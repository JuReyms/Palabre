import { createAgent } from "./adapters/index.js";
import type { AgentConfig, ChicaneConfig, DebateMessage, DebateOptions, DebateRenderer, DebateSummary } from "./types.js";

export interface DebateResult {
  options: DebateOptions;
  messages: DebateMessage[];
  summary?: DebateSummary;
}

export async function runDebate(
  config: ChicaneConfig,
  options: DebateOptions,
  renderer?: DebateRenderer
): Promise<DebateResult> {
  const agentAConfig = withRuntimeOverrides(config.agents[options.agentA], options.modelA, options.pullModels);
  const agentBConfig = withRuntimeOverrides(config.agents[options.agentB], options.modelB, options.pullModels);

  if (!agentAConfig) {
    throw new Error(`Agent inconnu: ${options.agentA}`);
  }

  if (!agentBConfig) {
    throw new Error(`Agent inconnu: ${options.agentB}`);
  }

  warnIfOllamaHasNoContext(options, [
    [options.agentA, agentAConfig],
    [options.agentB, agentBConfig]
  ], renderer);

  renderer?.start(options);

  const agents = [
    createAgent(options.agentA, agentAConfig),
    createAgent(options.agentB, agentBConfig)
  ];

  const messages: DebateMessage[] = [];

  for (let index = 0; index < options.turns; index += 1) {
    const current = agents[index % agents.length];
    const peer = agents[(index + 1) % agents.length];
    const turn = index + 1;

    renderer?.turnStart(turn, options.turns, current.name, current.role);
    renderer?.thinkingStart(current.name, current.role);

    const response = await current.generate({
      topic: options.topic,
      turn,
      selfName: current.name,
      peerName: peer.name,
      files: options.files,
      transcript: messages
    }).finally(() => renderer?.thinkingEnd());

    const message: DebateMessage = {
      agent: current.name,
      role: current.role,
      content: response.content,
      createdAt: new Date().toISOString()
    };

    messages.push(message);
    renderer?.message(message.content);
  }

  const summary = options.summaryEnabled
    ? await generateSummary(config, options, messages, renderer)
    : undefined;

  return {
    options,
    messages,
    summary
  };
}

function warnIfOllamaHasNoContext(
  options: DebateOptions,
  agents: Array<[string, AgentConfig]>,
  renderer?: DebateRenderer
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

  renderer?.warning(
    `${ollamaAgents.join(", ")} ne lit pas le filesystem. Ajoute --files ou --context pour fournir un contexte projet.`
  );
}

async function generateSummary(
  config: ChicaneConfig,
  options: DebateOptions,
  messages: DebateMessage[],
  renderer?: DebateRenderer
): Promise<DebateSummary> {
  const summaryAgentName = options.summaryAgent ?? options.agentB;
  const summaryModel = options.summaryModel ?? modelForAgent(options, summaryAgentName);
  const summaryConfig = withRuntimeOverrides(config.agents[summaryAgentName], summaryModel, options.pullModels);

  if (!summaryConfig) {
    throw new Error(`Agent de synthese inconnu: ${summaryAgentName}`);
  }

  const summaryAgent = createAgent(summaryAgentName, summaryConfig);

  renderer?.summaryStart(summaryAgent.name, summaryAgent.role);
  renderer?.thinkingStart(summaryAgent.name, summaryAgent.role);

  const response = await summaryAgent.generate({
    topic: options.topic,
    turn: messages.length + 1,
    selfName: summaryAgent.name,
    peerName: "transcript",
    mode: "summary",
    files: options.files,
    transcript: messages
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

function modelForAgent(options: DebateOptions, agent: string): string | undefined {
  if (agent === options.agentA) {
    return options.modelA;
  }

  if (agent === options.agentB) {
    return options.modelB;
  }

  return undefined;
}

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
