/** @file Contrats partagés entre modules : agents, config, options de débat et résultats de session. */

/** Rôle fonctionnel de l'agent dans le débat. Non décoratif : guide les prompts et les modes d'orchestration futurs. */
export type AgentRole =
  | "implementer"
  | "reviewer"
  | "architect"
  | "scout"
  | "critic"
  | "summarizer";

/** Niveau de ressources de l'agent. Positionne Ollama en rôle secondaire par défaut. */
export type AgentTier = "primary" | "premium" | "local";

/** Mode de transmission du prompt au processus CLI. `stdin` pipe le prompt ; `argument` le passe en argument positionnel. */
export type CliPromptMode = "stdin" | "argument";

/** Langue de l'interface Palabre. Distincte de la future langue demandée aux agents pour le débat. */
export type Language = "fr" | "en";

/** Mode d'orchestration d'une session Palabre. */
export type PalabreMode = "debate" | "ask";

/** Interface utilisateur par défaut pour les sessions interactives. */
export type PalabreInterface = "tui" | "terminal";

/** Propriétés partagées par tous les adapters. Étendu par `CliAgentConfig` et `OllamaAgentConfig`. */
export interface BaseAgentConfig {
  role: AgentRole;
  tier?: AgentTier;
  systemPrompt?: string;
}

/**
 * Config de l'adapter CLI. Le champ `type` discrimine l'union `AgentConfig`.
 *
 * `idleTimeoutMs` est optionnel : certains modèles restent silencieux longtemps avant de répondre.
 * Sur Windows, `shell: true` peut être nécessaire pour les wrappers npm shimés.
 * `maxOutputBytes` plafonne le cumul stdout + stderr : ce budget protège la mémoire du
 * process Palabre (les deux flux sont bufferisés), pas seulement la taille de la réponse.
 */
export interface CliAgentConfig extends BaseAgentConfig {
  type: "cli";
  command: string;
  args?: string[];
  promptMode?: CliPromptMode;
  modelArg?: string;
  model?: string;
  shell?: boolean;
  allowEmptyOutput?: boolean;
  timeoutMs?: number;
  idleTimeoutMs?: number;
  maxOutputBytes?: number;
}

/**
 * Config de l'adapter Ollama. Le champ `type` discrimine l'union `AgentConfig`.
 *
 * `autoPullModel` est désactivé par défaut : un modèle peut peser plusieurs Go.
 */
export interface OllamaAgentConfig extends BaseAgentConfig {
  type: "ollama";
  model: string;
  baseUrl?: string;
  temperature?: number;
  keepAlive?: string | number;
  validateModel?: boolean;
  autoPullModel?: boolean;
  pullTimeoutMs?: number;
  unloadOtherModels?: boolean;
  timeoutMs?: number;
}

/** Union discriminée par `type`. Utilisez `config.type` pour narrower vers l'adapter correspondant. */
/**
 * Config d'un adapter CLI lancé dans un pseudo-terminal.
 * À utiliser uniquement pour les CLIs qui ne produisent pas de stdout capturable en mode batch.
 */
export interface CliPtyAgentConfig extends Omit<CliAgentConfig, "type"> {
  type: "cli-pty";
  cols?: number;
  rows?: number;
}

export type AgentConfig = CliAgentConfig | CliPtyAgentConfig | OllamaAgentConfig;

/** Config racine issue de `palabre.config.json`. */
export interface PalabreConfig {
  language?: Language;
  outputDir?: string;
  defaults?: {
    interface?: PalabreInterface;
    mode?: PalabreMode;
    agentA?: string;
    agentB?: string;
    askAgents?: string[];
    summaryAgent?: string;
    askSummaryAgent?: string;
    turns?: number;
  };
  agents: Record<string, AgentConfig>;
}

/** Entrée du transcript. Immuable une fois ajoutée par l'orchestrateur. */
export interface DebateMessage {
  agent: string;
  role: AgentRole;
  content: string;
  createdAt: string;
}

/** Paramètres complets d'une session de débat. Transmis à travers toutes les couches sans mutation. */
export interface DebateOptions {
  mode: PalabreMode;
  language: Language;
  topic: string;
  agentA: string;
  agentB: string;
  askAgents?: string[];
  turns: number;
  session: SessionContext;
  files: ProjectFileContext[];
  modelA?: string;
  modelB?: string;
  ollamaUrl?: string;
  pullModels: boolean;
  summaryAgent: string;
  summaryModel?: string;
  summaryEnabled: boolean;
  earlyStopOnAgreement: boolean;
  plainOutput: boolean;
  signal?: AbortSignal;
}

/** Données fournies à l'adapter pour générer une réponse. Reconstruit à chaque tour par l'orchestrateur. */
export interface AgentPrompt {
  language?: Language;
  topic: string;
  turn: number;
  totalTurns: number;
  selfName: string;
  peerName: string;
  selfRole: AgentRole;
  mode?: "debate" | "ask" | "summary";
  session: SessionContext;
  files: ProjectFileContext[];
  transcript: DebateMessage[];
  signal?: AbortSignal;
}

/**
 * Réponse brute de l'adapter.
 * `content` est le texte exploitable ; `raw` est la sortie non parsée si l'adapter la conserve.
 */
export interface AgentResponse {
  content: string;
  raw?: string;
}

/** Descripteur statique des fonctionnalités supportées par l'adapter. Déclaré par l'adapter, lu par l'orchestrateur. */
export interface AdapterCapabilities {
  mode: "batch" | "http" | "pty";
  supportsModelOverride: boolean;
  supportsFilesystemAccess: boolean;
  supportsStreaming: boolean;
  supportsProcessExitCode: boolean;
  supportsStderr: boolean;
}

/**
 * Contrat déclaré par l'adapter.
 * L'orchestrateur s'appuie sur ce contrat plutôt que sur des comportements implicites par adapter.
 */
export interface AdapterContract {
  name: string;
  kind: AgentConfig["type"];
  capabilities: AdapterCapabilities;
  guarantees: {
    rejectsEmptyOutput: boolean;
    rejectsNonZeroExit: boolean;
    rejectsTimeout: boolean;
    returnsRawOutput: boolean;
  };
}

/** Discriminant stable pour les erreurs d'adapter. Utilisé dans `AdapterError.kind`. */
export type AdapterFailureKind =
  | "command-not-found"
  | "spawn-failed"
  | "cancelled"
  | "timeout"
  | "idle-timeout"
  | "output-too-large"
  | "empty-output"
  | "usage-limit"
  | "non-zero-exit"
  | "model-unavailable"
  | "unsupported-model"
  | "model-pull-failed"
  | "http-error"
  | "unknown";

/**
 * Interface que tout adapter doit implémenter.
 * Invariant : si `contract.guarantees.rejectsEmptyOutput` est vrai, `generate` ne doit jamais résoudre avec un `content` vide.
 */
export interface AgentAdapter {
  name: string;
  role: AgentRole;
  contract: AdapterContract;
  generate(prompt: AgentPrompt): Promise<AgentResponse>;
}

/**
 * Fichier texte résolu, injecté dans le prompt.
 * `path` est relatif au CWD ; `absolutePath` est résolu au moment du chargement.
 */
export interface ProjectFileContext {
  path: string;
  absolutePath: string;
  content: string;
  sizeBytes: number;
}

/** Contexte factuel de la session, construit une seule fois au lancement et partagé entre tous les agents. */
export interface SessionContext {
  startedAt: string;
  localDate: string;
  timeZone: string;
  cwd: string;
}

/** Synthèse finale du débat. Structurellement similaire à `DebateMessage` mais sémantiquement distincte. */
export interface DebateSummary {
  agent: string;
  role: AgentRole;
  content: string;
  createdAt: string;
}

/** Phase stable où une erreur runtime a interrompu le débat. */
export type DebateFailurePhase = "debate" | "ask" | "summary";

/** Erreur runtime structurée exposée aux renderers et intégrations. */
export interface DebateFailure {
  phase: DebateFailurePhase;
  agent?: string;
  role?: AgentRole;
  turn?: number;
  kind: AdapterFailureKind | "unknown";
  message: string;
  details?: Record<string, unknown>;
}

/** Métadonnées d'un agent affichées dans le récap de démarrage. */
export interface DebateStartAgentInfo {
  name: string;
  role: AgentRole;
  type: AgentConfig["type"];
}

/** Interface d'observation du rendu. Découple l'orchestrateur du rendu console, TUI ou tout autre backend. */
export interface DebateRenderer {
  start(options: DebateOptions, agents?: DebateStartAgentInfo[]): void;
  notice(message: string): void;
  warning(message: string): void;
  turnStart(turn: number, totalTurns: number, agent: string, role: AgentRole): void;
  askResponseStart?(response: number, totalResponses: number, agent: string, role: AgentRole): void;
  thinkingStart(agent: string, role: AgentRole): void;
  thinkingEnd(): void;
  message(content: string): void;
  askResponseMessage?(content: string): void;
  summaryStart(agent: string, role: AgentRole): void;
  error(failure: DebateFailure): void;
  done(outputPath: string): void;
}
