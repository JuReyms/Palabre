/** @file Déroulé sur copie, IO injectées et preuves mémorisées ; ne reprend jamais la source. */
import { realpath } from "node:fs/promises";
import path from "node:path";
import { validateRelayMessage } from "./envelope.js";
import { RELAY_EXIT_CODES } from "./outcome.js";
import type { ExternalProcessResult } from "./process.js";
import type { DeliveryVerdict, RelayOutcome, SessionIdentity } from "./types.js";
import { CopyFailure, copyMessagePersisted, copyObject, inspectCopyClient, inspectCopyReply, isOpenCodeSessionId,
  sameCopySnapshot, validateCopyFork, validateCopySource, type OpenCodeSnapshot } from "./opencodeCopy.js";

/** Métadonnées de copie conservées aussi après un échec ; jamais une promesse de confinement. */
export interface CopyReport {
  source: string;
  session?: string;
  verified: boolean;
  retention: "none" | "retained" | "unknown";
  sourceCheck: "unchanged" | "changed" | "unknown";
  serverStop: "confirmed" | "unknown";
  diagnostic?: string;
}

/** Arrêt observé et cause éventuelle, relevée après drainage des sorties, sans effacer la réponse. */
export interface CopyStopResult {
  confirmed: boolean;
  failure?: CopyFailure;
}

/** Transport possédé par le socle ; les tests n'ont besoin ni de serveur ni de compte. */
export interface CopyTransport {
  version(signal: AbortSignal): Promise<string | undefined>;
  start(signal: AbortSignal): Promise<void>;
  snapshot(id: string, signal: AbortSignal): Promise<OpenCodeSnapshot>;
  fork(id: string, signal: AbortSignal): Promise<unknown>;
  run(id: string, envelope: string, signal: AbortSignal): Promise<ExternalProcessResult>;
  interrupt(id: string, signal: AbortSignal): Promise<void>;
  stop(signal: AbortSignal): Promise<CopyStopResult>;
}

/** Entrées explicites ; l'enveloppe se construit seulement après vérification du fork. */
export interface CopyRelayInput {
  source: string;
  cwd: string;
  timeoutMs: number;
  envelope(copyId: string): string;
  signal?: AbortSignal;
}

/** Issue globale distincte de la réception de la réponse, et des effets serveur/fork. */
export interface CopyRelayResult {
  outcome: RelayOutcome;
  delivery: DeliveryVerdict;
  copy: CopyReport;
  reply?: string;
  identity: SessionIdentity;
  observedModels: string[];
  serverAttempted: boolean;
}

/** Dépendances d'identité de dossier et plateforme, injectées seulement dans les tests internes. */
export interface CopyRelayDeps {
  transport: CopyTransport;
  platform?: NodeJS.Platform;
  canonicalDirectory?: (directory: string) => Promise<string>;
}

/**
 * Un fork au plus, un envoi au plus. Tout échec est rendu avec les ID/preuves déjà acquis.
 * Le budget d'appel comprend les sondes ; le nettoyage dispose de 10 s supplémentaires.
 */
export async function runCopyRelay(input: CopyRelayInput, deps: CopyRelayDeps): Promise<CopyRelayResult> {
  const { transport } = deps;
  const controller = new AbortController();
  let expired = false;
  const timer = setTimeout(() => { expired = true; controller.abort(); }, input.timeoutMs);
  const abort = () => controller.abort();
  input.signal?.addEventListener("abort", abort, { once: true });
  if (input.signal?.aborted) abort();
  const check = () => {
    if (input.signal?.aborted) throw new CopyFailure("cancelled", "cancelled");
    if (expired || controller.signal.aborted) throw new CopyFailure("timeout", "timeout");
  };
  const copy: CopyReport = { source: input.source, verified: false, retention: "none", sourceCheck: "unknown", serverStop: "confirmed" };
  let status: RelayOutcome["status"] = "no-valid-reply";
  let reason: RelayOutcome["reason"];
  let source: OpenCodeSnapshot | undefined, before: OpenCodeSnapshot | undefined, prompt: string | undefined;
  let serverAttempted = false, attempted = false, persisted = false, replied = false;
  let reply: string | undefined, identity: SessionIdentity = "unavailable", observedModels: string[] = [];
  const remember = (after: OpenCodeSnapshot) => {
    if (copy.session && prompt && copyMessagePersisted(after, copy.session, prompt)) persisted = true;
  };
  const canonical = deps.canonicalDirectory ?? realpath;
  const sameDirectory = (a: string, b: string) => (deps.platform ?? process.platform) === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b;
  try {
    check();
    if (!isOpenCodeSessionId(input.source)) throw new CopyFailure("invalid-request", "session-id");
    if ((deps.platform ?? process.platform) !== "win32") {
      reason = "opencode-cli-unsupported"; throw new CopyFailure("invalid-request", "unsupported-platform");
    }
    const version = await transport.version(controller.signal); check();
    if (version !== "2.0.32") {
      reason = "opencode-cli-unsupported"; throw new CopyFailure("invalid-request", "unsupported-version");
    }
    let directory: string;
    try { directory = await canonical(input.cwd); }
    catch { reason = "invalid-working-directory"; throw new CopyFailure("invalid-request", "directory-unavailable"); }
    check(); serverAttempted = true; copy.serverStop = "unknown";
    await transport.start(controller.signal); check();
    source = await transport.snapshot(input.source, controller.signal); check();
    const recorded = validateCopySource(source, input.source);
    let sourceDirectory: string;
    try {
      if (!path.isAbsolute(recorded)) throw Error();
      sourceDirectory = await canonical(recorded);
    } catch { reason = "invalid-working-directory"; throw new CopyFailure("invalid-request", "source-directory"); }
    if (!sameDirectory(directory, sourceDirectory)) { reason = "invalid-working-directory"; throw new CopyFailure("invalid-request", "source-directory"); }
    const stable = await transport.snapshot(input.source, controller.signal); check();
    if (!sameCopySnapshot(source, stable)) throw new CopyFailure("target-state-unknown", "source-changed");
    copy.sourceCheck = "unchanged";
    // Une réponse au POST perdue ne justifie jamais un second fork ni une recherche implicite.
    check(); copy.retention = "unknown";
    const fork = await transport.fork(input.source, controller.signal);
    if (copyObject(fork) && isOpenCodeSessionId(fork.id) && fork.id !== input.source) {
      copy.session = fork.id; copy.retention = "retained";
    }
    check();
    if (!copy.session) throw new CopyFailure("identity-mismatch", "fork-identity");
    before = await transport.snapshot(copy.session, controller.signal); check();
    validateCopyFork(source, before, copy.session);
    const sourceAgain = await transport.snapshot(input.source, controller.signal); check();
    if (!sameCopySnapshot(source, sourceAgain)) { copy.sourceCheck = "changed"; throw new CopyFailure("no-valid-reply", "source-changed"); }
    copy.verified = true;
    prompt = input.envelope(copy.session);
    if (!validateRelayMessage(prompt).ok) { reason = "message-too-large"; throw new CopyFailure("invalid-request", "envelope-size"); }
    check();
    // Conservateur dès l'appel du lanceur : même une dépendance qui lève après spawn ne perd pas l'incertitude.
    attempted = true;
    const run = await transport.run(copy.session, prompt, controller.signal);
    if (!run.started) attempted = false;
    check();
    if (run.stopReason) throw new CopyFailure(run.stopReason, run.stopReason);
    if (!run.started) {
      if (run.launchFailure === "command-not-found") throw new CopyFailure("command-not-found", "client-not-started");
      throw new CopyFailure("cli-failure", "client-not-started");
    }
    const after = await transport.snapshot(copy.session, controller.signal);
    remember(after); check();
    if (run.exitCode !== 0 || run.forcedReturn) throw new CopyFailure("cli-failure", "client-failed");
    inspectCopyClient(run.stdout, copy.session);
    const inspected = inspectCopyReply(before, after, prompt);
    check();
    reply = inspected.reply; observedModels = inspected.observedModels; identity = "same-as-target";
    replied = true; persisted = true; status = "replied";
    const finalSource = await transport.snapshot(input.source, controller.signal); check();
    copy.sourceCheck = sameCopySnapshot(source, finalSource) ? "unchanged" : "changed";
    if (copy.sourceCheck !== "unchanged") throw new CopyFailure("cli-failure", "source-changed");
  } catch (error) {
    const failure = input.signal?.aborted ? new CopyFailure("cancelled", "cancelled")
      : expired ? new CopyFailure("timeout", "timeout")
      : error instanceof CopyFailure ? error : new CopyFailure("cli-failure", "transport-failed");
    status = failure.status; copy.diagnostic = failure.diagnostic;
    if (status === "identity-mismatch") identity = "mismatch";
    if (status === "invalid-request" && !reason) reason = "invalid-arguments";
    if (replied && copy.sourceCheck === "unchanged") copy.sourceCheck = "unknown";
  } finally {
    clearTimeout(timer); input.signal?.removeEventListener("abort", abort); controller.abort();
    if (serverAttempted) {
      const cleanup = new AbortController();
      const cleanupTimer = setTimeout(() => cleanup.abort(), 10_000);
      try {
        if (attempted && !replied && copy.session) {
          try { await transport.interrupt(copy.session, cleanup.signal); } catch { /* Au mieux, jamais un retrait promis. */ }
          if (!cleanup.signal.aborted) {
            try { remember(await transport.snapshot(copy.session, cleanup.signal)); } catch { /* Preuve positive précédente conservée. */ }
          }
        }
        if (source && !cleanup.signal.aborted) {
          try { copy.sourceCheck = sameCopySnapshot(source, await transport.snapshot(input.source, cleanup.signal)) ? "unchanged" : "changed"; }
          catch { copy.sourceCheck = "unknown"; }
        }
      } finally {
        try {
          const stopped = await transport.stop(cleanup.signal);
          copy.serverStop = stopped.confirmed ? "confirmed" : "unknown";
          // Une cause connue lors du drainage interdit le succès global. Les refus, limites
          // déjà établies, l'annulation et l'échéance gardent leur priorité ; les preuves restent.
          if (stopped.failure && ["replied", "cli-failure", "no-valid-reply"].includes(status)) {
            status = stopped.failure.status; copy.diagnostic = stopped.failure.diagnostic;
          }
        }
        catch { copy.serverStop = "unknown"; }
        clearTimeout(cleanupTimer);
      }
      if (status === "replied" && (copy.serverStop !== "confirmed" || copy.sourceCheck !== "unchanged")) {
        status = "cli-failure"; copy.diagnostic = copy.serverStop !== "confirmed" ? "server-stop-unconfirmed" : "source-unverified";
      }
    }
  }
  const delivery: DeliveryVerdict = {
    status: replied ? "replied" : persisted ? "persisted-no-reply" : attempted ? "unknown" : "not-delivered",
    persisted: persisted ? true : attempted ? "unknown" : false,
    inActiveBranch: persisted ? true : attempted ? "unknown" : false
  };
  return { outcome: { status, exitCode: RELAY_EXIT_CODES[status], ...(reason ? { reason } : {}) }, delivery,
    copy, reply, identity, observedModels, serverAttempted };
}
