/** @file Messages de la commande interactive `palabre chat`. */
import type { AgentRole, ChatAvailableAgent, ChatStopReason, Language } from "../types.js";

export interface ChatMessages {
  intro(agentName: string, role: AgentRole): string;
  openingPrompt: string; questionPrompt: string; exitHint: string; assistantLabel(agentName: string): string; consultationLabel(agentName: string): string;
  availableAgents(agents: ChatAvailableAgent[]): string; consultUsage: string; useUsage: string; agentsUsage: string; unknownAgent(name: string): string;
  consultationUnavailable: string; consulting(agentName: string): string; switchedTo(agentName: string): string; contextTrimmed(count: number): string; continuedFromSession(mode: string): string;
  endHint: string; sessionEnded: string; exportedFile: string; exportedFolder: string; returnHint: string; failureExported(path: string): string;
  exportTitle: string; exportSubject: string; exportAgents: string; exportStartedAt: string; exportEndedAt: string; exportStopReason: string; exportStopReasonValue(reason: ChatStopReason): string; exportError: string; exportMessages: string;
}
export const chatMessages: Record<Language, ChatMessages> = {
  fr: {
    intro: (agentName, role) => `Palabre · ${agentName} (${role})`, openingPrompt: "Que voulez-vous explorer ?\nVous: ", questionPrompt: "Vous: ",
    exitHint: "`/consult <agent>` pour un avis · `/agents` pour la liste.", assistantLabel: (agentName) => `${agentName}:`, consultationLabel: (agentName) => `Avis de ${agentName}:`,
    availableAgents: (agents) => `Agents disponibles : ${agents.map((agent) => `${agent.name} (${agent.role})`).join(", ")}.`, consultUsage: "Usage : /consult <agent>", useUsage: "Usage : /use <agent>", agentsUsage: "Usage : /agents", unknownAgent: (name) => `Agent inconnu : ${name}.`, consultationUnavailable: "Écrivez d'abord un message avant de demander un avis.", consulting: (agentName) => `${agentName} se connecte à la conversation…`, switchedTo: (agentName) => `La conversation continue avec ${agentName}.`,
    contextTrimmed: (count) => `Contexte borné : ${count} ancien(s) message(s) ne sont plus renvoyés à l'agent.`,
    continuedFromSession: (mode) => `Contexte initial repris depuis la dernière session ${mode} : sujet et synthèse, ou échanges récents en l'absence de synthèse.`,
    endHint: "`/end` pour enregistrer et terminer · `/home` pour revenir sans enregistrer.", sessionEnded: "Conversation terminée", exportedFile: "Fichier exporté", exportedFolder: "Dossier d'export", returnHint: "Appuyez sur Entrée pour revenir à l'accueil.", failureExported: (path) => `Conversation interrompue : transcription partielle enregistrée dans ${path}.`, exportTitle: "# Conversation Palabre", exportSubject: "Contexte initial", exportAgents: "Agents", exportStartedAt: "Session démarrée", exportEndedAt: "Session terminée", exportStopReason: "Fin de session", exportStopReasonValue: (reason) => reason === "user-end" ? "Terminée par l'utilisateur avec /end" : "Interrompue par une erreur", exportError: "Erreur", exportMessages: "Messages"
  },
  en: {
    intro: (agentName, role) => `Palabre · ${agentName} (${role})`, openingPrompt: "What would you like to explore?\nYou: ", questionPrompt: "You: ",
    exitHint: "`/consult <agent>` for an opinion · `/agents` for the list.", assistantLabel: (agentName) => `${agentName}:`, consultationLabel: (agentName) => `${agentName}'s opinion:`,
    availableAgents: (agents) => `Available agents: ${agents.map((agent) => `${agent.name} (${agent.role})`).join(", ")}.`, consultUsage: "Usage: /consult <agent>", useUsage: "Usage: /use <agent>", agentsUsage: "Usage: /agents", unknownAgent: (name) => `Unknown agent: ${name}.`, consultationUnavailable: "Write at least one message before requesting an opinion.", consulting: (agentName) => `${agentName} is joining the conversation…`, switchedTo: (agentName) => `Conversation now continues with ${agentName}.`,
    contextTrimmed: (count) => `Bounded context: ${count} older message(s) are no longer sent to the agent.`,
    continuedFromSession: (mode) => `Initial context continued from the latest ${mode} session: subject and summary, or recent exchanges when no summary exists.`,
    endHint: "`/end` to save and finish · `/home` to return without saving.", sessionEnded: "Conversation ended", exportedFile: "Exported file", exportedFolder: "Export folder", returnHint: "Press Enter to return home.", failureExported: (path) => `Conversation interrupted: partial transcript saved to ${path}.`, exportTitle: "# Palabre conversation", exportSubject: "Initial context", exportAgents: "Agents", exportStartedAt: "Session started", exportEndedAt: "Session ended", exportStopReason: "Session end", exportStopReasonValue: (reason) => reason === "user-end" ? "Ended by the user with /end" : "Interrupted by an error", exportError: "Error", exportMessages: "Messages"
  }
};
