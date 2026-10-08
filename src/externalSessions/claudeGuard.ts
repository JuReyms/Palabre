/**
 * @file Relay B2.2 : garde d'envoi du messager Claude, hôte de permissions de `claude -p`
 * (`--permission-prompt-tool mcp__palabre_guard__decide`). Voir `scripts/prototypes/relay/CONTRAT-B2.md`.
 *
 * Le garde est un serveur MCP stdio minimal, lancé par la CLI avec l'interpréteur Node courant
 * (`claudeGuardServer.ts`). Il lit dans le dossier privé de la tentative l'état écrit par Palabre
 * (`guard.json` : nom, UUID et `pid` attendus, enveloppe exacte) et décide de chaque demande :
 * - seul `SendMessage` peut être autorisé ; tout autre outil est refusé ;
 * - avant d'autoriser, le registre est relu : même nom, même UUID, même `pid` ;
 * - l'échéance, la validité de la tentative et l'annulation sont revérifiées après toute attente ;
 * - la réservation crée **de façon exclusive** le fichier `reserved` : un seul envoi, même pour des
 *   demandes parallèles ou plusieurs processus ;
 * - l'autorisation impose `updatedInput = { to, message }` exacts ; le texte proposé par le modèle
 *   n'est jamais transmis ;
 * - toute erreur donne un refus. Chaque décision est ajoutée à `consulted.jsonl` (diagnostic :
 *   garde chargé ne veut pas dire garde consulté).
 *
 * Format des demandes et des réponses de l'outil de permission : `{ tool_name, input, tool_use_id? }`
 * puis un texte JSON `{ behavior: "allow", updatedInput }` ou `{ behavior: "deny", message }`,
 * d'après la documentation publique ; il reste à vérifier sur la vraie CLI (lot B2.3).
 */
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, closeSync, openSync, readFileSync, unlinkSync, writeFileSync, writeSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline";
import type { Readable, Writable } from "node:stream";
import { CLAUDE_OPEN_LIMITS, GUARD_TOOL_NAME, isSameRegistryTarget, parseClaudeRegistry, type ClaudeRegistryEntry } from "./claudeOpen.js";
import { isSessionId } from "./envelope.js";
import { cleanExternalEnv } from "./process.js";

/** Fichiers du dossier privé de la tentative. */
export const GUARD_FILES = { state: "guard.json", active: "active", reserved: "reserved", allowed: "allowed", consulted: "consulted.jsonl" } as const;

/** État écrit par Palabre avant le lancement du messager. */
export interface GuardState {
  v: 1;
  sessionId: string;
  name: string;
  pid: number;
  envelope: string;
  envelopeSha256: string;
  /** Échéance absolue en millisecondes Unix, partagée entre les processus. */
  expiresAt: number;
  /** Exécutable résolu (D21) pour relire le registre, sans shell. */
  executable: { command: string; prefixArgs: string[] };
}

/** Décision rendue à la CLI, avec une raison courte pour le diagnostic. */
export type GuardDecision =
  | { behavior: "allow"; updatedInput: { to: string; message: string }; reason: "allowed" }
  | { behavior: "deny"; message: string; reason: string };

/** Dépendances de la décision, injectables pour les tests. */
export interface GuardDeps {
  /** Registre relu juste avant d'autoriser ; `undefined` s'il est invérifiable. */
  registry: (state: GuardState, options: { timeoutMs: number; signal?: AbortSignal }) => Promise<ClaudeRegistryEntry[] | undefined>;
  /** Horloge Unix pour l'échéance partagée. */
  now: () => number;
  /** Marqueur de tentative encore active ; absence ou erreur de lecture donne `false`. */
  isActive: () => boolean;
  /** Crée `reserved` de façon exclusive : `false` s'il existe déjà, même sans autorisation. */
  claimAllow: () => boolean;
}

const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

/** Empreinte de l'enveloppe, enregistrée dans l'état et revérifiée par le garde. */
export function envelopeDigest(envelope: string): string {
  return sha256(envelope);
}

/** État valide seulement si toutes ses valeurs ont la forme attendue et l'empreinte correspond. */
export function parseGuardState(text: string): GuardState | undefined {
  let value: unknown;
  try { value = JSON.parse(text); } catch { return undefined; }
  if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
  const state = value as Partial<GuardState>;
  const executable = state.executable;
  if (state.v !== 1 || typeof state.sessionId !== "string" || !isSessionId(state.sessionId)
    || typeof state.name !== "string" || state.name === "" || typeof state.pid !== "number" || !Number.isSafeInteger(state.pid) || state.pid <= 0
    || typeof state.envelope !== "string" || state.envelope === "" || state.envelopeSha256 !== sha256(state.envelope)
    || typeof state.expiresAt !== "number" || !Number.isSafeInteger(state.expiresAt) || state.expiresAt <= 0
    || !executable || typeof executable.command !== "string" || !Array.isArray(executable.prefixArgs)
    || !executable.prefixArgs.every((arg) => typeof arg === "string")) return undefined;
  return state as GuardState;
}

const deny = (reason: string, message = "Refusé par Palabre : seul l'envoi prévu est autorisé, une seule fois."): GuardDecision =>
  ({ behavior: "deny", message, reason });

/**
 * Décide d'une demande de permission. Aucune exception ne s'échappe : toute erreur donne un refus.
 * L'ordre est fixe : outil, état, validité, registre, validité, réservation exclusive, validité.
 * Une réservation devenue tardive reste consommée, mais ne rend jamais `allow`.
 */
export async function decideGuard(request: unknown, state: GuardState | undefined, deps: GuardDeps, signal?: AbortSignal): Promise<GuardDecision> {
  try {
    const record = request !== null && typeof request === "object" && !Array.isArray(request) ? request as Record<string, unknown> : undefined;
    if (record?.tool_name !== "SendMessage") return deny("tool-not-allowed");
    if (!state) return deny("invalid-state");
    const invalidated = () => signal?.aborted ? deny("cancelled")
      : deps.now() >= state.expiresAt ? deny("expired") : !deps.isActive() ? deny("inactive") : undefined;
    const before = invalidated();
    if (before) return before;
    const entries = await deps.registry(state, {
      timeoutMs: Math.min(CLAUDE_OPEN_LIMITS.probeTimeoutMs, Math.max(1, state.expiresAt - deps.now())), signal
    });
    const after = invalidated();
    if (after) return after;
    if (!isSameRegistryTarget(entries, state)) return deny("target-changed");
    if (!deps.claimAllow()) return deny("already-allowed");
    const beforeAllow = invalidated();
    if (beforeAllow) return beforeAllow;
    return { behavior: "allow", updatedInput: { to: state.name, message: state.envelope }, reason: "allowed" };
  } catch {
    return deny("guard-error");
  }
}

/** Relit le registre sans shell, au plus pendant le budget restant, interrompable par MCP. */
export function readRegistryWith(state: GuardState, options: { timeoutMs: number; signal?: AbortSignal }): Promise<ClaudeRegistryEntry[] | undefined> {
  return new Promise((resolve) => {
    execFile(state.executable.command, [...state.executable.prefixArgs, "agents", "--json"], {
      env: cleanExternalEnv(process.env),
      timeout: options.timeoutMs,
      signal: options.signal,
      maxBuffer: CLAUDE_OPEN_LIMITS.probeOutputBytes,
      windowsHide: true,
      shell: false
    }, (error, stdout) => resolve(error ? undefined : parseClaudeRegistry(stdout)));
  });
}

/** Retire la validité partagée ; un échec est signalé, jamais une preuve de non-délivrance. */
export function revokeGuardIn(stateDir: string): boolean {
  try { unlinkSync(path.join(stateDir, GUARD_FILES.active)); return true; }
  catch (error) { return (error as NodeJS.ErrnoException).code === "ENOENT"; }
}

/** Réservation exclusive de l'unique envoi ; distincte du diagnostic d'autorisation `allowed`. */
export function claimAllowIn(stateDir: string): boolean {
  let fd: number;
  try {
    fd = openSync(path.join(stateDir, GUARD_FILES.reserved), "wx");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") return false;
    throw error;
  }
  try { writeSync(fd, `${new Date().toISOString()}\n`); } finally { closeSync(fd); }
  return true;
}

const TOOL_DESCRIPTION = "Hôte de permissions de Palabre : autorise au plus un SendMessage vers la cible prévue.";
const INPUT_SCHEMA = {
  type: "object",
  properties: { tool_name: { type: "string" }, input: { type: "object" }, tool_use_id: { type: "string" } },
  required: ["tool_name", "input"]
};

/**
 * Serveur MCP stdio (JSON-RPC 2.0, une ligne par message) : `initialize`, `ping`, `tools/list` et
 * `tools/call` pour l'outil `decide`. Les demandes sont traitées une à une ; la réservation reste
 * exclusive entre processus. Une notification d'annulation invalide immédiatement la demande,
 * même en attente dans la file. Une déconnexion invalide toutes les décisions encore en attente.
 */
export async function serveGuard(input: Readable, output: Writable, stateDir: string, deps?: GuardDeps): Promise<void> {
  let state: GuardState | undefined;
  try { state = parseGuardState(readFileSync(path.join(stateDir, GUARD_FILES.state), "utf8")); } catch { state = undefined; }
  const effective: GuardDeps = deps ?? {
    registry: readRegistryWith, claimAllow: () => claimAllowIn(stateDir), now: Date.now,
    isActive: () => { try { return readFileSync(path.join(stateDir, GUARD_FILES.active), "utf8") === "active\n"; } catch { return false; } }
  };
  const pending = new Map<string | number, AbortController>();
  const lines = createInterface({ input, crlfDelay: Infinity });
  let disconnected = false;
  const disconnect = () => {
    disconnected = true;
    for (const controller of pending.values()) controller.abort();
    lines.close();
  };
  input.on("end", disconnect);
  input.on("close", disconnect);
  input.on("error", disconnect);
  output.on("close", disconnect);
  output.on("error", disconnect);
  const send = (message: unknown) => { if (!disconnected) output.write(`${JSON.stringify(message)}\n`); };
  let queue = Promise.resolve();
  try {
    for await (const line of lines) {
      let message: Record<string, unknown> | undefined;
      try {
        const value: unknown = JSON.parse(line);
        message = value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
      } catch { message = undefined; }
      if (!message || typeof message.method !== "string") continue;
      const { id, method } = message;
      const params = message.params !== null && typeof message.params === "object" && !Array.isArray(message.params)
        ? message.params as Record<string, unknown> : {};
      if (method === "notifications/cancelled") {
        const cancelledId = params.requestId;
        if (typeof cancelledId === "string" || typeof cancelledId === "number") pending.get(cancelledId)?.abort();
        continue;
      }
      if (typeof id !== "string" && typeof id !== "number") continue;
      // Ne pas remplacer une demande en cours : son annulation doit rester adressable.
      if (pending.has(id)) continue;
      const controller = new AbortController();
      pending.set(id, controller);
      if (disconnected) controller.abort();
      queue = queue.then(async () => {
        try {
          if (method === "initialize") {
            send({ jsonrpc: "2.0", id, result: { protocolVersion: typeof params.protocolVersion === "string" ? params.protocolVersion : "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "palabre-guard", version: "1" } } });
          } else if (method === "ping") {
            send({ jsonrpc: "2.0", id, result: {} });
          } else if (method === "tools/list") {
            send({ jsonrpc: "2.0", id, result: { tools: [{ name: GUARD_TOOL_NAME, description: TOOL_DESCRIPTION, inputSchema: INPUT_SCHEMA }] } });
          } else if (method === "tools/call") {
            let decision = params.name === GUARD_TOOL_NAME ? await decideGuard(params.arguments, state, effective, controller.signal) : deny("unknown-tool");
            // Une réservation devenue tardive reste consommée, sans faux sendAllowed:true.
            if (decision.behavior === "allow") {
              try { writeFileSync(path.join(stateDir, GUARD_FILES.allowed), "allowed\n", { flag: "wx" }); }
              catch { decision = deny("guard-error"); }
            }
            try { appendFileSync(path.join(stateDir, GUARD_FILES.consulted), `${JSON.stringify({ decision: decision.behavior, reason: decision.reason })}\n`); } catch { /* diagnostic seulement */ }
            const { reason: _reason, ...answer } = decision;
            if (!controller.signal.aborted) send({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(answer) }] } });
          } else {
            send({ jsonrpc: "2.0", id, error: { code: -32601, message: "Method not found" } });
          }
        } finally { pending.delete(id); }
      });
    }
  } finally {
    disconnect();
    try { await queue; } finally {
      input.off("end", disconnect);
      input.off("close", disconnect);
      input.off("error", disconnect);
      output.off("close", disconnect);
      output.off("error", disconnect);
      lines.close();
    }
  }
}

/** Ce que Palabre relève du garde après le messager : consulté, et autorisation enregistrée. */
export function readGuardReport(stateDir: string): { consulted: boolean; allowed: boolean } {
  const exists = (name: string) => {
    try { readFileSync(path.join(stateDir, name)); return true; } catch { return false; }
  };
  return { consulted: exists(GUARD_FILES.consulted), allowed: exists(GUARD_FILES.allowed) };
}
