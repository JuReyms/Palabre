/** @file Résolution centralisée des flags et defaults en options runtime immuables. */
import { getStringListFlag } from "./args.js";
import { DEFAULT_TURNS, MAX_ASK_AGENTS, parseTurnsFlag } from "./limits.js";
import { normalizeOllamaBaseUrl } from "./ollamaUrl.js";
import { createSessionContext } from "./session.js";
import { askAgentSeedsForMode } from "./tuiState.js";
import type { AgentPairPreset } from "./presets.js";
import type { DebateOptions, Language, PalabreConfig, PalabreInterface, PalabreMode, ProjectFileContext } from "./types.js";
import type { Messages } from "./messages/index.js";
import { optionalString, type CommandFlags } from "./commands/shared.js";

/** Entrées déjà chargées par le point d'entrée avant la résolution métier. */
interface ResolveRunOptionsInput {
  flags: CommandFlags;
  config: PalabreConfig;
  language: Language;
  topic: string;
  files: ProjectFileContext[];
  preset?: AgentPairPreset;
  signal?: AbortSignal;
}

/**
 * Construit le contrat complet transmis à l'orchestrateur.
 *
 * La priorité est : flags explicites, preset, defaults de configuration, puis
 * fallbacks propres au mode. La fonction ne modifie ni les flags ni la config.
 *
 * @param input - Configuration, flags, contexte et signal de la session.
 * @param messages - Dictionnaire localisé utilisé pour les erreurs de validation.
 * @returns Des options complètes, avec agent de synthèse déjà résolu.
 * @throws {Error} Si le mode, les agents, le nombre de tours ou l'URL Ollama sont invalides.
 */
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

/** Résout un agent selon la priorité flag > preset > default configuré. */
function resolveAgentName(label: string, explicitValue: string | string[] | boolean | undefined, presetValue: string | undefined, defaultValue: string | undefined, messages: Messages): string {
  const resolved = optionalString(explicitValue) ?? presetValue ?? defaultValue;
  if (!resolved) throw new Error(messages.common.noAgentDefined(label));
  return resolved;
}

/** Résout une seule fois l'agent de synthèse avant l'entrée dans l'orchestrateur. */
function resolveSummaryAgent(explicitValue: string | string[] | boolean | undefined, defaults: PalabreConfig["defaults"] | undefined, mode: PalabreMode, askAgents: string[] | undefined, agentB: string): string {
  const explicit = optionalString(explicitValue);
  if (explicit) return explicit;
  if (mode === "ask") return defaults?.askSummaryAgent ?? defaults?.summaryAgent ?? askAgents?.at(-1) ?? agentB;
  return defaults?.summaryAgent ?? agentB;
}

/**
 * Valide le mode demandé (`--mode`, `config --mode`) et applique `debate` quand
 * aucune valeur n'est fournie. Partagé entre `run` et la commande `config`.
 * @throws {Error} Si `value` n'est ni `debate` ni `ask`.
 */
export function parseModeFlag(value: string | undefined, messages: Messages): PalabreMode {
  if (!value) return "debate";
  if (value === "debate" || value === "ask") return value;
  throw new Error(messages.common.unknownMode(value, "debate, ask"));
}

/**
 * Valide l'interface demandée (`--interface`, `config --interface`) et applique `tui`
 * quand aucune valeur n'est fournie.
 * @throws {Error} Si `value` n'est ni `tui` ni `terminal`.
 */
export function parseInterfaceFlag(value: string | undefined, messages: Messages): PalabreInterface {
  if (!value) return "tui";
  if (value === "tui" || value === "terminal") return value;
  throw new Error(messages.common.unknownMode(value, "tui, terminal"));
}

/** Déduplique les agents Ask et applique la limite produit sans modifier les listes sources. */
function resolveAskAgents(explicitAgents: string[], defaultAgents: string[] | undefined, fallbackAgents: string[], messages: Messages): string[] {
  const selected = explicitAgents.length > 0 ? explicitAgents : defaultAgents && defaultAgents.length > 0 ? defaultAgents : fallbackAgents;
  const unique = selected.filter((agent, index) => agent.trim() && selected.indexOf(agent) === index);
  if (unique.length > MAX_ASK_AGENTS) throw new Error(messages.common.tooManyAskAgents(MAX_ASK_AGENTS));
  return unique;
}
