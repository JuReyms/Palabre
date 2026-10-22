/** @file Contrôles purs du fork OpenCode 2.0.32 ; aucune IO, sélection implicite ou autorisation. */
import { isDeepStrictEqual as same } from "node:util";
import { parseAgentName, type ValidationResult } from "./envelope.js";
import type { RelayStatus, SessionRef } from "./types.js";

/** Relevé borné par le transport, puis validé avant toute utilisation. */
export interface OpenCodeSnapshot {
  info: Record<string, unknown>;
  export: unknown;
  context: Record<string, unknown>[];
  inbox: unknown[];
  instructions: unknown;
}

/** Erreur sans données de compte ni prose distante ; traduite par la commande. */
export class CopyFailure extends Error {
  constructor(readonly status: RelayStatus, readonly diagnostic: string) { super(diagnostic); }
}

/** Objet JSON simple ; ni null ni tableau. */
export function copyObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** ID OpenCode opaque : pas de normalisation de casse, pas d'usage comme chemin. */
export function isOpenCodeSessionId(value: unknown): value is string {
  return typeof value === "string" && /^ses_[A-Za-z0-9]{1,124}$/.test(value);
}

/** Parseur réservé à --copy ; les parseurs UUID et Mission restent stricts. */
export function parseOpenCodeRef(value: string): ValidationResult<SessionRef> {
  const index = value.indexOf(":");
  const agent = parseAgentName(value.slice(0, index));
  const sessionId = value.slice(index + 1);
  if (index < 1 || !agent.ok) return { ok: false, reason: "invalid-arguments" };
  return isOpenCodeSessionId(sessionId) ? { ok: true, value: { agent: agent.value, sessionId } }
    : { ok: false, reason: "invalid-session-id" };
}

/** Refuse au lieu de corriger/tronquer une structure API inconnue. */
export function readCopySnapshot(value: unknown): OpenCodeSnapshot {
  if (!copyObject(value) || !copyObject(value.info) || !copyObject(value.export)
    || !Array.isArray(value.context) || !value.context.every(copyObject) || !Array.isArray(value.inbox)
    || !Array.isArray(value.instructions)) throw new CopyFailure("no-valid-reply", "snapshot-schema");
  return value as unknown as OpenCodeSnapshot;
}

function nonblank(value: unknown): value is string { return typeof value === "string" && !!value.trim(); }
function completed(message: Record<string, unknown>): boolean {
  return copyObject(message.time) && typeof message.time.completed === "number" && Number.isFinite(message.time.completed);
}
function model(value: unknown): value is Record<string, unknown> {
  return copyObject(value) && nonblank(value.providerID) && nonblank(value.id)
    && (value.variant === undefined || nonblank(value.variant));
}

/** Les clés supplémentaires d'une notice non qualifiée ne sont jamais ignorées. */
function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return same(Object.keys(value).sort(), [...keys].sort());
}

/**
 * Seule notice système qualifiée pour le nouveau tour (OpenCode 2.0.32) : rafraîchissement
 * core/date. Texte entier, calendrier et jour de semaine vérifiés sans Date.parse ni dépendance
 * au fuseau/à l'horloge du lecteur. Ces métadonnées ne prouvent ni une origine ni une autorité.
 * La position, l'unicité et l'identifiant restent contrôlés par inspectCopyReply.
 */
function coreDateNotice(message: Record<string, unknown>): boolean {
  if (!exactKeys(message, ["id", "time", "type", "description", "metadata", "text"])
    || message.type !== "system" || message.description !== "Instructions updated: core/date"
    || !copyObject(message.metadata) || !exactKeys(message.metadata, ["notice", "instructionSources"])
    || message.metadata.notice !== "instructions" || !same(message.metadata.instructionSources, ["core/date"])
    || !copyObject(message.time) || !exactKeys(message.time, ["created"])
    || !Number.isSafeInteger(message.time.created) || (message.time.created as number) < 0
    || typeof message.text !== "string") return false;
  const match = /^Today's date is now: (Sun|Mon|Tue|Wed|Thu|Fri|Sat) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (0[1-9]|[12][0-9]|3[01]) ([0-9]{4})$/.exec(message.text);
  // `$` admet aussi une fin de ligne terminale en JavaScript : le texte doit être entier.
  if (!match || match[0] !== message.text) return false;
  const [, weekday, month, day, year] = match;
  const monthIndex = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].indexOf(month!);
  const date = new Date(0);
  date.setUTCFullYear(Number(year), monthIndex, Number(day));
  return date.getUTCFullYear() === Number(year) && date.getUTCMonth() === monthIndex
    && date.getUTCDate() === Number(day) && ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][date.getUTCDay()] === weekday;
}

/** Identifiant de modèle observé, variante comprise, jamais une sélection de remplacement. */
export function copyModelLabel(value: Record<string, unknown>): string {
  return `${value.providerID}/${value.id}${value.variant === undefined ? "" : `#${value.variant}`}`;
}

/** Source terminée et explicite ; l'égalité des dossiers canoniques appartient au contrôleur. */
export function validateCopySource(source: OpenCodeSnapshot, id: string): string {
  const { info, context } = source;
  if (info.id !== id) throw new CopyFailure("identity-mismatch", "source-identity");
  if (!copyObject(info.location) || !nonblank(info.location.directory)) throw new CopyFailure("invalid-request", "source-directory");
  if (!model(info.model) || !nonblank(info.agent)) throw new CopyFailure("target-state-unknown", "source-selection");
  if (info.outcome !== "succeeded" || !copyObject(info.time) || typeof info.time.idle !== "number" || source.inbox.length)
    throw new CopyFailure("target-state-unknown", "source-incomplete");
  const allowed = new Set(["agent-switched", "model-switched", "user", "assistant", "idle", "system"]);
  const ids = new Set<string>();
  for (const message of context) {
    if (!nonblank(message.id) || ids.has(message.id) || !allowed.has(String(message.type)) || message.error !== undefined)
      throw new CopyFailure("target-state-unknown", "source-context");
    ids.add(message.id);
  }
  const final = context.filter(m => m.type === "assistant").at(-1);
  if (!context.some(m => m.type === "user" && nonblank(m.text)) || context.at(-1)?.type !== "idle"
    || context.at(-1)?.outcome !== "succeeded" || !final || !completed(final) || final.finish !== "stop"
    || !Array.isArray(final.content) || !final.content.some(p => copyObject(p) && p.type === "text" && nonblank(p.text)))
    throw new CopyFailure("target-state-unknown", "source-incomplete");
  return info.location.directory;
}

/** Comparaison complète des relevés ; pas de suppression de champs potentiellement concurrents. */
export function sameCopySnapshot(a: OpenCodeSnapshot, b: OpenCodeSnapshot): boolean { return same(a, b); }

/** Copie exacte : seuls les ID de message réattribués sont exclus de la comparaison. */
export function validateCopyFork(source: OpenCodeSnapshot, copy: OpenCodeSnapshot, id: string): void {
  if (copy.info.id !== id || id === source.info.id || !copyObject(copy.info.fork) || copy.info.fork.sessionID !== source.info.id)
    throw new CopyFailure("identity-mismatch", "fork-identity");
  const normalize = (messages: Record<string, unknown>[]) => messages.map(({ id: _id, ...rest }) => rest);
  if (!same(normalize(source.context), normalize(copy.context)) || !same(source.instructions, copy.instructions)
    || !same(source.info.location, copy.info.location) || !same(source.info.agent, copy.info.agent)
    || !same(source.info.model, copy.info.model) || !same(source.info.permissions, copy.info.permissions) || copy.inbox.length)
    throw new CopyFailure("no-valid-reply", "fork-content");
  const ids = copy.context.map(m => m.id);
  if (ids.some(id => !nonblank(id)) || new Set(ids).size !== ids.length)
    throw new CopyFailure("no-valid-reply", "fork-context-ids");
}

/** Preuve positive seulement : message utilisateur exact dans la copie identifiée. */
export function copyMessagePersisted(after: OpenCodeSnapshot, id: string, prompt: string): boolean {
  return after.info.id === id && after.context.some(m => m.type === "user" && m.text === prompt);
}

/** Le flux client ne suffit pas à prouver la réponse, mais une contradiction interdit le succès. */
export function inspectCopyClient(stdout: string, id: string): void {
  const allowed = new Set(["step_start", "step_finish", "tool_use", "text", "reasoning"]);
  let count = 0;
  for (const line of stdout.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let event: unknown;
    try { event = JSON.parse(line); } catch { throw new CopyFailure("no-valid-reply", "client-schema"); }
    if (!copyObject(event)) throw new CopyFailure("no-valid-reply", "client-schema");
    if (typeof event.sessionID === "string" && event.sessionID && event.sessionID !== id)
      throw new CopyFailure("identity-mismatch", "client-identity");
    if (event.type === "error" || event.error !== undefined || (copyObject(event.part)
      && copyObject(event.part.state) && event.part.state.status === "error")) throw new CopyFailure("cli-failure", "client-error");
    if (event.sessionID !== id || !allowed.has(String(event.type))) throw new CopyFailure("no-valid-reply", "client-schema");
    count++;
  }
  if (!count) throw new CopyFailure("no-valid-reply", "client-empty");
}

/**
 * Un seul nouveau tour terminé, relié à l'enveloppe intégrale et au préfixe vérifié.
 * Une seule notice core/date strictement qualifiée est admise avant l'utilisateur ;
 * elle ne relâche aucun contrôle de sélection, d'instructions, d'outils ou de fin de tour.
 */
export function inspectCopyReply(before: OpenCodeSnapshot, after: OpenCodeSnapshot, prompt: string): { reply: string; observedModels: string[] } {
  if (after.info.id !== before.info.id) throw new CopyFailure("identity-mismatch", "reply-identity");
  if (!same(after.context.slice(0, before.context.length), before.context)) throw new CopyFailure("no-valid-reply", "context-changed");
  for (const key of ["agent", "model", "permissions", "location"]) {
    if (!same(before.info[key], after.info[key])) throw new CopyFailure("no-valid-reply", "selection-changed");
  }
  if (!same(before.instructions, after.instructions) || after.inbox.length) throw new CopyFailure("no-valid-reply", "instructions-or-inbox");
  const fresh = after.context.slice(before.context.length);
  const users = fresh.filter(m => m.type === "user");
  if (users.length !== 1 || users[0]!.text !== prompt) throw new CopyFailure("no-valid-reply", "message-correlation");
  if (["files", "agents", "skills"].some(key => users[0]![key] !== undefined
    && (!Array.isArray(users[0]![key]) || (users[0]![key] as unknown[]).length)))
    throw new CopyFailure("no-valid-reply", "message-attachments");
  const userIndex = fresh.indexOf(users[0]!);
  const allowed = new Set(["agent-switched", "model-switched", "user", "assistant", "idle", "system"]);
  const ids = new Set(before.context.map(m => m.id));
  const models: string[] = [];
  const assistants: Record<string, unknown>[] = [];
  let dateNoticeSeen = false;
  for (const [index, message] of fresh.entries()) {
    if (!nonblank(message.id) || ids.has(message.id) || !allowed.has(String(message.type)) || message.error !== undefined)
      throw new CopyFailure("no-valid-reply", "turn-schema");
    ids.add(message.id);
    if (message.type === "system") {
      if (dateNoticeSeen || index >= userIndex || !coreDateNotice(message)) throw new CopyFailure("no-valid-reply", "turn-schema");
      dateNoticeSeen = true;
      continue;
    }
    if ((message.type === "agent-switched" && message.agent !== before.info.agent)
      || (message.type === "model-switched" && !same(message.model, before.info.model)))
      throw new CopyFailure("no-valid-reply", "selection-changed");
    if (message.type !== "assistant") continue;
    if (index < userIndex || message.agent !== before.info.agent || !model(message.model)
      || !same(message.model, before.info.model) || !completed(message) || !Array.isArray(message.content)
      || !["stop", "tool-calls"].includes(String(message.finish))) throw new CopyFailure("no-valid-reply", "assistant-incomplete");
    for (const part of message.content) {
      if (!copyObject(part) || !["text", "reasoning", "tool"].includes(String(part.type))
        || (part.type !== "tool" && typeof part.text !== "string")
        || (part.type === "tool" && (!copyObject(part.state) || part.state.status !== "completed")))
        throw new CopyFailure("no-valid-reply", "tool-or-content");
    }
    assistants.push(message); models.push(copyModelLabel(message.model));
  }
  const final = assistants.at(-1), idle = fresh.at(-1);
  if (!final || final.finish !== "stop" || idle?.type !== "idle" || idle.outcome !== "succeeded"
    || fresh.filter(m => m.type === "idle").length !== 1 || fresh.indexOf(final) > fresh.length - 2)
    throw new CopyFailure("no-valid-reply", "turn-incomplete");
  const reply = (final.content as Record<string, unknown>[]).filter(p => p.type === "text").map(p => p.text as string).join("\n");
  if (!reply.trim()) throw new CopyFailure("no-valid-reply", "empty-reply");
  return { reply, observedModels: [...new Set(models)] };
}
