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
  unknownMode(value: string, supported: string): string;
  tooManyAskAgents(max: number): string;
  configInvalidShape(configPath: string): string;
  configMissingAgents(configPath: string): string;
  configEmptyAgents(configPath: string): string;
  configTrustPrompt(configPath: string): string;
  configTrustRequired(configPath: string): string;
  configTrustDeclined(configPath: string): string;
  configTrusted(configPath: string): string;
  ollamaUrlEmpty: string;
  ollamaUrlInvalid(value: string): string;
  ollamaUrlProtocol(protocol: string): string;
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
    unknownMode: (value, supported) => `Mode inconnu: ${value}. Valeurs supportées: ${supported}.`,
    tooManyAskAgents: (max) => `Le mode ask accepte au maximum ${max} agents.`,
    configInvalidShape: (configPath) => `Config invalide: ${configPath} ne contient pas un objet JSON. Relance palabre init ou corrige le fichier.`,
    configMissingAgents: (configPath) => `Config invalide: ${configPath} ne déclare pas de bloc "agents". Relance palabre init ou ajoute au moins un agent.`,
    configEmptyAgents: (configPath) => `Config invalide: ${configPath} ne déclare aucun agent. Ajoute au moins un agent ou relance palabre init.`,
    configTrustPrompt: (configPath) => `La configuration locale ${configPath} peut lancer des commandes et contacter des services réseau. L'approuver ? [o/N] `,
    configTrustRequired: (configPath) => `Configuration locale non approuvée: ${configPath}. Vérifie son contenu puis relance avec --trust-config pour enregistrer son empreinte.`,
    configTrustDeclined: (configPath) => `Configuration locale non approuvée: ${configPath}.`,
    configTrusted: (configPath) => `Configuration locale approuvée: ${configPath}.`,
    ollamaUrlEmpty: "L'adresse Ollama ne peut pas être vide.",
    ollamaUrlInvalid: (value) => `Adresse Ollama invalide: ${value}.`,
    ollamaUrlProtocol: (protocol) => `Protocole Ollama invalide: ${protocol}. Utilise http: ou https:.`,
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
    unknownMode: (value, supported) => `Unknown mode: ${value}. Supported values: ${supported}.`,
    tooManyAskAgents: (max) => `Ask mode supports at most ${max} agents.`,
    configInvalidShape: (configPath) => `Invalid config: ${configPath} does not contain a JSON object. Run palabre init or fix the file.`,
    configMissingAgents: (configPath) => `Invalid config: ${configPath} has no "agents" block. Run palabre init or add at least one agent.`,
    configEmptyAgents: (configPath) => `Invalid config: ${configPath} declares no agent. Add at least one agent or run palabre init.`,
    configTrustPrompt: (configPath) => `Local configuration ${configPath} can run commands and contact network services. Trust it? [y/N] `,
    configTrustRequired: (configPath) => `Untrusted local configuration: ${configPath}. Review it, then run again with --trust-config to record its fingerprint.`,
    configTrustDeclined: (configPath) => `Local configuration not trusted: ${configPath}.`,
    configTrusted: (configPath) => `Local configuration trusted: ${configPath}.`,
    ollamaUrlEmpty: "The Ollama address cannot be empty.",
    ollamaUrlInvalid: (value) => `Invalid Ollama address: ${value}.`,
    ollamaUrlProtocol: (protocol) => `Invalid Ollama protocol: ${protocol}. Use http: or https:.`,
    errorPrefix: "Error"
  }
};
