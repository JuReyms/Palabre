import type { AgentConfig, DebateOptions, PalabreConfig } from "./types.js";

/** Retourne des options enrichies avec les modèles affichables connus par Palabre. */
export function withResolvedModelInfo(config: PalabreConfig, options: DebateOptions): DebateOptions {
  return {
    ...options,
    modelInfo: resolveDebateModelInfo(config, options)
  };
}

export function formatModelPair(options: DebateOptions): string {
  return `${options.agentA}=${options.modelInfo?.agentA ?? options.modelA ?? "default"} <-> ${options.agentB}=${options.modelInfo?.agentB ?? options.modelB ?? "default"}`;
}

export function formatSummaryLabel(options: DebateOptions): string {
  if (!options.summaryEnabled) {
    return "disabled";
  }

  const agent = options.summaryAgent ?? options.agentB;
  const model = options.modelInfo?.summary;
  return model ? `${agent}=${model}` : agent;
}

export function formatSummaryModel(options: DebateOptions): string {
  return options.modelInfo?.summary ?? options.summaryModel ?? "default";
}

function resolveDebateModelInfo(config: PalabreConfig, options: DebateOptions): NonNullable<DebateOptions["modelInfo"]> {
  const summaryAgent = options.summaryEnabled ? options.summaryAgent ?? options.agentB : undefined;

  return {
    agentA: resolveModelLabel(config.agents[options.agentA], options.modelA),
    agentB: resolveModelLabel(config.agents[options.agentB], options.modelB),
    ...(summaryAgent ? { summary: resolveModelLabel(config.agents[summaryAgent], resolveSummaryModelOverride(options, summaryAgent)) } : {})
  };
}

function resolveSummaryModelOverride(options: DebateOptions, summaryAgent: string): string | undefined {
  if (options.summaryModel) {
    return options.summaryModel;
  }

  if (summaryAgent === options.agentA) {
    return options.modelA;
  }

  if (summaryAgent === options.agentB) {
    return options.modelB;
  }

  return undefined;
}

function resolveModelLabel(agentConfig: AgentConfig | undefined, override: string | undefined): string {
  if (override) {
    return `${override} (override)`;
  }

  if (!agentConfig) {
    return "unknown";
  }

  if (agentConfig.type === "ollama") {
    return agentConfig.model;
  }

  return agentConfig.model ? agentConfig.model : "CLI default";
}