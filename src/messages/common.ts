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
  configInvalidShape(configPath: string): string;
  configMissingAgents(configPath: string): string;
  configEmptyAgents(configPath: string): string;
  errorPrefix: string;
}

export const commonMessages: Record<Language, CommonMessages> = {
  fr: {
    invalidLanguage: (source, value, supported) => `${source} invalide: ${value}. Valeurs supportées: ${supported.join(", ")}.`,
    unknownCommand: (value, commands) => `Commande inconnue: ${value}. Commandes disponibles: ${commands}.`,
    ambiguousSubject: (value) => `Commande inconnue ou sujet ambigu: ${value}. Utilise -s "${value}" pour un sujet en un mot, ou palabre help pour voir les commandes.`,
    optionRequiresValue: (option) => `L'option ${option} attend une valeur.`,
    setDefaultsRequiresTwo: "L'option --set-defaults attend deux agents: --set-defaults <agentA> <agentB>.",
    topicRequired: "Le paramètre --subject est requis.",
    noAgentDefined: (label) => `Aucun ${label} défini. Utilise --agent-a/--agent-b, un preset, ou définis une paire avec palabre config --set-defaults <agentA> <agentB>. Guide: https://palab.re/fr/agents/overview`,
    unknownAgentForField: (field, agent, available) => `Agent inconnu pour ${field}: ${agent}. Agents disponibles: ${available}.`,
    unknownAgent: (agent) => `Agent inconnu: ${agent}`,
    unknownRenderer: (value, supported) => `Renderer inconnu: ${value}. Valeurs supportées: ${supported}.`,
    configInvalidShape: (configPath) => `Config invalide: ${configPath} ne contient pas un objet JSON. Relance palabre init ou corrige le fichier.`,
    configMissingAgents: (configPath) => `Config invalide: ${configPath} ne déclare pas de bloc "agents". Relance palabre init ou ajoute au moins un agent.`,
    configEmptyAgents: (configPath) => `Config invalide: ${configPath} ne déclare aucun agent. Ajoute au moins un agent ou relance palabre init.`,
    errorPrefix: "Erreur"
  },
  en: {
    invalidLanguage: (source, value, supported) => `Invalid ${source}: ${value}. Supported values: ${supported.join(", ")}.`,
    unknownCommand: (value, commands) => `Unknown command: ${value}. Available commands: ${commands}.`,
    ambiguousSubject: (value) => `Unknown command or ambiguous subject: ${value}. Use -s "${value}" for a one-word subject, or palabre help to see commands.`,
    optionRequiresValue: (option) => `Option ${option} expects a value.`,
    setDefaultsRequiresTwo: "Option --set-defaults expects two agents: --set-defaults <agentA> <agentB>.",
    topicRequired: "The --subject parameter is required.",
    noAgentDefined: (label) => `No ${label} defined. Use --agent-a/--agent-b, a preset, or define a pair with palabre config --set-defaults <agentA> <agentB>. Guide: https://palab.re/en/agents/overview`,
    unknownAgentForField: (field, agent, available) => `Unknown agent for ${field}: ${agent}. Available agents: ${available}.`,
    unknownAgent: (agent) => `Unknown agent: ${agent}`,
    unknownRenderer: (value, supported) => `Unknown renderer: ${value}. Supported values: ${supported}.`,
    configInvalidShape: (configPath) => `Invalid config: ${configPath} does not contain a JSON object. Run palabre init or fix the file.`,
    configMissingAgents: (configPath) => `Invalid config: ${configPath} has no "agents" block. Run palabre init or add at least one agent.`,
    configEmptyAgents: (configPath) => `Invalid config: ${configPath} declares no agent. Add at least one agent or run palabre init.`,
    errorPrefix: "Error"
  }
};
