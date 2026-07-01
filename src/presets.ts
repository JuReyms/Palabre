import { detectionForCommand, isRetiredAgentName } from "./agentRegistry.js";
import type { ToolDiscovery } from "./discovery.js";
import type { PalabreConfig } from "./types.js";
import type { Messages } from "./messages/index.js";

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

/** Agent configuré enrichi avec sa disponibilité locale pour les intégrations. */
export interface AgentAvailability {
  name: string;
  type: PalabreConfig["agents"][string]["type"];
  role: PalabreConfig["agents"][string]["role"];
  available: boolean;
  unavailableReason?: string;
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
  "codex-vibe": {
    agentA: "codex",
    agentB: "vibe"
  },
  "vibe-codex": {
    agentA: "vibe",
    agentB: "codex"
  },
  "codex-antigravity": {
    agentA: "codex",
    agentB: "antigravity"
  },
  "antigravity-codex": {
    agentA: "antigravity",
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
  "claude-vibe": {
    agentA: "claude",
    agentB: "vibe"
  },
  "vibe-claude": {
    agentA: "vibe",
    agentB: "claude"
  },
  "claude-antigravity": {
    agentA: "claude",
    agentB: "antigravity"
  },
  "antigravity-claude": {
    agentA: "antigravity",
    agentB: "claude"
  },
  "opencode-antigravity": {
    agentA: "opencode",
    agentB: "antigravity"
  },
  "antigravity-opencode": {
    agentA: "antigravity",
    agentB: "opencode"
  },
  "opencode-vibe": {
    agentA: "opencode",
    agentB: "vibe"
  },
  "vibe-opencode": {
    agentA: "vibe",
    agentB: "opencode"
  },
  "antigravity-vibe": {
    agentA: "antigravity",
    agentB: "vibe"
  },
  "vibe-antigravity": {
    agentA: "vibe",
    agentB: "antigravity"
  },
  "opencode-ollama": {
    agentA: "opencode",
    agentB: "ollama-local"
  },
  "ollama-opencode": {
    agentA: "ollama-local",
    agentB: "opencode"
  },
  "vibe-ollama": {
    agentA: "vibe",
    agentB: "ollama-local"
  },
  "ollama-vibe": {
    agentA: "ollama-local",
    agentB: "vibe"
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
  "antigravity-ollama": {
    agentA: "antigravity",
    agentB: "ollama-local"
  },
  "ollama-antigravity": {
    agentA: "ollama-local",
    agentB: "antigravity"
  }
};

/** Retourne la paire d'agents pour `name`. Lève une erreur avec la liste des presets disponibles si inconnu. */
export function resolvePreset(name: string, messages?: Messages): AgentPairPreset {
  const preset = presets[name];

  if (!preset) {
    const available = Object.keys(presets).join(", ");
    throw new Error(messages?.presets.unknown(name, available) ?? `Preset inconnu: ${name}. Presets disponibles: ${available}`);
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
export function listPresetsWithAvailability(config: PalabreConfig, discovery: ToolDiscovery, messages?: Messages): PresetAvailability[] {
  return listPresets().map((preset) => {
    const checks = [
      checkAgentAvailability(preset.agentA, config, discovery, messages),
      checkAgentAvailability(preset.agentB, config, discovery, messages)
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

/**
 * Retourne tous les agents de la config avec la même disponibilité que celle
 * utilisée pour les presets. Les intégrations ne doivent pas réimplémenter la
 * découverte des commandes ou des modèles Ollama.
 */
export function listAgentsWithAvailability(config: PalabreConfig, discovery: ToolDiscovery, messages?: Messages): AgentAvailability[] {
  return Object.entries(config.agents)
    .filter(([name]) => !isRetiredAgentName(name))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, agentConfig]) => {
      const check = checkAgentAvailability(name, config, discovery, messages);
      return {
        name,
        type: agentConfig.type,
        role: agentConfig.role,
        available: check.available,
        ...(check.available ? {} : { unavailableReason: check.reason })
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

function checkAgentAvailability(agentName: string, config: PalabreConfig, discovery: ToolDiscovery, messages?: Messages): AgentAvailabilityCheck {
  const agent = config.agents[agentName];

  if (!agent) {
    return unavailable(agentName, messages?.presets.missingAgent(agentName) ?? `agent absent de la config: ${agentName}`);
  }

  if (agent.type === "ollama") {
    const ollama = discovery.ollamaAgents?.[agentName] ?? discovery.ollama;
    if (!ollama.available) {
      return unavailable(agentName, ollama.commandAvailable
        ? messages?.presets.ollamaUnreachable(agentName) ?? `Ollama non joignable pour ${agentName}`
        : messages?.presets.ollamaNotDetected(agentName) ?? `Ollama non détecté pour ${agentName}`);
    }

    if (!ollama.models.includes(agent.model)) {
      return unavailable(agentName, messages?.presets.missingOllamaModel(agentName, agent.model) ?? `modèle Ollama absent pour ${agentName}: ${agent.model}`);
    }

    return available(agentName);
  }

  const detection = detectionForCommand(agent.command, discovery);
  if (!detection) {
    // Les CLIs custom déclarées par l'utilisateur restent considérées utilisables :
    // Palabre ne peut pas connaître leur sémantique sans les lancer.
    return available(agentName);
  }

  return detection.available
    ? available(agentName)
    : unavailable(agentName, messages?.presets.missingCommand(agentName, detection.command) ?? `commande non détectée pour ${agentName}: ${detection.command}`);
}

function available(agent: string): AgentAvailabilityCheck {
  return { agent, available: true, reason: "" };
}

function unavailable(agent: string, reason: string): AgentAvailabilityCheck {
  return { agent, available: false, reason };
}
