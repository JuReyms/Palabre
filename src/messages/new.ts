import type { Language, PalabreMode } from "../types.js";

export interface NewMessages {
  needsOneAgent: string;
  needsTwoAgents: string;
  cancelled: string;
  title: string;
  quitHint: string;
  defaultHint: string;
  mode: string;
  modeChat: string;
  modeDebate: string;
  modeAsk: string;
  choiceYes: string;
  choiceNo: string;
  agentA: string;
  agentB: string;
  askAgents: string;
  askAgentsPrompt(defaultValue: string): string;
  topic: string;
  session: string;
  sessionMode: string;
  sessionAgents: string;
  sessionTopic: string;
  sessionResponses: string;
  sessionSummary: string;
  sessionModels: string;
  sessionContext: string;
  sessionNoSummary: string;
  sessionDefaultModels: string;
  launchSession(mode: PalabreMode): string;
  customize: string;
  cancel: string;
  sessionAction: string;
  turns(maxTurns: number): string;
  changeModel: string;
  changeModels: string;
  modelFor(agent: string, format?: string): string;
  summaryEnabled: string;
  summaryAgent: string;
  summaryModelFor(agent: string, format?: string): string;
  changeSummaryModel: string;
  contextChoice: string;
  contextNone: string;
  contextFlexible: string;
  contextStrict: string;
  contextPaths: string;
  filesPaths: string;
  showPrompt: string;
  detectedOllama(role: string, count: number): string;
  ollamaUnreachable(role: string): string;
  detectedCli(role: string): string;
  missingCli(role: string): string;
  invalidModeChoice: string;
  invalidAgentChoice: string;
  invalidAskAgentsChoice: string;
  invalidSessionAction: string;
  invalidContextChoice: string;
  requiredField: string;
  invalidTurns(maxTurns: number): string;
  invalidYesNo: string;
  equivalentCommands: string;
  yesNoSuffix(defaultValue: boolean): string;
  turnsValidationLabel: string;
}

export const newMessages: Record<Language, NewMessages> = {
  fr: {
    needsOneAgent: "palabre new a besoin d'au moins un agent dans la config. Lance `palabre init` ou edite ta config.",
    needsTwoAgents: "palabre new a besoin d'au moins deux agents dans la config. Lance `palabre init` ou edite ta config.",
    cancelled: "Création de session annulée.",
    title: "PALABRE - NOUVELLE SESSION",
    quitHint: "Entrée valider · Flèches choisir · Ctrl+C revenir",
    defaultHint: "",
    mode: "Mode",
    modeChat: "Conversation avec un agent",
    modeDebate: "Débat entre deux agents",
    modeAsk: "Demande avec réponses indépendantes",
    choiceYes: "oui",
    choiceNo: "non",
    agentA: "Agent A",
    agentB: "Agent B",
    askAgents: "Agents qui répondront indépendamment",
    askAgentsPrompt: (defaultValue) => `Agents ask, noms ou numéros séparés par des espaces (Entrée = ${defaultValue})`,
    topic: "Sujet",
    session: "Session",
    sessionMode: "Mode",
    sessionAgents: "Agents",
    sessionTopic: "Sujet",
    sessionResponses: "Réponses",
    sessionSummary: "Synthèse",
    sessionModels: "Modèles",
    sessionContext: "Contexte",
    sessionNoSummary: "Aucune",
    sessionDefaultModels: "Par défaut",
    launchSession: (mode) => `Lancer la session ${mode === "chat" ? "Chat" : mode === "ask" ? "Ask" : "Débat"}`,
    customize: "Personnaliser",
    cancel: "Annuler",
    sessionAction: "Que voulez-vous faire ?",
    turns: (maxTurns) => `Nombre de réponses (1 à ${maxTurns})`,
    changeModel: "Changer le modèle ?",
    changeModels: "Changer les modèles ?",
    modelFor: (agent, format) => `Modèle pour ${agent} (${format ? `${format}, ` : ""}Entrée = défaut)`,
    summaryEnabled: "Synthèse finale ?",
    summaryAgent: "Agent de synthèse",
    summaryModelFor: (agent, format) => `Modèle de synthèse pour ${agent} (${format ? `${format}, ` : ""}Entrée = défaut)`,
    changeSummaryModel: "Changer le modèle de synthèse ?",
    contextChoice: "Ajouter du contexte au sujet ?",
    contextNone: "Aucun",
    contextFlexible: "Dossier ou fichiers",
    contextStrict: "Uniquement des fichiers précis",
    contextPaths: "Chemins du dossier ou des fichiers",
    filesPaths: "Chemins des fichiers précis",
    showPrompt: "Prévisualiser le prompt sans lancer les agents ?",
    detectedOllama: (role, count) => `ollama/${role} détecté (${count} modèle(s))`,
    ollamaUnreachable: (role) => `ollama/${role} non joignable`,
    detectedCli: (role) => `cli/${role} détecté`,
    missingCli: (role) => `cli/${role} non détecté`,
    invalidModeChoice: "Choix invalide. Choisis chat, debate ou ask, Entrée ou q.",
    invalidAgentChoice: "Choix invalide. Tape un numéro, un nom d'agent, Entrée ou q.",
    invalidAskAgentsChoice: "Choix invalide. Tape un à quatre numéros ou noms d'agents, séparés par des espaces, Entrée ou q.",
    invalidSessionAction: "Choix invalide. Choisis lancer, personnaliser ou annuler.",
    invalidContextChoice: "Choix invalide. Choisis aucun, dossier ou fichiers précis.",
    requiredField: "Ce champ est requis pour lancer la session.",
    invalidTurns: (maxTurns) => `Entre un nombre entier entre 1 et ${maxTurns}, Entrée ou q.`,
    invalidYesNo: "Réponds par oui, non, Entrée ou q.",
    equivalentCommands: "Commandes équivalentes:",
    yesNoSuffix: (defaultValue) => defaultValue ? "O/n" : "o/N",
    turnsValidationLabel: "Le nombre de réponses"
  },
  en: {
    needsOneAgent: "palabre new needs at least one agent in the config. Run `palabre init` or edit your config.",
    needsTwoAgents: "palabre new needs at least two agents in the config. Run `palabre init` or edit your config.",
    cancelled: "Session creation cancelled.",
    title: "PALABRE - NEW SESSION",
    quitHint: "Enter validate · Arrows choose · Ctrl+C go back",
    defaultHint: "",
    mode: "Mode",
    modeChat: "Conversation with one agent",
    modeDebate: "Debate between two agents",
    modeAsk: "Request with independent responses",
    choiceYes: "yes",
    choiceNo: "no",
    agentA: "Agent A",
    agentB: "Agent B",
    askAgents: "Agents that will answer independently",
    askAgentsPrompt: (defaultValue) => `Ask agents, names or numbers separated by spaces (Enter = ${defaultValue})`,
    topic: "Subject",
    session: "Session",
    sessionMode: "Mode",
    sessionAgents: "Agents",
    sessionTopic: "Subject",
    sessionResponses: "Responses",
    sessionSummary: "Summary",
    sessionModels: "Models",
    sessionContext: "Context",
    sessionNoSummary: "None",
    sessionDefaultModels: "Defaults",
    launchSession: (mode) => `Launch ${mode === "chat" ? "Chat" : mode === "ask" ? "Ask" : "Debate"} session`,
    customize: "Customize",
    cancel: "Cancel",
    sessionAction: "What would you like to do?",
    turns: (maxTurns) => `Number of responses (1 to ${maxTurns})`,
    changeModel: "Change the model?",
    changeModels: "Change models?",
    modelFor: (agent, format) => `Model for ${agent} (${format ? `${format}, ` : ""}Enter = default)`,
    summaryEnabled: "Final summary?",
    summaryAgent: "Summary agent",
    summaryModelFor: (agent, format) => `Summary model for ${agent} (${format ? `${format}, ` : ""}Enter = default)`,
    changeSummaryModel: "Change the summary model?",
    contextChoice: "Add context to the subject?",
    contextNone: "None",
    contextFlexible: "Folder or files",
    contextStrict: "Only specific files",
    contextPaths: "Folder or file paths",
    filesPaths: "Specific file paths",
    showPrompt: "Preview the prompt without running agents?",
    detectedOllama: (role, count) => `ollama/${role} detected (${count} model(s))`,
    ollamaUnreachable: (role) => `ollama/${role} unreachable`,
    detectedCli: (role) => `cli/${role} detected`,
    missingCli: (role) => `cli/${role} not detected`,
    invalidModeChoice: "Invalid choice. Choose chat, debate, or ask, Enter, or q.",
    invalidAgentChoice: "Invalid choice. Type a number, an agent name, Enter, or q.",
    invalidAskAgentsChoice: "Invalid choice. Type one to four agent numbers or names separated by spaces, Enter, or q.",
    invalidSessionAction: "Invalid choice. Choose launch, customize, or cancel.",
    invalidContextChoice: "Invalid choice. Choose none, folder, or specific files.",
    requiredField: "This field is required to start the session.",
    invalidTurns: (maxTurns) => `Enter an integer between 1 and ${maxTurns}, Enter, or q.`,
    invalidYesNo: "Answer yes, no, Enter, or q.",
    equivalentCommands: "Equivalent commands:",
    yesNoSuffix: (defaultValue) => defaultValue ? "Y/n" : "y/N",
    turnsValidationLabel: "The number of responses"
  }
};
