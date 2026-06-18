import type { Language } from "../types.js";

export interface InitMessages {
  configExists(path: string): string;
  configCreated(path: string): string;
  editConfigThenRerun(path: string): string;
  localDetectionTitle: string;
  commandDetected(command: string): string;
  commandMissing: string;
  ollamaServerUnreachable(baseUrl: string): string;
  ollamaMissing: string;
  ollamaDetected(modelCount: number): string;
  defaults(agentA: string, agentB: string): string;
  noDefaultPair(detectedAgents: string): string;
  languageHint(language: Language): string;
}

export const initMessages: Record<Language, InitMessages> = {
  fr: {
    configExists: (path) => `${path} existe déjà.`,
    configCreated: (path) => `${path} créé.`,
    editConfigThenRerun: (path) => `${path} créé. Édite la config puis relance palabre run.`,
    localDetectionTitle: "Détection locale:",
    commandDetected: (command) => `détecté (${command})`,
    commandMissing: "non détecté",
    ollamaServerUnreachable: (baseUrl) => `serveur non joignable (${baseUrl})`,
    ollamaMissing: "non détecté",
    ollamaDetected: (modelCount) => `détectée (${modelCount} modèle${modelCount > 1 ? "s" : ""})`,
    defaults: (agentA, agentB) => `Défauts: ${agentA} <-> ${agentB}`,
    noDefaultPair: (detectedAgents) => `Défauts: ${detectedAgents}. Palabre a besoin d'au moins deux agents.\nAgents compatibles: Codex CLI, Claude CLI, Antigravity CLI, OpenCode CLI, Mistral Vibe CLI, Ollama local.\nGuide: https://palab.re/fr/agents/overview`,
    languageHint: (language) => `Langue: ${language}\nEnglish > palabre config --language en`
  },
  en: {
    configExists: (path) => `${path} already exists.`,
    configCreated: (path) => `${path} created.`,
    editConfigThenRerun: (path) => `${path} created. Edit the config, then run palabre run again.`,
    localDetectionTitle: "Local detection:",
    commandDetected: (command) => `detected (${command})`,
    commandMissing: "not detected",
    ollamaServerUnreachable: (baseUrl) => `server unreachable (${baseUrl})`,
    ollamaMissing: "not detected",
    ollamaDetected: (modelCount) => `detected (${modelCount} model${modelCount > 1 ? "s" : ""})`,
    defaults: (agentA, agentB) => `Defaults: ${agentA} <-> ${agentB}`,
    noDefaultPair: (detectedAgents) => `Defaults: ${detectedAgents}. Palabre needs at least two agents.\nCompatible agents: Codex CLI, Claude CLI, Antigravity CLI, OpenCode CLI, Mistral Vibe CLI, local Ollama.\nGuide: https://palab.re/en/agents/overview`,
    languageHint: (language) => `Language: ${language}\nFrançais > palabre config --language fr`
  }
};
