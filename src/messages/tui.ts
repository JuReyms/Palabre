import type { Language, PalabreMode } from "../types.js";

export interface TuiMessages {
  tagline: string;
  updateAvailable(current: string, latest: string): string;
  modeLabel(mode: PalabreMode): string;
  modeValue(mode: PalabreMode): string;
  composerPlaceholder(mode: PalabreMode): string;
  noValue: string;
  lastAskAgent: string;
  roles: string;
  summary: string;
  ollamaModel: string;
  ollamaUrl: string;
  ollamaUrlEffective: string;
  responses: string;
  folder: string;
  docs: string;
  changeMode: string;
  chatReady: string;
  tipContext: string;
  homeCommands: string;
  homeModes: string;
  chatTip: string;
  chatComposerCommands: string;
  askTip: string;
  debateTip: string;
  helpTitle: string;
  helpAsk: string;
  helpChat: string;
  helpDebate: string;
  helpAgents: string;
  helpRoles: string;
  helpConfig: string;
  helpNew: string;
  helpRetry: string;
  helpHistory: string;
  helpUpdate: string;
  helpHelp: string;
  helpQuit: string;
  helpFallback: string;
  historyTitle: string;
  historyEmpty: string;
  historyOpenHint: string;
  historyFile: string;
  historyMode(mode: PalabreMode | "chat"): string;
  historyCount(mode: PalabreMode | "chat"): string;
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
  /** Titre de la section des reglages generaux de l'ecran /config. */
  configSectionGeneral: string;
  /** Label du fichier exporte dans le panneau de fin de session. */
  exportedFile: string;
  /** Label du dossier d'export dans le panneau de fin de session. */
  exportedFolder: string;
  configFile: string;
  interface: string;
  language: string;
  availableAgentsShort: string;
  availableCommands: string;
  noConfiguredAgents: string;
  or: string;
  modeConfigCommand: string;
  backCommand: string;
  quitCommand: string;
  subject: string;
  configPrompt: string;
  configComposerPlaceholder: string;
  configComposerTip: string;
  agentsPrompt: string;
  rolesPrompt: string;
  sessionDone: string;
  sessionHistoryHint: string;
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
  ollamaUrlUsage: string;
  interfaceUsage: string;
  languageUsage: string;
  rolesUsage: string;
  ollamaInfoCommand: string;
  ollamaUrlCommand: string;
  ollamaSyncCommand: string;
  interfaceDefault(value: string): string;
  languageUpdated(value: string): string;
  askConfigMode: string;
  debateConfigMode: string;
  chatConfigMode: string;
  askDefaultMode: string;
  debateDefaultMode: string;
  chatDefaultMode: string;
  agentsUnchanged: string;
  rolesUnchanged: string;
  askTurnsNotice: string;
  turnsUpdated(value: number): string;
  askSummaryFallback: string;
  debateSummaryFallback: string;
  askSummaryAgent(value: string): string;
  debateSummaryAgent(value: string): string;
  ollamaUrlUpdated(configured: string, effective: string): string;
  ollamaInfo(current: string, installed: string, api: string): string;
  ollamaUnavailable(baseUrl: string): string;
  askAgentsUpdated(value: string): string;
  debateAgentsUpdated(value: string): string;
  chatAgentsUpdated(value: string): string;
  askRolesUpdated(value: string): string;
  debateRolesUpdated(value: string): string;
  chatRolesUpdated(value: string): string;
  rolesError(message: string): string;
  agentsError(message: string): string;
  noAskAgentsConfigured: string;
  noDebateAgentsConfigured: string;
  noChatAgentConfigured: string;
  rolesCountError(count: number, expected: number, agents: string): string;
  unknownRole(role: string, available: string): string;
  debateAgentsUsage: string;
  askAgentsUsage: string;
  chatAgentsUsage: string;
}

export const tuiMessages: Record<Language, TuiMessages> = {
  fr: {
    tagline: "Orchestrez des conversations entre agents IA",
    updateAvailable: (current, latest) => `Mise a jour disponible: ${current} -> ${latest}. Utilise /update.`,
    modeLabel: (mode) => mode === "chat" ? "Chat" : mode === "ask" ? "Ask" : "Debat",
    modeValue: (mode) => mode === "chat" ? "Chat" : mode === "ask" ? "Ask" : "Debat",
    composerPlaceholder: (mode) => mode === "chat" ? "De quoi voulez-vous discuter ?" : mode === "ask" ? "Quelle question voulez-vous poser aux agents ?" : "Quel sujet voulez-vous faire débattre ?",
    noValue: "non definis",
    lastAskAgent: "dernier agent ask",
    roles: "Roles",
    summary: "Synthese",
    ollamaModel: "Modele Ollama",
    ollamaUrl: "Adresse Ollama",
    ollamaUrlEffective: "Adresse Ollama effective",
    responses: "Tours",
    folder: "Dossier",
    docs: "Docs",
    changeMode: "changer de mode",
    chatReady: "conversation",
    tipContext: "Tip Ajoute du contexte avec --context <dossier> ou --files <fichier>.",
    homeCommands: "/config reglages · /roles roles des agents · /help commandes disponibles",
    homeModes: "/debat débat entre deux agents · /chat conversation · /ask réponses multiples",
    chatTip: "/chat : une conversation, puis un avis supplémentaire seulement si utile.",
    chatComposerCommands: "/consult <agent> avis · /use <agent> basculer · /agents liste · /end exporter · /home accueil",
    askTip: "Ask : plusieurs réponses indépendantes à la même question.",
    debateTip: "Débat : deux agents confrontent leurs points de vue avant la synthèse.",
    helpTitle: "Commandes TUI",
    helpAsk: "mode Ask",
    helpChat: "ouvrir une conversation",
    helpDebate: "mode Debat",
    helpAgents: "choisir les agents",
    helpRoles: "choisir les roles",
    helpConfig: "reglages",
    helpNew: "assistant guide",
    helpRetry: "relancer la derniere session",
    helpHistory: "voir les derniers exports",
    helpUpdate: "voir les informations de mise a jour",
    helpHelp: "aide",
    helpQuit: "quitter",
    helpFallback: "Tape un sujet ou une commande.",
    historyTitle: "Historique Palabre",
    historyEmpty: "Aucun export trouve pour le moment.",
    historyOpenHint: "Le chemin du fichier est cliquable dans les terminaux compatibles.",
    historyFile: "Fichier",
    historyMode: (mode) => mode === "chat" ? "Conversation" : mode === "ask" ? "Mode ask" : "Mode debat",
    historyCount: (mode) => mode === "chat" ? "Messages" : mode === "ask" ? "Reponses" : "Tours",
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
    configSectionGeneral: "Général",
    exportedFile: "Fichier exporté",
    exportedFolder: "Dossier d'export",
    configFile: "Config",
    interface: "Interface",
    language: "Langue",
    availableAgentsShort: "Agents dispo",
    availableCommands: "Commandes disponibles",
    noConfiguredAgents: "aucun agent configure",
    or: "ou",
    modeConfigCommand: "basculer et definir par defaut",
    backCommand: "revenir a l'accueil",
    quitCommand: "quitter",
    subject: "Sujet",
    configPrompt: "Config",
    configComposerPlaceholder: "Saisissez une commande de configuration…",
    configComposerTip: "/home accueil · Ctrl+C retour · /quit quitter",
    agentsPrompt: "Agents",
    rolesPrompt: "Roles",
    sessionDone: "Session terminee",
    sessionHistoryHint: "Retrouvez vos exports avec /history.",
    askResponse: (response, totalResponses) => `reponse ${response}/${totalResponses}`,
    turnLabel: (turn) => `tour ${turn}`,
    planTitle: "Plan de session",
    planCollectAsk: "Collecter les reponses",
    planLaunchDebate: "Lancer le debat",
    planSummaryComparative: "Synthese comparative",
    planSummaryDisabled: "Synthese desactivee",
    planExport: "Export Markdown",
    ptyNotice: (agents) => `Note: ${agents} utilise un pseudo-terminal; une fenetre peut apparaitre brievement.`,
    unknownCommand: "Commande inconnue. Utilise /home pour revenir.",
    turnsUsage: "Usage: /turns <tours>",
    summaryUsage: "Usage: /summary <agent|none>",
    ollamaModelUsage: "Usage: /ollama-model <modele>",
    ollamaUrlUsage: "Usage: /ollama-url <url|default>",
    interfaceUsage: "Usage: /interface <tui|terminal>",
    languageUsage: "Usage: /language <fr|en>",
    rolesUsage: "Usage: /roles <role...>",
    ollamaInfoCommand: "afficher modeles installes",
    ollamaUrlCommand: "modifier l'adresse (<url|default>)",
    ollamaSyncCommand: "choisir un modele installe disponible",
    interfaceDefault: (value) => `Interface par defaut: ${value}.`,
    languageUpdated: (value) => `Langue mise a jour: ${value}.`,
    askConfigMode: "Configuration Ask.",
    debateConfigMode: "Configuration Debat.",
    chatConfigMode: "Configuration Chat.",
    askDefaultMode: "Ask devient le mode par defaut.",
    debateDefaultMode: "Debat devient le mode par defaut.",
    chatDefaultMode: "Chat devient le mode par defaut.",
    agentsUnchanged: "Agents inchanges.",
    rolesUnchanged: "Roles inchanges.",
    askTurnsNotice: "En mode Ask, le nombre de reponses depend des agents selectionnes avec /agents.",
    turnsUpdated: (value) => `Tours mis a jour: ${value}.`,
    askSummaryFallback: "Synthese Ask revenue au fallback.",
    debateSummaryFallback: "Synthese Debat revenue au fallback.",
    askSummaryAgent: (value) => `Synthese Ask: ${value}.`,
    debateSummaryAgent: (value) => `Synthese Debat: ${value}.`,
    ollamaInfo: (current, installed, api) => `Ollama ${api}. Modele actuel: ${current}. Modeles installes: ${installed}.`,
    ollamaUrlUpdated: (configured, effective) => configured === effective ? `Adresse Ollama mise a jour: ${configured}.` : `Adresse Ollama configuree: ${configured}. Adresse effective via OLLAMA_HOST: ${effective}.`,
    ollamaUnavailable: (baseUrl) => `API Ollama indisponible (${baseUrl}). Lance ollama serve puis reessaie /ollama.`,
    askAgentsUpdated: (value) => `Agents Ask mis a jour: ${value}.`,
    debateAgentsUpdated: (value) => `Agents Debat mis a jour: ${value}.`,
    chatAgentsUpdated: (value) => `Agent Chat mis a jour: ${value}.`,
    askRolesUpdated: (value) => `Roles Ask mis a jour: ${value}.`,
    debateRolesUpdated: (value) => `Roles Debat mis a jour: ${value}.`,
    chatRolesUpdated: (value) => `Role Chat mis a jour: ${value}.`,
    rolesError: (message) => `Erreur roles: ${message}`,
    agentsError: (message) => `Erreur agents: ${message}`,
    noAskAgentsConfigured: "Aucun agent Ask configure.",
    noDebateAgentsConfigured: "Agents Debat non definis.",
    noChatAgentConfigured: "Aucun agent Chat configure.",
    rolesCountError: (count, expected, agents) => `${count} role(s) saisi(s), ${expected} attendu(s). Saisis au moins ${expected} roles pour: ${agents}.`,
    unknownRole: (role, available) => `Role inconnu: ${role}. Roles disponibles: ${available}.`,
    debateAgentsUsage: "Usage: /agents <agentA> <agentB>",
    askAgentsUsage: "Usage: /agents <agent...>",
    chatAgentsUsage: "Usage: /agents <agent>"
  },
  en: {
    tagline: "Orchestrate conversations between AI agents",
    updateAvailable: (current, latest) => `Update available: ${current} -> ${latest}. Use /update.`,
    modeLabel: (mode) => mode === "chat" ? "Chat" : mode === "ask" ? "Ask" : "Debate",
    modeValue: (mode) => mode === "chat" ? "Chat" : mode === "ask" ? "Ask" : "Debate",
    composerPlaceholder: (mode) => mode === "chat" ? "What would you like to discuss?" : mode === "ask" ? "What question would you like to ask the agents?" : "What topic would you like the agents to debate?",
    noValue: "not set",
    lastAskAgent: "last ask agent",
    roles: "Roles",
    summary: "Summary",
    ollamaModel: "Ollama model",
    ollamaUrl: "Ollama address",
    ollamaUrlEffective: "Effective Ollama address",
    responses: "Turns",
    folder: "Folder",
    docs: "Docs",
    changeMode: "change mode",
    chatReady: "conversation",
    tipContext: "Tip Add context with --context <folder> or --files <file>.",
    homeCommands: "/config settings · /roles agent roles · /help available commands",
    homeModes: "/debat debate between two agents · /chat conversation · /ask multiple responses",
    chatTip: "/chat: one conversation, then an extra opinion only when useful.",
    chatComposerCommands: "/consult <agent> opinion · /use <agent> switch · /agents list · /end export · /home home",
    askTip: "Ask: several independent responses to the same question.",
    debateTip: "Debate: two agents challenge each other before the summary.",
    helpTitle: "TUI Commands",
    helpAsk: "Ask mode",
    helpChat: "open a conversation",
    helpDebate: "Debate mode",
    helpAgents: "choose agents",
    helpRoles: "choose roles",
    helpConfig: "settings",
    helpNew: "guided assistant",
    helpRetry: "rerun the last session",
    helpHistory: "show recent exports",
    helpUpdate: "show update information",
    helpHelp: "help",
    helpQuit: "quit",
    helpFallback: "Type a topic or a command.",
    historyTitle: "Palabre History",
    historyEmpty: "No export found yet.",
    historyOpenHint: "The file path is clickable in compatible terminals.",
    historyFile: "File",
    historyMode: (mode) => mode === "chat" ? "Conversation" : mode === "ask" ? "Ask mode" : "Debate mode",
    historyCount: (mode) => mode === "chat" ? "Messages" : mode === "ask" ? "Responses" : "Turns",
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
    configSectionGeneral: "General",
    exportedFile: "Exported file",
    exportedFolder: "Export folder",
    configFile: "Config",
    interface: "Interface",
    language: "Language",
    availableAgentsShort: "Agents",
    availableCommands: "Available commands",
    noConfiguredAgents: "no configured agent",
    or: "or",
    modeConfigCommand: "switch and set as default",
    backCommand: "return to home",
    quitCommand: "quit",
    subject: "Subject",
    configPrompt: "Config",
    agentsPrompt: "Agents",
    configComposerPlaceholder: "Enter a configuration command…",
    configComposerTip: "/home home · Ctrl+C back · /quit quit",
    rolesPrompt: "Roles",
    sessionDone: "Session complete",
    sessionHistoryHint: "Find your exports again with /history.",
    askResponse: (response, totalResponses) => `response ${response}/${totalResponses}`,
    turnLabel: (turn) => `turn ${turn}`,
    planTitle: "Session plan",
    planCollectAsk: "Collect responses",
    planLaunchDebate: "Start debate",
    planSummaryComparative: "Comparative summary",
    planSummaryDisabled: "Summary disabled",
    planExport: "Markdown export",
    ptyNotice: (agents) => `Note: ${agents} uses a pseudo-terminal; a window may briefly appear.`,
    unknownCommand: "Unknown command. Use /home to return.",
    turnsUsage: "Usage: /turns <turns>",
    summaryUsage: "Usage: /summary <agent|none>",
    ollamaModelUsage: "Usage: /ollama-model <model>",
    ollamaUrlUsage: "Usage: /ollama-url <url|default>",
    interfaceUsage: "Usage: /interface <tui|terminal>",
    languageUsage: "Usage: /language <fr|en>",
    rolesUsage: "Usage: /roles <role...>",
    ollamaInfoCommand: "show installed models",
    ollamaUrlCommand: "change the address (<url|default>)",
    ollamaSyncCommand: "choose an available installed model",
    interfaceDefault: (value) => `Default interface: ${value}.`,
    languageUpdated: (value) => `Language updated: ${value}.`,
    askConfigMode: "Ask configuration.",
    debateConfigMode: "Debate configuration.",
    chatConfigMode: "Chat configuration.",
    askDefaultMode: "Ask is now the default mode.",
    debateDefaultMode: "Debate is now the default mode.",
    chatDefaultMode: "Chat is now the default mode.",
    agentsUnchanged: "Agents unchanged.",
    rolesUnchanged: "Roles unchanged.",
    askTurnsNotice: "In Ask mode, the number of responses depends on agents selected with /agents.",
    turnsUpdated: (value) => `Turns updated: ${value}.`,
    askSummaryFallback: "Ask summary returned to fallback.",
    debateSummaryFallback: "Debate summary returned to fallback.",
    askSummaryAgent: (value) => `Ask summary: ${value}.`,
    debateSummaryAgent: (value) => `Debate summary: ${value}.`,
    ollamaInfo: (current, installed, api) => `Ollama ${api}. Current model: ${current}. Installed models: ${installed}.`,
    ollamaUrlUpdated: (configured, effective) => configured === effective ? `Ollama address updated: ${configured}.` : `Ollama address configured: ${configured}. Effective address from OLLAMA_HOST: ${effective}.`,
    ollamaUnavailable: (baseUrl) => `Ollama API unavailable (${baseUrl}). Run ollama serve, then try /ollama again.`,
    askAgentsUpdated: (value) => `Ask agents updated: ${value}.`,
    debateAgentsUpdated: (value) => `Debate agents updated: ${value}.`,
    chatAgentsUpdated: (value) => `Chat agent updated: ${value}.`,
    askRolesUpdated: (value) => `Ask roles updated: ${value}.`,
    debateRolesUpdated: (value) => `Debate roles updated: ${value}.`,
    chatRolesUpdated: (value) => `Chat role updated: ${value}.`,
    rolesError: (message) => `Roles error: ${message}`,
    agentsError: (message) => `Agents error: ${message}`,
    noAskAgentsConfigured: "No Ask agent configured.",
    noDebateAgentsConfigured: "Debate agents are not set.",
    noChatAgentConfigured: "No Chat agent configured.",
    rolesCountError: (count, expected, agents) => `${count} role(s) entered, ${expected} expected. Enter at least ${expected} roles for: ${agents}.`,
    unknownRole: (role, available) => `Unknown role: ${role}. Available roles: ${available}.`,
    debateAgentsUsage: "Usage: /agents <agentA> <agentB>",
    askAgentsUsage: "Usage: /agents <agent...>",
    chatAgentsUsage: "Usage: /agents <agent>"
  }
};
