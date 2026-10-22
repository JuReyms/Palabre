/**
 * @file Contrats partagés du relay Codex, Claude Code ou copie OpenCode (voir AGENTS.md,
 * section "Relay externe").
 *
 * Une session externe n'est pas un adapter de débat : elle n'expose pas `generate(prompt)` et
 * n'est jamais appelée par l'orchestrateur. Ces types sont consommés par le socle
 * (`process.ts`, `envelope.ts`, `outcome.ts`), puis par les adapters fournisseurs et la commande
 * `palabre relay` des lots suivants.
 */

/** Fournisseurs de session externe pris en charge. */
export type ExternalProvider = "codex" | "claude" | "opencode";

/**
 * Référence `<agent>:<session>` validée syntaxiquement par `parseSessionRef`.
 * `agent` est un nom d'agent de config (cible) ou une étiquette déclarative (expéditeur) ;
 * `sessionId` est un UUID normalisé par parseSessionRef ; le parcours --copy emploie
 * son parseur dédié d'ID OpenCode sensible à la casse, sans élargir celui de Mission.
 */
export interface SessionRef {
  agent: string;
  sessionId: string;
}

/** Expéditeur déclaratif : son identifiant est facultatif et ne confère aucun droit. */
export interface SenderRef {
  agent: string;
  sessionId?: string;
}

/**
 * Conversation cible résolue. `cwd` est le dossier de travail lu dans l'historique du
 * fournisseur ; lors d'une création, c'est le dossier demandé. `sessionId` reste vide jusqu'au
 * premier événement d'identité et ne doit alors jamais servir à lire un historique.
 */
export interface ExternalTarget {
  agent: string;
  provider: ExternalProvider;
  sessionId: string;
  cwd: string;
  /**
   * Modèle enregistré dans l'historique, repris tel quel (Codex : dernier `turn_context`). Absent
   * quand le fournisseur garde lui-même le modèle de la session (Claude) ou quand il n'est pas
   * enregistré.
   */
  model?: string;
}

/** Vivacité d'un PID : `unverifiable` quand le système ne permet pas de conclure. */
export type Liveness = "alive" | "dead" | "unverifiable";

/** Processus déclaré comme attaché à la cible par le fournisseur (registre, verrou). */
export interface AttachedProcess {
  pid: number;
  liveness: Liveness;
  /** Origine déclarée par le fournisseur (TUI, desktop, `-p`…), pour diagnostic seulement. */
  kind?: string;
}

/**
 * Sonde de la cible. Seuls `attachment` et `activity` peuvent fonder une décision ; `processes`
 * et `evidence` servent au diagnostic humain.
 * - `attachment` : un processus tient-il la conversation ? `unknown` si c'est invérifiable ;
 * - `activity` : état déclaré par le fournisseur, `unknown` s'il n'est pas exposé.
 */
export interface TargetProbe {
  attachment: "attached" | "detached" | "unknown";
  activity: "busy" | "idle" | "unknown";
  processes: AttachedProcess[];
  evidence: string[];
}

/** Décision d'envoi dérivée d'une sonde : seule une cible `detached` est relayable. */
export type TargetDecision =
  | { allowed: true }
  | { allowed: false; status: "target-busy" | "target-state-unknown" };

/**
 * Cohérence entre la session qui a répondu et la cible :
 * - `same-as-target` : tous les identifiants rapportés égalent la cible ;
 * - `mismatch` : au moins un identifiant diffère ;
 * - `unavailable` : aucun identifiant fiable (échec, sortie absente).
 */
export type SessionIdentity = "same-as-target" | "mismatch" | "unavailable";

/**
 * Lancements de commandes refusés par le système, observés dans le flux de la CLI cible.
 *
 * Ce diagnostic compte des **démarrages de processus refusés**, pas des lectures : son absence
 * n'établit aucun accès, et sa présence seule n'établit aucune impossibilité de lire. Le statut
 * vient de la suite du même tour, et non de la réponse du modèle (#173 ; essai réel #171 ; suivi
 * Windows #128) :
 *
 * - `partial` : au moins une commande a abouti **après** le premier refus. L'agent a donc pu
 *   exécuter des commandes ; le Relay garde son issue. Quelles lectures ont eu lieu reste
 *   indéterminé. Une réussite explicite donne priorité à `partial`, même avec un autre événement ambigu.
 * - `blocked` : aucune commande n'a abouti après le premier refus et aucun événement n'est ambigu. Un Relay par ailleurs réussi
 *   est alors dégradé en `read-unavailable`, ce qui couvre la réponse plausible mais non lue.
 * - `unverified` : sans réussite explicite, des événements de commande ne sont pas interprétables, donc une réussite ne
 *   peut pas être écartée. Repli explicite : le Relay garde son issue. C'est la limite assumée
 *   de la CLI, qui ne distingue alors pas une lecture réelle d'une réponse inventée.
 *
 * Pour la tâche `review`, les trois statuts refusent la publication : publier est une action
 * publique que PALABRE ne peut pas défaire.
 */
export interface ReadAccessDiagnostic {
  status: "blocked" | "partial" | "unverified";
  reason: "windows-process-access-denied";
  failedCommands: number;
  /**
   * Commandes terminées avec succès **après le premier refus**, et non sur tout le tour : c'est
   * ce décompte qui sépare `partial` (> 0) de `blocked` (aucune réussite). Présent seulement pour
   * `partial` ; `blocked` est déjà explicite et aucun décompte fiable n'existe pour `unverified`.
   */
  succeededCommands?: number;
}

/** Interprétation de la sortie d'une CLI fournisseur, produite par son adapter. */
export interface ExchangeInterpretation {
  /** Diagnostic d'outils, indépendant de la réponse et de sa délivrance. */
  readAccess?: ReadAccessDiagnostic;
  /** `true` si la CLI signale un échec (exit non nul, erreur déclarée, sortie incomplète). */
  isError: boolean;
  /** Réponse finale ; jamais renseignée quand `isError`. */
  reply?: string;
  identity: SessionIdentity;
  /** Identifiants bruts rapportés par la CLI, pour diagnostic seulement. */
  reportedSessionIds: string[];
  /** Modèles réellement observés dans la réponse. */
  observedModels: string[];
  /** Messages d'erreur rapportés par la CLI. */
  errors: string[];
}

/**
 * Preuve de délivrance lue dans l'historique de la cible :
 * - `persisted` : le nonce figure dans une entrée utilisateur (`true`), n'y figure pas (`false`,
 *   ce qui ne prouve pas la non-délivrance), ou l'historique est illisible (`unknown`) ;
 * - `inActiveBranch` : diagnostic seulement, jamais utilisé pour décider du statut.
 */
export interface DeliveryEvidence {
  persisted: boolean | "unknown";
  inActiveBranch: boolean | "unknown";
  detail: string;
}

/**
 * Statut de délivrance :
 * - `replied` : réponse capturée, identité cohérente ;
 * - `not-delivered` : refus certain sans écriture (avant lancement, ou refus documenté de la CLI) ;
 * - `persisted-no-reply` : le nonce est dans l'historique, sans réponse valide ;
 * - `unknown` : aucune preuve dans un sens ou dans l'autre.
 */
export type DeliveryStatus = "replied" | "not-delivered" | "persisted-no-reply" | "unknown";

export interface DeliveryVerdict {
  status: DeliveryStatus;
  persisted: boolean | "unknown";
  inActiveBranch: boolean | "unknown";
}

/** Refus de CLI observés sans aucune écriture dans l'historique de la cible. */
export type CertainRefusal = "target-busy" | "session-not-found";

/**
 * Issue d'un relay ; le code de sortie associé est dans `RELAY_EXIT_CODES` (`outcome.ts`).
 * `target-not-open` n'est produit qu'avec `--open` (B1) : la sortie sans `--open` ne le rencontre pas.
 * `followed` n'est produit qu'avec `--open --follow` (#195), `checked` qu'avec `--check` (#203).
 */
export type RelayStatus =
  | "replied"
  /**
   * Suivi seulement (`--open --follow`, #195) : réponse du premier tour terminé après l'appel, sans
   * message déposé. Ce n'est pas la réponse à un message PALABRE et son auteur n'est pas vérifié.
   */
  | "followed"
  /**
   * Vérification seulement (`--check`, #203) : les contrôles d'avant envoi sont passés, rien n'a été
   * envoyé ni écrit, aucune CLI de l'équipier n'a été lancée (sous macOS/Linux, seule la sonde du
   * verrou lance `python3`). Un refus que l'envoi aurait reçu garde son propre statut et son code.
   */
  | "checked"
  /**
   * Réservé, plus émis depuis la correction du faux négatif Windows (issue 171) : un lancement de
   * commande refusé ne dégrade plus un échange réussi. La valeur reste dans le contrat v1 pour les
   * exports et les intégrations existants, et `task.error` la conserve pour une revue non publiée.
   */
  | "read-unavailable"
  | "review-failed"
  | "internal-error"
  | "cli-failure"
  | "no-valid-reply"
  | "usage-limit"
  | "output-too-large"
  | "target-busy"
  | "target-state-unknown"
  | "target-not-open"
  | "neutralization-failed"
  | "timeout"
  | "identity-mismatch"
  | "session-not-found"
  | "command-not-found"
  | "invalid-request"
  | "cancelled";

/** Raison détaillée d'une issue `invalid-request`. */
export type InvalidRequestReason =
  | "opencode-cli-unsupported"
  | "write-unavailable"
  | "write-approval-required"
  | "write-approval-invalid"
  | "task-not-allowed"
  | "invalid-pr"
  | "review-unavailable"
  | "review-cli-unsupported"
  | "invalid-arguments"
  | "invalid-session-id"
  | "message-too-large"
  | "unknown-agent"
  | "unsupported-agent"
  | "config-untrusted"
  | "config-unavailable"
  | "unsupported-executable"
  | "invalid-working-directory";

/** Issue d'un relay et code de sortie ; `reason` n'est présent que pour `invalid-request`. */
export interface RelayOutcome {
  status: RelayStatus;
  exitCode: number;
  reason?: InvalidRequestReason;
}
