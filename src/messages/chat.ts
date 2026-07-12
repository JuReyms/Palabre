/** @file Messages de la commande interactive `palabre chat`. */
import type { AgentRole, ChatAvailableAgent, Language } from "../types.js";

export interface ChatMessages {
  intro(agentName: string, role: AgentRole): string;
  openingPrompt: string;
  questionPrompt: string;
  exitHint: string;
  assistantLabel(agentName: string): string;
  consultationLabel(agentName: string): string;
  availableAgents(agents: ChatAvailableAgent[]): string;
  consultUsage: string;
  useUsage: string;
  agentsUsage: string;
  unknownAgent(name: string): string;
  consultationUnavailable: string;
  consulting(agentName: string): string;
  switchedTo(agentName: string): string;
}

export const chatMessages: Record<Language, ChatMessages> = {
  fr: {
    intro: (agentName, role) => `Palabre · ${agentName} (${role})`,
    openingPrompt: "Que voulez-vous explorer ?\nVous: ",
    questionPrompt: "Vous: ",
    exitHint: "`/consult <agent>` pour un avis · `/agents` pour la liste · `/exit` pour terminer.",
    assistantLabel: (agentName) => `${agentName}:`,
    consultationLabel: (agentName) => `Avis de ${agentName}:`,
    availableAgents: (agents) => `Agents disponibles : ${agents.map((agent) => `${agent.name} (${agent.role})`).join(", ")}.`,
    consultUsage: "Usage : /consult <agent>",
    useUsage: "Usage : /use <agent>",
    agentsUsage: "Usage : /agents",
    unknownAgent: (name) => `Agent inconnu : ${name}.`,
    consultationUnavailable: "Écrivez d'abord un message avant de demander un avis.",
    consulting: (agentName) => `Consultation de ${agentName}…`,
    switchedTo: (agentName) => `La conversation continue avec ${agentName}.`
  },
  en: {
    intro: (agentName, role) => `Palabre · ${agentName} (${role})`,
    openingPrompt: "What would you like to explore?\nYou: ",
    questionPrompt: "You: ",
    exitHint: "`/consult <agent>` for an opinion · `/agents` for the list · `/exit` to finish.",
    assistantLabel: (agentName) => `${agentName}:`,
    consultationLabel: (agentName) => `${agentName}'s opinion:`,
    availableAgents: (agents) => `Available agents: ${agents.map((agent) => `${agent.name} (${agent.role})`).join(", ")}.`,
    consultUsage: "Usage: /consult <agent>",
    useUsage: "Usage: /use <agent>",
    agentsUsage: "Usage: /agents",
    unknownAgent: (name) => `Unknown agent: ${name}.`,
    consultationUnavailable: "Write at least one message before requesting an opinion.",
    consulting: (agentName) => `Consulting ${agentName}…`,
    switchedTo: (agentName) => `Conversation now continues with ${agentName}.`
  }
};