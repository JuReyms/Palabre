/**
 * @file Relay B2.2 (`palabre relay --open` vers Claude Code, pilote Windows) : envoi d'un message
 * à une conversation Claude ouverte par un messager `claude -p` dont le garde est l'hôte de
 * permissions, puis attente de la réponse corrélée dans le transcript (lecteur B2.1). Voir
 * `scripts/prototypes/relay/CONTRAT-B2.md`.
 *
 * Déroulé, sous **une seule échéance** :
 * 1. enveloppe (taille, NUL, balise de file réservée), sans lancement ;
 * 2. version du messager, registre, auto-ciblage, dossier et transcript de la cible ;
 * 3. référence du transcript, puis nouveau contrôle du registre juste avant le lancement ;
 * 4. un seul messager, en `min(120 s, budget restant)` ; dès qu'il est créé, la tentative compte ;
 * 5. lectures bornées jusqu'à une observation terminale, l'échéance ou l'annulation.
 *
 * Délivrance : `not-delivered` avant le lancement du messager ; ensuite `unknown`, sauf preuve de
 * réception ou réponse corrélée dans le transcript de la cible. L'état du garde (chargé, consulté,
 * autorisation enregistrée) reste un diagnostic : aucune promotion vers `not-delivered`. Aucun
 * renvoi. Une issue d'échec, d'annulation ou d'échéance ne rend jamais de réponse, mais conserve
 * toute preuve de réception.
 */
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ExternalExecutable } from "./adapter.js";
import { inspectClaudeOpenReply, type ClaudeOpenObservation, type ClaudeTurnContext } from "./claudeOpenReader.js";
import { envelopeDigest, GUARD_FILES, readGuardReport, revokeGuardIn, type GuardState } from "./claudeGuard.js";
import {
  CLAUDE_OPEN_LIMITS,
  detectSelfTarget,
  guardMcpConfig,
  hasQueueTag,
  isSameRegistryTarget,
  isLoggedOut,
  isSupportedClaudeVersion,
  locateClaudeTranscript,
  MESSENGER_MODEL,
  messengerArgs,
  messengerPrompt,
  messengerSettings,
  parseClaudeRegistry,
  parseClaudeVersion,
  parseProjectsDirectory,
  readMessengerStream,
  resolveRegistryTarget,
  type ClaudeRegistryEntry
} from "./claudeOpen.js";
import { MAX_OPEN_ENVELOPE_UTF16 } from "./codexQueue.js";
import { settleOpenDelivery, type OpenBaseline, type OpenSnapshot } from "./openReader.js";
import { abortableSleep, OPEN_BASELINE_RETRY, OPEN_POLL_MS } from "./openRelay.js";
import { captureOpenRollout, readOpenRollout } from "./openRollout.js";
import { RELAY_EXIT_CODES } from "./outcome.js";
import { runExternalProcess, type ExternalProcessResult, type ExternalProcessSpec } from "./process.js";
import type { DeliveryVerdict, InvalidRequestReason, RelayOutcome, RelayStatus, SessionIdentity } from "./types.js";

/** Dépendances injectables ; `defaultClaudeOpenRelayDeps` lit l'installation réelle. */
export interface ClaudeOpenRelayDeps {
  run: (spec: ExternalProcessSpec) => Promise<ExternalProcessResult>;
  capture: (file: string) => Promise<OpenBaseline>;
  read: (file: string, baseline: OpenBaseline) => Promise<OpenSnapshot>;
  now: () => number;
  /** Horloge Unix pour partager l'échéance avec le garde dans un autre processus. */
  wallNow: () => number;
  sleep: (ms: number, signal: AbortSignal) => Promise<void>;
  /** Dossier privé de la tentative, supprimé à la fin. */
  makeStateDir: () => Promise<string>;
  removeStateDir: (dir: string) => Promise<void>;
  /** Interpréteur et script du garde, lancés par la CLI comme serveur MCP. */
  nodePath: string;
  guardScript: string;
}

/** Cible et enveloppe exactes, budget et annulation de la tentative entière. */
export interface ClaudeOpenRelayInput {
  executable: ExternalExecutable;
  sessionId: string;
  envelope: string;
  nonce: string;
  /** Environnement de l'appelant **avant** nettoyage, pour l'auto-ciblage. */
  callerEnv: NodeJS.ProcessEnv;
  timeoutMs: number;
  signal: AbortSignal;
  /** Appelé dès que le messager a été créé (pour qualifier une erreur interne ultérieure). */
  onAttempt?: () => void;
}

/**
 * Diagnostic du messager, jamais une preuve de délivrance :
 * - `guard` : garde connecté d'après `system/init` ; chargé ne veut pas dire consulté ;
 * - `guardConsulted` : au moins une décision du garde a été enregistrée ;
 * - `sendAllowed` : `true` si l'unique autorisation a été enregistrée, `false` si le garde a été
 *   consulté sans l'accorder, `"unknown"` sinon ;
 * - `toolResult` : un résultat d'outil a été rendu pour un appel `SendMessage` (texte non recopié).
 */
export interface ClaudeMessengerReport {
  attempted: boolean;
  guard?: "loaded" | "not-loaded" | "unknown";
  guardConsulted?: boolean;
  sendAllowed?: boolean | "unknown";
  toolResult?: "returned" | "absent";
  model?: string;
  diagnostic?: string;
}

/** Issue de la tentative ; diagnostics du messager distincts des preuves de réception. */
export interface ClaudeOpenRelayResult {
  outcome: RelayOutcome;
  delivery: DeliveryVerdict;
  reply?: string;
  identity: SessionIdentity;
  observedModels: string[];
  messenger: ClaudeMessengerReport;
  correlation?: { status: ClaudeOpenObservation["status"]; reason: string };
  /** Mode de permissions de la cible au début du tour corrélé, ou `"unknown"`. */
  targetPermissions: { permissionMode: string } | "unknown";
  receiver: "unverified";
  /** Réception prouvée maintenant ou lors d'une lecture antérieure. */
  receptionObserved: boolean;
  /** Forme exacte de file observée (diagnostic, sans effet sur la délivrance). */
  queued: boolean;
  diagnostic?: string;
}

const NOT_DELIVERED: DeliveryVerdict = { status: "not-delivered", persisted: false, inActiveBranch: false };

function outcome(status: RelayStatus, reason?: InvalidRequestReason): RelayOutcome {
  return reason === undefined ? { status, exitCode: RELAY_EXIT_CODES[status] } : { status, exitCode: RELAY_EXIT_CODES[status], reason };
}

/** Code court d'une erreur : jamais son message brut, qui peut contenir un chemin. */
function errorCode(error: unknown): string {
  const code = (error as NodeJS.ErrnoException | undefined)?.code ?? (error instanceof Error ? error.message : undefined);
  return typeof code === "string" && /^[A-Za-z0-9-]{1,40}$/.test(code) ? code : "read-error";
}

/** Dépendances réelles : lancement sans shell, lectures bornées, dossier temporaire privé. */
export function defaultClaudeOpenRelayDeps(): ClaudeOpenRelayDeps {
  return {
    run: runExternalProcess,
    capture: captureOpenRollout,
    read: readOpenRollout,
    now: () => performance.now(),
    wallNow: Date.now,
    sleep: abortableSleep,
    makeStateDir: () => mkdtemp(path.join(os.tmpdir(), "palabre-claude-open-")),
    removeStateDir: (dir) => rm(dir, { recursive: true, force: true }).catch(() => undefined),
    nodePath: process.execPath,
    guardScript: fileURLToPath(new URL("./claudeGuardServer.js", import.meta.url))
  };
}

/** Exécute un relay B2.2 ; ne lève pas pour les échecs prévus (refus, lancement, lecture). */
export async function runClaudeOpenRelay(input: ClaudeOpenRelayInput, deps: ClaudeOpenRelayDeps): Promise<ClaudeOpenRelayResult> {
  const deadline = deps.now() + input.timeoutMs;
  const remaining = () => Math.max(0, deadline - deps.now());
  const base = {
    identity: "unavailable" as SessionIdentity,
    observedModels: [] as string[],
    targetPermissions: "unknown" as const,
    receiver: "unverified" as const,
    receptionObserved: false,
    queued: false
  };
  const refuse = (refusal: RelayOutcome, diagnostic?: string): ClaudeOpenRelayResult =>
    ({ ...base, outcome: refusal, delivery: NOT_DELIVERED, messenger: { attempted: false }, ...(diagnostic ? { diagnostic } : {}) });
  const interrupted = (): ClaudeOpenRelayResult | undefined =>
    input.signal.aborted ? refuse(outcome("cancelled")) : remaining() <= 0 ? refuse(outcome("timeout")) : undefined;

  // 1. Enveloppe : rien n'est lancé si elle ne peut pas être transmise telle quelle.
  if (input.envelope.length > MAX_OPEN_ENVELOPE_UTF16 || input.envelope.includes("\0")) return refuse(outcome("invalid-request", "message-too-large"), "envelope-too-long");
  if (hasQueueTag(input.envelope)) return refuse(outcome("invalid-request", "reserved-content"), "envelope-queue-tag");

  /** Commande préalable bornée, sans appel de modèle ; un refus ou un échec n'envoie rien. */
  const probe = async (args: string[]): Promise<{ result: ExternalProcessResult } | { refusal: ClaudeOpenRelayResult }> => {
    const stop = interrupted();
    if (stop) return { refusal: stop };
    const result = await deps.run({
      command: input.executable.command,
      args: [...input.executable.prefixArgs, ...args],
      cwd: os.tmpdir(),
      stdin: "",
      timeoutMs: Math.min(CLAUDE_OPEN_LIMITS.probeTimeoutMs, remaining()),
      maxOutputBytes: CLAUDE_OPEN_LIMITS.probeOutputBytes,
      signal: input.signal
    });
    const after = interrupted();
    if (after) return { refusal: after };
    if (!result.started) {
      if (result.stopReason === "cancelled") return { refusal: refuse(outcome("cancelled")) };
      if (result.launchFailure === "command-not-found") return { refusal: refuse(outcome("command-not-found")) };
      return { refusal: refuse(outcome("cli-failure"), `${args[0]}-launch-failed`) };
    }
    if (result.stopReason === "cancelled") return { refusal: refuse(outcome("cancelled")) };
    if (result.stopReason === "timeout" && remaining() <= 0) return { refusal: refuse(outcome("timeout"), `${args[0]}-timeout`) };
    return { result };
  };

  // 2. Version du messager.
  const versionRun = await probe(["--version"]);
  if ("refusal" in versionRun) return versionRun.refusal;
  const version = versionRun.result.exitCode === 0 && !versionRun.result.stopReason ? parseClaudeVersion(versionRun.result.stdout) : undefined;
  if (!version) return refuse(outcome("invalid-request", "unsupported-version"), "version-unreadable");
  if (!isSupportedClaudeVersion(version)) return refuse(outcome("invalid-request", "unsupported-version"), `version-${version.join(".")}`);

  // Registre : la cible doit être une session vivante, nommée sans homonyme.
  const readRegistry = async (): Promise<{ entries: ClaudeRegistryEntry[] | undefined } | { refusal: ClaudeOpenRelayResult }> => {
    const run = await probe(["agents", "--json"]);
    if ("refusal" in run) return run;
    return { entries: run.result.exitCode === 0 && !run.result.stopReason ? parseClaudeRegistry(run.result.stdout) : undefined };
  };
  const registry = await readRegistry();
  if ("refusal" in registry) return registry.refusal;
  if (!registry.entries) return refuse(outcome("target-state-unknown"), "registry-unreadable");
  const resolved = resolveRegistryTarget(registry.entries, input.sessionId);
  if (resolved.status === "target-not-open") return refuse(outcome("target-not-open"));
  if (resolved.status === "target-state-unknown") return refuse(outcome("target-state-unknown"), resolved.diagnostic);
  const target = { sessionId: input.sessionId, name: resolved.name, pid: resolved.pid };

  // Auto-ciblage : l'appelant ne doit pas être la conversation visée.
  const self = detectSelfTarget(input.callerEnv, target);
  if (self !== "distinct") return refuse(outcome("invalid-request", "self-target"), self === "self" ? "self-target" : "self-target-unprovable");

  // Dossier des transcripts et transcript de la cible, lus bornés.
  const auth = await probe(["auth", "status"]);
  if ("refusal" in auth) return auth.refusal;
  // Messager non connecté : il ne pourrait rien envoyer ; refus certain avant tout lancement.
  if (!auth.result.stopReason && isLoggedOut(auth.result.stdout)) return refuse(outcome("cli-failure"), "messenger-not-logged-in");
  const projectsDir = auth.result.stopReason ? undefined : parseProjectsDirectory(auth.result.stdout);
  if (!projectsDir) return refuse(outcome("target-state-unknown"), "projects-directory-unreadable");
  const located = await locateClaudeTranscript(projectsDir, input.sessionId);
  if (located.status !== "found") return refuse(outcome("session-not-found"), "transcript-not-found");

  // 3. Référence, avec nouvelles tentatives bornées sur une fin de ligne partielle (comme B1).
  const retryUntil = Math.min(deadline, deps.now() + OPEN_BASELINE_RETRY.totalMs);
  let baseline: OpenBaseline | undefined;
  while (!baseline) {
    if (input.signal.aborted) return refuse(outcome("cancelled"));
    try {
      baseline = await deps.capture(located.transcriptPath);
    } catch (error) {
      const code = errorCode(error);
      if (code === "baseline-incomplete" && deps.now() + OPEN_BASELINE_RETRY.stepMs <= retryUntil) {
        await deps.sleep(OPEN_BASELINE_RETRY.stepMs, input.signal);
        continue;
      }
      if (input.signal.aborted) return refuse(outcome("cancelled"));
      if (remaining() <= 0) return refuse(outcome("timeout"), `reference-${code}`);
      return refuse(outcome("no-valid-reply"), `reference-${code}`);
    }
  }

  // Nouveau contrôle du registre juste avant le lancement (réduit la course, sans l'annuler).
  const recheck = await readRegistry();
  if ("refusal" in recheck) return recheck.refusal;
  if (!isSameRegistryTarget(recheck.entries, target)) {
    const now = recheck.entries ? resolveRegistryTarget(recheck.entries, input.sessionId) : undefined;
    return refuse(outcome(now?.status === "target-not-open" ? "target-not-open" : "target-state-unknown"), "registry-changed-before-send");
  }

  // 4. Messager, dans un dossier privé qui porte l'état du garde.
  const stateDir = await deps.makeStateDir();
  let revocationFailed = false;
  const revoke = () => { if (!revokeGuardIn(stateDir)) revocationFailed = true; };
  let guardTimer: ReturnType<typeof setTimeout> | undefined;
  try {
    const state: GuardState = {
      v: 1, sessionId: input.sessionId, name: target.name, pid: target.pid,
      envelope: input.envelope, envelopeSha256: envelopeDigest(input.envelope),
      expiresAt: Math.floor(deps.wallNow() + Math.min(CLAUDE_OPEN_LIMITS.messengerTimeoutMs, remaining())),
      executable: { command: input.executable.command, prefixArgs: [...input.executable.prefixArgs] }
    };
    const files = { settingsPath: path.join(stateDir, "settings.json"), mcpConfigPath: path.join(stateDir, "mcp.json") };
    await writeFile(path.join(stateDir, GUARD_FILES.state), JSON.stringify(state));
    await writeFile(files.settingsPath, JSON.stringify(messengerSettings()));
    await writeFile(files.mcpConfigPath, JSON.stringify(guardMcpConfig({ nodePath: deps.nodePath, guardScript: deps.guardScript, stateDir })));

    // Lancement seulement avec un budget strictement positif, mesuré juste avant.
    if (input.signal.aborted) return refuse(outcome("cancelled"));
    let budget = remaining();
    if (budget <= 0) return refuse(outcome("timeout"), "budget-exhausted-before-send");
    // Marqueur privé : l'annulation le retire avant la terminaison du messager. Le garde le
    // relit après le registre. Le délai absolu reste un second contrôle indépendant.
    writeFileSync(path.join(stateDir, GUARD_FILES.active), "active\n", { flag: "wx" });
    input.signal.addEventListener("abort", revoke, { once: true });
    if (input.signal.aborted) { revoke(); return refuse(outcome("cancelled")); }
    budget = remaining();
    if (budget <= 0) return refuse(outcome("timeout"), "budget-exhausted-before-send");
    guardTimer = setTimeout(revoke, Math.min(CLAUDE_OPEN_LIMITS.messengerTimeoutMs, budget));
    let run: ExternalProcessResult;
    try {
      run = await deps.run({
        command: input.executable.command,
        args: [...input.executable.prefixArgs, ...messengerArgs(files)],
        cwd: stateDir,
        stdin: messengerPrompt(target.name),
        timeoutMs: Math.min(CLAUDE_OPEN_LIMITS.messengerTimeoutMs, budget),
        maxOutputBytes: CLAUDE_OPEN_LIMITS.messengerOutputBytes,
        signal: input.signal
      });
    } finally { revoke(); }
    if (!run.started) {
      if (run.stopReason === "cancelled") return refuse(outcome("cancelled"));
      if (run.launchFailure === "command-not-found") return refuse(outcome("command-not-found"));
      if (run.launchFailure === "invalid-working-directory") return refuse(outcome("invalid-request", "invalid-working-directory"));
      return refuse(outcome("cli-failure"), "messenger-launch-failed");
    }
    input.onAttempt?.();
    const result = await settleAfterLaunch(run, stateDir, located.transcriptPath, baseline);
    if (revocationFailed) result.messenger.diagnostic = [result.messenger.diagnostic, "guard-revocation-failed"].filter(Boolean).join(";");
    return result;
  } finally {
    input.signal.removeEventListener("abort", revoke);
    if (guardTimer !== undefined) clearTimeout(guardTimer);
    revoke();
    await deps.removeStateDir(stateDir);
  }

  /** Après lancement : diagnostics du messager, issue primaire éventuelle, puis attente. */
  async function settleAfterLaunch(run: ExternalProcessResult, stateDir: string, transcriptPath: string, reference: OpenBaseline): Promise<ClaudeOpenRelayResult> {
    const stream = readMessengerStream(run.stdout);
    const guard = readGuardReport(stateDir);
    const messenger: ClaudeMessengerReport = {
      attempted: true,
      guard: stream.guard,
      guardConsulted: guard.consulted,
      sendAllowed: guard.allowed ? true : guard.consulted ? false : "unknown",
      toolResult: stream.toolResult,
      ...(stream.model ? { model: stream.model } : {})
    };
    const notes: string[] = [];
    // Modèle fixe, sans repli : un autre modèle annoncé est signalé, jamais accepté en silence.
    if (stream.model && !stream.model.toLowerCase().includes(MESSENGER_MODEL)) notes.push("messenger-model-unexpected");

    const request = { sessionId: input.sessionId, nonce: input.nonce, envelope: input.envelope, baseline: reference };
    let observation: ClaudeOpenObservation | undefined;
    let persisted = false;
    let queued = false;
    const inspect = async () => {
      try {
        observation = inspectClaudeOpenReply(await deps.read(transcriptPath, reference), request);
      } catch (error) {
        observation = { status: "unreadable", persisted: "unknown", reason: errorCode(error), queued: false };
      }
      if (observation.persisted === true) persisted = true;
      if (observation.queued) queued = true;
    };

    const finish = (final: RelayOutcome, primaryDiagnostic?: string): ClaudeOpenRelayResult => {
      const current = observation ?? { status: "awaiting-message" as const, persisted: false as const, reason: "not-inspected", queued: false };
      // Une observation `replied` ne vaut réponse que si l'issue l'est aussi : jamais après échec,
      // annulation ou échéance. La preuve de réception, elle, est toujours conservée.
      const settled = settleOpenDelivery(final.status === "replied" ? current : { ...current, status: current.status === "replied" ? "awaiting-reply" : current.status }, true, persisted);
      const context: ClaudeTurnContext | undefined = (final.status === "replied" && current.status === "replied") || (final.status === "cli-failure" && current.status === "failed" && !primaryDiagnostic)
        ? current.context
        : undefined;
      const diagnostic = [primaryDiagnostic, ...notes].filter((item): item is string => item !== undefined);
      if (diagnostic.length) messenger.diagnostic = diagnostic.join(",");
      const readerDiagnostic = observation && final.status !== "replied" ? observation.reason : undefined;
      return {
        outcome: final,
        delivery: { status: settled.status, persisted: settled.persisted, inActiveBranch: "unknown" },
        ...(final.status === "replied" && settled.reply !== undefined ? { reply: settled.reply } : {}),
        identity: final.status === "replied" ? "same-as-target" : "unavailable",
        observedModels: context?.models ? [...context.models] : [],
        messenger,
        ...(observation ? { correlation: { status: observation.status, reason: observation.reason } } : {}),
        targetPermissions: context?.permissionMode ? { permissionMode: context.permissionMode } : "unknown",
        receiver: "unverified",
        receptionObserved: persisted,
        queued,
        ...(primaryDiagnostic ?? readerDiagnostic ? { diagnostic: primaryDiagnostic ?? readerDiagnostic } : {})
      };
    };

    // Issue primaire du messager : arrêt, code non nul, ou aucune autorisation enregistrée.
    let primary: { outcome: RelayOutcome; diagnostic: string } | undefined;
    if (run.stopReason) primary = { outcome: outcome(run.stopReason), diagnostic: `messenger-${run.stopReason}` };
    else if (run.exitCode !== 0) primary = { outcome: outcome("cli-failure"), diagnostic: `messenger-exit-${run.exitCode ?? "signal"}` };
    else if (!guard.allowed) {
      const why = stream.guard === "not-loaded" ? "guard-not-loaded" : !guard.consulted ? "guard-not-consulted" : "send-not-allowed";
      primary = { outcome: outcome("no-valid-reply"), diagnostic: why };
    }
    if (primary) {
      // Une dernière lecture bornée peut relever une réception, sans remplacer l'issue primaire
      // ni rendre une réponse ; elle est sautée après annulation ou échéance.
      if (!input.signal.aborted && remaining() > 0) await inspect();
      return finish(primary.outcome, primary.diagnostic);
    }

    // 5. Attente. Annulation et échéance sont contrôlées avant chaque lecture et après son retour.
    for (;;) {
      if (input.signal.aborted) return finish(outcome("cancelled"));
      if (remaining() <= 0) return finish(outcome("timeout"));
      await inspect();
      if (input.signal.aborted) return finish(outcome("cancelled"));
      if (remaining() <= 0) return finish(outcome("timeout"));
      if (!observation!.status.startsWith("awaiting")) break;
      await deps.sleep(Math.min(OPEN_POLL_MS, remaining()), input.signal);
    }
    const terminal = observation!;
    if (terminal.status === "replied") return finish(outcome("replied"));
    return finish(outcome(terminal.status === "failed" ? "cli-failure" : "no-valid-reply"));
  }
}
