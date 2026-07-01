import type { Language } from "../types.js";

export interface ConfigMessages {
  createdForConfig(path: string): string;
  syncNoMissing(path: string): string;
  syncAdded(path: string, agents: string): string;
  syncRefreshed(path: string): string;
  ollamaModelNoChange(path: string, model: string | undefined): string;
  ollamaModelUpdated(path: string, previousModel: string, nextModel: string): string;
  ollamaModelUnavailable(model: string): string;
  ollamaModelNoAgent: string;
  ollamaModelNoInstalledModels: string;
  ollamaModelsCurrent(model: string | null): string;
  ollamaModelsApi(available: boolean, baseUrl: string): string;
  ollamaModelsInstalled(models: string[]): string;
  updated(path: string, defaults: string, language: string): string;
  cleared(path: string): string;
  defaultsSummary(agentA: string | undefined, agentB: string | undefined, turns: number, summaryAgent: string | undefined, askSummaryAgent?: string, mode?: string, askAgents?: string[], interfaceName?: string): string;
  wizardNeedsTwoAgents: string;
  wizardTitle: string;
  wizardQuitHint: string;
  wizardConfigFile: string;
  wizardCurrentDefaults: string;
  wizardNoDefaults: string;
  wizardActionQuestion: string;
  wizardActionSetDefaults: string;
  wizardActionClearDefaults: string;
  wizardActionSyncAgents: string;
  wizardActionExit: string;
  wizardChoicePrompt: string;
  wizardChoiceQuestion(label: string, defaultValue: string): string;
  wizardUnchanged: string;
  wizardCleared(path: string): string;
  wizardDefaultsSet(path: string, defaults: string): string;
  wizardAgentADescription: string;
  wizardAgentBDescription: string;
  wizardSummaryTitle: string;
  wizardNoSummary: string;
  wizardCurrent: string;
  wizardSuggestion: string;
  wizardAgentBHint: string;
  wizardAgentPrompt(fallback: string | undefined): string;
  wizardSummaryPrompt(fallback: string | undefined): string;
  wizardInvalidAgentChoice: string;
  wizardInvalidSummaryChoice: string;
  wizardInvalidChoice(allowed: string): string;
  wizardTurnsLabel: string;
  wizardTurnsPrompt(defaultValue: number): string;
  wizardTurnsInvalid(maxTurns: number): string;
  wizardDefaults(defaults: { mode?: string; interfaceName?: string; agentA?: string; agentB?: string; askAgents?: string[]; turns: number; summaryAgent?: string; askSummaryAgent?: string }): string;
}

export const configMessages: Record<Language, ConfigMessages> = {
  fr: {
    createdForConfig: (path) => `${path} créé. Édite la config puis relance palabre config.`,
    syncNoMissing: (path) => `Aucun agent détecté manquant dans ${path}.`,
    syncAdded: (path, agents) => `Agents ajoutés dans ${path}: ${agents}.`,
    syncRefreshed: (path) => `Agents détectés rafraîchis dans ${path}.`,
    ollamaModelNoChange: (path, model) => `Modèle Ollama inchangé dans ${path}: ${model ?? "aucun"}.`,
    ollamaModelUpdated: (path, previousModel, nextModel) => `Modèle Ollama mis à jour dans ${path}: ${previousModel} -> ${nextModel}.`,
    ollamaModelUnavailable: (model) => `Modèle Ollama non installé: ${model}. Action: choisis un modèle installé ou lance \`ollama pull ${model}\`.`,
    ollamaModelNoAgent: "Agent ollama-local absent ou invalide dans la config.",
    ollamaModelNoInstalledModels: "Aucun modèle Ollama installé détecté. Action: lance `ollama pull <modèle>`.",
    ollamaModelsCurrent: (model) => `ollama-local: ${model ?? "(non configuré)"}`,
    ollamaModelsApi: (available, baseUrl) => `Ollama API: ${available ? "joignable" : "indisponible"} (${baseUrl})`,
    ollamaModelsInstalled: (models) => `Modèles installés: ${models.length > 0 ? models.join(", ") : "(aucun)"}`,
    updated: (path, defaults, language) => `Configuration mise à jour dans ${path}: ${defaults}, langue: ${language}.`,
    cleared: (path) => `Paramètres par défaut supprimés dans ${path}. Utilise maintenant un preset ou --agent-a/--agent-b pour lancer un débat.`,
    defaultsSummary: (agentA, agentB, turns, summaryAgent, askSummaryAgent, mode, askAgents, interfaceName) => {
      const modeLabel = `mode: ${mode ?? "debate"}`;
      const interfaceLabel = `interface: ${interfaceName ?? "tui"}`;
      const pair = agentA && agentB ? `agents: ${agentA} <-> ${agentB}` : "agents: non définis";
      const askAgentsLabel = askAgents && askAgents.length > 0 ? `agents ask: ${askAgents.join(", ")}` : "agents ask: défaut";
      const summary = summaryAgent ? `synthèse débat: ${summaryAgent}` : "synthèse débat: agent B";
      const askSummary = askSummaryAgent ? `synthèse ask: ${askSummaryAgent}` : "synthèse ask: synthèse par défaut";
      return `${modeLabel}, ${interfaceLabel}, ${pair}, réponses: ${turns}, ${askAgentsLabel}, ${summary}, ${askSummary}`;
    },
    wizardNeedsTwoAgents: "La config doit contenir au moins deux agents pour définir des paramètres par défaut.",
    wizardTitle: "PALABRE - Configuration",
    wizardQuitHint: "À tout moment: Ctrl+C pour interrompre, ou tape q, quit ou exit dans un prompt pour quitter.",
    wizardConfigFile: "Fichier de configuration :",
    wizardCurrentDefaults: "Paramètres par défaut actuels :",
    wizardNoDefaults: "Aucun",
    wizardActionQuestion: "Que veux-tu faire ?",
    wizardActionSetDefaults: "Définir des paramètres par défaut",
    wizardActionClearDefaults: "Supprimer les paramètres par défaut",
    wizardActionSyncAgents: "Synchroniser les agents détectés",
    wizardActionExit: "Quitter sans modifier",
    wizardChoicePrompt: "Tape le numéro de ton choix",
    wizardChoiceQuestion: (label, defaultValue) => `${label} (Entrée = ${defaultValue}) : `,
    wizardUnchanged: "Config inchangée.",
    wizardCleared: (path) => `Paramètres par défaut supprimés dans ${path}.`,
    wizardDefaultsSet: (path, defaults) => `Paramètres par défaut définis dans ${path}: ${defaults}.`,
    wizardAgentADescription: "Choisis l'agent A, celui qui répondra en premier.",
    wizardAgentBDescription: "Choisis l'agent B, celui qui répondra en second.",
    wizardSummaryTitle: "Agent de synthèse par défaut",
    wizardNoSummary: "Aucun agent de synthèse par défaut",
    wizardCurrent: "Actuel",
    wizardSuggestion: "Suggestion",
    wizardAgentBHint: "agent B",
    wizardAgentPrompt: (fallback) => `Tape un numéro ou un nom d'agent (Entrée = ${fallback}) : `,
    wizardSummaryPrompt: (fallback) => `Tape un numéro, un nom d'agent, ou 0 pour aucun (Entrée = ${fallback}) : `,
    wizardInvalidAgentChoice: "Choix invalide. Tape un numéro, un nom d'agent, Entrée ou q.",
    wizardInvalidSummaryChoice: "Choix invalide. Tape un numéro, un nom d'agent, 0, Entrée ou q.",
    wizardInvalidChoice: (allowed) => `Choix invalide. Valeurs: ${allowed}, Entrée ou q.`,
    wizardTurnsLabel: "Nombre de réponses par défaut",
    wizardTurnsPrompt: (defaultValue) => `Tape le nombre total de réponses du débat (Entrée = ${defaultValue}) : `,
    wizardTurnsInvalid: (maxTurns) => `Entre un nombre entier entre 1 et ${maxTurns}, Entrée ou q.`,
    wizardDefaults: (defaults) => `mode: ${defaults.mode ?? "debate"}, interface: ${defaults.interfaceName ?? "tui"}, ${defaults.agentA ?? "?"} <-> ${defaults.agentB ?? "?"}, réponses: ${defaults.turns}, agents ask: ${defaults.askAgents && defaults.askAgents.length > 0 ? defaults.askAgents.join(", ") : "défaut"}${defaults.summaryAgent ? `, synthèse débat: ${defaults.summaryAgent}` : ""}${defaults.askSummaryAgent ? `, synthèse ask: ${defaults.askSummaryAgent}` : ""}`
  },
  en: {
    createdForConfig: (path) => `${path} created. Edit the config, then run palabre config again.`,
    syncNoMissing: (path) => `No missing detected agent in ${path}.`,
    syncAdded: (path, agents) => `Agents added to ${path}: ${agents}.`,
    syncRefreshed: (path) => `Detected agents refreshed in ${path}.`,
    ollamaModelNoChange: (path, model) => `Ollama model unchanged in ${path}: ${model ?? "none"}.`,
    ollamaModelUpdated: (path, previousModel, nextModel) => `Ollama model updated in ${path}: ${previousModel} -> ${nextModel}.`,
    ollamaModelUnavailable: (model) => `Ollama model is not installed: ${model}. Action: choose an installed model or run \`ollama pull ${model}\`.`,
    ollamaModelNoAgent: "ollama-local agent is missing or invalid in the config.",
    ollamaModelNoInstalledModels: "No installed Ollama model detected. Action: run `ollama pull <model>`.",
    ollamaModelsCurrent: (model) => `ollama-local: ${model ?? "(not configured)"}`,
    ollamaModelsApi: (available, baseUrl) => `Ollama API: ${available ? "reachable" : "unavailable"} (${baseUrl})`,
    ollamaModelsInstalled: (models) => `Installed models: ${models.length > 0 ? models.join(", ") : "(none)"}`,
    updated: (path, defaults, language) => `Configuration updated in ${path}: ${defaults}, language: ${language}.`,
    cleared: (path) => `Default settings cleared in ${path}. Use a preset or --agent-a/--agent-b to start a debate now.`,
    defaultsSummary: (agentA, agentB, turns, summaryAgent, askSummaryAgent, mode, askAgents, interfaceName) => {
      const modeLabel = `mode: ${mode ?? "debate"}`;
      const interfaceLabel = `interface: ${interfaceName ?? "tui"}`;
      const pair = agentA && agentB ? `agents: ${agentA} <-> ${agentB}` : "agents: not set";
      const askAgentsLabel = askAgents && askAgents.length > 0 ? `ask agents: ${askAgents.join(", ")}` : "ask agents: default";
      const summary = summaryAgent ? `debate summary: ${summaryAgent}` : "debate summary: agent B";
      const askSummary = askSummaryAgent ? `ask summary: ${askSummaryAgent}` : "ask summary: default summary";
      return `${modeLabel}, ${interfaceLabel}, ${pair}, responses: ${turns}, ${askAgentsLabel}, ${summary}, ${askSummary}`;
    },
    wizardNeedsTwoAgents: "The config must contain at least two agents to set default settings.",
    wizardTitle: "PALABRE - Configuration",
    wizardQuitHint: "At any time: Ctrl+C to interrupt, or type q, quit, or exit in a prompt to leave.",
    wizardConfigFile: "Configuration file:",
    wizardCurrentDefaults: "Current default settings:",
    wizardNoDefaults: "None",
    wizardActionQuestion: "What do you want to do?",
    wizardActionSetDefaults: "Set default settings",
    wizardActionClearDefaults: "Clear default settings",
    wizardActionSyncAgents: "Sync detected agents",
    wizardActionExit: "Exit without changes",
    wizardChoicePrompt: "Type the number of your choice",
    wizardChoiceQuestion: (label, defaultValue) => `${label} (Enter = ${defaultValue}): `,
    wizardUnchanged: "Config unchanged.",
    wizardCleared: (path) => `Default settings cleared in ${path}.`,
    wizardDefaultsSet: (path, defaults) => `Default settings set in ${path}: ${defaults}.`,
    wizardAgentADescription: "Choose agent A, the one that will answer first.",
    wizardAgentBDescription: "Choose agent B, the one that will answer second.",
    wizardSummaryTitle: "Default summary agent",
    wizardNoSummary: "No default summary agent",
    wizardCurrent: "Current",
    wizardSuggestion: "Suggestion",
    wizardAgentBHint: "agent B",
    wizardAgentPrompt: (fallback) => `Type a number or agent name (Enter = ${fallback}): `,
    wizardSummaryPrompt: (fallback) => `Type a number, agent name, or 0 for none (Enter = ${fallback}): `,
    wizardInvalidAgentChoice: "Invalid choice. Type a number, an agent name, Enter, or q.",
    wizardInvalidSummaryChoice: "Invalid choice. Type a number, an agent name, 0, Enter, or q.",
    wizardInvalidChoice: (allowed) => `Invalid choice. Values: ${allowed}, Enter, or q.`,
    wizardTurnsLabel: "Default number of responses",
    wizardTurnsPrompt: (defaultValue) => `Type the total number of debate responses (Enter = ${defaultValue}): `,
    wizardTurnsInvalid: (maxTurns) => `Enter an integer between 1 and ${maxTurns}, Enter, or q.`,
    wizardDefaults: (defaults) => `mode: ${defaults.mode ?? "debate"}, interface: ${defaults.interfaceName ?? "tui"}, ${defaults.agentA ?? "?"} <-> ${defaults.agentB ?? "?"}, responses: ${defaults.turns}, ask agents: ${defaults.askAgents && defaults.askAgents.length > 0 ? defaults.askAgents.join(", ") : "default"}${defaults.summaryAgent ? `, debate summary: ${defaults.summaryAgent}` : ""}${defaults.askSummaryAgent ? `, ask summary: ${defaults.askSummaryAgent}` : ""}`
  }
};
