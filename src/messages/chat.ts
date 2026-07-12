/** @file Messages de la commande interactive `palabre chat`. */
import type { ChatAvailableAgent, Language } from "../types.js";

export interface ChatMessages {
  intro(agentName: string): string;
  questionPrompt: string;
  exitHint: string;
  assistantLabel(agentName: string): string;
  consultationLabel(agentName: string): string;
  availableAgents(agents: ChatAvailableAgent[]): string;
  consultUsage: string;
  useUsage: string;
  unknownAgent(name: string): string;
  consultationUnavailable: string;
  consulting(agentName: string): string;
  switchedTo(agentName: string): string;
}

export const chatMessages: Record<Language, ChatMessages> = {
  fr: {
    intro: (agentName) => `Conversation avec ${agentName}.`,
    questionPrompt: "Vous: ",
    exitHint: "Tapez /exit pour terminer. Commandes : /consult <agent>, /use <agent>.",
    assistantLabel: (agentName) => `${agentName}:`,
    consultationLabel: (agentName) => `Avis de ${agentName}:`,
    availableAgents: (agents) => `Agents disponibles : ${agents.map((agent) => `${agent.name} (${agent.role})`).join(", ")}.`,
    consultUsage: "Usage : /consult <agent>",
    useUsage: "Usage : /use <agent>",
    unknownAgent: (name) => `Agent inconnu : ${name}.`,
    consultationUnavailable: "Ajoutez au moins un message avant de demander un avis.",
    consulting: (agentName) => `Consultation de ${agentName}…`,
    switchedTo: (agentName) => `La conversation continue avec ${agentName}.`
  },
  en: {
    intro: (agentName) => `Conversation with ${agentName}.`,
    questionPrompt: "You: ",
    exitHint: "Type /exit to finish. Commands: /consult <agent>, /use <agent>.",
    assistantLabel: (agentName) => `${agentName}:`,
    consultationLabel: (agentName) => `${agentName}'s opinion:`,
    availableAgents: (agents) => `Available agents: ${agents.map((agent) => `${agent.name} (${agent.role})`).join(", ")}.`,
    consultUsage: "Usage: /consult <agent>",
    useUsage: "Usage: /use <agent>",
    unknownAgent: (name) => `Unknown agent: ${name}.`,
    consultationUnavailable: "Add at least one message before requesting an opinion.",
    consulting: (agentName) => `Consulting ${agentName}…`,
    switchedTo: (agentName) => `Conversation now continues with ${agentName}.`
  }
};