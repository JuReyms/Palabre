/** @file Chargement, génération et validation de la config Palabre, ainsi que la synchronisation des agents/modèles Ollama détectés. */
import { access, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { applyDetectedCommands, detectedAgentNames, normalizeCommandName } from "./agentRegistry.js";
import { refreshTrustedConfig } from "./configTrust.js";
import { validateRelayPolicy } from "./externalSessions/review.js";
import { writeTextFileAtomically } from "./atomicFile.js";
import type { CliAgentConfig, PalabreConfig } from "./types.js";
import type { ToolDiscovery } from "./discovery.js";
import type { Messages } from "./messages/index.js";

/** Nom de la configuration Palabre courante dans un dossier de projet. */
export const DEFAULT_CONFIG_PATH = "palabre.config.json";
/** Ancien nom de configuration conservé uniquement pour la migration. */
export const LEGACY_CONFIG_PATH = "chicane.config.json";
/** Dossier utilisateur et projet réservé aux données Palabre. */
export const CONFIG_DIR_NAME = ".palabre";
/** Chemin de la configuration globale Palabre. */
export const GLOBAL_CONFIG_PATH = path.join(os.homedir(), CONFIG_DIR_NAME, DEFAULT_CONFIG_PATH);
/** Chemin de l'ancienne configuration globale, lu seulement pour la migration. */
export const GLOBAL_LEGACY_CONFIG_PATH = path.join(os.homedir(), CONFIG_DIR_NAME, LEGACY_CONFIG_PATH);
/** Modèle Ollama léger retenu lorsqu'aucun modèle local n'est détecté. */
export const DEFAULT_OLLAMA_MODEL = "nemotron-3-nano:4b";
/** Dossier de sortie dédié utilisé quand aucun dossier n'est configuré. */
export const DEFAULT_OUTPUT_DIR = ".palabre";

const CLAUDE_SAFE_ARGS = [
  "--print",
  "--output-format",
  "text",
  "--no-session-persistence",
  "--tools",
  "Read,Glob,Grep"
];
const CODEX_SAFE_ARGS = [
  "exec",
  "--skip-git-repo-check",
  "--color",
  "never",
  "--sandbox",
  "read-only"
];
/**
 * OpenCode 2 n'a plus `--pure` (absent dès 2.0.0) et aucun remplaçant n'est qualifié : décision du
 * propriétaire du 28 octobre 2026, Débat/Ask/Chat utilisent l'environnement habituel d'OpenCode,
 * comme Relay sur copie. Plugins, MCP et permissions configurés restent actifs ; aucune lecture
 * seule ni neutralisation n'est promise.
 */
const OPENCODE_DEFAULT_ARGS = ["run"];
const ANTIGRAVITY_LEGACY_ARGS = ["--print-timeout", "5m0s", "--print"];
const ANTIGRAVITY_JSON_ARGS = ["--print-timeout", "5m0s", "--output-format", "json", "--print"];
const VIBE_SAFE_ARGS = [
  "--output",
  "text",
  "--trust",
  "--enabled-tools",
  "read",
  "--enabled-tools",
  "grep",
  "--prompt"
];

/** Configuration complète écrite lors d'une initialisation, avant adaptation à la découverte locale. */
export const exampleConfig: PalabreConfig = {
  language: "fr",
  outputDir: DEFAULT_OUTPUT_DIR,
  defaults: {
    interface: "tui",
    mode: "debate",
    agentA: "codex",
    agentB: "claude",
    askAgents: ["codex", "claude"],
    summaryAgent: "claude",
    askSummaryAgent: "claude",
    turns: 4
  },
  agents: {
    codex: {
      type: "cli",
      command: "codex",
      args: [...CODEX_SAFE_ARGS],
      promptMode: "stdin",
      shell: process.platform === "win32",
      role: "implementer",
      tier: "primary"
    },
    claude: {
      type: "cli",
      command: process.platform === "win32" ? "claude.exe" : "claude",
      args: [...CLAUDE_SAFE_ARGS],
      promptMode: "stdin",
      shell: false,
      role: "reviewer",
      tier: "primary"
    },
    antigravity: {
      type: "cli",
      command: "agy",
      args: [...ANTIGRAVITY_JSON_ARGS],
      responseFormat: "antigravity-json",
      promptMode: "argument",
      shell: process.platform === "win32",
      role: "reviewer",
      tier: "primary",
      timeoutMs: 300_000
    },
    opencode: {
      type: "cli",
      command: "opencode",
      args: [...OPENCODE_DEFAULT_ARGS],
      promptMode: "stdin",
      modelArg: "--model",
      shell: process.platform === "win32",
      role: "reviewer",
      tier: "primary"
    },
    vibe: {
      type: "cli",
      command: "vibe",
      args: [...VIBE_SAFE_ARGS],
      promptMode: "argument",
      modelArg: "--model",
      shell: process.platform === "win32",
      role: "reviewer",
      tier: "primary"
    },
    "ollama-local": {
      type: "ollama",
      baseUrl: "http://localhost:11434",
      model: DEFAULT_OLLAMA_MODEL,
      role: "critic",
      tier: "local",
      temperature: 0.2,
      validateModel: true,
      unloadOtherModels: true
    }
  }
};

/**
 * Résout le dossier d'export effectif.
 * `.` est traité comme l'ancien défaut historique afin de regrouper les exports
 * dans un dossier dédié sans demander de migration manuelle aux utilisateurs.
 */
export function resolveOutputDir(outputDir: string | undefined): string {
  const normalized = outputDir?.trim();
  return !normalized || normalized === "." ? DEFAULT_OUTPUT_DIR : normalized;
}

/** Charge et parse la config depuis `configPath`. Lance une erreur si le fichier est absent ou invalide. */
export async function loadConfig(configPath = DEFAULT_CONFIG_PATH): Promise<PalabreConfig> {
  const resolved = path.resolve(configPath);
  const raw = await readFile(resolved, "utf8");
  const config = JSON.parse(raw) as PalabreConfig;
  if (config?.relay !== undefined) config.relay = validateRelayPolicy(config.relay);
  migrateKnownAgentDefaults(config);
  return config;
}

/**
 * Valide qu'une config chargée est exploitable pour lancer un débat.
 *
 * `loadConfig` parse le JSON et applique les migrations sûres en mémoire ; cette garde attrape les configs
 * structurellement cassées (racine non-objet, bloc `agents` absent ou vide)
 * avant qu'elles ne provoquent un `TypeError` opaque dans l'orchestrateur.
 * Volontairement minimale : la validation sémantique fine (agents par défaut
 * inconnus, timeouts invalides, etc.) reste du ressort de `palabre doctor`.
 *
 * @throws {Error} message actionnable si la config ne peut pas faire tourner un débat.
 */
export function assertRunnableConfig(config: PalabreConfig, messages: Messages, configPath = DEFAULT_CONFIG_PATH): void {
  const root = config as unknown;

  if (!root || typeof root !== "object" || Array.isArray(root)) {
    throw new Error(messages.common.configInvalidShape(configPath));
  }

  const agents = (root as { agents?: unknown }).agents;

  if (!agents || typeof agents !== "object" || Array.isArray(agents)) {
    throw new Error(messages.common.configMissingAgents(configPath));
  }

  if (Object.keys(agents).length === 0) {
    throw new Error(messages.common.configEmptyAgents(configPath));
  }
}

/** Retourne `true` si le fichier de config est accessible en lecture. Silencieux sur toute erreur filesystem. */
export async function configExists(configPath = DEFAULT_CONFIG_PATH): Promise<boolean> {
  try {
    await access(path.resolve(configPath));
    return true;
  } catch {
    return false;
  }
}

/**
 * Résout le chemin de config à utiliser selon l'ordre de priorité :
 * local (`palabre.config.json`) → legacy local → global → legacy global.
 * Retourne le chemin global même s'il n'existe pas encore (cas d'un premier `init`).
 */
export async function resolveDefaultConfigPath(): Promise<string> {
  if (await configExists(DEFAULT_CONFIG_PATH)) {
    return DEFAULT_CONFIG_PATH;
  }

  if (await configExists(LEGACY_CONFIG_PATH)) {
    return LEGACY_CONFIG_PATH;
  }

  if (await configExists(GLOBAL_CONFIG_PATH)) {
    return GLOBAL_CONFIG_PATH;
  }

  if (await configExists(GLOBAL_LEGACY_CONFIG_PATH)) {
    return GLOBAL_LEGACY_CONFIG_PATH;
  }

  return GLOBAL_CONFIG_PATH;
}

/**
 * Construit une `PalabreConfig` complète à partir des outils détectés localement.
 * Ajuste `defaults.agentA/agentB/summaryAgent` en fonction de la paire disponible.
 * Si aucune paire n'est détectée, seuls les defaults sans agent sont conservés.
 */
export function createConfigFromDiscovery(discovery: ToolDiscovery): PalabreConfig {
  const config = cloneConfig(exampleConfig);
  const pair = chooseDefaultPair(discovery);

  applyDetectedCommands(config, discovery);

  const ollamaAgent = config.agents["ollama-local"];
  if (ollamaAgent?.type === "ollama") {
    ollamaAgent.model = chooseDefaultOllamaModel(discovery);
  }

  config.defaults = pair
    ? {
        ...config.defaults,
        interface: config.defaults?.interface ?? "tui",
        mode: config.defaults?.mode ?? "debate",
        agentA: pair[0],
        agentB: pair[1],
        askAgents: pair,
        summaryAgent: chooseDefaultSummaryAgent(pair),
        askSummaryAgent: chooseDefaultSummaryAgent(pair)
      }
    : {
        interface: config.defaults?.interface ?? "tui",
        mode: config.defaults?.mode ?? "debate",
        turns: config.defaults?.turns,
        askAgents: detectedAgentNames(discovery).slice(0, 2)
      };

  return config;
}

/**
 * Ajoute dans `config.agents` les agents détectés localement mais absents de la config.
 * Mute `config` directement ; l'appelant est responsable de persister la config.
 */
export function syncDetectedAgents(config: PalabreConfig, discovery: ToolDiscovery): string[] {
  const discoveredConfig = createConfigFromDiscovery(discovery);
  const missingAgents = detectedAgentNames(discovery).filter((agentName) => !config.agents[agentName]);

  applyDetectedCommands(config, discovery);
  migrateKnownAgentDefaults(config);

  for (const agentName of missingAgents) {
    config.agents[agentName] = discoveredConfig.agents[agentName];
  }

  return missingAgents;
}

/** Anciens défauts d'arguments exactement reconnus, et leur remplacement actuel. */
const LEGACY_ARGS_MIGRATIONS: { agent: string; previous: string[][]; next: string[] }[] = [
  { agent: "codex", previous: [["exec", "--skip-git-repo-check", "--color", "never", "--sandbox", "read-only", "-"]], next: CODEX_SAFE_ARGS },
  { agent: "claude", previous: [["--print", "--output-format", "text", "--no-session-persistence"]], next: CLAUDE_SAFE_ARGS },
  // Ancien défaut exact seulement : une configuration personnalisée qui contient `--pure` reste intacte.
  { agent: "opencode", previous: [["run", "--pure"]], next: OPENCODE_DEFAULT_ARGS },
  {
    agent: "vibe",
    previous: [["--output", "text", "--trust", "--prompt"], ["--output", "text", "--agent", "plan", "--trust", "--prompt"]],
    next: VIBE_SAFE_ARGS
  }
];

/**
 * Remplace des anciens défauts d'arguments **exactement** reconnus par les défauts actuels ; tout
 * tableau personnalisé est conservé tel quel. OpenCode : `["run", "--pure"]` devient `["run"]`.
 * Antigravity migre aussi son ancien transport exact vers JSON batch ; les réglages de transport
 * personnalisés sont exclus. Appliqué en mémoire par `loadConfig` : le fichier reste intact.
 */
function migrateKnownAgentDefaults(config: PalabreConfig): void {
  for (const { agent, previous, next } of LEGACY_ARGS_MIGRATIONS) migrateExactCliArgs(config, agent, previous, next);
  const agent = config.agents.antigravity;
  if (isLegacyAntigravity(agent)) {
    // Même résolution prudente que les autres CLI : natif/shim reconnu sans shell ; wrapper inconnu refusé.
    config.agents.antigravity = { ...agent, type: "cli", args: [...ANTIGRAVITY_JSON_ARGS], responseFormat: "antigravity-json", shell: process.platform === "win32" } as CliAgentConfig;
  }
}

/** Ancien transport exact uniquement : aucun réglage PTY, shell, idle ou format personnalisé ni wrapper explicite. */
function isLegacyAntigravity(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const agent = value as Record<string, unknown>;
  return agent.type === "cli-pty" && typeof agent.command === "string"
    && ["agy", "antigravity"].includes(normalizeCommandName(agent.command))
    && JSON.stringify(agent.args) === JSON.stringify(ANTIGRAVITY_LEGACY_ARGS)
    && agent.promptMode === "argument" && agent.responseFormat === undefined
    && agent.cols === undefined && agent.rows === undefined
    && agent.shell === undefined && agent.idleTimeoutMs === undefined
    && !/\.(cmd|bat|ps1)$/i.test(agent.command);
}

/** Agents dont le JSON brut contient un ancien défaut exact (arguments, ou transport Antigravity). */
function legacyArgsAgents(raw: unknown): string[] {
  const agents = (raw as { agents?: Record<string, { type?: unknown; args?: unknown }> } | null)?.agents;
  if (!agents || typeof agents !== "object") return [];
  return [...LEGACY_ARGS_MIGRATIONS
    .filter(({ agent, previous }) => agents[agent]?.type === "cli" && previous.some((args) => JSON.stringify(agents[agent]?.args) === JSON.stringify(args)))
    .map(({ agent }) => agent), ...(isLegacyAntigravity(agents.antigravity) ? ["antigravity"] : [])];
}

/**
 * Agents dont le fichier `configPath` contient encore un ancien défaut d'arguments exact, avant la
 * migration en mémoire de `loadConfig`. Fichier illisible ou invalide : aucun.
 */
export async function legacyArgsInConfigFile(configPath: string): Promise<string[]> {
  try { return legacyArgsAgents(JSON.parse(await readFile(path.resolve(configPath), "utf8"))); } catch { return []; }
}

/** Résultat de `persistAgentSync` ; `conflict` : fichier modifié depuis son chargement, rien n'est écrit. */
export interface PersistedAgentSync extends DetectedAgentsSyncResult {
  conflict?: true;
}

/** Options de `persistAgentSync`. */
export interface PersistAgentSyncOptions {
  /**
   * Écrire aussi quand seul un ancien défaut d'arguments reste dans le fichier (vrai par défaut :
   * synchronisation demandée explicitement). L'accueil TUI, automatique, le désactive.
   */
  persistLegacyArgs?: boolean;
}

/**
 * Synchronise les agents détectés et écrit la configuration si elle change, **y compris** quand seul
 * un ancien défaut d'arguments reste dans le fichier (déjà migré en mémoire par `loadConfig`), sauf
 * `persistLegacyArgs: false`. L'écriture rafraîchit une approbation existante. Parcours partagés :
 * `palabre config --sync-agents`, action « synchroniser » de l'assistant `palabre config` et accueil TUI.
 *
 * Protection contre une édition concurrente : le fichier relu au départ doit correspondre à
 * `config` (chargé et migré), puis rester identique octet pour octet jusqu'à l'écriture ; sinon
 * `conflict`, sans écriture. Un fichier devenu illisible ou invalide compte comme modifié. On ne
 * reconstruit pas depuis le fichier modifié, qui n'a pas été approuvé : l'écriture rafraîchirait son
 * approbation. Après un conflit, `config` peut déjà contenir la synchronisation en mémoire. La
 * découverte (`discover`) peut être lente, d'où le contrôle avant écriture ; il réduit la course sans
 * la rendre atomique : une édition entre ce dernier contrôle et le remplacement du fichier peut encore
 * être écrasée.
 */
export async function persistAgentSync(
  configPath: string,
  config: PalabreConfig,
  discover: () => Promise<ToolDiscovery>,
  options: PersistAgentSyncOptions = {}
): Promise<PersistedAgentSync> {
  const resolved = path.resolve(configPath);
  const conflict: PersistedAgentSync = { addedAgents: [], changed: false, conflict: true };
  const initial = await readFile(resolved, "utf8").catch(() => undefined);
  if (initial === undefined) return conflict;
  let raw: unknown;
  try {
    raw = JSON.parse(initial);
    const reloaded = structuredClone(raw) as PalabreConfig;
    if (reloaded?.relay !== undefined) reloaded.relay = validateRelayPolicy(reloaded.relay);
    migrateKnownAgentDefaults(reloaded);
    if (JSON.stringify(reloaded) !== JSON.stringify(config)) return conflict;
  } catch {
    return conflict;
  }
  const legacy = options.persistLegacyArgs === false ? [] : legacyArgsAgents(raw);
  const result = syncDetectedAgentsDetailed(config, await discover());
  if (!result.changed && legacy.length === 0) return { addedAgents: result.addedAgents, changed: false };
  if (await readFile(resolved, "utf8").catch(() => undefined) !== initial) return conflict;
  await writeConfig(resolved, config);
  return { addedAgents: result.addedAgents, changed: true };
}

function migrateExactCliArgs(
  config: PalabreConfig,
  agentName: string,
  previousArgs: string[][],
  nextArgs: string[]
): void {
  const agent = config.agents[agentName];
  if (agent?.type !== "cli" || !previousArgs.some((args) => sameArgs(agent.args, args))) {
    return;
  }
  agent.args = [...nextArgs];
}

function sameArgs(args: CliAgentConfig["args"], expected: string[]): boolean {
  return JSON.stringify(args) === JSON.stringify(expected);
}

/** Résultat d'un changement de modèle Ollama, utilisé pour formater une notice utilisateur. */
export interface OllamaModelSyncResult {
  previousModel: string;
  nextModel: string;
}

/** Résultat détaillé de `syncDetectedAgents`, distinguant les agents ajoutés du reste (roles/args migrés). */
export interface DetectedAgentsSyncResult {
  addedAgents: string[];
  changed: boolean;
}

/**
 * Variante de `syncDetectedAgents` qui indique aussi si la config a changé,
 * même quand aucun agent n'a été ajouté (ex. migration d'arguments legacy).
 */
export function syncDetectedAgentsDetailed(config: PalabreConfig, discovery: ToolDiscovery): DetectedAgentsSyncResult {
  const before = JSON.stringify(config.agents);
  const addedAgents = syncDetectedAgents(config, discovery);
  const changed = JSON.stringify(config.agents) !== before;

  return {
    addedAgents,
    changed
  };
}

/**
 * Bascule le modèle de l'agent `ollama-local` vers un modèle installé si celui configuré
 * ne l'est pas. Mute `config` directement.
 * @returns `undefined` si l'agent n'est pas de type `ollama`, si aucun modèle n'est installé,
 * ou si le modèle configuré est déjà installé.
 */
export function syncOllamaModel(config: PalabreConfig, discovery: ToolDiscovery): OllamaModelSyncResult | undefined {
  const agent = config.agents["ollama-local"];

  if (agent?.type !== "ollama" || discovery.ollama.models.length === 0) {
    return undefined;
  }

  if (discovery.ollama.models.includes(agent.model)) {
    return undefined;
  }

  const previousModel = agent.model;
  agent.model = chooseDefaultOllamaModel(discovery);
  return {
    previousModel,
    nextModel: agent.model
  };
}

/**
 * Force le modèle de l'agent `ollama-local` à `model`, sans vérifier qu'il est installé.
 * Mute `config` directement.
 * @returns `undefined` si l'agent n'est pas de type `ollama`.
 */
export function setOllamaModel(config: PalabreConfig, model: string): OllamaModelSyncResult | undefined {
  const agent = config.agents["ollama-local"];

  if (agent?.type !== "ollama") {
    return undefined;
  }

  const previousModel = agent.model;
  agent.model = model;
  return {
    previousModel,
    nextModel: agent.model
  };
}

/** Met à jour l'adresse persistante de tous les agents Ollama configurés. */
export function setOllamaBaseUrl(config: PalabreConfig, baseUrl: string): number {
  const agents = Object.values(config.agents).filter((agent) => agent.type === "ollama");

  for (const agent of agents) {
    agent.baseUrl = baseUrl;
  }

  return agents.length;
}

/** Écrit `config` sérialisé en JSON dans `configPath`. Crée le répertoire parent si nécessaire. */
/** Configurations en mémoire dont le fichier a changé hors de cette session : voir `lockConfigWrites`. */
const writeLockedConfigs = new WeakSet<PalabreConfig>();

/**
 * Interdit toute écriture ultérieure de `config` par `writeConfig`. Utilisé par l'accueil TUI après un
 * conflit de `persistAgentSync` : l'objet chargé ne correspond plus au fichier, et le réécrire
 * écraserait l'édition humaine tout en rafraîchissant son approbation. Seul un rechargement (relancer
 * `palabre`) repasse par la validation et l'approbation normales.
 */
export function lockConfigWrites(config: PalabreConfig): void {
  writeLockedConfigs.add(config);
}

/** Vrai si `lockConfigWrites` a été appelé pour cet objet de configuration. */
export function isConfigWriteLocked(config: PalabreConfig): boolean {
  return writeLockedConfigs.has(config);
}

/**
 * Écrit la configuration (atomiquement) et rafraîchit une approbation existante. Refuse, par une
 * erreur, un objet verrouillé par `lockConfigWrites` : garde-fou si un appelant oublie son contrôle.
 */
export async function writeConfig(
  configPath = DEFAULT_CONFIG_PATH,
  config: PalabreConfig = exampleConfig
): Promise<void> {
  const resolved = path.resolve(configPath);
  if (writeLockedConfigs.has(config)) {
    throw new Error(`Configuration write blocked: ${resolved} changed outside this session; restart palabre to reload it.`);
  }
  await writeTextFileAtomically(resolved, `${JSON.stringify(config, null, 2)}\n`);
  await refreshTrustedConfig(resolved);
}

function chooseDefaultOllamaModel(discovery: ToolDiscovery): string {
  if (discovery.ollama.models.includes(DEFAULT_OLLAMA_MODEL)) {
    return DEFAULT_OLLAMA_MODEL;
  }

  return discovery.ollama.models[0] ?? DEFAULT_OLLAMA_MODEL;
}

function chooseDefaultSummaryAgent(pair: [string, string]): string {
  for (const preferred of ["claude", "codex", "antigravity", "vibe"]) {
    if (pair.includes(preferred)) {
      return preferred;
    }
  }

  return pair[1];
}

function chooseDefaultPair(discovery: ToolDiscovery): [string, string] | undefined {
  if (discovery.codex.available && discovery.claude.available) {
    return ["codex", "claude"];
  }

  if (discovery.codex.available && discovery.ollama.available) {
    return ["codex", "ollama-local"];
  }

  if (discovery.claude.available && discovery.ollama.available) {
    return ["claude", "ollama-local"];
  }

  if (discovery.opencode.available && discovery.ollama.available) {
    return ["opencode", "ollama-local"];
  }

  if (discovery.vibe.available && discovery.ollama.available) {
    return ["vibe", "ollama-local"];
  }

  if (discovery.antigravity.available && discovery.ollama.available) {
    return ["antigravity", "ollama-local"];
  }

  const cliAgents = [
    discovery.codex.available ? "codex" : undefined,
    discovery.claude.available ? "claude" : undefined,
    discovery.antigravity.available ? "antigravity" : undefined,
    discovery.opencode.available ? "opencode" : undefined,
    discovery.vibe.available ? "vibe" : undefined
  ].filter((agent): agent is string => Boolean(agent));

  if (cliAgents.length >= 2) {
    return [cliAgents[0], cliAgents[1]];
  }

  return undefined;
}

function cloneConfig(config: PalabreConfig): PalabreConfig {
  return JSON.parse(JSON.stringify(config)) as PalabreConfig;
}
