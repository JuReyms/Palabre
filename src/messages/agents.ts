import type { Language } from "../types.js";

export interface AgentsMessages {
  noConfig: string;
  config(path: string): string;
  title: string;
  defaultAgentA: string;
  defaultAgentB: string;
  defaultSummary: string;
  defaultAskSummary: string;
  defaults(agentA: string, agentB: string, turns: number, summaryAgent: string, askSummaryAgent?: string): string;
  none: string;
  summaryAgentB: string;
  model(model: string): string;
  command(command: string, model?: string): string;
  detected(command?: string): string;
  notDetected: string;
  ollamaUnreachable: string;
  ollamaNotDetected: string;
  missingModel(model: string): string;
}

export const agentsMessages: Record<Language, AgentsMessages> = {
  fr: {
    noConfig: "Aucune config trouvée. Lance `palabre init`, puis `palabre agents`.",
    config: (path) => `Config: ${path}`,
    title: "Agents déclarés:",
    defaultAgentA: "agent A par défaut",
    defaultAgentB: "agent B par défaut",
    defaultSummary: "synthèse par défaut",
    defaultAskSummary: "synthèse ask par défaut",
    defaults: (agentA, agentB, turns, summaryAgent, askSummaryAgent) => `Défauts: ${agentA} <-> ${agentB}, réponses: ${turns}, synthèse débat: ${summaryAgent}${askSummaryAgent ? `, synthèse ask: ${askSummaryAgent}` : ""}`,
    none: "aucun",
    summaryAgentB: "agent B",
    model: (model) => `modèle: ${model}`,
    command: (command, model) => `commande: ${command}${model ? ` | modèle: ${model}` : ""}`,
    detected: (command) => command ? `détecté (${command})` : "détecté",
    notDetected: "non détecté",
    ollamaUnreachable: "Ollama non joignable",
    ollamaNotDetected: "Ollama non détecté",
    missingModel: (model) => `modèle absent (${model})`
  },
  en: {
    noConfig: "No config found. Run `palabre init`, then `palabre agents`.",
    config: (path) => `Config: ${path}`,
    title: "Declared agents:",
    defaultAgentA: "default agent A",
    defaultAgentB: "default agent B",
    defaultSummary: "default summary",
    defaultAskSummary: "default ask summary",
    defaults: (agentA, agentB, turns, summaryAgent, askSummaryAgent) => `Defaults: ${agentA} <-> ${agentB}, responses: ${turns}, debate summary: ${summaryAgent}${askSummaryAgent ? `, ask summary: ${askSummaryAgent}` : ""}`,
    none: "none",
    summaryAgentB: "agent B",
    model: (model) => `model: ${model}`,
    command: (command, model) => `command: ${command}${model ? ` | model: ${model}` : ""}`,
    detected: (command) => command ? `detected (${command})` : "detected",
    notDetected: "not detected",
    ollamaUnreachable: "Ollama unreachable",
    ollamaNotDetected: "Ollama not detected",
    missingModel: (model) => `missing model (${model})`
  }
};
