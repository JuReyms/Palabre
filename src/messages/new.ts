import type { Language } from "../types.js";

export interface NewMessages {
  needsTwoAgents: string;
  cancelled: string;
  title: string;
  quitHint: string;
  defaultHint: string;
  agentA: string;
  agentB: string;
  topic: string;
  advancedHint: string;
  launchMinimal: string;
  turns: string;
  modelFor(agent: string): string;
  summaryEnabled: string;
  summaryAgent: string;
  summaryModelFor(agent: string): string;
  contextPaths: string;
  filesPaths: string;
  showPrompt: string;
  plainOutput: string;
  detectedOllama(role: string, count: number): string;
  ollamaUnreachable(role: string): string;
  detectedCli(role: string): string;
  missingCli(role: string): string;
  invalidAgentChoice: string;
  requiredField: string;
  invalidTurns(maxTurns: number): string;
  invalidYesNo: string;
  equivalentCommands: string;
  yesNoSuffix(defaultValue: boolean): string;
  turnsValidationLabel: string;
}

export const newMessages: Record<Language, NewMessages> = {
  fr: {
    needsTwoAgents: "palabre new a besoin d'au moins deux agents dans la config. Lance `palabre init` ou edite ta config.",
    cancelled: "Création de débat annulée.",
    title: "PALABRE - ASSISTANT DE CONFIGURATION",
    quitHint: "À tout moment: Ctrl+C pour interrompre, ou tape q, quit ou exit dans un prompt pour quitter.",
    defaultHint: "Appuie sur Entrée pour accepter un choix par défaut (*).",
    agentA: "Agent A",
    agentB: "Agent B",
    topic: "Sujet",
    advancedHint: "Réponds non pour choisir le nombre de réponses, les modèles, la synthèse et le contexte.",
    launchMinimal: "Lancer maintenant avec les options par défaut ?",
    turns: "Nombre de réponses",
    modelFor: (agent) => `Modèle pour ${agent} (optionnel)`,
    summaryEnabled: "Synthèse finale ?",
    summaryAgent: "Agent de synthèse",
    summaryModelFor: (agent) => `Modèle de synthèse pour ${agent} (optionnel)`,
    contextPaths: "Contexte dossier/fichier via --context (optionnel)",
    filesPaths: "Fichiers stricts via --files (optionnel)",
    showPrompt: "Afficher seulement le prompt ?",
    plainOutput: "Rendu plain ?",
    detectedOllama: (role, count) => `ollama/${role} détecté (${count} modèle(s))`,
    ollamaUnreachable: (role) => `ollama/${role} non joignable`,
    detectedCli: (role) => `cli/${role} détecté`,
    missingCli: (role) => `cli/${role} non détecté`,
    invalidAgentChoice: "Choix invalide. Tape un numéro, un nom d'agent, Entrée ou q.",
    requiredField: "Ce champ est requis pour lancer un débat.",
    invalidTurns: (maxTurns) => `Entre un nombre entier entre 1 et ${maxTurns}, Entrée ou q.`,
    invalidYesNo: "Réponds par oui, non, Entrée ou q.",
    equivalentCommands: "Commandes équivalentes:",
    yesNoSuffix: (defaultValue) => defaultValue ? "O/n" : "o/N",
    turnsValidationLabel: "Le nombre de réponses"
  },
  en: {
    needsTwoAgents: "palabre new needs at least two agents in the config. Run `palabre init` or edit your config.",
    cancelled: "Debate creation cancelled.",
    title: "PALABRE - SETUP ASSISTANT",
    quitHint: "At any time: Ctrl+C to interrupt, or type q, quit, or exit in a prompt to leave.",
    defaultHint: "Press Enter to accept a default choice (*).",
    agentA: "Agent A",
    agentB: "Agent B",
    topic: "Subject",
    advancedHint: "Answer no to choose the number of responses, models, summary, and context.",
    launchMinimal: "Launch now with default options?",
    turns: "Number of responses",
    modelFor: (agent) => `Model for ${agent} (optional)`,
    summaryEnabled: "Final summary?",
    summaryAgent: "Summary agent",
    summaryModelFor: (agent) => `Summary model for ${agent} (optional)`,
    contextPaths: "Folder/file context via --context (optional)",
    filesPaths: "Strict files via --files (optional)",
    showPrompt: "Only show the prompt?",
    plainOutput: "Plain output?",
    detectedOllama: (role, count) => `ollama/${role} detected (${count} model(s))`,
    ollamaUnreachable: (role) => `ollama/${role} unreachable`,
    detectedCli: (role) => `cli/${role} detected`,
    missingCli: (role) => `cli/${role} not detected`,
    invalidAgentChoice: "Invalid choice. Type a number, an agent name, Enter, or q.",
    requiredField: "This field is required to start a debate.",
    invalidTurns: (maxTurns) => `Enter an integer between 1 and ${maxTurns}, Enter, or q.`,
    invalidYesNo: "Answer yes, no, Enter, or q.",
    equivalentCommands: "Equivalent commands:",
    yesNoSuffix: (defaultValue) => defaultValue ? "Y/n" : "y/N",
    turnsValidationLabel: "The number of responses"
  }
};
