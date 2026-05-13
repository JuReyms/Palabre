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
  noDefaultPair: string;
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
    noDefaultPair: "Défauts: aucune paire détectée. Installe au moins deux agents, puis lance `palabre config --sync-agents` ou `palabre config --set-defaults <agentA> <agentB>`. Guide: https://palab.re/fr/agents/overview",
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
    noDefaultPair: "Defaults: no detected pair. Install at least two agents, then run `palabre config --sync-agents` or `palabre config --set-defaults <agentA> <agentB>`. Guide: https://palab.re/en/agents/overview",
    languageHint: (language) => `Language: ${language}\nFrançais > palabre config --language fr`
  }
};
