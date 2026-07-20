/** @file État partagé entre le point d'entrée et la TUI pour réinitialiser les overrides de lancement entre deux sessions. */

export type TuiFlagValue = string | string[] | boolean;

/** Flags de session ponctuels (par sujet) qui ne doivent pas persister entre deux lancements TUI successifs. */
const TUI_RUN_OVERRIDE_FLAGS = [
  "preset",
  "agent-a",
  "agent-b",
  "agents",
  "model-a",
  "ollama-url",
  "model-b",
  "summary-agent",
  "summary-model",
  "turns",
  "files",
  "context",
  "no-summary",
  "no-early-stop",
  "pull-models",
  "show-prompt",
  "plain",
  "terminal",
  "json"
];

/** Supprime les overrides de lancement d'une session TUI terminée, pour repartir des defaults au prochain sujet. */
export function clearTuiRunOverrides(flags: Record<string, TuiFlagValue>): void {
  for (const flag of TUI_RUN_OVERRIDE_FLAGS) {
    delete flags[flag];
  }
}

/** Pré-remplit les agents `ask` proposés par le wizard : explicites, sinon defaults de config, sinon aucun en mode `debate`. */
export function askAgentSeedsForMode(
  mode: import("./types.js").PalabreMode,
  explicitAskAgents: string[],
  defaultAskAgents: string[] | undefined
): string[] {
  if (mode !== "ask") {
    return [];
  }

  return explicitAskAgents.length > 0 ? explicitAskAgents : defaultAskAgents ?? [];
}
