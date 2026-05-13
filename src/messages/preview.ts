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
    note: "Note: seuls les prompts du premier tour sont exacts sans exécuter les agents. Les tours suivants incluent le transcript réel."
  },
  en: {
    title: "# Prompt preview",
    agent: (name, role) => `Agent: ${name} (${role})`,
    peer: (name) => `Peer: ${name}`,
    pullModels: (enabled) => `Pull missing Ollama models: ${enabled ? "yes" : "no"}`,
    summary: (value) => `Summary: ${value}`,
    disabled: "disabled",
    interfaceLanguage: (language) => `Language: ${language}`,
    note: "Note: only first-turn prompts are exact without running agents. Later turns include the real transcript."
  }
};
