import { createAgent } from "./adapters/index.js";
import type { AgentConfig, ChicaneConfig, DebateMessage, DebateOptions, DebateSummary } from "./types.js";

export interface DebateResult {
  options: DebateOptions;
  messages: DebateMessage[];
  summary?: DebateSummary;
}

export async function runDebate(config: ChicaneConfig, options: DebateOptions): Promise<DebateResult> {
  const agentAConfig = withRuntimeOverrides(config.agents[options.agentA], options.modelA, options.pullModels);
  const agentBConfig = withRuntimeOverrides(config.agents[options.agentB], options.modelB, options.pullModels);

  if (!agentAConfig) {
    throw new Error(`Agent inconnu: ${options.agentA}`);
  }

  if (!agentBConfig) {
    throw new Error(`Agent inconnu: ${options.agentB}`);
  }

  warnIfOllamaHasNoExplicitFiles(options, [
    [options.agentA, agentAConfig],
    [options.agentB, agentBConfig]
  ]);

  const agents = [
    createAgent(options.agentA, agentAConfig),
    createAgent(options.agentB, agentBConfig)
  ];

  const messages: DebateMessage[] = [];

  for (let index = 0; index < options.turns; index += 1) {
    const current = agents[index % agents.length];
    const peer = agents[(index + 1) % agents.length];
    const turn = index + 1;

    process.stdout.write(`\n[${turn}/${options.turns}] ${current.name} (${current.role})...\n`);

    const response = await current.generate({
      topic: options.topic,
      turn,
      selfName: current.name,
      peerName: peer.name,
      files: options.files,
      transcript: messages
    });

    const message: DebateMessage = {
      agent: current.name,
      role: current.role,
      content: response.content,
      createdAt: new Date().toISOString()
    };

    messages.push(message);
    process.stdout.write(`${message.content}\n`);
  }

  const summary = options.summaryEnabled
    ? await generateSummary(config, options, messages)
    : undefined;

  return {
    options,
    messages,
    summary
  };
}

function warnIfOllamaHasNoExplicitFiles(options: DebateOptions, agents: Array<[string, AgentConfig]>): void {
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

  process.stderr.write(
    `Warning: ${ollamaAgents.join(", ")} ne lit pas le filesystem. ` +
    "Ajoute --files pour fournir un contexte projet explicite.\n"
  );
}

async function generateSummary(
  config: ChicaneConfig,
  options: DebateOptions,
  messages: DebateMessage[]
): Promise<DebateSummary> {
  const summaryAgentName = options.summaryAgent ?? options.agentB;
  const summaryModel = options.summaryModel ?? modelForAgent(options, summaryAgentName);
  const summaryConfig = withRuntimeOverrides(config.agents[summaryAgentName], summaryModel, options.pullModels);

  if (!summaryConfig) {
    throw new Error(`Agent de synthese inconnu: ${summaryAgentName}`);
  }

  const summaryAgent = createAgent(summaryAgentName, summaryConfig);

  process.stdout.write(`\n[Synthese] ${summaryAgent.name} (${summaryAgent.role})...\n`);

  const response = await summaryAgent.generate({
    topic: options.topic,
    turn: messages.length + 1,
    selfName: summaryAgent.name,
    peerName: "transcript",
    mode: "summary",
    files: options.files,
    transcript: messages
  });

  const summary: DebateSummary = {
    agent: summaryAgent.name,
    role: summaryAgent.role,
    content: response.content,
    createdAt: new Date().toISOString()
  };

  process.stdout.write(`${summary.content}\n`);
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
