import path from "node:path";
import type { ToolDiscovery } from "./discovery.js";
import type { AgentConfig, PalabreConfig } from "./types.js";

/** Paire d'agents nommée. Les noms doivent correspondre à des clés dans `PalabreConfig.agents`. */
export interface AgentPairPreset {
  agentA: string;
  agentB: string;
}

/** Entrée de preset exposée aux intégrations out-of-process. */
export interface PresetInfo extends AgentPairPreset {
  name: string;
}

/** Entrée de preset enrichie avec l'état réel de disponibilité locale. */
export interface PresetAvailability extends PresetInfo {
  available: boolean;
  missingAgents: string[];
  unavailableReasons: string[];
}

const presets: Record<string, AgentPairPreset> = {
  "codex-claude": {
    agentA: "codex",
    agentB: "claude"
  },
  "claude-codex": {
    agentA: "claude",
    agentB: "codex"
  },
  "codex-opencode": {
    agentA: "codex",
    agentB: "opencode"
  },
  "opencode-codex": {
    agentA: "opencode",
    agentB: "codex"
  },
  "claude-opencode": {
    agentA: "claude",
    agentB: "opencode"
  },
  "opencode-claude": {
    agentA: "opencode",
    agentB: "claude"
  },
  "gemini-opencode": {
    agentA: "gemini",
    agentB: "opencode"
  },
  "opencode-gemini": {
    agentA: "opencode",
    agentB: "gemini"
  },
  "opencode-ollama": {
    agentA: "opencode",
    agentB: "ollama-local"
  },
  "ollama-opencode": {
    agentA: "ollama-local",
    agentB: "opencode"
  },
  "codex-ollama": {
    agentA: "codex",
    agentB: "ollama-local"
  },
  "ollama-codex": {
    agentA: "ollama-local",
    agentB: "codex"
  },
  "claude-ollama": {
    agentA: "claude",
    agentB: "ollama-local"
  },
  "ollama-claude": {
    agentA: "ollama-local",
    agentB: "claude"
  },
  "gemini-ollama": {
    agentA: "gemini",
    agentB: "ollama-local"
  },
  "ollama-gemini": {
    agentA: "ollama-local",
    agentB: "gemini"
  },
  "codex-gemini": {
    agentA: "codex",
    agentB: "gemini"
  },
  "gemini-codex": {
    agentA: "gemini",
    agentB: "codex"
  },
  "claude-gemini": {
    agentA: "claude",
    agentB: "gemini"
  },
  "gemini-claude": {
    agentA: "gemini",
    agentB: "claude"
  }
};

/** Retourne la paire d'agents pour `name`. Lève une erreur avec la liste des presets disponibles si inconnu. */
export function resolvePreset(name: string): AgentPairPreset {
  const preset = presets[name];

  if (!preset) {
    throw new Error(`Preset inconnu: ${name}. Presets disponibles: ${Object.keys(presets).join(", ")}`);
  }

  return preset;
}

/** Retourne la liste de tous les noms de presets disponibles, dans l'ordre de déclaration. */
export function listPresetNames(): string[] {
  return Object.keys(presets);
}

/** Retourne les presets complets, dans l'ordre de déclaration. */
export function listPresets(): PresetInfo[] {
  return Object.entries(presets).map(([name, preset]) => ({
    name,
    agentA: preset.agentA,
    agentB: preset.agentB
  }));
}

/**
 * Retourne les presets enrichis par la disponibilité réelle des agents déclarés.
 * Les intégrations peuvent filtrer `available === true` sans réimplémenter la découverte locale.
 */
export function listPresetsWithAvailability(config: PalabreConfig, discovery: ToolDiscovery): PresetAvailability[] {
  return listPresets().map((preset) => {
    const checks = [
      checkAgentAvailability(preset.agentA, config, discovery),
      checkAgentAvailability(preset.agentB, config, discovery)
    ];
    const unavailable = checks.filter((check) => !check.available);

    return {
      ...preset,
      available: unavailable.length === 0,
      missingAgents: unavailable.map((check) => check.agent),
      unavailableReasons: unavailable.map((check) => check.reason)
    };
  });
}

/** Recherche inverse : retourne le nom du preset correspondant à une paire `(agentA, agentB)`, ou `undefined`. */
export function findPresetNameForPair(agentA: string, agentB: string): string | undefined {
  return Object.entries(presets).find(([, preset]) => preset.agentA === agentA && preset.agentB === agentB)?.[0];
}

interface AgentAvailabilityCheck {
  agent: string;
  available: boolean;
  reason: string;
}

function checkAgentAvailability(agentName: string, config: PalabreConfig, discovery: ToolDiscovery): AgentAvailabilityCheck {
  const agent = config.agents[agentName];

  if (!agent) {
    return unavailable(agentName, `agent absent de la config: ${agentName}`);
  }

  if (agent.type === "ollama") {
    if (!discovery.ollama.available) {
      return unavailable(agentName, discovery.ollama.commandAvailable
        ? `Ollama non joignable pour ${agentName}`
        : `Ollama non détecté pour ${agentName}`);
    }

    if (!discovery.ollama.models.includes(agent.model)) {
      return unavailable(agentName, `modèle Ollama absent pour ${agentName}: ${agent.model}`);
    }

    return available(agentName);
  }

  const detection = knownCliDetection(agent, discovery);
  if (!detection) {
    // Les CLIs custom déclarées par l'utilisateur restent considérées utilisables :
    // Palabre ne peut pas connaître leur sémantique sans les lancer.
    return available(agentName);
  }

  return detection.available
    ? available(agentName)
    : unavailable(agentName, `commande non détectée pour ${agentName}: ${detection.command}`);
}

function knownCliDetection(agent: Extract<AgentConfig, { type: "cli" }>, discovery: ToolDiscovery): { available: boolean; command: string } | undefined {
  const command = normalizeCommandName(agent.command);

  if (command === "codex") return discovery.codex;
  if (command === "claude") return discovery.claude;
  if (command === "gemini") return discovery.gemini;
  if (command === "opencode") return discovery.opencode;

  return undefined;
}

function normalizeCommandName(command: string): string {
  return path.basename(command).toLowerCase().replace(/\.(exe|cmd|ps1|bat)$/i, "");
}

function available(agent: string): AgentAvailabilityCheck {
  return { agent, available: true, reason: "" };
}

function unavailable(agent: string, reason: string): AgentAvailabilityCheck {
  return { agent, available: false, reason };
}

