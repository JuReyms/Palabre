import type { Language } from "../types.js";

export interface PresetsMessages {
  unknown(name: string, available: string): string;
  title: string;
  available: string;
  unavailable(reasons: string): string;
  total(count: number): string;
  missingAgent(agentName: string): string;
  ollamaUnreachable(agentName: string): string;
  ollamaNotDetected(agentName: string): string;
  missingOllamaModel(agentName: string, model: string): string;
  missingCommand(agentName: string, command: string): string;
}

export const presetsMessages: Record<Language, PresetsMessages> = {
  fr: {
    unknown: (name, available) => `Preset inconnu: ${name}. Presets disponibles: ${available}`,
    title: "Presets disponibles:",
    available: "disponible",
    unavailable: (reasons) => `indisponible (${reasons})`,
    total: (count) => `Total : ${count} preset(s). Utilise --json pour une sortie machine-readable.`,
    missingAgent: (agentName) => `agent absent de la config: ${agentName}`,
    ollamaUnreachable: (agentName) => `Ollama non joignable pour ${agentName}`,
    ollamaNotDetected: (agentName) => `Ollama non détecté pour ${agentName}`,
    missingOllamaModel: (agentName, model) => `modèle Ollama absent pour ${agentName}: ${model}`,
    missingCommand: (agentName, command) => `commande non détectée pour ${agentName}: ${command}`
  },
  en: {
    unknown: (name, available) => `Unknown preset: ${name}. Available presets: ${available}`,
    title: "Available presets:",
    available: "available",
    unavailable: (reasons) => `unavailable (${reasons})`,
    total: (count) => `Total: ${count} preset(s). Use --json for machine-readable output.`,
    missingAgent: (agentName) => `agent missing from config: ${agentName}`,
    ollamaUnreachable: (agentName) => `Ollama unreachable for ${agentName}`,
    ollamaNotDetected: (agentName) => `Ollama not detected for ${agentName}`,
    missingOllamaModel: (agentName, model) => `missing Ollama model for ${agentName}: ${model}`,
    missingCommand: (agentName, command) => `command not detected for ${agentName}: ${command}`
  }
};
