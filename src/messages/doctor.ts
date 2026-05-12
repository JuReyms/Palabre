import type { Language } from "../types.js";

type LevelLabels = {
  ok: string;
  warn: string;
  error: string;
  info: string;
};

export interface DoctorMessages {
  title: string;
  currentDirectory(cwd: string): string;
  configFound(path: string): string;
  configMissing(path: string): string;
  noConfigAction: string;
  configReadable: string;
  configUnreadable(message: string): string;
  configUnreadableAction: string;
  interfaceLanguage(language: Language): string;
  noAgents: string;
  oneAgent(name: string): string;
  agentCount(count: number, names: string): string;
  defaultAgentMissing(label: string): string;
  defaultAgentUnknown(label: string, name: string): string;
  defaultAgentOk(label: string, name: string): string;
  defaultPairIncomplete: string;
  sameDefaultAgent(name: string): string;
  defaultTurnsMissing(turns: number): string;
  defaultTurnsInvalid(value: string, max: number): string;
  defaultTurnsOk(value: number): string;
  summaryAgentMissing: string;
  outputDirMissing(path: string): string;
  outputDirLegacy(path: string): string;
  outputDirIsFile(path: string): string;
  outputDirConfigured(path: string): string;
  outputDirWillCreate(path: string): string;
  localTools: string;
  ollamaReachable(baseUrl: string, count: number): string;
  ollamaInstalledNoApi(baseUrl: string, suffix: string): string;
  ollamaMissingNoApi(baseUrl: string, suffix: string): string;
  configuredAgents: string;
  detectedMissing(names: string): string;
  roleMissing(name: string): string;
  cliCommandMissing(name: string): string;
  promptModeInvalid(name: string, value: string): string;
  positiveTimeout(name: string, field: string): string;
  ollamaModelMissing(name: string): string;
  ollamaBaseUrlInvalid(name: string, value: string): string;
  customCommand(prefix: string): string;
  cliDetected(prefix: string, path: string): string;
  cliMissing(prefix: string): string;
  ollamaNotVerifiable(prefix: string): string;
  ollamaValidateFalse(prefix: string): string;
  ollamaInstalled(prefix: string): string;
  ollamaMissing(prefix: string, model: string): string;
  commandDetected(label: string, path: string): string;
  commandMissing(label: string): string;
  status(errorCount: number, warnCount: number): string;
  sections: {
    configuration: string;
    tools: string;
    agents: string;
    check: string;
  };
  nothingToDisplay: string;
  statusLabel: string;
  levelLabels: LevelLabels;
  prettyLevelLabels: LevelLabels;
}

export const doctorMessages: Record<Language, DoctorMessages> = {
  fr: {
    title: "PALABRE doctor",
    currentDirectory: (cwd) => `Dossier courant: ${cwd}`,
    configFound: (path) => `Config trouvée: ${path}`,
    configMissing: (path) => `Config absente: ${path}`,
    noConfigAction: "Action: lance `palabre init` pour créer la config globale, ou `palabre init --local` pour une config projet.",
    configReadable: "Config JSON lisible.",
    configUnreadable: (message) => `Config illisible: ${message}`,
    configUnreadableAction: "Action: corrige le JSON ou relance `palabre init --config <path>` vers un nouveau fichier.",
    interfaceLanguage: (language) => `Langue interface: ${language}`,
    noAgents: "Aucun agent configuré.",
    oneAgent: (name) => `1 agent configuré: ${name}. Palabre fonctionne mieux avec au moins deux agents.`,
    agentCount: (count, names) => `${count} agent(s) configuré(s): ${names}`,
    defaultAgentMissing: (label) => `${label} absent.`,
    defaultAgentUnknown: (label, name) => `${label} pointe vers un agent inconnu: ${name}`,
    defaultAgentOk: (label, name) => `${label}: ${name}`,
    defaultPairIncomplete: "Paire par défaut incomplète. Action: `palabre config --set-defaults <agentA> <agentB>`.",
    sameDefaultAgent: (name) => `defaults.agentA et defaults.agentB pointent vers le même agent (${name}). C'est possible, mais souvent moins utile qu'une vraie paire.`,
    defaultTurnsMissing: (turns) => `defaults.turns absent: Palabre utilisera ${turns} réponses.`,
    defaultTurnsInvalid: (value, max) => `defaults.turns invalide: ${value}. Action: choisis un entier entre 1 et ${max}.`,
    defaultTurnsOk: (value) => `defaults.turns: ${value}`,
    summaryAgentMissing: "defaults.summaryAgent absent: la synthèse utilisera agentB.",
    outputDirMissing: (path) => `outputDir absent: les exports seront écrits dans le dossier par défaut (${path}).`,
    outputDirLegacy: (path) => `outputDir legacy '.': les exports seront regroupés dans ${path}.`,
    outputDirIsFile: (path) => `outputDir pointe vers un fichier, pas un dossier: ${path}`,
    outputDirConfigured: (path) => `outputDir configuré: ${path}`,
    outputDirWillCreate: (path) => `outputDir n'existe pas encore: ${path}. Palabre tentera de le créer au moment de l'export.`,
    localTools: "Outils locaux:",
    ollamaReachable: (baseUrl, count) => `Ollama API joignable: ${baseUrl} (${count} modèle(s))`,
    ollamaInstalledNoApi: (baseUrl, suffix) => `Ollama installé mais API non joignable: ${baseUrl}${suffix}`,
    ollamaMissingNoApi: (baseUrl, suffix) => `Ollama non détecté et API non joignable: ${baseUrl}${suffix}`,
    configuredAgents: "Agents configurés:",
    detectedMissing: (names) => `Agent(s) détecté(s) mais absent(s) de la config: ${names}. Action: lance ` + "`palabre config --sync-agents`.",
    roleMissing: (name) => `${name}: role absent.`,
    cliCommandMissing: (name) => `${name}: command CLI absent.`,
    promptModeInvalid: (name, value) => `${name}: promptMode invalide (${value}). Valeurs attendues: stdin ou argument.`,
    positiveTimeout: (name, field) => `${name}: ${field} doit être un nombre positif.`,
    ollamaModelMissing: (name) => `${name}: modèle Ollama absent.`,
    ollamaBaseUrlInvalid: (name, value) => `${name}: baseUrl Ollama invalide (${value}). Attendu: http://... ou https://...`,
    customCommand: (prefix) => `${prefix} (commande custom non vérifiée par doctor)`,
    cliDetected: (prefix, path) => `${prefix} détectée (${path})`,
    cliMissing: (prefix) => `${prefix} non détectée dans PATH. Action: installe/authentifie la CLI ou corrige command dans la config.`,
    ollamaNotVerifiable: (prefix) => `${prefix} non vérifiable: API Ollama non joignable. Action: démarre Ollama ou corrige baseUrl.`,
    ollamaValidateFalse: (prefix) => `${prefix} non validé car validateModel=false.`,
    ollamaInstalled: (prefix) => `${prefix} installé.`,
    ollamaMissing: (prefix, model) => `${prefix} absent. Action: lance ` + "`ollama pull " + model + "`" + " ou utilise `--pull-models`.",
    commandDetected: (label, path) => `${label}: détecté (${path})`,
    commandMissing: (label) => `${label}: non détecté dans PATH.`,
    status: (errorCount, warnCount) => errorCount > 0
      ? `${errorCount} erreur(s), ${warnCount} avertissement(s)`
      : warnCount > 0 ? `${warnCount} avertissement(s)` : "OK",
    sections: {
      configuration: "Configuration",
      tools: "Outils locaux",
      agents: "Agents",
      check: "À vérifier"
    },
    nothingToDisplay: "Rien à afficher.",
    statusLabel: "Statut",
    levelLabels: { ok: "OK", warn: "WARN", error: "ERREUR", info: "INFO" },
    prettyLevelLabels: { ok: "OK    ", warn: "WARN  ", error: "ERREUR", info: "INFO  " }
  },
  en: {
    title: "PALABRE doctor",
    currentDirectory: (cwd) => `Current directory: ${cwd}`,
    configFound: (path) => `Config found: ${path}`,
    configMissing: (path) => `Config missing: ${path}`,
    noConfigAction: "Action: run `palabre init` to create the global config, or `palabre init --local` for a project config.",
    configReadable: "Config JSON is readable.",
    configUnreadable: (message) => `Config unreadable: ${message}`,
    configUnreadableAction: "Action: fix the JSON or run `palabre init --config <path>` for a new file.",
    interfaceLanguage: (language) => `Interface language: ${language}`,
    noAgents: "No agent configured.",
    oneAgent: (name) => `1 agent configured: ${name}. Palabre works best with at least two agents.`,
    agentCount: (count, names) => `${count} agent(s) configured: ${names}`,
    defaultAgentMissing: (label) => `${label} is missing.`,
    defaultAgentUnknown: (label, name) => `${label} points to an unknown agent: ${name}`,
    defaultAgentOk: (label, name) => `${label}: ${name}`,
    defaultPairIncomplete: "Default pair is incomplete. Action: `palabre config --set-defaults <agentA> <agentB>`.",
    sameDefaultAgent: (name) => `defaults.agentA and defaults.agentB point to the same agent (${name}). This is allowed, but usually less useful than a real pair.`,
    defaultTurnsMissing: (turns) => `defaults.turns is missing: Palabre will use ${turns} responses.`,
    defaultTurnsInvalid: (value, max) => `Invalid defaults.turns: ${value}. Action: choose an integer between 1 and ${max}.`,
    defaultTurnsOk: (value) => `defaults.turns: ${value}`,
    summaryAgentMissing: "defaults.summaryAgent is missing: the summary will use agentB.",
    outputDirMissing: (path) => `outputDir is missing: exports will be written to the default folder (${path}).`,
    outputDirLegacy: (path) => `legacy outputDir '.': exports will be grouped in ${path}.`,
    outputDirIsFile: (path) => `outputDir points to a file, not a folder: ${path}`,
    outputDirConfigured: (path) => `outputDir configured: ${path}`,
    outputDirWillCreate: (path) => `outputDir does not exist yet: ${path}. Palabre will try to create it during export.`,
    localTools: "Local tools:",
    ollamaReachable: (baseUrl, count) => `Ollama API reachable: ${baseUrl} (${count} model(s))`,
    ollamaInstalledNoApi: (baseUrl, suffix) => `Ollama is installed but the API is unreachable: ${baseUrl}${suffix}`,
    ollamaMissingNoApi: (baseUrl, suffix) => `Ollama not detected and API unreachable: ${baseUrl}${suffix}`,
    configuredAgents: "Configured agents:",
    detectedMissing: (names) => `Detected agent(s) missing from config: ${names}. Action: run ` + "`palabre config --sync-agents`.",
    roleMissing: (name) => `${name}: missing role.`,
    cliCommandMissing: (name) => `${name}: missing CLI command.`,
    promptModeInvalid: (name, value) => `${name}: invalid promptMode (${value}). Expected values: stdin or argument.`,
    positiveTimeout: (name, field) => `${name}: ${field} must be a positive number.`,
    ollamaModelMissing: (name) => `${name}: missing Ollama model.`,
    ollamaBaseUrlInvalid: (name, value) => `${name}: invalid Ollama baseUrl (${value}). Expected: http://... or https://...`,
    customCommand: (prefix) => `${prefix} (custom command not checked by doctor)`,
    cliDetected: (prefix, path) => `${prefix} detected (${path})`,
    cliMissing: (prefix) => `${prefix} not detected in PATH. Action: install/authenticate the CLI or fix command in the config.`,
    ollamaNotVerifiable: (prefix) => `${prefix} cannot be verified: Ollama API is unreachable. Action: start Ollama or fix baseUrl.`,
    ollamaValidateFalse: (prefix) => `${prefix} not validated because validateModel=false.`,
    ollamaInstalled: (prefix) => `${prefix} installed.`,
    ollamaMissing: (prefix, model) => `${prefix} missing. Action: run ` + "`ollama pull " + model + "`" + " or use `--pull-models`.",
    commandDetected: (label, path) => `${label}: detected (${path})`,
    commandMissing: (label) => `${label}: not detected in PATH.`,
    status: (errorCount, warnCount) => errorCount > 0
      ? `${errorCount} error(s), ${warnCount} warning(s)`
      : warnCount > 0 ? `${warnCount} warning(s)` : "OK",
    sections: {
      configuration: "Configuration",
      tools: "Local tools",
      agents: "Agents",
      check: "To check"
    },
    nothingToDisplay: "Nothing to display.",
    statusLabel: "Status",
    levelLabels: { ok: "OK", warn: "WARN", error: "ERROR", info: "INFO" },
    prettyLevelLabels: { ok: "OK    ", warn: "WARN  ", error: "ERROR ", info: "INFO  " }
  }
};
