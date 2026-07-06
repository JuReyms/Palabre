/** @file Chargement, génération et validation de la config Palabre, ainsi que la synchronisation des agents/modèles Ollama détectés. */
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { applyDetectedCommands, detectedAgentNames } from "./agentRegistry.js";
import { refreshTrustedConfig } from "./configTrust.js";
import type { CliAgentConfig, PalabreConfig } from "./types.js";
import type { ToolDiscovery } from "./discovery.js";
import type { Messages } from "./messages/index.js";

export const DEFAULT_CONFIG_PATH = "palabre.config.json";
export const LEGACY_CONFIG_PATH = "chicane.config.json";
export const CONFIG_DIR_NAME = ".palabre";
export const GLOBAL_CONFIG_PATH = path.join(os.homedir(), CONFIG_DIR_NAME, DEFAULT_CONFIG_PATH);
export const GLOBAL_LEGACY_CONFIG_PATH = path.join(os.homedir(), CONFIG_DIR_NAME, LEGACY_CONFIG_PATH);
export const DEFAULT_OLLAMA_MODEL = "nemotron-3-nano:4b";
export const DEFAULT_OUTPUT_DIR = ".palabre";

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
      args: [
        "exec",
        "--skip-git-repo-check",
        "--color",
        "never",
        "--sandbox",
        "read-only",
        "-"
      ],
      promptMode: "stdin",
      shell: process.platform === "win32",
      role: "implementer",
      tier: "primary"
    },
    claude: {
      type: "cli",
      command: process.platform === "win32" ? "claude.exe" : "claude",
      args: [
        "--print",
        "--output-format",
        "text",
        "--no-session-persistence"
      ],
      promptMode: "stdin",
      shell: false,
      role: "reviewer",
      tier: "primary"
    },
    antigravity: {
      type: "cli-pty",
      command: "agy",
      args: [
        "--print-timeout",
        "5m0s",
        "--print"
      ],
      promptMode: "argument",
      role: "reviewer",
      tier: "primary",
      timeoutMs: 300_000
    },
    opencode: {
      type: "cli",
      command: "opencode",
      args: [
        "run"
      ],
      promptMode: "stdin",
      modelArg: "--model",
      shell: process.platform === "win32",
      role: "reviewer",
      tier: "primary"
    },
    vibe: {
      type: "cli",
      command: "vibe",
      args: [
        "--output",
        "text",
        "--trust",
        "--prompt"
      ],
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
  return JSON.parse(raw) as PalabreConfig;
}

/**
 * Valide qu'une config chargée est exploitable pour lancer un débat.
 *
 * `loadConfig` se contente de parser le JSON ; cette garde attrape les configs
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

function migrateKnownAgentDefaults(config: PalabreConfig): void {
  migrateVibePlanAgent(config);
}

function migrateVibePlanAgent(config: PalabreConfig): void {
  const agent = config.agents.vibe;

  if (agent?.type !== "cli" || !isLegacyVibePlanArgs(agent.args)) {
    return;
  }

  agent.args = ["--output", "text", "--trust", "--prompt"];
}

function isLegacyVibePlanArgs(args: CliAgentConfig["args"]): boolean {
  return JSON.stringify(args) === JSON.stringify(["--output", "text", "--agent", "plan", "--trust", "--prompt"]);
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
export async function writeConfig(
  configPath = DEFAULT_CONFIG_PATH,
  config: PalabreConfig = exampleConfig
): Promise<void> {
  const resolved = path.resolve(configPath);
  await mkdir(path.dirname(resolved), { recursive: true });
  await writeFile(resolved, `${JSON.stringify(config, null, 2)}\n`, "utf8");
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
