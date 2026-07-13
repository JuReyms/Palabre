/** @file Résolution partagée des overrides runtime appliqués aux configurations agent. */
import type { AgentConfig, AgentRole } from "./types.js";

/** Fusionne modèle, rôle et politique de pull sans modifier la configuration persistée. */
export function withRuntimeOverrides(
  config: AgentConfig | undefined,
  model: string | undefined,
  pullModels: boolean,
  role?: AgentRole
): AgentConfig | undefined {
  if (!config) return config;

  if (config.type === "ollama") {
    return {
      ...config,
      ...(role ? { role } : {}),
      ...(model ? { model } : {}),
      ...(pullModels ? { autoPullModel: true } : {})
    };
  }

  if (!model && !role) return config;
  return { ...config, ...(role ? { role } : {}), ...(model ? { model } : {}) };
}
