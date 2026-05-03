export type AgentRole =
  | "implementer"
  | "reviewer"
  | "architect"
  | "scout"
  | "critic"
  | "summarizer";

export type AgentTier = "primary" | "premium" | "local";

export type CliPromptMode = "stdin" | "argument";

export interface BaseAgentConfig {
  role: AgentRole;
  tier?: AgentTier;
  systemPrompt?: string;
}

export interface CliAgentConfig extends BaseAgentConfig {
  type: "cli";
  command: string;
  args?: string[];
  promptMode?: CliPromptMode;
  modelArg?: string;
  model?: string;
  shell?: boolean;
  allowEmptyOutput?: boolean;
  timeoutMs?: number;
  idleTimeoutMs?: number;
}

export interface OllamaAgentConfig extends BaseAgentConfig {
  type: "ollama";
  model: string;
  baseUrl?: string;
  temperature?: number;
  keepAlive?: string | number;
  validateModel?: boolean;
  autoPullModel?: boolean;
  pullTimeoutMs?: number;
  unloadOtherModels?: boolean;
  timeoutMs?: number;
}

export type AgentConfig = CliAgentConfig | OllamaAgentConfig;

export interface ChicaneConfig {
  outputDir?: string;
  defaults?: {
    agentA?: string;
    agentB?: string;
    turns?: number;
  };
  agents: Record<string, AgentConfig>;
}

export interface DebateMessage {
  agent: string;
  role: AgentRole;
  content: string;
  createdAt: string;
}

export interface DebateOptions {
  topic: string;
  agentA: string;
  agentB: string;
  turns: number;
  files: ProjectFileContext[];
  modelA?: string;
  modelB?: string;
  pullModels: boolean;
  summaryAgent?: string;
  summaryModel?: string;
  summaryEnabled: boolean;
}

export interface AgentPrompt {
  topic: string;
  turn: number;
  selfName: string;
  peerName: string;
  mode?: "debate" | "summary";
  files: ProjectFileContext[];
  transcript: DebateMessage[];
}

export interface AgentResponse {
  content: string;
  raw?: string;
}

export interface AgentAdapter {
  name: string;
  role: AgentRole;
  generate(prompt: AgentPrompt): Promise<AgentResponse>;
}

export interface ProjectFileContext {
  path: string;
  absolutePath: string;
  content: string;
  sizeBytes: number;
}

export interface DebateSummary {
  agent: string;
  role: AgentRole;
  content: string;
  createdAt: string;
}
