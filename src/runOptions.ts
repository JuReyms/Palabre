import { getStringListFlag } from "./args.js";
import { DEFAULT_TURNS, MAX_ASK_AGENTS, parseTurnsFlag } from "./limits.js";
import { normalizeOllamaBaseUrl } from "./ollamaUrl.js";
import { createSessionContext } from "./session.js";
import { askAgentSeedsForMode } from "./tuiState.js";
import type { AgentPairPreset } from "./presets.js";
import type { DebateOptions, Language, PalabreConfig, PalabreMode, ProjectFileContext } from "./types.js";
import type { Messages } from "./messages/index.js";
import { optionalString, type CommandFlags } from "./commands/shared.js";

interface ResolveRunOptionsInput {
  flags: CommandFlags;
  config: PalabreConfig;
  language: Language;
  topic: string;
  files: ProjectFileContext[];
  preset?: AgentPairPreset;
  signal?: AbortSignal;
}

/** Resolves flags and defaults into complete orchestrator options. */
export function resolveRunOptions(input: ResolveRunOptionsInput, messages: Messages): DebateOptions {
  const { flags, config, language, topic, files, preset, signal } = input;
  const mode = parseModeFlag(optionalString(flags.mode) ?? config.defaults?.mode, messages);
  const explicitAskAgents = getStringListFlag(flags.agents);
  const askAgentSeeds = askAgentSeedsForMode(mode, explicitAskAgents, config.defaults?.askAgents);
  const agentA = resolveAgentName("agent A", flags["agent-a"], preset?.agentA, askAgentSeeds[0] ?? config.defaults?.agentA, messages);
  const agentB = resolveAgentName("agent B", flags["agent-b"], preset?.agentB, askAgentSeeds[1] ?? askAgentSeeds[0] ?? config.defaults?.agentB, messages);
  const askAgents = mode === "ask" ? resolveAskAgents(explicitAskAgents, config.defaults?.askAgents, [agentA, agentB], messages) : undefined;
  const ollamaUrl = optionalString(flags["ollama-url"]);

  return {
    mode,
    language,
    topic,
    agentA,
    agentB,
    askAgents,
    turns: parseTurnsFlag(flags.turns, config.defaults?.turns ?? DEFAULT_TURNS, "--turns", messages),
    session: createSessionContext(),
    files,
    modelA: optionalString(flags["model-a"]),
    modelB: optionalString(flags["model-b"]),
    ollamaUrl: ollamaUrl ? normalizeOllamaBaseUrl(ollamaUrl) : undefined,
    pullModels: Boolean(flags["pull-models"]),
    summaryAgent: resolveSummaryAgent(flags["summary-agent"], config.defaults, mode, askAgents, agentB),
    summaryModel: optionalString(flags["summary-model"]),
    summaryEnabled: !flags["no-summary"],
    earlyStopOnAgreement: !flags["no-early-stop"],
    plainOutput: Boolean(flags.plain || flags.terminal),
    signal
  };
}

function resolveAgentName(label: string, explicitValue: string | string[] | boolean | undefined, presetValue: string | undefined, defaultValue: string | undefined, messages: Messages): string {
  const resolved = optionalString(explicitValue) ?? presetValue ?? defaultValue;
  if (!resolved) throw new Error(messages.common.noAgentDefined(label));
  return resolved;
}

function resolveSummaryAgent(explicitValue: string | string[] | boolean | undefined, defaults: PalabreConfig["defaults"] | undefined, mode: PalabreMode, askAgents: string[] | undefined, agentB: string): string {
  const explicit = optionalString(explicitValue);
  if (explicit) return explicit;
  if (mode === "ask") return defaults?.askSummaryAgent ?? defaults?.summaryAgent ?? askAgents?.at(-1) ?? agentB;
  return defaults?.summaryAgent ?? agentB;
}

function parseModeFlag(value: string | undefined, messages: Messages): PalabreMode {
  if (!value) return "debate";
  if (value === "debate" || value === "ask") return value;
  throw new Error(messages.common.unknownMode(value, "debate, ask"));
}

function resolveAskAgents(explicitAgents: string[], defaultAgents: string[] | undefined, fallbackAgents: string[], messages: Messages): string[] {
  const selected = explicitAgents.length > 0 ? explicitAgents : defaultAgents && defaultAgents.length > 0 ? defaultAgents : fallbackAgents;
  const unique = selected.filter((agent, index) => agent.trim() && selected.indexOf(agent) === index);
  if (unique.length > MAX_ASK_AGENTS) throw new Error(messages.common.tooManyAskAgents(MAX_ASK_AGENTS));
  return unique;
}
