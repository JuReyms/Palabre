import type { Language } from "../types.js";

export interface RendererMessages {
  subject(topic: string): string;
  agents(pair: string): string;
  responsesSummaryContext(turns: number, summary: string, context: string): string;
  responsesSummary(turns: number, summary: string): string;
  context(context: string): string;
  workingFolder(path: string): string;
  options(earlyStop: boolean, pullModels: boolean): string;
  enabled: string;
  disabled: string;
  warningPrefix: string;
  infoPrefix: string;
  turn(turn: number, totalTurns: number): string;
  thinking(agent: string, role: string): string;
  summaryTitle: string;
  exported(path: string): string;
  noInjectedFiles: string;
  /** Résumé du contexte injecté : compte + chemins (tronqués à 3, reste en `+N`). */
  injectedFiles(count: number, paths: string[]): string;
}

/** Tronque une liste de chemins pour l'affichage : 3 premiers + compteur du reste. */
function summarizePaths(paths: string[]): string {
  const shown = paths.slice(0, 3);
  const extra = paths.length - shown.length;
  return `${shown.join(", ")}${extra > 0 ? ` (+${extra})` : ""}`;
}

export const rendererMessages: Record<Language, RendererMessages> = {
  fr: {
    subject: (topic) => `Sujet: ${topic}`,
    agents: (pair) => `Agents: ${pair}`,
    responsesSummaryContext: (turns, summary, context) => `Réponses: ${turns} | Synthèse: ${summary} | Contexte: ${context}`,
    responsesSummary: (turns, summary) => `Réponses: ${turns} | Synthèse: ${summary}`,
    context: (context) => `Contexte: ${context}`,
    workingFolder: (path) => `Dossier: ${path}`,
    options: (earlyStop, pullModels) => `Options: arrêt anticipé ${earlyStop ? "activé" : "désactivé"}, auto-pull Ollama ${pullModels ? "activé" : "désactivé"}`,
    enabled: "activé",
    disabled: "désactivée",
    warningPrefix: "Warning:",
    infoPrefix: "Info:",
    turn: (turn, totalTurns) => `tour ${turn}/${totalTurns}`,
    thinking: (agent, role) => `${agent} (${role}) reflechit`,
    summaryTitle: "Synthese",
    exported: (path) => `Palabre exporte: ${path}`,
    noInjectedFiles: "aucun fichier injecté",
    injectedFiles: (count, paths) => `${count} fichier${count > 1 ? "s" : ""} injecté${count > 1 ? "s" : ""} : ${summarizePaths(paths)}`
  },
  en: {
    subject: (topic) => `Subject: ${topic}`,
    agents: (pair) => `Agents: ${pair}`,
    responsesSummaryContext: (turns, summary, context) => `Responses: ${turns} | Summary: ${summary} | Context: ${context}`,
    responsesSummary: (turns, summary) => `Responses: ${turns} | Summary: ${summary}`,
    context: (context) => `Context: ${context}`,
    workingFolder: (path) => `Folder: ${path}`,
    options: (earlyStop, pullModels) => `Options: early stop ${earlyStop ? "enabled" : "disabled"}, Ollama auto-pull ${pullModels ? "enabled" : "disabled"}`,
    enabled: "enabled",
    disabled: "disabled",
    warningPrefix: "Warning:",
    infoPrefix: "Info:",
    turn: (turn, totalTurns) => `turn ${turn}/${totalTurns}`,
    thinking: (agent, role) => `${agent} (${role}) is thinking`,
    summaryTitle: "Summary",
    exported: (path) => `Palabre exported: ${path}`,
    noInjectedFiles: "no injected files",
    injectedFiles: (count, paths) => `${count} injected file${count > 1 ? "s" : ""}: ${summarizePaths(paths)}`
  }
};
