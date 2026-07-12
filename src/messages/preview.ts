import type { Language } from "../types.js";

export interface PreviewMessages {
  title: string;
  agent(name: string, role: string): string;
  peer(name: string): string;
  pullModels(enabled: boolean): string;
  summary(value: string): string;
  disabled: string;
  interfaceLanguage(language: string): string;
  note: string;
  askNote: string;
  dryRun(preview: { configPath: string; configTrusted: boolean; mode: string; agents: string; summary: string; responses: number; context: string; warnings: number; outputDir: string }): string[];
}

export const previewMessages: Record<Language, PreviewMessages> = {
  fr: {
    title: "# Aperçu du prompt",
    agent: (name, role) => `Agent: ${name} (${role})`,
    peer: (name) => `Pair: ${name}`,
    pullModels: (enabled) => `Télécharger les modèles Ollama manquants: ${enabled ? "oui" : "non"}`,
    summary: (value) => `Synthèse: ${value}`,
    disabled: "désactivée",
    interfaceLanguage: (language) => `Langue: ${language}`,
    note: "Note: seuls les prompts du premier tour sont exacts sans exécuter les agents. Les tours suivants incluent le transcript réel.",
    askNote: "Note: en mode ask, chaque agent reçoit un prompt indépendant. La synthèse reçoit ensuite toutes les réponses réelles.",
    dryRun: (preview) => [
      "# Prévisualisation de session",
      `Configuration: ${preview.configPath} (${preview.configTrusted ? "approuvée" : "non approuvée"})`,
      `Mode: ${preview.mode}`,
      `Agents: ${preview.agents}`,
      `Synthèse: ${preview.summary}`,
      `Réponses prévues: ${preview.responses}`,
      `Contexte: ${preview.context}`,
      `Avertissements de contexte: ${preview.warnings}`,
      `Dossier d’export prévu: ${preview.outputDir}`,
      "Aucun agent, adapter, export ou appel Ollama n’a été lancé."
    ]
  },
  en: {
    title: "# Prompt preview",
    agent: (name, role) => `Agent: ${name} (${role})`,
    peer: (name) => `Peer: ${name}`,
    pullModels: (enabled) => `Pull missing Ollama models: ${enabled ? "yes" : "no"}`,
    summary: (value) => `Summary: ${value}`,
    disabled: "disabled",
    interfaceLanguage: (language) => `Language: ${language}`,
    note: "Note: only first-turn prompts are exact without running agents. Later turns include the real transcript.",
    askNote: "Note: in ask mode, each agent receives an independent prompt. The summary later receives all real responses.",
    dryRun: (preview) => [
      "# Session preview",
      `Configuration: ${preview.configPath} (${preview.configTrusted ? "trusted" : "untrusted"})`,
      `Mode: ${preview.mode}`,
      `Agents: ${preview.agents}`,
      `Summary: ${preview.summary}`,
      `Planned responses: ${preview.responses}`,
      `Context: ${preview.context}`,
      `Context warnings: ${preview.warnings}`,
      `Planned export directory: ${preview.outputDir}`,
      "No agent, adapter, export, or Ollama request was started."
    ]
  }
};
