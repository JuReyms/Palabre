/** @file Contrôleur unique du cycle de vie d'une conversation Chat. */
import { isRetiredAgentName } from "./agentRegistry.js";
import { withRuntimeOverrides } from "./agentRuntime.js";
import { createChatUserMessage, runStatelessChatResponse, runStatelessConsultation } from "./chat.js";
import { writeChatMarkdown } from "./chatOutput.js";
import type { Messages } from "./messages/index.js";
import type { AgentConfig, ChatAvailableAgent, ChatOptions, ChatTermination, DebateMessage, Language, PalabreConfig } from "./types.js";

export class ChatSession {
  readonly availableAgents: ChatAvailableAgent[];
  private readonly transcript: DebateMessage[] = [];
  private readonly initialAgent: string;
  private droppedCount = 0;
  private activeName: string;
  private topicValue: string;

  constructor(
    private readonly config: PalabreConfig,
    private readonly options: ChatOptions,
    private readonly translations: Messages
  ) {
    this.initialAgent = options.agent;
    this.activeName = options.agent;
    this.topicValue = options.topic;
    this.availableAgents = Object.entries(config.agents)
      .filter(([name]) => !isRetiredAgentName(name))
      .map(([name, agent]) => ({ name, role: agent.role }));
    this.requireAgent(options.agent);
  }

  get activeAgentName(): string {
    return this.activeName;
  }

  get activeAgentConfig(): AgentConfig {
    return this.runtimeConfig(this.activeName);
  }

  get topic(): string {
    return this.topicValue;
  }

  get messages(): DebateMessage[] {
    return this.transcript.slice();
  }

  get droppedMessageCount(): number {
    return this.droppedCount;
  }

  get aborted(): boolean {
    return this.options.signal?.aborted === true;
  }

  async send(
    userMessage: string,
    onAccepted?: (message: DebateMessage) => void
  ): Promise<{ user: DebateMessage; assistant: DebateMessage }> {
    if (!this.topicValue) this.topicValue = userMessage;
    this.droppedCount = Math.max(0, this.transcript.length + 1 - 6);
    const user = createChatUserMessage(userMessage);
    this.transcript.push(user);
    onAccepted?.(user);
    const assistant = await runStatelessChatResponse({
      agentName: this.activeName,
      agentConfig: this.runtimeConfig(this.activeName),
      runtime: { ollamaUrl: this.options.ollamaUrl },
      topic: this.topicValue,
      userMessage,
      transcript: this.transcript,
      availableAgents: this.availableAgents,
      language: this.options.language,
      session: this.options.session,
      files: this.options.files,
      signal: this.options.signal
    }, this.transcript);
    this.transcript.push(assistant);
    return { user, assistant };
  }

  async consult(agentName: string): Promise<DebateMessage> {
    this.droppedCount = Math.max(0, this.transcript.length - 6);
    const opinion = await runStatelessConsultation({
      agentName,
      agentConfig: this.runtimeConfig(agentName),
      runtime: { ollamaUrl: this.options.ollamaUrl },
      requesterName: this.activeName,
      topic: this.topicValue,
      transcript: this.transcript,
      availableAgents: this.availableAgents,
      language: this.options.language,
      session: this.options.session,
      files: this.options.files,
      signal: this.options.signal
    });
    this.transcript.push(opinion);
    return opinion;
  }

  use(agentName: string): void {
    this.requireAgent(agentName);
    this.activeName = agentName;
  }

  async export(outputDir: string, termination: ChatTermination): Promise<string> {
    return writeChatMarkdown(outputDir, this.topicValue, this.transcript, this.options.session, termination, this.translations);
  }

  private requireAgent(agentName: string): AgentConfig {
    const agent = this.config.agents[agentName];
    if (!agent || isRetiredAgentName(agentName)) throw new Error(this.translations.common.unknownAgent(agentName));
    return agent;
  }

  private runtimeConfig(agentName: string): AgentConfig {
    const config = this.requireAgent(agentName);
    return withRuntimeOverrides(
      config,
      agentName === this.initialAgent ? this.options.model : undefined,
      this.options.pullModels,
      agentName === this.initialAgent ? this.options.role : undefined
    )!;
  }
}

/** Construit un contexte borné et traçable pour poursuivre une session de décision en Chat. */
export function buildChatHandoffTopic(
  topic: string,
  mode: "debate" | "ask",
  summary: string | undefined,
  transcript: DebateMessage[],
  language: Language
): string {
  const recent = transcript.slice(-6).map((message) => `[${message.agent} · ${message.role}]\n${message.content}`).join("\n\n");
  const source = summary ?? recent;
  const boundedSource = source.length > 20_000 ? `${source.slice(0, 20_000)}\n[…]` : source;
  return language === "fr"
    ? `Contexte repris d'une session Palabre ${mode}.\nSujet initial : ${topic}\n\n${summary ? "Synthèse finale" : "Échanges récents retenus"} :\n${boundedSource}`
    : `Context continued from a Palabre ${mode} session.\nInitial subject: ${topic}\n\n${summary ? "Final summary" : "Retained recent exchanges"}:\n${boundedSource}`;
}
