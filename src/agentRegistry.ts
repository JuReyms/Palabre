/** @file Source de vérité unique reliant les agents CLI connus à leur détection locale (voir docs/dev/architecture.md, section "Registre d'agents connus"). */
import type { CommandDetection, ToolDiscovery } from "./discovery.js";
import path from "node:path";
import { statSync } from "node:fs";
import type { AgentConfig, CliAgentConfig, CliRuntimeProfile, PalabreConfig } from "./types.js";

/**
 * Descripteur d'un agent CLI connu de Palabre.
 *
 * Source de vérité unique pour relier un nom de commande à une entrée de
 * découverte locale. Ajouter un agent CLI ici suffit à le faire reconnaître
 * partout (détection, doctor, presets, wizard, génération de config), au lieu
 * de dupliquer le mapping `command -> discovery` dans chaque module.
 */
interface KnownCliAgent {
  /** Clé de l'agent dans `config.agents` et nom retourné par `detectedAgentNames`. */
  configKey: string;
  /** Noms de commande reconnus (après `normalizeCommandName`) qui mappent vers cet agent. */
  commandAliases: readonly string[];
  /** Clé correspondante dans `ToolDiscovery`. */
  discoveryKey: "codex" | "claude" | "antigravity" | "opencode" | "vibe";
  /**
   * Fournisseur de session externe pris en charge par `palabre relay` (voir docs/dev/relay.md, section
   * "Relay externe"). Absent pour les CLIs dont la reprise de session n'est pas vérifiée.
   */
  externalSession?: "codex" | "claude" | "opencode";
  /** Délai par défaut connu (ms) quand la configuration n'en fixe aucun valide, arguments personnalisés compris. */
  defaultTimeoutMs?: number;
  /**
   * Sortie qualifiée, appliquée en mémoire au seul défaut exact d'arguments (`args`) avec prompt sur
   * stdin et sans `responseFormat`. Une configuration personnalisée garde ses arguments.
   */
  batchProfile?: { args: readonly string[]; extraArgs: readonly string[]; output: CliRuntimeProfile["output"] };
}

/**
 * Agents CLI connus, dans l'ordre d'affichage canonique.
 * `ollama-local` n'est pas listé ici : ce n'est pas une commande CLI, il est
 * géré séparément via `discovery.ollama`.
 */
const KNOWN_CLI_AGENTS: readonly KnownCliAgent[] = [
  { configKey: "codex", commandAliases: ["codex"], discoveryKey: "codex", externalSession: "codex" },
  { configKey: "claude", commandAliases: ["claude"], discoveryKey: "claude", externalSession: "claude" },
  { configKey: "antigravity", commandAliases: ["agy", "antigravity"], discoveryKey: "antigravity" },
  // OpenCode 2.0.32 qualifié : sortie JSON structurée et 15 min par défaut (réponses lentes observées).
  { configKey: "opencode", commandAliases: ["opencode"], discoveryKey: "opencode", externalSession: "opencode",
    defaultTimeoutMs: 900_000, batchProfile: { args: ["run"], extraArgs: ["--format", "json"], output: "opencode-json" } },
  { configKey: "vibe", commandAliases: ["vibe"], discoveryKey: "vibe" }
];

/** Agents retirés conservés uniquement pour lire les anciennes configurations. */
const RETIRED_AGENT_NAMES = new Set(["gemini"]);

/** Indique qu'un nom d'agent ne doit plus être proposé ni exposé aux intégrations. */
export function isRetiredAgentName(name: string): boolean {
  return RETIRED_AGENT_NAMES.has(name.toLowerCase());
}

/** Retourne uniquement les agents configurés encore actifs dans le produit. */
export function activeConfiguredAgentEntries(
  config: Pick<PalabreConfig, "agents">
): Array<[string, AgentConfig]> {
  return Object.entries(config.agents).filter(([name]) => !isRetiredAgentName(name));
}

/** Retourne les noms configurés qui peuvent encore être proposés à l'utilisateur. */
export function activeConfiguredAgentNames(config: Pick<PalabreConfig, "agents">): string[] {
  return activeConfiguredAgentEntries(config).map(([name]) => name);
}
/** Clé de config de l'agent Ollama local par défaut. */
export const OLLAMA_AGENT_KEY = "ollama-local";

/**
 * Extrait le nom de base d'une commande en supprimant le chemin et l'extension
 * exécutable Windows éventuelle (ex. `C:\bin\claude.cmd` → `claude`).
 */
export function normalizeCommandName(command: string): string {
  return command
    .split(/[\\/]/)
    .pop()
    ?.toLowerCase()
    .replace(/\.(exe|cmd|bat|ps1)$/i, "") ?? command.toLowerCase();
}

/**
 * Fournisseur de session externe d'une commande d'agent CLI connue, pour `palabre relay`.
 * Retourne `undefined` pour une CLI connue sans reprise vérifiée ou pour une commande custom :
 * Palabre ne connaît pas sa sémantique de reprise.
 */
export function externalSessionProviderForCommand(command: string): "codex" | "claude" | "opencode" | undefined {
  const normalized = normalizeCommandName(command);
  return KNOWN_CLI_AGENTS.find((agent) => agent.commandAliases.includes(normalized))?.externalSession;
}

/**
 * Profil d'exécution d'un agent CLI connu, ou `undefined`. Deux décisions séparées : le délai par
 * défaut connu s'applique sans délai explicite valide, arguments personnalisés compris ; la sortie
 * qualifiée (`runtime`) seulement au défaut exact d'arguments, prompt sur stdin, sans format explicite.
 * Aucune détection par nom de modèle. Retourne une copie : commande gardée, valeurs explicites
 * valides conservées, configuration chargée ou approuvée jamais modifiée ni écrite.
 */
export function cliRuntimeProfile(config: AgentConfig): { config: CliAgentConfig; runtime?: CliRuntimeProfile } | undefined {
  if (config.type !== "cli") return undefined;
  const known = KNOWN_CLI_AGENTS.find((agent) => agent.commandAliases.includes(normalizeCommandName(config.command)));
  if (!known || (known.defaultTimeoutMs === undefined && !known.batchProfile)) return undefined;
  const explicitTimeout = config.timeoutMs !== undefined && Number.isFinite(config.timeoutMs) && config.timeoutMs > 0;
  const timeoutMs = explicitTimeout ? config.timeoutMs : known.defaultTimeoutMs ?? config.timeoutMs;
  const output = known.batchProfile;
  const exact = output !== undefined && config.responseFormat === undefined && (config.promptMode ?? "stdin") === "stdin"
    && config.args !== undefined && JSON.stringify(config.args) === JSON.stringify(output.args);
  return {
    config: { ...config, ...(exact ? { args: [...output.args, ...output.extraArgs] } : {}), ...(timeoutMs !== undefined ? { timeoutMs } : {}) },
    ...(exact ? { runtime: { output: output.output } } : {})
  };
}

/**
 * Reconnaît les formes absolues POSIX, Windows et UNC, indépendamment de la plateforme hôte.
 */
export function isAbsoluteCommand(command: string): boolean {
  return path.isAbsolute(command) || path.win32.isAbsolute(command);
}

/** Un chemin absolu vérifie son fichier ; sinon, découverte connue ou undefined pour une CLI custom. */
export function detectionForCommand(command: string, discovery: ToolDiscovery): CommandDetection | undefined {
  if (isAbsoluteCommand(command)) {
    let available = false;
    try { available = path.isAbsolute(command) && statSync(command).isFile(); } catch { /* Missing or unreadable configured file. */ }
    return { available, command, path: command };
  }
  const normalized = normalizeCommandName(command);
  const known = KNOWN_CLI_AGENTS.find((agent) => agent.commandAliases.includes(normalized));

  return known ? discovery[known.discoveryKey] : undefined;
}

/**
 * Liste les clés d'agents connus effectivement détectés localement, dans
 * l'ordre canonique (`codex`, `claude`, `antigravity`, `opencode`, `vibe`,
 * puis `ollama-local`).
 */
export function detectedAgentNames(discovery: ToolDiscovery): string[] {
  const names = KNOWN_CLI_AGENTS
    .filter((agent) => discovery[agent.discoveryKey].available)
    .map((agent) => agent.configKey);

  if (discovery.ollama.available) {
    names.push(OLLAMA_AGENT_KEY);
  }

  return names;
}

/**
 * Applique les chemins de commande résolus localement aux agents CLI connus
 * d'une config. Mute `config` : l'appelant est responsable de la cloner au besoin.
 * Sans détection disponible ou avec un chemin absolu déjà déclaré, conserve la commande.
 * Un chemin absent n'est pas remplacé silencieusement ; le diagnostic reste celui de la CLI.
 */
export function applyDetectedCommands(config: PalabreConfig, discovery: ToolDiscovery): void {
  for (const agent of KNOWN_CLI_AGENTS) {
    const detection = discovery[agent.discoveryKey];
    const cfg = config.agents[agent.configKey];

    if (detection.available && cfg && (cfg.type === "cli" || cfg.type === "cli-pty")) {
      if (typeof cfg.command === "string" && isAbsoluteCommand(cfg.command)) continue;
      cfg.command = detection.command;
    }
  }
}

/**
 * Indique si un agent de config est détecté localement.
 * Pour Ollama, reflète l'accessibilité du serveur ; pour les CLIs connues, l'état
 * de découverte, ou le fichier configuré pour un chemin absolu ; pour une CLI custom sans chemin
 * absolu, retourne `true` (faute de connaître sa sémantique).
 */
export function isAgentDetected(name: string, config: AgentConfig, discovery: ToolDiscovery): boolean {
  if (config.type === "ollama") {
    return discovery.ollama.available;
  }

  const detection = detectionForCommand(config.command || name, discovery);
  return detection ? detection.available : true;
}
