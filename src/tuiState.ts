export type TuiFlagValue = string | string[] | boolean;

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

export function clearTuiRunOverrides(flags: Record<string, TuiFlagValue>): void {
  for (const flag of TUI_RUN_OVERRIDE_FLAGS) {
    delete flags[flag];
  }
}

export function askAgentSeedsForMode(
  mode: "ask" | "debate",
  explicitAskAgents: string[],
  defaultAskAgents: string[] | undefined
): string[] {
  if (mode !== "ask") {
    return [];
  }

  return explicitAskAgents.length > 0 ? explicitAskAgents : defaultAskAgents ?? [];
}
