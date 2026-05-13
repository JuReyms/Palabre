import type { Language } from "../types.js";

export interface CommonMessages {
  invalidLanguage(source: string, value: string, supported: readonly string[]): string;
  unknownCommand(value: string, commands: string): string;
  ambiguousSubject(value: string): string;
  optionRequiresValue(option: string): string;
  setDefaultsRequiresTwo: string;
  topicRequired: string;
  noAgentDefined(label: string): string;
  unknownAgentForField(field: string, agent: string, available: string): string;
  unknownAgent(agent: string): string;
  unknownRenderer(value: string, supported: string): string;
  errorPrefix: string;
}

export const commonMessages: Record<Language, CommonMessages> = {
  fr: {
    invalidLanguage: (source, value, supported) => `${source} invalide: ${value}. Valeurs supportées: ${supported.join(", ")}.`,
    unknownCommand: (value, commands) => `Commande inconnue: ${value}. Commandes disponibles: ${commands}.`,
    ambiguousSubject: (value) => `Commande inconnue ou sujet ambigu: ${value}. Utilise -s "${value}" pour un sujet en un mot, ou palabre help pour voir les commandes.`,
    optionRequiresValue: (option) => `L'option ${option} attend une valeur.`,
    setDefaultsRequiresTwo: "L'option --set-defaults attend deux agents: --set-defaults <agentA> <agentB>.",
    topicRequired: "Le paramètre --topic/--subject est requis.",
    noAgentDefined: (label) => `Aucun ${label} défini. Utilise --agent-a/--agent-b, un preset, ou lance palabre init pour définir defaults.agentA/defaults.agentB.`,
    unknownAgentForField: (field, agent, available) => `Agent inconnu pour ${field}: ${agent}. Agents disponibles: ${available}.`,
    unknownAgent: (agent) => `Agent inconnu: ${agent}`,
    unknownRenderer: (value, supported) => `Renderer inconnu: ${value}. Valeurs supportées: ${supported}.`,
    errorPrefix: "Erreur"
  },
  en: {
    invalidLanguage: (source, value, supported) => `Invalid ${source}: ${value}. Supported values: ${supported.join(", ")}.`,
    unknownCommand: (value, commands) => `Unknown command: ${value}. Available commands: ${commands}.`,
    ambiguousSubject: (value) => `Unknown command or ambiguous subject: ${value}. Use -s "${value}" for a one-word subject, or palabre help to see commands.`,
    optionRequiresValue: (option) => `Option ${option} expects a value.`,
    setDefaultsRequiresTwo: "Option --set-defaults expects two agents: --set-defaults <agentA> <agentB>.",
    topicRequired: "The --topic/--subject parameter is required.",
    noAgentDefined: (label) => `No ${label} defined. Use --agent-a/--agent-b, a preset, or run palabre init to define defaults.agentA/defaults.agentB.`,
    unknownAgentForField: (field, agent, available) => `Unknown agent for ${field}: ${agent}. Available agents: ${available}.`,
    unknownAgent: (agent) => `Unknown agent: ${agent}`,
    unknownRenderer: (value, supported) => `Unknown renderer: ${value}. Supported values: ${supported}.`,
    errorPrefix: "Error"
  }
};
