import type { Language, PalabreMode } from "../types.js";

export interface TuiMessages {
  tagline: string;
  modeLabel(mode: PalabreMode): string;
  modeValue(mode: PalabreMode): string;
  noValue: string;
  lastAskAgent: string;
  roles: string;
  summary: string;
  ollamaModel: string;
  responses: string;
  folder: string;
  docs: string;
  commands: string;
  settings: string;
  changeMode: string;
  tipContext: string;
  helpTitle: string;
  helpAsk: string;
  helpDebate: string;
  helpAgents: string;
  helpRoles: string;
  helpConfig: string;
  helpNew: string;
  helpRetry: string;
  helpHelp: string;
  helpQuit: string;
  helpFallback: string;
  retryUnavailable: string;
  agentsTitle: string;
  activeMode: string;
  activeAgents: string;
  availableAgents: string;
  example: string;
  rolesTitle: string;
  currentConfig: string;
  availableRoles: string;
  roleImplementer: string;
  roleCritic: string;
  roleArchitect: string;
  roleScout: string;
  roleReviewer: string;
  roleSummarizer: string;
  configTitle: string;
  configFile: string;
  interface: string;
  language: string;
  availableAgentsShort: string;
  availableCommands: string;
  noConfiguredAgents: string;
  or: string;
  defaultModeCommand(mode: PalabreMode): string;
  modeConfigCommand: string;
  backCommand: string;
  quitCommand: string;
  subject: string;
  configPrompt: string;
  agentsPrompt: string;
  rolesPrompt: string;
  sessionDone: string;
  askResponse(response: number, totalResponses: number): string;
  turnLabel(turn: number): string;
  planTitle: string;
  planCollectAsk: string;
  planLaunchDebate: string;
  planSummaryComparative: string;
  planSummaryDisabled: string;
  planExport: string;
  ptyNotice(agents: string): string;
  unknownCommand: string;
  turnsUsage: string;
  summaryUsage: string;
  ollamaModelUsage: string;
  interfaceUsage: string;
  languageUsage: string;
  rolesUsage: string;
  ollamaInfoCommand: string;
  ollamaSyncCommand: string;
  interfaceDefault(value: string): string;
  languageUpdated(value: string): string;
  askConfigMode: string;
  debateConfigMode: string;
  askDefaultMode: string;
  debateDefaultMode: string;
  agentsUnchanged: string;
  rolesUnchanged: string;
  askTurnsNotice: string;
  turnsUpdated(value: number): string;
  askSummaryFallback: string;
  debateSummaryFallback: string;
  askSummaryAgent(value: string): string;
  debateSummaryAgent(value: string): string;
  ollamaInfo(current: string, installed: string, api: string): string;
  ollamaUnavailable(baseUrl: string): string;
  askAgentsUpdated(value: string): string;
  debateAgentsUpdated(value: string): string;
  askRolesUpdated(value: string): string;
  debateRolesUpdated(value: string): string;
  rolesError(message: string): string;
  agentsError(message: string): string;
  noAskAgentsConfigured: string;
  noDebateAgentsConfigured: string;
  rolesCountError(count: number, expected: number, agents: string): string;
  unknownRole(role: string, available: string): string;
  debateAgentsUsage: string;
  askAgentsUsage: string;
}

export const tuiMessages: Record<Language, TuiMessages> = {
  fr: {
    tagline: "Orchestrez des conversations entre agents IA",
    modeLabel: (mode) => mode === "ask" ? "Ask" : "Debat",
    modeValue: (mode) => mode === "ask" ? "Ask" : "Debat",
    noValue: "non definis",
    lastAskAgent: "dernier agent ask",
    roles: "Roles",
    summary: "Synthese",
    ollamaModel: "Modele Ollama",
    responses: "Reponses",
    folder: "Dossier",
    docs: "Docs",
    commands: "commandes",
    settings: "reglages",
    changeMode: "changer de mode",
    tipContext: "* Tip Ajoute du contexte avec --context <dossier> ou --files <fichier>.",
    helpTitle: "Commandes TUI",
    helpAsk: "mode Ask",
    helpDebate: "mode Debat",
    helpAgents: "choisir les agents",
    helpRoles: "choisir les roles",
    helpConfig: "reglages",
    helpNew: "assistant guide",
    helpRetry: "relancer la derniere session",
    helpHelp: "aide",
    helpQuit: "quitter",
    helpFallback: "Tape un sujet ou une commande.",
    retryUnavailable: "Aucune session a relancer pour le moment.",
    agentsTitle: "Agents Palabre",
    activeMode: "Mode actif",
    activeAgents: "Agents actifs",
    availableAgents: "Agents disponibles",
    example: "Exemple",
    rolesTitle: "Roles Palabre",
    currentConfig: "Config actuelle",
    availableRoles: "Roles disponibles",
    roleImplementer: "propose une solution concrete",
    roleCritic: "challenge les hypotheses et demande des preuves",
    roleArchitect: "structure les options et compromis",
    roleScout: "explore les pistes et inconnues",
    roleReviewer: "cherche risques et tests manquants",
    roleSummarizer: "synthetise fidelement",
    configTitle: "Configuration Palabre",
    configFile: "Config",
    interface: "Interface",
    language: "Langue",
    availableAgentsShort: "Agents dispo",
    availableCommands: "Commandes disponibles",
    noConfiguredAgents: "aucun agent configure",
    or: "ou",
    defaultModeCommand: (mode) => `utiliser ${mode === "ask" ? "Ask" : "Debat"} par defaut`,
    modeConfigCommand: "changer de mode de configuration",
    backCommand: "revenir a l'accueil",
    quitCommand: "quitter",
    subject: "Sujet",
    configPrompt: "Config",
    agentsPrompt: "Agents",
    rolesPrompt: "Roles",
    sessionDone: "Session terminee",
    askResponse: (response, totalResponses) => `reponse ${response}/${totalResponses}`,
    turnLabel: (turn) => `tour ${turn}`,
    planTitle: "Plan de session",
    planCollectAsk: "Collecter les reponses",
    planLaunchDebate: "Lancer le debat",
    planSummaryComparative: "Synthese comparative",
    planSummaryDisabled: "Synthese desactivee",
    planExport: "Export Markdown",
    ptyNotice: (agents) => `Note: ${agents} utilise un pseudo-terminal; une fenetre peut apparaitre brievement.`,
    unknownCommand: "Commande inconnue. Utilise /back pour revenir.",
    turnsUsage: "Usage: /turns <nombre>",
    summaryUsage: "Usage: /summary <agent|none>",
    ollamaModelUsage: "Usage: /ollama-model <modele>",
    interfaceUsage: "Usage: /interface <tui|terminal>",
    languageUsage: "Usage: /language <fr|en>",
    rolesUsage: "Usage: /roles <role...>",
    ollamaInfoCommand: "afficher modeles installes",
    ollamaSyncCommand: "choisir un modele installe disponible",
    interfaceDefault: (value) => `Interface par defaut: ${value}.`,
    languageUpdated: (value) => `Langue mise a jour: ${value}.`,
    askConfigMode: "Configuration Ask.",
    debateConfigMode: "Configuration Debat.",
    askDefaultMode: "Ask devient le mode par defaut.",
    debateDefaultMode: "Debat devient le mode par defaut.",
    agentsUnchanged: "Agents inchanges.",
    rolesUnchanged: "Roles inchanges.",
    askTurnsNotice: "En mode Ask, le nombre de reponses depend des agents selectionnes avec /agents.",
    turnsUpdated: (value) => `Tours mis a jour: ${value}.`,
    askSummaryFallback: "Synthese Ask revenue au fallback.",
    debateSummaryFallback: "Synthese Debat revenue au fallback.",
    askSummaryAgent: (value) => `Synthese Ask: ${value}.`,
    debateSummaryAgent: (value) => `Synthese Debat: ${value}.`,
    ollamaInfo: (current, installed, api) => `Ollama ${api}. Modele actuel: ${current}. Modeles installes: ${installed}.`,
    ollamaUnavailable: (baseUrl) => `API Ollama indisponible (${baseUrl}). Lance ollama serve puis reessaie /ollama.`,
    askAgentsUpdated: (value) => `Agents Ask mis a jour: ${value}.`,
    debateAgentsUpdated: (value) => `Agents Debat mis a jour: ${value}.`,
    askRolesUpdated: (value) => `Roles Ask mis a jour: ${value}.`,
    debateRolesUpdated: (value) => `Roles Debat mis a jour: ${value}.`,
    rolesError: (message) => `Erreur roles: ${message}`,
    agentsError: (message) => `Erreur agents: ${message}`,
    noAskAgentsConfigured: "Aucun agent Ask configure.",
    noDebateAgentsConfigured: "Agents Debat non definis.",
    rolesCountError: (count, expected, agents) => `${count} role(s) saisi(s), ${expected} attendu(s). Saisis au moins ${expected} roles pour: ${agents}.`,
    unknownRole: (role, available) => `Role inconnu: ${role}. Roles disponibles: ${available}.`,
    debateAgentsUsage: "Usage: /agents <agentA> <agentB>",
    askAgentsUsage: "Usage: /agents <agent...>"
  },
  en: {
    tagline: "Orchestrate conversations between AI agents",
    modeLabel: (mode) => mode === "ask" ? "Ask" : "Debate",
    modeValue: (mode) => mode === "ask" ? "Ask" : "Debate",
    noValue: "not set",
    lastAskAgent: "last ask agent",
    roles: "Roles",
    summary: "Summary",
    ollamaModel: "Ollama model",
    responses: "Responses",
    folder: "Folder",
    docs: "Docs",
    commands: "commands",
    settings: "settings",
    changeMode: "change mode",
    tipContext: "* Tip Add context with --context <folder> or --files <file>.",
    helpTitle: "TUI Commands",
    helpAsk: "Ask mode",
    helpDebate: "Debate mode",
    helpAgents: "choose agents",
    helpRoles: "choose roles",
    helpConfig: "settings",
    helpNew: "guided assistant",
    helpRetry: "rerun the last session",
    helpHelp: "help",
    helpQuit: "quit",
    helpFallback: "Type a topic or a command.",
    retryUnavailable: "No session to retry yet.",
    agentsTitle: "Palabre Agents",
    activeMode: "Active mode",
    activeAgents: "Active agents",
    availableAgents: "Available agents",
    example: "Example",
    rolesTitle: "Palabre Roles",
    currentConfig: "Current config",
    availableRoles: "Available roles",
    roleImplementer: "proposes a concrete solution",
    roleCritic: "challenges assumptions and asks for evidence",
    roleArchitect: "structures options and trade-offs",
    roleScout: "explores paths and unknowns",
    roleReviewer: "looks for risks and missing tests",
    roleSummarizer: "summarizes faithfully",
    configTitle: "Palabre Configuration",
    configFile: "Config",
    interface: "Interface",
    language: "Language",
    availableAgentsShort: "Agents",
    availableCommands: "Available commands",
    noConfiguredAgents: "no configured agent",
    or: "or",
    defaultModeCommand: (mode) => `use ${mode === "ask" ? "Ask" : "Debate"} as default`,
    modeConfigCommand: "change configuration mode",
    backCommand: "return to home",
    quitCommand: "quit",
    subject: "Subject",
    configPrompt: "Config",
    agentsPrompt: "Agents",
    rolesPrompt: "Roles",
    sessionDone: "Session complete",
    askResponse: (response, totalResponses) => `response ${response}/${totalResponses}`,
    turnLabel: (turn) => `turn ${turn}`,
    planTitle: "Session plan",
    planCollectAsk: "Collect responses",
    planLaunchDebate: "Start debate",
    planSummaryComparative: "Comparative summary",
    planSummaryDisabled: "Summary disabled",
    planExport: "Markdown export",
    ptyNotice: (agents) => `Note: ${agents} uses a pseudo-terminal; a window may briefly appear.`,
    unknownCommand: "Unknown command. Use /back to return.",
    turnsUsage: "Usage: /turns <number>",
    summaryUsage: "Usage: /summary <agent|none>",
    ollamaModelUsage: "Usage: /ollama-model <model>",
    interfaceUsage: "Usage: /interface <tui|terminal>",
    languageUsage: "Usage: /language <fr|en>",
    rolesUsage: "Usage: /roles <role...>",
    ollamaInfoCommand: "show installed models",
    ollamaSyncCommand: "choose an available installed model",
    interfaceDefault: (value) => `Default interface: ${value}.`,
    languageUpdated: (value) => `Language updated: ${value}.`,
    askConfigMode: "Ask configuration.",
    debateConfigMode: "Debate configuration.",
    askDefaultMode: "Ask is now the default mode.",
    debateDefaultMode: "Debate is now the default mode.",
    agentsUnchanged: "Agents unchanged.",
    rolesUnchanged: "Roles unchanged.",
    askTurnsNotice: "In Ask mode, the number of responses depends on agents selected with /agents.",
    turnsUpdated: (value) => `Turns updated: ${value}.`,
    askSummaryFallback: "Ask summary returned to fallback.",
    debateSummaryFallback: "Debate summary returned to fallback.",
    askSummaryAgent: (value) => `Ask summary: ${value}.`,
    debateSummaryAgent: (value) => `Debate summary: ${value}.`,
    ollamaInfo: (current, installed, api) => `Ollama ${api}. Current model: ${current}. Installed models: ${installed}.`,
    ollamaUnavailable: (baseUrl) => `Ollama API unavailable (${baseUrl}). Run ollama serve, then try /ollama again.`,
    askAgentsUpdated: (value) => `Ask agents updated: ${value}.`,
    debateAgentsUpdated: (value) => `Debate agents updated: ${value}.`,
    askRolesUpdated: (value) => `Ask roles updated: ${value}.`,
    debateRolesUpdated: (value) => `Debate roles updated: ${value}.`,
    rolesError: (message) => `Roles error: ${message}`,
    agentsError: (message) => `Agents error: ${message}`,
    noAskAgentsConfigured: "No Ask agent configured.",
    noDebateAgentsConfigured: "Debate agents are not set.",
    rolesCountError: (count, expected, agents) => `${count} role(s) entered, ${expected} expected. Enter at least ${expected} roles for: ${agents}.`,
    unknownRole: (role, available) => `Unknown role: ${role}. Available roles: ${available}.`,
    debateAgentsUsage: "Usage: /agents <agentA> <agentB>",
    askAgentsUsage: "Usage: /agents <agent...>"
  }
};
