import { createAgent } from "./adapters/index.js";
import { AdapterError } from "./errors.js";
import { createTranslator } from "./i18n.js";
import type { Messages } from "./messages/index.js";
import type { AgentConfig, AgentRole, PalabreConfig, DebateFailure, DebateMessage, DebateOptions, DebateRenderer, DebateSummary } from "./types.js";

export const MAX_ASK_AGENTS = 4;

/** Résultat retourné par `runDebate`. `stopReason` est défini uniquement en cas d'arrêt anticipé. */
export interface DebateResult {
  options: DebateOptions;
  messages: DebateMessage[];
  summary?: DebateSummary;
  stopReason?: string;
  failure?: DebateFailure;
}

/** Résultat retourné par `runAsk`. Structurellement identique à `DebateResult`. */
export type AskResult = DebateResult;

/**
 * Point d'entrée de l'orchestration.
 * Lance le ping-pong entre `agentA` et `agentB` pendant `options.turns` tours,
 * applique l'arrêt anticipé si activé, puis génère la synthèse si `summaryEnabled` est vrai.
 *
 * @throws {Error} si un agent référencé dans `options` est absent de `config.agents`.
 */
export async function runDebate(
  config: PalabreConfig,
  options: DebateOptions,
  renderer?: DebateRenderer,
  messages: Messages = createTranslator("fr")
): Promise<DebateResult> {
  const agentAConfig = withRuntimeOverrides(config.agents[options.agentA], options.modelA, options.pullModels);
  const agentBConfig = withRuntimeOverrides(config.agents[options.agentB], options.modelB, options.pullModels);

  if (!agentAConfig) {
    throw new Error(messages.common.unknownAgent(options.agentA));
  }

  if (!agentBConfig) {
    throw new Error(messages.common.unknownAgent(options.agentB));
  }

  warnIfOllamaHasNoContext(options, [
    [options.agentA, agentAConfig],
    [options.agentB, agentBConfig]
  ], renderer, messages);

  renderer?.start(options, [
    { name: options.agentA, role: agentAConfig.role, type: agentAConfig.type },
    { name: options.agentB, role: agentBConfig.role, type: agentBConfig.type }
  ]);

  const agents = [
    createAgent(options.agentA, agentAConfig, { ollamaUrl: options.ollamaUrl }),
    createAgent(options.agentB, agentBConfig, { ollamaUrl: options.ollamaUrl })
  ];

  const transcript: DebateMessage[] = [];
  let stopReason: string | undefined;

  for (let index = 0; index < options.turns; index += 1) {
    const cancellation = cancellationFailureIfAborted(options, messages, {
      phase: "debate",
      turn: index + 1
    });
    if (cancellation) {
      renderer?.error(cancellation);
      return {
        options,
        messages: transcript,
        stopReason,
        failure: cancellation
      };
    }

    const current = agents[index % agents.length];
    const peer = agents[(index + 1) % agents.length];
    const turn = index + 1;

    renderer?.turnStart(turn, options.turns, current.name, current.role);
    renderer?.thinkingStart(current.name, current.role);

    let response;
    try {
      response = await current.generate({
        topic: options.topic,
        turn,
        totalTurns: options.turns,
        selfName: current.name,
        peerName: peer.name,
        selfRole: current.role,
        language: options.language,
        session: options.session,
        files: options.files,
        transcript,
        signal: options.signal
      });
    } catch (error) {
      const failure = toDebateFailure(error, {
        phase: "debate",
        agent: current.name,
        role: current.role,
        turn
      });
      renderer?.error(failure);
      return {
        options,
        messages: transcript,
        stopReason,
        failure
      };
    } finally {
      renderer?.thinkingEnd();
    }

    const message: DebateMessage = {
      agent: current.name,
      role: current.role,
      content: response.content,
      createdAt: new Date().toISOString()
    };

    transcript.push(message);
    renderer?.message(message.content);

    if (shouldStopOnAgreement(options, transcript, messages)) {
      stopReason = messages.orchestrator.agreementStopReason;
      renderer?.notice(messages.orchestrator.earlyStop(stopReason));
      break;
    }
  }

  let summary: DebateSummary | undefined;
  let failure: DebateFailure | undefined;

  if (options.summaryEnabled) {
    try {
      const cancellation = cancellationFailureIfAborted(options, messages, {
        phase: "summary",
        agent: resolveSummaryAgentName(options),
        role: summaryRole(),
        turn: transcript.length + 1
      });
      if (cancellation) {
        renderer?.error(cancellation);
        return {
          options,
          messages: transcript,
          stopReason,
          failure: cancellation
        };
      }
      summary = await generateSummary(config, options, transcript, renderer, messages);
    } catch (error) {
      failure = toDebateFailure(error, {
        phase: "summary",
        agent: resolveSummaryAgentName(options),
        role: summaryRole(),
        turn: transcript.length + 1
      });
      renderer?.error(failure);
    }
  }

  return {
    options,
    messages: transcript,
    summary,
    stopReason,
    failure
  };
}

/**
 * Lance le mode ask : plusieurs agents répondent indépendamment au même sujet,
 * puis un agent de synthèse résume fidèlement chaque réponse et les compare.
 */
export async function runAsk(
  config: PalabreConfig,
  options: DebateOptions,
  renderer?: DebateRenderer,
  messages: Messages = createTranslator("fr")
): Promise<AskResult> {
  const askAgentNames = resolveAskAgentNames(options);

  if (askAgentNames.length === 0) {
    throw new Error(messages.common.noAgentDefined("ask agent"));
  }

  if (askAgentNames.length > MAX_ASK_AGENTS) {
    throw new Error(messages.common.tooManyAskAgents(MAX_ASK_AGENTS));
  }

  const agentEntries = askAgentNames.map((name) => {
    const agentConfig = withRuntimeOverrides(config.agents[name], modelForAgent(options, name), options.pullModels);

    if (!agentConfig) {
      throw new Error(messages.common.unknownAgent(name));
    }

    return [name, agentConfig] as const;
  });

  warnIfOllamaHasNoContext(options, agentEntries.map(([name, agentConfig]) => [name, agentConfig]), renderer, messages);

  renderer?.start(options, agentEntries.map(([name, agentConfig]) => ({
    name,
    role: agentConfig.role,
    type: agentConfig.type
  })));

  const agents = agentEntries.map(([name, agentConfig]) => createAgent(name, agentConfig, { ollamaUrl: options.ollamaUrl }));
  const transcript: DebateMessage[] = [];

  for (let index = 0; index < agents.length; index += 1) {
    const current = agents[index];
    const response = index + 1;
    const cancellation = cancellationFailureIfAborted(options, messages, {
      phase: "ask",
      agent: current.name,
      role: current.role,
      turn: response
    });

    if (cancellation) {
      renderer?.error(cancellation);
      return {
        options,
        messages: transcript,
        failure: cancellation
      };
    }

    if (renderer?.askResponseStart) {
      renderer.askResponseStart(response, agents.length, current.name, current.role);
    } else {
      renderer?.turnStart(response, agents.length, current.name, current.role);
    }
    renderer?.thinkingStart(current.name, current.role);

    let agentResponse;
    try {
      agentResponse = await current.generate({
        topic: options.topic,
        turn: response,
        totalTurns: agents.length,
        selfName: current.name,
        peerName: "independent-agents",
        selfRole: current.role,
        mode: "ask",
        language: options.language,
        session: options.session,
        files: options.files,
        transcript: [],
        signal: options.signal
      });
    } catch (error) {
      const failure = toDebateFailure(error, {
        phase: "ask",
        agent: current.name,
        role: current.role,
        turn: response
      });
      renderer?.error(failure);
      return {
        options,
        messages: transcript,
        failure
      };
    } finally {
      renderer?.thinkingEnd();
    }

    const message: DebateMessage = {
      agent: current.name,
      role: current.role,
      content: agentResponse.content,
      createdAt: new Date().toISOString()
    };

    transcript.push(message);
    if (renderer?.askResponseMessage) {
      renderer.askResponseMessage(message.content);
    } else {
      renderer?.message(message.content);
    }
  }

  let summary: DebateSummary | undefined;
  let failure: DebateFailure | undefined;

  if (options.summaryEnabled) {
    try {
      const summaryAgentName = resolveSummaryAgentName(options);
      const cancellation = cancellationFailureIfAborted(options, messages, {
        phase: "summary",
        agent: summaryAgentName,
        role: summaryRole(),
        turn: transcript.length + 1
      });
      if (cancellation) {
        renderer?.error(cancellation);
        return {
          options,
          messages: transcript,
          failure: cancellation
        };
      }
      summary = await generateSummary(config, options, transcript, renderer, messages);
    } catch (error) {
      failure = toDebateFailure(error, {
        phase: "summary",
        agent: resolveSummaryAgentName(options),
        role: summaryRole(),
        turn: transcript.length + 1
      });
      renderer?.error(failure);
    }
  }

  return {
    options,
    messages: transcript,
    summary,
    failure
  };
}

/**
 * Heuristique d'arrêt sur accord explicite.
 * Ne s'active qu'après un tour complet (nombre pair de messages) pour éviter les faux positifs.
 * Les phrases d'accord proviennent du dictionnaire i18n pour suivre la langue d'interface.
 * Intentionnellement prudente : ne remplace pas une évaluation sémantique réelle.
 */
function shouldStopOnAgreement(options: DebateOptions, transcript: DebateMessage[], messages: Messages): boolean {
  if (!options.earlyStopOnAgreement || transcript.length < 2 || transcript.length % 2 !== 0) {
    return false;
  }

  const latest = normalizeForAgreement(transcript[transcript.length - 1]?.content ?? "");

  if (!latest) {
    return false;
  }

  if (messages.orchestrator.agreementPatterns.some((pattern) => latest.includes(pattern))) {
    return true;
  }

  // Combinaison française historique : confirmation explicite + absence de point ouvert.
  return (latest.includes("confirme") || latest.includes("acte")) &&
    (latest.includes("aucun") || latest.includes("rien a trancher") || latest.includes("rien a ajouter"));
}

/** Normalise le texte pour la détection d'accord : minuscules, sans diacritiques, espaces unifiés. */
function normalizeForAgreement(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[’']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Émet un avertissement si un agent Ollama participe sans contexte fichier.
 * L'adapter Ollama ne lit pas le filesystem : sans `--files` ou `--context`, il ne voit pas le projet.
 */
function warnIfOllamaHasNoContext(
  options: DebateOptions,
  agents: Array<[string, AgentConfig]>,
  renderer?: DebateRenderer,
  messages: Messages = createTranslator("fr")
): void {
  if (options.files.length > 0) {
    return;
  }

  const ollamaAgents = agents
    .filter(([, config]) => config.type === "ollama")
    .map(([name]) => name)
    .filter((name, index, names) => names.indexOf(name) === index);

  if (ollamaAgents.length === 0) {
    return;
  }

  renderer?.warning(messages.orchestrator.ollamaNoContext(ollamaAgents.join(", ")));
}

/**
 * Phase de synthèse post-débat. Utilise `options.summaryAgent` quand il est défini, sinon `agentB`.
 *
 * @throws {Error} si l'agent de synthèse est absent de `config.agents`.
 */
async function generateSummary(
  config: PalabreConfig,
  options: DebateOptions,
  transcript: DebateMessage[],
  renderer?: DebateRenderer,
  messages: Messages = createTranslator("fr")
): Promise<DebateSummary> {
  const summaryAgentName = resolveSummaryAgentName(options);
  const summaryModel = options.summaryModel ?? modelForAgent(options, summaryAgentName);
  const summaryConfig = withRuntimeOverrides(config.agents[summaryAgentName], summaryModel, options.pullModels);

  if (!summaryConfig) {
    throw new Error(messages.orchestrator.unknownSummaryAgent(summaryAgentName));
  }

  const summaryAgent = createAgent(summaryAgentName, summaryConfig, { ollamaUrl: options.ollamaUrl });
  const role = summaryRole();

  renderer?.summaryStart(summaryAgent.name, role);
  renderer?.thinkingStart(summaryAgent.name, role);

  const response = await summaryAgent.generate({
    topic: options.topic,
    turn: transcript.length + 1,
    totalTurns: options.mode === "ask" ? transcript.length : options.turns,
    selfName: summaryAgent.name,
    peerName: options.mode === "ask" ? "ask-responses" : "transcript",
    selfRole: role,
    mode: "summary",
    language: options.language,
    session: options.session,
    files: options.files,
    transcript,
    signal: options.signal
  }).finally(() => renderer?.thinkingEnd());

  const summary: DebateSummary = {
    agent: summaryAgent.name,
    role,
    content: response.content,
    createdAt: new Date().toISOString()
  };

  renderer?.message(summary.content);
  return summary;
}

function summaryRole(): AgentRole {
  return "summarizer";
}

function cancellationFailureIfAborted(
  options: DebateOptions,
  messages: Messages,
  context: Pick<DebateFailure, "phase"> & Partial<Pick<DebateFailure, "agent" | "role" | "turn">>
): DebateFailure | undefined {
  if (!options.signal?.aborted) {
    return undefined;
  }

  return {
    phase: context.phase,
    agent: context.agent,
    role: context.role,
    turn: context.turn,
    kind: "cancelled",
    message: messages.orchestrator.cancelled
  };
}

function resolveAskAgentNames(options: DebateOptions): string[] {
  const agents = options.askAgents && options.askAgents.length > 0
    ? options.askAgents
    : [options.agentA, options.agentB];

  return agents.filter((agent, index) => Boolean(agent) && agents.indexOf(agent) === index);
}

function resolveSummaryAgentName(options: DebateOptions): string {
  if (options.summaryAgent) {
    return options.summaryAgent;
  }

  if (options.mode === "ask" && options.askAgents && options.askAgents.length > 0) {
    return options.askAgents[options.askAgents.length - 1] ?? options.agentB;
  }

  return options.agentB;
}

function toDebateFailure(
  error: unknown,
  context: Pick<DebateFailure, "phase"> & Partial<Pick<DebateFailure, "agent" | "role" | "turn">>
): DebateFailure {
  if (error instanceof AdapterError) {
    return {
      phase: context.phase,
      agent: context.agent ?? error.adapterName,
      role: context.role,
      turn: context.turn,
      kind: error.kind,
      message: error.message,
      details: error.details
    };
  }

  return {
    phase: context.phase,
    agent: context.agent,
    role: context.role,
    turn: context.turn,
    kind: "unknown",
    message: error instanceof Error ? error.message : String(error)
  };
}

/** Résout le model override pour un agent donné. Retourne `undefined` si l'agent n'est ni A ni B. */
function modelForAgent(options: DebateOptions, agent: string): string | undefined {
  if (agent === options.agentA) {
    return options.modelA;
  }

  if (agent === options.agentB) {
    return options.modelB;
  }

  return undefined;
}

/**
 * Fusionne les overrides runtime dans la config agent.
 * Pour l'adapter `ollama`, applique aussi `autoPullModel` si `pullModels` est vrai.
 * Retourne `undefined` si `config` est `undefined`.
 */
function withRuntimeOverrides(
  config: AgentConfig | undefined,
  model: string | undefined,
  pullModels: boolean
): AgentConfig | undefined {
  if (!config) {
    return config;
  }

  if (config.type === "ollama") {
    return {
      ...config,
      ...(model ? { model } : {}),
      ...(pullModels ? { autoPullModel: true } : {})
    };
  }

  if (!model) {
    return config;
  }

  return {
    ...config,
    model
  };
}
