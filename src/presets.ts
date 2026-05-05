export interface AgentPairPreset {
  agentA: string;
  agentB: string;
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

export function resolvePreset(name: string): AgentPairPreset {
  const preset = presets[name];

  if (!preset) {
    throw new Error(`Preset inconnu: ${name}. Presets disponibles: ${Object.keys(presets).join(", ")}`);
  }

  return preset;
}

export function listPresetNames(): string[] {
  return Object.keys(presets);
}

export function findPresetNameForPair(agentA: string, agentB: string): string | undefined {
  return Object.entries(presets).find(([, preset]) => preset.agentA === agentA && preset.agentB === agentB)?.[0];
}
