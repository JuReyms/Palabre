/** @file Noyau stateless de conversation et de consultation entre agents. */
import { createAgent } from "./adapters/index.js";
import type { AgentConfig, AgentRole, ChatAvailableAgent, DebateMessage, Language, ProjectFileContext, SessionContext } from "./types.js";
import type { AgentRuntimeOptions } from "./adapters/index.js";

const RETAINED_MESSAGES = 6;

export interface ChatTurnInput {
  agentName: string;
  agentConfig: AgentConfig;
  runtime?: AgentRuntimeOptions;
  topic: string;
  userMessage: string;
  transcript: DebateMessage[];
  availableAgents: ChatAvailableAgent[];
  language: Language;
  session: SessionContext;
  files: ProjectFileContext[];
  signal?: AbortSignal;
}

export interface ConsultationInput extends Omit<ChatTurnInput, "userMessage"> {
  requesterName: string;
}

/** Construit le message utilisateur avant tout appel agent. */
export function createChatUserMessage(content: string): DebateMessage {
  return { agent: "user", role: "architect" as AgentRole, content, createdAt: new Date().toISOString() };
}

/** Génère une réponse en réinjectant un historique récent dans un appel batch indépendant. */
export async function runStatelessChatTurn(input: ChatTurnInput): Promise<{ user: DebateMessage; assistant: DebateMessage }> {
  const user = createChatUserMessage(input.userMessage);
  const assistant = await runStatelessChatResponse(input, [...input.transcript, user]);
  return { user, assistant };
}

/** Génère uniquement la réponse pour un message déjà accepté dans le transcript. */
export async function runStatelessChatResponse(input: ChatTurnInput, transcript: DebateMessage[]): Promise<DebateMessage> {
  const adapter = createAgent(input.agentName, input.agentConfig, input.runtime);
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
    transcript: retainRecentMessages(transcript),
    availableAgents: input.availableAgents,
    signal: input.signal
  });
  return { agent: input.agentName, role: adapter.role, content: response.content, createdAt: new Date().toISOString() };
}

/** Recueille un avis indépendant sans modifier l'agent actif de la conversation. */
export async function runStatelessConsultation(input: ConsultationInput): Promise<DebateMessage> {
  const adapter = createAgent(input.agentName, input.agentConfig, input.runtime);
  const response = await adapter.generate({
    topic: input.topic,
    turn: input.transcript.length,
    totalTurns: input.transcript.length,
    selfName: input.agentName,
    peerName: "user",
    selfRole: adapter.role,
    mode: "consultation",
    language: input.language,
    session: input.session,
    files: input.files,
    transcript: retainRecentMessages(input.transcript),
    availableAgents: input.availableAgents,
    consultationRequester: input.requesterName,
    signal: input.signal
  });
  return { agent: input.agentName, role: adapter.role, content: response.content, createdAt: new Date().toISOString() };
}

/** Le contexte par défaut privilégie les échanges récents plutôt que le transcript intégral. */
function retainRecentMessages(transcript: DebateMessage[]): DebateMessage[] {
  return transcript.slice(-RETAINED_MESSAGES);
}