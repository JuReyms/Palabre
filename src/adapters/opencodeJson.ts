/**
 * @file Lecture stricte de `opencode run --format json`, de `opencode session export <id>` et de la
 * référence opaque de lecture (OpenCode 2.0.32 qualifié ; projections 2.2.3 vérifiées sur sources/tests). Fonctions pures, sans I/O ni autorité :
 * les textes rendus restent des données non fiables.
 * Les projections restent liées au même message/type. Mélanges de textes live/projetés, trous
 * d’ordinal et message nouveau seulement projeté après du live restent refusés prudemment.
 * Cette prise en charge sur sources/tests ne constitue pas une qualification réelle complète 2.2.3.
 *
 * `run` : chaque ligne est un événement JSON avec `type` et un `sessionID` valide ; `part.sessionID`,
 * `part.messageID` et `part.id`, s'ils existent, doivent être cohérents et bien formés. La réponse
 * est le texte du dernier message assistant annoncé (y compris par un `step_start`) : un nouveau pas
 * sans texte ne laisse jamais passer un ancien texte. Raisonnement et outils ne deviennent jamais une
 * réponse ; un événement `error`, une ligne non qualifiée ou deux sessions refusent la sortie entière.
 *
 * Export `{ info, messages }` : réponse acceptée seulement pour la session exacte, le même dossier,
 * le modèle lié à la référence, un seul message utilisateur en tête dont le SHA-256 du texte est celui
 * de la demande, le dernier message assistant observé présent, un dernier `idle` `succeeded`,
 * `info.outcome` `succeeded`, sans erreur, et un assistant final `finish: stop`, `time.completed`
 * valide, au texte assaini non vide. Les messages `system` d'instructions sont tolérés ; toute autre
 * forme est refusée. Jamais la dernière session, ni une autre réponse.
 */
import { createHash } from "node:crypto";
import path from "node:path";
import { cleanTerminalOutput } from "./terminal.js";
import type { ConfigIdentity } from "../types.js";

/** Identifiant de session OpenCode observé. */
export const OPENCODE_SESSION_ID = /^ses_[A-Za-z0-9]{8,80}$/;
/** Identifiant de message OpenCode observé (assistant dans la sortie `run`). */
export const OPENCODE_MESSAGE_ID = /^msg_[A-Za-z0-9]{8,80}$/;
const OPENCODE_PART_ID = /^prt_[A-Za-z0-9]{8,80}$/;
/** Empreinte SHA-256 hexadécimale minuscule. */
export const SHA256_HEX = /^[0-9a-f]{64}$/;
/** Alias d'agent accepté dans une référence. */
export const SAFE_AGENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const MAX_OBSERVED_LINE = 1_048_576;
const CONTROL = /[\p{Cc}\p{Cf}\u2028\u2029]/u;
const REFERENCE_TEXT = /^[A-Za-z0-9_-]{16,8192}$/;
const REFERENCE_KEYS = ["agent", "command", "config", "cwd", "lastMessage", "model", "requestSha256", "session", "v"].join();

type JsonObject = Record<string, unknown>;
const isObject = (value: unknown): value is JsonObject => typeof value === "object" && value !== null && !Array.isArray(value);
const safeText = (value: unknown, max: number): value is string => typeof value === "string" && value.length > 0 && value.length <= max && !CONTROL.test(value);
const isAbsolutePath = (value: string) => path.isAbsolute(value) || path.win32.isAbsolute(value);

/** Empreinte SHA-256 du texte UTF-8 exact, sans normalisation des fins de ligne. */
export function sha256Hex(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** Raisons stables d'un refus de sortie `run` ; aucun repli texte. */
export type OpenCodeOutputReason = "not-json" | "invalid-event" | "error-event" | "session-conflict" | "no-session";

/** Refus d'une sortie `run` non qualifiée. */
export class OpenCodeOutputError extends Error {
  constructor(readonly reason: OpenCodeOutputReason) {
    super(reason);
    this.name = "OpenCodeOutputError";
  }
}

interface RunEvent { sessionId: string; messageId: string; projected: boolean; text?: string; projectedTextOrdinal?: number }
const RUN_PART_TYPES: Readonly<Record<string, string>> = {
  step_start: "step-start", step_finish: "step-finish", tool_use: "tool", text: "text", reasoning: "reasoning"
};

/** Suffixe projeté v2.2.3 lié au même message ; jamais un identifiant opaque élargi. */
function projectedPartSuffix(id: unknown, messageID: string): string | undefined {
  const prefix = "prt_" + messageID.slice(4) + "_";
  return typeof id === "string" && id.startsWith(prefix) ? id.slice(prefix.length) : undefined;
}

/** Formats officiels de reconcile v2.2.3 : type exact, ordinal canonique ou même appel d'outil. */
function validRunPartID(id: unknown, type: string, messageID: string, toolID?: unknown): boolean {
  if (typeof id !== "string") return false;
  if (OPENCODE_PART_ID.test(id)) return true;
  const suffix = projectedPartSuffix(id, messageID);
  if (suffix === undefined) return false;
  if (type === "step_start") return suffix === "step-start";
  if (type === "step_finish") return suffix === "step-finish";
  if (type === "tool_use") return typeof toolID === "string" && suffix === "tool-" + toolID;
  const ordinal = suffix.match(/^(text|reasoning)-(0|[1-9]\d{0,15})$/);
  return ordinal?.[1] === type && Number.isSafeInteger(Number(ordinal[2]));
}

/** Valide une ligne d'événement `run` ; lève `OpenCodeOutputError` pour toute forme non qualifiée. */
function readRunEvent(line: string): RunEvent {
  let value: unknown;
  try { value = JSON.parse(line); } catch { throw new OpenCodeOutputError("not-json"); }
  if (!isObject(value) || typeof value.type !== "string" || !value.type) throw new OpenCodeOutputError("invalid-event");
  if (value.type === "error") throw new OpenCodeOutputError("error-event");
  if (!Object.hasOwn(RUN_PART_TYPES, value.type)) throw new OpenCodeOutputError("invalid-event");
  const sessionId = value.sessionID;
  if (typeof sessionId !== "string" || !OPENCODE_SESSION_ID.test(sessionId)) throw new OpenCodeOutputError("invalid-event");
  const part = value.part;
  if (!isObject(part) || part.type !== RUN_PART_TYPES[value.type]) throw new OpenCodeOutputError("invalid-event");
  if (part.sessionID !== undefined && part.sessionID !== sessionId) throw new OpenCodeOutputError("session-conflict");
  const messageId = part.messageID;
  if (typeof messageId !== "string" || !OPENCODE_MESSAGE_ID.test(messageId)) throw new OpenCodeOutputError("invalid-event");
  // tool_use.id est l'appel opaque ; partID est sa part. Les projections doivent lier les deux.
  if (value.type === "tool_use") {
    if (!safeText(part.id, 4096) || !validRunPartID(part.partID, value.type, messageId, part.id)) throw new OpenCodeOutputError("invalid-event");
  } else if (part.id !== undefined && !validRunPartID(part.id, value.type, messageId)) throw new OpenCodeOutputError("invalid-event");
  const projected = projectedPartSuffix(value.type === "tool_use" ? part.partID : part.id, messageId) !== undefined;
  if (value.type === "text") {
    if (part.type !== "text" || typeof part.text !== "string") throw new OpenCodeOutputError("invalid-event");
    const suffix = projectedPartSuffix(part.id, messageId);
    return { sessionId, messageId, projected, text: part.text,
      ...(suffix === undefined ? {} : { projectedTextOrdinal: Number(suffix.slice("text-".length)) }) };
  }
  return { sessionId, messageId, projected };
}

/**
 * Observe pendant l'appel la session et le dernier message assistant annoncés par les événements
 * structurés. UTF-8 strict entre fragments ; une ligne non qualifiée, une erreur, deux sessions ou une
 * ligne géante invalident définitivement la référence : rien n'est alors proposé.
 */
export class OpenCodeSessionObserver {
  private sequence = newRunSequence();
  private sessionId?: string;
  private invalid = false;
  private buffer = "";
  private readonly decoder = new TextDecoder("utf-8", { fatal: true });

  /** Ajoute un fragment de stdout ; une ligne incomplète attend le fragment suivant. */
  feed(chunk: Buffer): void {
    if (this.invalid) return;
    try { this.buffer += this.decoder.decode(chunk, { stream: true }); }
    catch { this.invalidate(); return; }
    let index = this.buffer.indexOf("\n");
    while (index >= 0) {
      const line = this.buffer.slice(0, index);
      this.buffer = this.buffer.slice(index + 1);
      if (line.length > MAX_OBSERVED_LINE) { this.invalidate(); return; }
      if (line.trim()) this.observe(line);
      if (this.invalid) return;
      index = this.buffer.indexOf("\n");
    }
    if (this.buffer.length > MAX_OBSERVED_LINE) this.invalidate();
  }

  /** Session et dernier message observés, ou `undefined` dès la moindre forme non qualifiée. */
  reference(): { session: string; lastMessage: string } | undefined {
    try { this.buffer += this.decoder.decode(); }
    catch { this.invalidate(); }
    if (this.buffer.trim()) this.invalidate();
    return !this.invalid && this.sessionId && this.sequence.lastMessage ? { session: this.sessionId, lastMessage: this.sequence.lastMessage } : undefined;
  }

  private observe(line: string): void {
    try {
      const event = readRunEvent(line);
      if (this.sessionId !== undefined && this.sessionId !== event.sessionId) throw new OpenCodeOutputError("session-conflict");
      this.sessionId = event.sessionId;
      observeRunSequence(this.sequence, event);
    } catch {
      this.invalidate();
    }
  }

  private invalidate(): void {
    this.invalid = true;
    this.sequence = newRunSequence();
    this.buffer = "";
    this.sessionId = undefined;
  }
}

/** Parts `text` jointes par une ligne vide ; raisonnement, outils et autres parts exclus. */
function textOf(parts: readonly unknown[]): string {
  return parts
    .filter((part): part is JsonObject => isObject(part) && part.type === "text" && typeof part.text === "string")
    .map((part) => part.text as string)
    .join("\n\n");
}

/** Ordre observé et origine des blocs : aucune reconstruction mixte ambiguë n'est acceptée. */
interface RunSequence {
  seen: Set<string>;
  live: boolean;
  lastMessage?: string;
  texts: Map<string, { projected: boolean; count: number }>;
}

/** État local borné par la sortie de l'appel, sans texte conservé par l'observateur. */
function newRunSequence(): RunSequence { return { seen: new Set(), live: false, texts: new Map() }; }

/**
 * Partagé par observateur et lecteur. Un message connu ne redevient jamais le dernier ; un message
 * seulement projeté après d'autres messages live est ambigu. Les textes live/projetés d'un même
 * message ne sont pas fusionnés : leur correspondance d'ordinal n'est pas prouvée par les IDs live.
 */
function observeRunSequence(state: RunSequence, event: RunEvent): number | undefined {
  if (!state.seen.has(event.messageId)) {
    if (event.projected && state.live) throw new OpenCodeOutputError("invalid-event");
    state.seen.add(event.messageId);
    state.lastMessage = event.messageId;
  }
  if (!event.projected) state.live = true;
  if (event.text === undefined) return undefined;
  const previous = state.texts.get(event.messageId);
  if (previous && previous.projected !== event.projected) throw new OpenCodeOutputError("invalid-event");
  const count = previous?.count ?? 0;
  const index = event.projectedTextOrdinal ?? count;
  if (index !== count) throw new OpenCodeOutputError("invalid-event");
  state.texts.set(event.messageId, { projected: event.projected, count: count + 1 });
  return index;
}

/** Analyse la sortie complète d'un `run` terminé avec le code 0 ; texte brut, assaini par l'appelant. */
export function parseOpenCodeRunOutput(stdout: string): { sessionId: string; lastMessage?: string; content: string } {
  let sessionId: string | undefined;
  const sequence = newRunSequence();
  const texts = new Map<string, string[]>();
  for (const line of stdout.split("\n")) {
    if (!line.trim()) continue;
    const event = readRunEvent(line);
    if (sessionId !== undefined && sessionId !== event.sessionId) throw new OpenCodeOutputError("session-conflict");
    sessionId = event.sessionId;
    const index = observeRunSequence(sequence, event);
    if (event.text !== undefined) {
      const parts = texts.get(event.messageId) ?? [];
      if (index !== parts.length) throw new OpenCodeOutputError("invalid-event");
      parts.push(event.text);
      texts.set(event.messageId, parts);
    }
  }
  if (sessionId === undefined) throw new OpenCodeOutputError("no-session");
  const lastMessage = sequence.lastMessage;
  return { sessionId, ...(lastMessage ? { lastMessage } : {}), content: lastMessage ? (texts.get(lastMessage) ?? []).join("\n\n") : "" };
}

/**
 * Référence opaque d'une demande expirée : configuration approuvée exacte, agent et commande, dossier,
 * session et dernier message observés, empreinte du prompt, modèle demandé (`null` sans modèle
 * explicite). Le prompt n'y figure jamais. Aucun registre : l'agent la conserve.
 */
export interface OpenCodeRecoveryReference {
  v: 1;
  agent: string;
  command: string;
  config: ConfigIdentity;
  cwd: string;
  session: string;
  lastMessage: string;
  requestSha256: string;
  model: string | null;
}

/** Encode en base64url canonique ; `undefined` si une valeur ne passerait pas la validation. */
export function encodeRecoveryReference(reference: OpenCodeRecoveryReference): string | undefined {
  const ordered = {
    v: 1, agent: reference.agent, command: reference.command, config: { path: reference.config.path, sha256: reference.config.sha256 },
    cwd: reference.cwd, session: reference.session, lastMessage: reference.lastMessage, requestSha256: reference.requestSha256, model: reference.model
  };
  const encoded = Buffer.from(JSON.stringify(ordered), "utf8").toString("base64url");
  return decodeRecoveryReference(encoded) ? encoded : undefined;
}

/** Décode et valide strictement une référence (clés exactes, bornes, formats) ; sinon `undefined`. */
export function decodeRecoveryReference(text: string): OpenCodeRecoveryReference | undefined {
  if (!REFERENCE_TEXT.test(text)) return undefined;
  const bytes = Buffer.from(text, "base64url");
  if (bytes.toString("base64url") !== text) return undefined;
  let value: unknown;
  try { value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); } catch { return undefined; }
  if (!isObject(value) || Object.keys(value).sort().join() !== REFERENCE_KEYS) return undefined;
  const config = value.config;
  if (!isObject(config) || Object.keys(config).sort().join() !== "path,sha256") return undefined;
  const valid = value.v === 1
    && typeof value.agent === "string" && SAFE_AGENT.test(value.agent)
    && safeText(value.command, 4096)
    && safeText(config.path, 4096) && isAbsolutePath(config.path)
    && typeof config.sha256 === "string" && SHA256_HEX.test(config.sha256)
    && safeText(value.cwd, 4096) && isAbsolutePath(value.cwd)
    && typeof value.session === "string" && OPENCODE_SESSION_ID.test(value.session)
    && typeof value.lastMessage === "string" && OPENCODE_MESSAGE_ID.test(value.lastMessage)
    && typeof value.requestSha256 === "string" && SHA256_HEX.test(value.requestSha256)
    && (value.model === null || safeText(value.model, 200));
  return valid ? value as unknown as OpenCodeRecoveryReference : undefined;
}

/** Champs de la référence utiles à l'évaluation d'un export. */
export type OpenCodeRequestReference = Pick<OpenCodeRecoveryReference, "session" | "lastMessage" | "requestSha256" | "cwd" | "model">;

/** Verdict de lecture ; seul `replied` porte une réponse. */
export type OpenCodeExportVerdict =
  | { status: "replied"; reply: string }
  | { status: "pending" }
  | { status: "not-succeeded"; reason: "outcome" | "not-stopped" | "empty-text" | "error" | "incomplete"; outcome?: string }
  | { status: "mismatch"; reason: "session" | "cwd" | "model" | "request" | "ambiguous" | "message" }
  | { status: "unreadable"; reason: "unknown-format" };

const MESSAGE_TYPES = new Set(["user", "assistant", "idle", "system"]);

function samePath(a: string, b: string): boolean {
  const normalize = (value: string) => {
    const resolved = path.resolve(value);
    return process.platform === "win32" ? resolved.toLowerCase() : resolved;
  };
  return normalize(a) === normalize(b);
}

function sameModel(value: unknown, expected: string): boolean {
  if (!isObject(value)) return false;
  const [base = "", variant] = expected.split("#", 2);
  const slash = base.indexOf("/");
  const provider = slash >= 0 ? base.slice(0, slash) : undefined;
  const id = slash >= 0 ? base.slice(slash + 1) : base;
  return value.id === id && (provider === undefined || value.providerID === provider) && (variant === undefined || value.variant === variant);
}

const qualifiedMessage = (message: unknown): message is JsonObject => isObject(message) && typeof message.type === "string"
  && MESSAGE_TYPES.has(message.type) && (message.type !== "system" || (isObject(message.metadata) && message.metadata.notice === "instructions"));

const outcomeLabel = (value: unknown) => typeof value === "string" && /^[a-z][a-z-]{0,31}$/.test(value) ? value : "unknown";

/** Évalue un export contre la référence exacte de la demande, sans choisir d'autre réponse. */
export function evaluateOpenCodeExport(value: unknown, expected: OpenCodeRequestReference): OpenCodeExportVerdict {
  const unknownFormat: OpenCodeExportVerdict = { status: "unreadable", reason: "unknown-format" };
  if (!isObject(value) || !isObject(value.info) || !Array.isArray(value.messages)) return unknownFormat;
  const info = value.info;
  const messages: unknown[] = value.messages;
  if (info.id !== expected.session) return { status: "mismatch", reason: "session" };
  const directory = isObject(info.location) ? info.location.directory : undefined;
  if (typeof directory !== "string" || !samePath(directory, expected.cwd)) return { status: "mismatch", reason: "cwd" };
  if (expected.model !== null && !sameModel(info.model, expected.model)) return { status: "mismatch", reason: "model" };
  if (!messages.every(qualifiedMessage)) return unknownFormat;
  const typed = messages as JsonObject[];
  const users = typed.filter((message) => message.type === "user");
  if (users.length > 1) return { status: "mismatch", reason: "ambiguous" };
  const user = users[0];
  if (!user) return { status: "mismatch", reason: "request" };
  if (typed[0] !== user) return unknownFormat;
  const requestText = user.text;
  if (typeof requestText !== "string" || sha256Hex(requestText) !== expected.requestSha256) return { status: "mismatch", reason: "request" };
  const observed = typed.find((message) => message.id === expected.lastMessage);
  if (!observed || observed.type !== "assistant") return { status: "mismatch", reason: "message" };
  const last = typed[typed.length - 1]!;
  if (last.type !== "idle") return { status: "pending" };
  if (last.outcome !== "succeeded") return { status: "not-succeeded", reason: "outcome", outcome: outcomeLabel(last.outcome) };
  if (info.error !== undefined) return { status: "not-succeeded", reason: "error" };
  if (info.outcome !== "succeeded") {
    return typeof info.outcome === "string" ? { status: "not-succeeded", reason: "outcome", outcome: outcomeLabel(info.outcome) } : unknownFormat;
  }
  const final = [...typed].reverse().find((message) => message.type === "assistant")!;
  if (expected.model !== null && !sameModel(final.model, expected.model)) return { status: "mismatch", reason: "model" };
  if (final.error !== undefined) return { status: "not-succeeded", reason: "error" };
  if (final.finish !== "stop") return { status: "not-succeeded", reason: "not-stopped" };
  const time = final.time;
  if (!isObject(time) || typeof time.completed !== "number" || !Number.isFinite(time.completed) || time.completed <= 0) {
    return { status: "not-succeeded", reason: "incomplete" };
  }
  const content = final.content;
  if (!Array.isArray(content)) return unknownFormat;
  const reply = cleanTerminalOutput(textOf(content));
  return reply ? { status: "replied", reply } : { status: "not-succeeded", reason: "empty-text" };
}
