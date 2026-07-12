/** @file Messages de la commande interactive `palabre chat`. */
import type { Language } from "../types.js";

export interface ChatMessages {
  intro(agentName: string): string;
  questionPrompt: string;
  exitHint: string;
  assistantLabel(agentName: string): string;
}

export const chatMessages: Record<Language, ChatMessages> = {
  fr: {
    intro: (agentName) => `Conversation avec ${agentName}.`,
    questionPrompt: "Vous: ",
    exitHint: "Tapez /exit pour terminer.",
    assistantLabel: (agentName) => `${agentName}:`
  },
  en: {
    intro: (agentName) => `Conversation with ${agentName}.`,
    questionPrompt: "You: ",
    exitHint: "Type /exit to finish.",
    assistantLabel: (agentName) => `${agentName}:`
  }
};