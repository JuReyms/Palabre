import type { CommandDetection, ToolDiscovery } from "./discovery.js";
import type { AgentConfig, PalabreConfig } from "./types.js";

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
}

/**
 * Agents CLI connus, dans l'ordre d'affichage canonique.
 * `ollama-local` n'est pas listé ici : ce n'est pas une commande CLI, il est
 * géré séparément via `discovery.ollama`.
 */
const KNOWN_CLI_AGENTS: readonly KnownCliAgent[] = [
  { configKey: "codex", commandAliases: ["codex"], discoveryKey: "codex" },
  { configKey: "claude", commandAliases: ["claude"], discoveryKey: "claude" },
  { configKey: "antigravity", commandAliases: ["agy", "antigravity"], discoveryKey: "antigravity" },
  { configKey: "opencode", commandAliases: ["opencode"], discoveryKey: "opencode" },
  { configKey: "vibe", commandAliases: ["vibe"], discoveryKey: "vibe" }
];

/** Agents retirés conservés uniquement pour lire les anciennes configurations. */
const RETIRED_AGENT_NAMES = new Set(["gemini"]);

/** Indique qu'un nom d'agent ne doit plus être proposé ni exposé aux intégrations. */
export function isRetiredAgentName(name: string): boolean {
  return RETIRED_AGENT_NAMES.has(name.toLowerCase());
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
 * Résout l'entrée de découverte d'une commande d'agent CLI connue.
 * Retourne `undefined` pour une commande custom non reconnue : Palabre ne peut
 * pas connaître sa sémantique sans la lancer, donc l'appelant la considère
 * généralement comme disponible.
 */
export function detectionForCommand(command: string, discovery: ToolDiscovery): CommandDetection | undefined {
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
 * Sans détection disponible, l'agent garde la commande déjà déclarée.
 */
export function applyDetectedCommands(config: PalabreConfig, discovery: ToolDiscovery): void {
  for (const agent of KNOWN_CLI_AGENTS) {
    const detection = discovery[agent.discoveryKey];
    const cfg = config.agents[agent.configKey];

    if (detection.available && cfg && (cfg.type === "cli" || cfg.type === "cli-pty")) {
      cfg.command = detection.command;
    }
  }
}

/**
 * Indique si un agent de config est détecté localement.
 * Pour Ollama, reflète l'accessibilité du serveur ; pour les CLIs connues, l'état
 * de découverte ; pour une CLI custom inconnue, retourne `true` (faute de pouvoir vérifier).
 */
export function isAgentDetected(name: string, config: AgentConfig, discovery: ToolDiscovery): boolean {
  if (config.type === "ollama") {
    return discovery.ollama.available;
  }

  const detection = detectionForCommand(config.command || name, discovery);
  return detection ? detection.available : true;
}
