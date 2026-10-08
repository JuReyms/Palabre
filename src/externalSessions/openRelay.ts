/**
 * @file Relay B1 (`palabre relay --open`) : dépôt d'un message dans une conversation Codex ouverte
 * par `codex queue`, puis attente de la réponse corrélée dans le rollout (voir AGENTS.md, section
 * "Relay externe", et `scripts/prototypes/relay/CONTRAT-B1.md`).
 *
 * Déroulé, sous **une seule échéance** couvrant référence, dépôt et attente :
 * 1. verrou tenu, sinon `target-not-open` ou `target-state-unknown`, sans dépôt ;
 * 2. contrôle de l'enveloppe et de la ligne de commande Windows, sans dépôt ;
 * 3. référence du rollout (fin de ligne partielle réessayée au plus 2 s, dans le budget) ;
 * 4. nouveau contrôle du verrou immédiatement avant le dépôt ;
 * 5. un seul `codex queue`, en `min(60 s, budget restant)` ; dès qu'un processus est créé, la
 *    tentative compte : aucune issue ultérieure n'annonce plus `not-delivered`, sauf refus certain ;
 * 6. lectures bornées de l'ajout jusqu'à une observation terminale, l'échéance ou l'annulation.
 *
 * Aucun renvoi, aucune reprise `exec resume`. Ni l'échéance ni l'annulation ne retirent un message
 * de la file : il peut être traité plus tard. Les dépendances (sonde, lectures, lancement, horloge)
 * sont injectables pour les tests.
 */
import type { ExternalExecutable } from "./adapter.js";
import { checkQueueCommand, codexQueueArgs, isQueueUnsupported, parseQueueAck, QUEUE_LIMITS } from "./codexQueue.js";
import { inspectOpenReply, settleOpenDelivery, type OpenBaseline, type OpenObservation, type OpenSnapshot, type OpenTurnContext } from "./openReader.js";
import { captureOpenRollout, readOpenRollout } from "./openRollout.js";
import { RELAY_EXIT_CODES } from "./outcome.js";
import { runExternalProcess, type ExternalProcessResult, type ExternalProcessSpec } from "./process.js";
import type { DeliveryVerdict, InvalidRequestReason, RelayOutcome, RelayStatus, SessionIdentity, TargetProbe } from "./types.js";

/** Intervalle entre deux lectures de l'ajout. */
export const OPEN_POLL_MS = 500;
/** Durée maximale des nouvelles tentatives de référence sur une fin de ligne partielle, et pas. */
export const OPEN_BASELINE_RETRY = { totalMs: 2_000, stepMs: 100 } as const;

/** Dépendances injectables ; `defaultOpenRelayDeps` lit l'installation réelle. */
export interface OpenRelayDeps {
  /** Sonde du verrou d'écriture de la cible. */
  probe: () => TargetProbe;
  capture: (file: string) => Promise<OpenBaseline>;
  read: (file: string, baseline: OpenBaseline) => Promise<OpenSnapshot>;
  run: (spec: ExternalProcessSpec) => Promise<ExternalProcessResult>;
  /** Horloge monotone, en millisecondes. */
  now: () => number;
  /** Attente interrompue par l'annulation. */
  sleep: (ms: number, signal: AbortSignal) => Promise<void>;
}

export interface OpenRelayInput {
  executable: ExternalExecutable;
  sessionId: string;
  /** Dossier de travail lu dans `session_meta` ; jamais le dossier courant de Palabre. */
  cwd: string;
  historyPath: string;
  envelope: string;
  nonce: string;
  /** Budget total : référence, dépôt et attente. */
  timeoutMs: number;
  signal: AbortSignal;
  /** Appelé dès qu'un processus de dépôt a été créé (pour qualifier une erreur interne ultérieure). */
  onAttempt?: () => void;
}

/**
 * Diagnostic du dépôt :
 * - `attempted` : un processus `queue` a été créé ;
 * - `accepted` : `true` pour un accusé reconnu et lié à la cible, `false` seulement pour un refus
 *   certain de la CLI, `"unknown"` sinon (l'absence d'accusé n'est pas un refus) ;
 * - `itemId` : présent seulement pour un accusé reconnu ; il ne prouve pas la réception du texte exact.
 */
export interface OpenQueueReport {
  attempted: boolean;
  accepted?: true | false | "unknown";
  itemId?: string;
  diagnostic?: string;
}

/** Résultat d'un relay B1, avant mise en forme par la commande. */
export interface OpenRelayResult {
  outcome: RelayOutcome;
  delivery: DeliveryVerdict;
  reply?: string;
  identity: SessionIdentity;
  /** Modèle du seul tour corrélé. */
  observedModels: string[];
  queue: OpenQueueReport;
  /** Dernière observation du lecteur ; absente tant que rien n'a été inspecté. */
  correlation?: { status: OpenObservation["status"]; reason: string };
  /** Permissions du seul tour corrélé, ou `"unknown"`. */
  targetPermissions: Omit<OpenTurnContext, "model"> | "unknown";
  /** Le verrou tenu ne prouve ni la surface, ni la version, ni la consommation de la file. */
  receiver: "unverified";
  /** Vrai si l'enveloppe a été vue dans l'historique, maintenant ou lors d'une lecture antérieure. */
  receptionObserved: boolean;
  /** Code technique court d'un refus ou d'un échec, sans contenu ni chemin. */
  diagnostic?: string;
}

const NOT_DELIVERED: DeliveryVerdict = { status: "not-delivered", persisted: false, inActiveBranch: false };

function outcome(status: RelayStatus, reason?: InvalidRequestReason): RelayOutcome {
  return reason === undefined ? { status, exitCode: RELAY_EXIT_CODES[status] } : { status, exitCode: RELAY_EXIT_CODES[status], reason };
}

/** Code court d'une erreur de lecture : jamais son message brut, qui peut contenir un chemin. */
function errorCode(error: unknown): string {
  const code = (error as NodeJS.ErrnoException | undefined)?.code ?? (error instanceof Error ? error.message : undefined);
  return typeof code === "string" && /^[A-Za-z0-9-]{1,40}$/.test(code) ? code : "read-error";
}

/** Seul un verrou tenu permet le dépôt. */
function lockRefusal(probe: TargetProbe): RelayStatus | undefined {
  if (probe.attachment === "attached") return undefined;
  return probe.attachment === "detached" ? "target-not-open" : "target-state-unknown";
}

/** Attente interrompue par l'annulation ; ne rejette jamais. */
export function abortableSleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted || ms <= 0) {
      resolve();
      return;
    }
    const done = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal.addEventListener("abort", done, { once: true });
  });
}

/** Dépendances réelles : verrou par `probe`, lectures bornées, lancement sans shell. */
export function defaultOpenRelayDeps(probe: () => TargetProbe): OpenRelayDeps {
  return { probe, capture: captureOpenRollout, read: readOpenRollout, run: runExternalProcess, now: () => performance.now(), sleep: abortableSleep };
}

/** Exécute un relay B1 ; ne lève pas pour les échecs prévus (refus, lancement, lecture). */
export async function runOpenRelay(input: OpenRelayInput, deps: OpenRelayDeps): Promise<OpenRelayResult> {
  const deadline = deps.now() + input.timeoutMs;
  const remaining = () => Math.max(0, deadline - deps.now());
  const base = {
    identity: "unavailable" as SessionIdentity,
    observedModels: [] as string[],
    targetPermissions: "unknown" as const,
    receiver: "unverified" as const,
    receptionObserved: false
  };
  const refuse = (refusal: RelayOutcome, diagnostic?: string): OpenRelayResult =>
    ({ ...base, outcome: refusal, delivery: NOT_DELIVERED, queue: { attempted: false }, ...(diagnostic ? { diagnostic } : {}) });

  // 1. Verrou tenu, puis 2. contrôle du dépôt : sans dépôt en cas de refus.
  const firstLock = lockRefusal(deps.probe());
  if (firstLock) return refuse(outcome(firstLock));
  const args = [...input.executable.prefixArgs, ...codexQueueArgs(input.sessionId, input.envelope)];
  const check = checkQueueCommand(input.executable.command, args, input.envelope);
  if (!check.ok) return refuse(outcome("invalid-request", "message-too-large"), check.detail);

  // 3. Référence, avec nouvelles tentatives bornées sur une fin de ligne partielle.
  const retryUntil = Math.min(deadline, deps.now() + OPEN_BASELINE_RETRY.totalMs);
  let baseline: OpenBaseline | undefined;
  while (!baseline) {
    if (input.signal.aborted) return refuse(outcome("cancelled"));
    try {
      baseline = await deps.capture(input.historyPath);
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

  // 4. Nouveau contrôle du verrou juste avant le seul dépôt (réduit la course, sans l'annuler).
  if (input.signal.aborted) return refuse(outcome("cancelled"));
  if (remaining() <= 0) return refuse(outcome("timeout"));
  const secondLock = lockRefusal(deps.probe());
  if (secondLock) return refuse(outcome(secondLock), "lock-released-before-queue");

  // 5. Dépôt.
  const run = await deps.run({
    command: input.executable.command,
    args,
    cwd: input.cwd,
    stdin: "",
    timeoutMs: Math.min(QUEUE_LIMITS.timeoutMs, remaining()),
    maxOutputBytes: QUEUE_LIMITS.maxOutputBytes,
    signal: input.signal
  });
  if (!run.started) {
    if (run.stopReason === "cancelled") return refuse(outcome("cancelled"));
    if (run.launchFailure === "invalid-working-directory") return refuse(outcome("invalid-request", "invalid-working-directory"));
    if (run.launchFailure === "command-not-found") return refuse(outcome("command-not-found"));
    const code = run.launchErrorCode && /^[A-Za-z0-9-]{1,40}$/.test(run.launchErrorCode) ? run.launchErrorCode : "failed";
    return refuse(outcome("cli-failure"), `queue-launch-${code}`);
  }
  input.onAttempt?.();
  const request = { threadId: input.sessionId, nonce: input.nonce, envelope: input.envelope, baseline };
  const queue: OpenQueueReport = { attempted: true, accepted: "unknown" };
  let observation: OpenObservation | undefined;
  let persisted = false;
  const inspect = async () => {
    try {
      observation = inspectOpenReply(await deps.read(input.historyPath, baseline!), request);
    } catch (error) {
      observation = { status: "unreadable", persisted: "unknown", reason: errorCode(error) };
    }
    if (observation.persisted === true) persisted = true;
  };

  const finish = (final: RelayOutcome): OpenRelayResult => {
    const current = observation ?? { status: "awaiting-message" as const, persisted: false, reason: "not-inspected" };
    // Une observation `replied` ne vaut réponse que si l'issue l'est aussi (jamais après un échec du déposant).
    const settled = settleOpenDelivery(final.status === "replied" ? current : { ...current, status: current.status === "replied" ? "awaiting-reply" : current.status }, true, persisted);
    const context = current.status === "replied" || current.status === "failed" ? current.context : undefined;
    const { model, ...permissions } = context ?? {};
    return {
      outcome: final,
      delivery: { status: settled.status, persisted: settled.persisted, inActiveBranch: "unknown" },
      ...(final.status === "replied" && settled.reply !== undefined ? { reply: settled.reply } : {}),
      identity: final.status === "replied" ? "same-as-target" : "unavailable",
      observedModels: model ? [model] : [],
      queue,
      ...(observation ? { correlation: { status: observation.status, reason: observation.reason } } : {}),
      targetPermissions: Object.keys(permissions).length > 0 ? permissions : "unknown",
      receiver: "unverified",
      receptionObserved: persisted,
      ...(queue.diagnostic ? { diagnostic: queue.diagnostic } : observation && final.status !== "replied" ? { diagnostic: observation.reason } : {})
    };
  };

  let primary: RelayOutcome | undefined;
  if (run.stopReason) {
    primary = outcome(run.stopReason);
    queue.diagnostic = `queue-${run.stopReason}`;
  } else if (run.exitCode !== 0) {
    if (isQueueUnsupported(run.stderr)) {
      // Refus documenté de l'analyseur d'arguments : rien n'a été déposé.
      return { ...base, outcome: outcome("cli-failure"), delivery: NOT_DELIVERED, queue: { attempted: true, accepted: false, diagnostic: "queue-unsupported" }, diagnostic: "queue-unsupported" };
    }
    primary = outcome("cli-failure");
    queue.diagnostic = `queue-exit-${run.exitCode ?? "signal"}`;
  } else {
    const ack = parseQueueAck(run.stdout, input.sessionId);
    if (ack.status === "accepted") {
      queue.accepted = true;
      queue.itemId = ack.itemId;
    } else {
      primary = outcome("no-valid-reply");
      queue.diagnostic = ack.status === "foreign" ? "queue-ack-foreign-thread" : "queue-ack-missing";
    }
  }

  if (primary) {
    // Échec du déposant : une dernière lecture bornée peut relever une réception, sans remplacer
    // l'issue primaire ni rendre une réponse ; elle est sautée après annulation ou échéance.
    if (!input.signal.aborted && remaining() > 0) await inspect();
    return finish(primary);
  }

  // 6. Attente de la réponse corrélée.
  for (;;) {
    if (input.signal.aborted) return finish(outcome("cancelled"));
    await inspect();
    if (!observation!.status.startsWith("awaiting")) break;
    if (input.signal.aborted) return finish(outcome("cancelled"));
    if (remaining() <= 0) return finish(outcome("timeout"));
    await deps.sleep(Math.min(OPEN_POLL_MS, remaining()), input.signal);
  }
  const terminal = observation!;
  if (terminal.status === "replied") return finish(outcome("replied"));
  return finish(outcome(terminal.status === "failed" ? "cli-failure" : "no-valid-reply"));
}
