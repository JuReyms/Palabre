import type { Language } from "../types.js";

export interface ConfigMessages {
  createdForConfig(path: string): string;
  syncNoMissing(path: string): string;
  syncAdded(path: string, agents: string): string;
  updated(path: string, defaults: string, language: string): string;
  cleared(path: string): string;
  defaultsSummary(agentA: string | undefined, agentB: string | undefined, turns: number, summaryAgent: string | undefined): string;
  wizardNeedsTwoAgents: string;
  wizardTitle: string;
  wizardQuitHint: string;
  wizardConfigFile: string;
  wizardCurrentDefaults: string;
  wizardNoDefaults: string;
  wizardActionQuestion: string;
  wizardActionSetDefaults: string;
  wizardActionClearDefaults: string;
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
  wizardDefaults(defaults: { agentA?: string; agentB?: string; turns: number; summaryAgent?: string }): string;
}

export const configMessages: Record<Language, ConfigMessages> = {
  fr: {
    createdForConfig: (path) => `${path} créé. Édite la config puis relance palabre config.`,
    syncNoMissing: (path) => `Aucun agent détecté manquant dans ${path}.`,
    syncAdded: (path, agents) => `Agents ajoutés dans ${path}: ${agents}.`,
    updated: (path, defaults, language) => `Configuration mise à jour dans ${path}: ${defaults}, langue: ${language}.`,
    cleared: (path) => `Paramètres par défaut supprimés dans ${path}. Utilise maintenant un preset ou --agent-a/--agent-b pour lancer un débat.`,
    defaultsSummary: (agentA, agentB, turns, summaryAgent) => {
      const pair = agentA && agentB ? `agents: ${agentA} <-> ${agentB}` : "agents: non définis";
      const summary = summaryAgent ? `synthèse: ${summaryAgent}` : "synthèse: agent B";
      return `${pair}, réponses: ${turns}, ${summary}`;
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
    wizardDefaults: (defaults) => `${defaults.agentA ?? "?"} <-> ${defaults.agentB ?? "?"}, réponses: ${defaults.turns}${defaults.summaryAgent ? `, synthèse: ${defaults.summaryAgent}` : ""}`
  },
  en: {
    createdForConfig: (path) => `${path} created. Edit the config, then run palabre config again.`,
    syncNoMissing: (path) => `No missing detected agent in ${path}.`,
    syncAdded: (path, agents) => `Agents added to ${path}: ${agents}.`,
    updated: (path, defaults, language) => `Configuration updated in ${path}: ${defaults}, language: ${language}.`,
    cleared: (path) => `Default settings cleared in ${path}. Use a preset or --agent-a/--agent-b to start a debate now.`,
    defaultsSummary: (agentA, agentB, turns, summaryAgent) => {
      const pair = agentA && agentB ? `agents: ${agentA} <-> ${agentB}` : "agents: not set";
      const summary = summaryAgent ? `summary: ${summaryAgent}` : "summary: agent B";
      return `${pair}, responses: ${turns}, ${summary}`;
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
    wizardDefaults: (defaults) => `${defaults.agentA ?? "?"} <-> ${defaults.agentB ?? "?"}, responses: ${defaults.turns}${defaults.summaryAgent ? `, summary: ${defaults.summaryAgent}` : ""}`
  }
};
