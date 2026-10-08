/**
 * @file Issues, codes de sortie et statut de délivrance du relay (voir AGENTS.md, section
 * "Relay externe").
 *
 * L'issue est unique et déduite dans un ordre fixe :
 * 1. refus avant lancement (requête, résolution, session, sonde, neutralisation, annulation) ;
 * 2. lancement impossible (dossier de travail, exécutable) ;
 * 3. arrêt provoqué par Palabre (annulation, timeout, plafond de sortie) ;
 * 4. refus certain de la CLI ;
 * 5. réponse et identité ;
 * 6. limite d'usage, puis échec générique.
 *
 * La délivrance ne dépend que du lancement, de l'issue et de la persistance du nonce ; une preuve
 * de persistance l'emporte toujours sur l'issue. Aucune fonction de ce module ne relance un envoi.
 */
import type { ExternalProcessResult } from "./process.js";
import type {
  CertainRefusal,
  DeliveryEvidence,
  DeliveryVerdict,
  ExchangeInterpretation,
  InvalidRequestReason,
  RelayOutcome,
  RelayStatus,
  TargetDecision,
  TargetProbe
} from "./types.js";

/** Code de sortie de chaque issue. Toute issue autre que `replied` sort en non nul. */
export const RELAY_EXIT_CODES: Readonly<Record<RelayStatus, number>> = {
  "replied": 0,
  "internal-error": 1,
  "cli-failure": 2,
  "no-valid-reply": 2,
  "usage-limit": 2,
  "output-too-large": 2,
  "target-busy": 3,
  "target-state-unknown": 3,
  "target-not-open": 3,
  "neutralization-failed": 3,
  "timeout": 4,
  "identity-mismatch": 5,
  "session-not-found": 6,
  "command-not-found": 7,
  "invalid-request": 8,
  "cancelled": 130
};

/** Issues qui garantissent qu'aucune écriture n'a eu lieu dans l'historique de la cible. */
const CERTAINLY_NOT_DELIVERED: ReadonlySet<RelayStatus> = new Set<RelayStatus>([
  "invalid-request",
  "command-not-found",
  "session-not-found",
  "target-busy",
  "target-state-unknown",
  "target-not-open",
  "neutralization-failed"
]);

/** Refus prononcé avant tout lancement de la CLI de reprise. */
export type PreLaunchRefusal =
  | { status: "invalid-request"; reason: InvalidRequestReason }
  | { status: "command-not-found" | "session-not-found" | "target-busy" | "target-state-unknown" | "target-not-open" | "neutralization-failed" | "cancelled" };

function outcome(status: RelayStatus, reason?: InvalidRequestReason): RelayOutcome {
  return reason === undefined
    ? { status, exitCode: RELAY_EXIT_CODES[status] }
    : { status, exitCode: RELAY_EXIT_CODES[status], reason };
}

/**
 * Seule une cible `detached` est relayable. `target-busy` signifie « cible attachée », en
 * génération comme au repos ; un attachement invérifiable donne `target-state-unknown`.
 */
export function assessTarget(probe: TargetProbe): TargetDecision {
  if (probe.attachment === "detached") return { allowed: true };
  return { allowed: false, status: probe.attachment === "attached" ? "target-busy" : "target-state-unknown" };
}

/** Issue d'un refus prononcé avant le lancement. */
export function refusalOutcome(refusal: PreLaunchRefusal): RelayOutcome {
  return refusal.status === "invalid-request" ? outcome(refusal.status, refusal.reason) : outcome(refusal.status);
}

/**
 * Issue d'un lancement. `interpretation`, `certainRefusal` et `usageLimit` sont fournis par
 * l'adapter fournisseur à partir de la sortie de la CLI.
 */
export function launchOutcome(input: {
  process: ExternalProcessResult;
  interpretation?: ExchangeInterpretation;
  certainRefusal?: CertainRefusal;
  usageLimit?: boolean;
}): RelayOutcome {
  const { process: run, interpretation } = input;
  if (!run.started) {
    if (run.stopReason === "cancelled") return outcome("cancelled");
    if (run.launchFailure === "invalid-working-directory") return outcome("invalid-request", "invalid-working-directory");
    if (run.launchFailure === "command-not-found") return outcome("command-not-found");
    return outcome("cli-failure");
  }
  if (run.stopReason) return outcome(run.stopReason);
  if (input.certainRefusal) return outcome(input.certainRefusal);
  if (interpretation && !interpretation.isError && interpretation.reply !== undefined) {
    return outcome(interpretation.identity === "same-as-target" ? "replied" : "identity-mismatch");
  }
  if (interpretation?.identity === "mismatch") return outcome("identity-mismatch");
  if (input.usageLimit) return outcome("usage-limit");
  return outcome(run.exitCode === 0 ? "no-valid-reply" : "cli-failure");
}

/**
 * Statut de délivrance d'un relay terminé, dans cet ordre :
 * 1. la preuve de persistance l'emporte toujours : nonce trouvé => `replied` si l'issue est
 *    `replied`, sinon `persisted-no-reply`, même quand l'issue annonce un refus. Une contradiction
 *    entre l'issue et l'historique ne doit jamais faire annoncer un renvoi sans risque de doublon ;
 * 2. sans lancement, ou issue qui exclut toute écriture : `not-delivered` ;
 * 3. `replied` : `replied` ;
 * 4. sinon `unknown`, car l'absence du nonce ne prouve pas la non-délivrance.
 *
 * La preuve fournie est rapportée telle quelle, jamais réécrite. Sans preuve, `persisted` vaut
 * `false` si rien n'a été lancé, `unknown` sinon. `inActiveBranch` est un diagnostic et
 * n'influence jamais le statut.
 */
export function classifyDelivery(input: { outcome: RelayOutcome; launched: boolean; evidence?: DeliveryEvidence }): DeliveryVerdict {
  const fallback = input.launched ? "unknown" : false;
  const persisted = input.evidence?.persisted ?? fallback;
  const inActiveBranch = input.evidence?.inActiveBranch ?? fallback;
  const replied = input.outcome.status === "replied";
  if (persisted === true) return { status: replied ? "replied" : "persisted-no-reply", persisted, inActiveBranch };
  if (!input.launched || CERTAINLY_NOT_DELIVERED.has(input.outcome.status)) {
    return { status: "not-delivered", persisted, inActiveBranch };
  }
  if (replied) return { status: "replied", persisted, inActiveBranch };
  return { status: "unknown", persisted, inActiveBranch };
}
