import { createAgent } from "./adapters/index.js";
import { AdapterError } from "./errors.js";
import { createTranslator } from "./i18n.js";
import type { Messages } from "./messages/index.js";
import type { AgentConfig, PalabreConfig, DebateFailure, DebateMessage, DebateOptions, DebateRenderer, DebateSummary } from "./types.js";

/** Résultat retourné par `runDebate`. `stopReason` est défini uniquement en cas d'arrêt anticipé. */
export interface DebateResult {
  options: DebateOptions;
  messages: DebateMessage[];
  summary?: DebateSummary;
  stopReason?: string;
  failure?: DebateFailure;
}

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
    createAgent(options.agentA, agentAConfig),
    createAgent(options.agentB, agentBConfig)
  ];

  const transcript: DebateMessage[] = [];
  let stopReason: string | undefined;

  for (let index = 0; index < options.turns; index += 1) {
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
        transcript
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

    if (shouldStopOnAgreement(options, transcript)) {
      stopReason = messages.orchestrator.agreementStopReason;
      renderer?.notice(messages.orchestrator.earlyStop(stopReason));
      break;
    }
  }

  let summary: DebateSummary | undefined;
  let failure: DebateFailure | undefined;

  if (options.summaryEnabled) {
    try {
      summary = await generateSummary(config, options, transcript, renderer, messages);
    } catch (error) {
      failure = toDebateFailure(error, {
        phase: "summary",
        agent: options.summaryAgent ?? options.agentB,
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
 * Heuristique d'arrêt sur accord explicite.
 * Ne s'active qu'après un tour complet (nombre pair de messages) pour éviter les faux positifs.
 * Intentionnellement prudente : ne remplace pas une évaluation sémantique réelle.
 */
function shouldStopOnAgreement(options: DebateOptions, messages: DebateMessage[]): boolean {
  if (!options.earlyStopOnAgreement || messages.length < 2 || messages.length % 2 !== 0) {
    return false;
  }

  const latest = normalizeForAgreement(messages[messages.length - 1]?.content ?? "");

  if (!latest) {
    return false;
  }

  const positivePatterns = [
    "accord complet",
    "accord total",
    "aucun desaccord",
    "aucune incertitude",
    "rien a trancher",
    "rien a ajouter",
    "question factuelle resolue"
  ];

  if (positivePatterns.some((pattern) => latest.includes(pattern))) {
    return true;
  }

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
  const summaryAgentName = options.summaryAgent ?? options.agentB;
  const summaryModel = options.summaryModel ?? modelForAgent(options, summaryAgentName);
  const summaryConfig = withRuntimeOverrides(config.agents[summaryAgentName], summaryModel, options.pullModels);

  if (!summaryConfig) {
    throw new Error(messages.orchestrator.unknownSummaryAgent(summaryAgentName));
  }

  const summaryAgent = createAgent(summaryAgentName, summaryConfig);

  renderer?.summaryStart(summaryAgent.name, summaryAgent.role);
  renderer?.thinkingStart(summaryAgent.name, summaryAgent.role);

  const response = await summaryAgent.generate({
    topic: options.topic,
    turn: transcript.length + 1,
    totalTurns: options.turns,
    selfName: summaryAgent.name,
    peerName: "transcript",
    selfRole: summaryAgent.role,
    mode: "summary",
    language: options.language,
    session: options.session,
    files: options.files,
    transcript
  }).finally(() => renderer?.thinkingEnd());

  const summary: DebateSummary = {
    agent: summaryAgent.name,
    role: summaryAgent.role,
    content: response.content,
    createdAt: new Date().toISOString()
  };

  renderer?.message(summary.content);
  return summary;
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
