/** @file Noyau stateless d'une conversation Palabre avec un agent unique. */
import { createAgent } from "./adapters/index.js";
import { formatAgentPrompt } from "./prompt.js";
import type { AgentConfig, AgentRole, DebateMessage, Language, ProjectFileContext, SessionContext } from "./types.js";

export interface ChatTurnInput {
  agentName: string;
  agentConfig: AgentConfig;
  topic: string;
  userMessage: string;
  transcript: DebateMessage[];
  language: Language;
  session: SessionContext;
  files: ProjectFileContext[];
  signal?: AbortSignal;
}

/** Génère une réponse en réinjectant l'intégralité du transcript disponible dans un appel batch indépendant. */
export async function runStatelessChatTurn(input: ChatTurnInput): Promise<{ user: DebateMessage; assistant: DebateMessage }> {
  const user: DebateMessage = { agent: "user", role: "architect" as AgentRole, content: input.userMessage, createdAt: new Date().toISOString() };
  const adapter = createAgent(input.agentName, input.agentConfig);
  const response = await adapter.generate({
    topic: input.topic,
    turn: input.transcript.length + 1,
    totalTurns: input.transcript.length + 1,
    selfName: input.agentName,
    peerName: "user",
    selfRole: adapter.role,
    mode: "chat",
    language: input.language,
    session: input.session,
    files: input.files,
    transcript: [...input.transcript, user],
    signal: input.signal
  });
  return { user, assistant: { agent: input.agentName, role: adapter.role, content: response.content, createdAt: new Date().toISOString() } };
}