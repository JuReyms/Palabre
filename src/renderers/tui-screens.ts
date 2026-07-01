/**
 * @file Écrans plein terminal du TUI : accueil, aide, agents, rôles, historique,
 * configuration et instructions de mise à jour. Chaque écran efface l'écran en TTY
 * puis compose des blocs du thème (`tui-theme`) ; aucune lecture d'entrée ici.
 */
import path from "node:path";
import type { AgentRole, PalabreConfig, PalabreMode } from "../types.js";
import type { Messages } from "../messages/index.js";
import type { HistoryEntry } from "../history.js";
import { isRetiredAgentName } from "../agentRegistry.js";
import { DEFAULT_OLLAMA_BASE_URL, resolveOllamaBaseUrl } from "../ollamaUrl.js";
import {
  accent,
  agentLabel,
  bold,
  brandHeader,
  card,
  clearScreen,
  compactFileName,
  compactPath,
  composerCard,
  dim,
  dirnamePortable,
  logoBlock,
  padBlock,
  panel,
  row,
  rows,
  supportsInteractiveOutput,
  surfaceWidth,
  terminalLink,
  viewportWidth,
  type RowEntry
} from "./tui-theme.js";

/** Affiche l'ecran d'accueil TUI lance par `palabre` sans sujet. */
export function renderTuiHome(config: PalabreConfig, _configPath: string, messages: Messages, state: { mode?: PalabreMode; version?: string; latestVersion?: string } = {}): void {
  if (supportsInteractiveOutput) {
    clearScreen();
  }

  const viewport = viewportWidth();
  const width = surfaceWidth();
  const defaults = config.defaults ?? {};
  const mode = state.mode ?? defaults.mode ?? "debate";
  const debateAgents = defaults.agentA && defaults.agentB
    ? `${defaults.agentA} <-> ${defaults.agentB}`
    : messages.tui.noValue;
  const askAgents = defaults.askAgents && defaults.askAgents.length > 0
    ? defaults.askAgents.join(", ")
    : debateAgents.replace(" <-> ", ", ");
  const debateRoles = defaults.agentA && defaults.agentB
    ? `${roleFor(config, defaults.agentA, messages)} <-> ${roleFor(config, defaults.agentB, messages)}`
    : messages.tui.noValue;
  const askAgentNames = defaults.askAgents && defaults.askAgents.length > 0
    ? defaults.askAgents
    : [defaults.agentA, defaults.agentB].filter((agent): agent is string => Boolean(agent));
  const askRoles = askAgentNames.length > 0
    ? askAgentNames.map((agent) => roleFor(config, agent, messages)).join(", ")
    : debateRoles.replace(" <-> ", ", ");
  const summary = mode === "ask"
    ? defaults.askSummaryAgent ?? defaults.summaryAgent ?? messages.tui.lastAskAgent
    : defaults.summaryAgent ?? defaults.agentB ?? "agent B";
  const version = state.version ?? "0.0.0";
  const versionLines = state.latestVersion
    ? [dim(`v${version}`), accent(messages.tui.updateAvailable(version, state.latestVersion))]
    : [dim(`v${version}`)];

  const lines = [
    "",
    ...padBlock(logoBlock(messages)),
    ...padBlock(versionLines),
    "",
    ...padBlock(composerCard([
      `${accent(messages.tui.modeValue(mode))} ${dim("·")} ${mode === "ask" ? askAgents : debateAgents}`,
      `${accent(messages.tui.roles)} ${dim("·")} ${mode === "ask" ? askRoles : debateRoles}`,
      `${accent(messages.tui.summary)} ${dim("·")} ${summary}${mode === "debate" ? ` ${dim("·")} ${accent(messages.tui.responses)} ${String(defaults.turns ?? "?")}` : ""}`,
      `${accent(messages.tui.folder)} ${dim("·")} ${compactPath(process.cwd(), Math.min(width - 4, viewport - 12))}`,
      `${accent(messages.tui.docs)} ${dim("·")} ${documentationUrl(config)}`,
      "",
      `${accent("/help")} ${dim(messages.tui.commands)}   ${accent("/roles")} ${dim(messages.tui.roles.toLowerCase())}   ${accent("/config")} ${dim(messages.tui.settings)}   ${accent(mode === "ask" ? "/debat" : "/ask")} ${dim(messages.tui.changeMode)}`
    ], width)),
    "",
    ...padBlock([
      dim(messages.tui.tipContext)
    ])
  ];

  process.stdout.write(lines.join("\n") + "\n");
}

/** Affiche les instructions de mise a jour sans quitter le TUI. */
export function renderTuiUpdate(instructions: string, _messages: Messages): void {
  if (supportsInteractiveOutput) {
    clearScreen();
  }

  const width = surfaceWidth();
  process.stdout.write([
    "",
    ...padBlock([brandHeader()]),
    "",
    ...padBlock(card(instructions.split(/\r?\n/), width)),
    ""
  ].join("\n"));
}

/** Affiche l'aide interne du composer TUI. */
export function renderTuiHelp(messages: Messages): void {
  if (supportsInteractiveOutput) {
    clearScreen();
  }

  const width = surfaceWidth();
  process.stdout.write([
    "",
    ...padBlock([brandHeader(messages.tui.helpTitle)]),
    "",
    ...padBlock(card([
      row("/ask", messages.tui.helpAsk),
      row("/debat", messages.tui.helpDebate),
      "",
      row("/agents", messages.tui.helpAgents),
      row("/roles", messages.tui.helpRoles),
      row("/config", messages.tui.helpConfig),
      "",
      row("/new", messages.tui.helpNew),
      row("/retry", messages.tui.helpRetry),
      row("/history", messages.tui.helpHistory),
      row("/update", messages.tui.helpUpdate),
      row("/home", messages.tui.backCommand),
      row("/help", messages.tui.helpHelp),
      row("/quit", messages.tui.helpQuit),
      "",
      dim(messages.tui.helpFallback)
    ], width)),
    ""
  ].join("\n"));
}

/** Affiche l'aide rapide des agents configures. */
export function renderTuiAgentsHelp(config: PalabreConfig, mode: PalabreMode, messages: Messages): void {
  if (supportsInteractiveOutput) {
    clearScreen();
  }

  const width = surfaceWidth();
  const activeAgents = activeAgentNamesForMode(config, mode);
  const separator = mode === "ask" ? ", " : " <-> ";
  const exampleAgents = exampleAgentsForMode(config, mode);
  process.stdout.write([
    "",
    ...padBlock([brandHeader(messages.tui.agentsTitle)]),
    "",
    ...padBlock(card([
      row(messages.tui.activeMode, messages.tui.modeValue(mode)),
      row(messages.tui.activeAgents, activeAgents.length > 0 ? activeAgents.join(separator) : messages.tui.noValue),
      "",
      bold(messages.tui.availableAgents),
      "",
      ...agentInventoryRows(config, messages),
      "",
      dim(`${messages.tui.example}: ${messages.tui.modeLabel(mode)} > ${messages.tui.agentsPrompt} > ${exampleAgents.join(" ")}`)
    ], width)),
    ""
  ].join("\n"));
}

/** Affiche l'aide rapide des roles disponibles. */
export function renderTuiRolesHelp(mode: PalabreMode, messages: Messages, config?: PalabreConfig): void {
  if (supportsInteractiveOutput) {
    clearScreen();
  }

  const width = surfaceWidth();
  const currentRoles = config ? roleLineForMode(config, mode, messages) : undefined;
  const activeAgents = config ? activeAgentNamesForMode(config, mode) : [];
  const expectedCount = activeAgents.length || (mode === "ask" ? 3 : 2);
  const exampleRoles = exampleRolesForMode(mode, expectedCount);
  process.stdout.write([
    "",
    ...padBlock([brandHeader(messages.tui.rolesTitle)]),
    "",
    ...padBlock(card([
      ...(activeAgents.length > 0 ? [row(messages.tui.activeAgents, activeAgents.join(mode === "ask" ? ", " : " <-> "))] : []),
      ...(currentRoles ? [row(messages.tui.currentConfig, currentRoles), ""] : []),
      bold(messages.tui.availableRoles),
      "",
      row("implementer", messages.tui.roleImplementer),
      row("critic", messages.tui.roleCritic),
      row("architect", messages.tui.roleArchitect),
      row("scout", messages.tui.roleScout),
      row("reviewer", messages.tui.roleReviewer),
      row("summarizer", messages.tui.roleSummarizer),
      "",
      dim(`${messages.tui.example}: ${messages.tui.modeLabel(mode)} > ${messages.tui.rolesPrompt} > ${exampleRoles.join(" ")}`)
    ], Math.min(width, 82))),
    ""
  ].join("\n"));
}

/** Affiche les derniers exports Palabre disponibles. */
export function renderTuiHistory(entries: HistoryEntry[], messages: Messages): void {
  if (supportsInteractiveOutput) {
    clearScreen();
  }

  const width = surfaceWidth();
  const entryRows = entries.length === 0
    ? [dim(messages.tui.historyEmpty)]
    : entries.flatMap((entry) => {
      const folderPath = path.dirname(entry.path);
      const folderLabel = folderPath === "." ? dirnamePortable(entry.path) : folderPath;
      return [
        row(messages.tui.historyMode(entry.mode), entry.topic),
        row(messages.tui.activeAgents, entry.agents || messages.tui.noValue),
        ...(entry.count ? [row(messages.tui.historyCount(entry.mode), entry.count)] : []),
        row(messages.tui.historyFile, terminalLink(entry.path, compactFileName(entry.fileName, width - 24))),
        row(messages.tui.folder, terminalLink(folderPath, compactPath(folderLabel, width - 24))),
        ...(entry.date ? [row("Date", entry.date)] : []),
        ""
      ];
    }).slice(0, -1);

  process.stdout.write([
    "",
    ...padBlock([brandHeader(messages.tui.historyTitle)]),
    "",
    ...padBlock(panel([
      ...entryRows,
      "",
      dim(messages.tui.historyOpenHint)
    ], width)),
    ""
  ].join("\n"));
}

/** Affiche l'ecran de config natif TUI, adapte au mode courant. */
export function renderTuiConfig(config: PalabreConfig, configPath: string, mode: PalabreMode, messages: Messages, state: { message?: string } = {}): void {
  if (supportsInteractiveOutput) {
    clearScreen();
  }

  const width = surfaceWidth();
  const defaults = config.defaults ?? {};
  const debateAgents = defaults.agentA && defaults.agentB ? `${defaults.agentA} <-> ${defaults.agentB}` : messages.tui.noValue;
  const askAgents = defaults.askAgents && defaults.askAgents.length > 0
    ? defaults.askAgents.join(", ")
    : debateAgents.replace(" <-> ", ", ");
  const debateRoles = defaults.agentA && defaults.agentB ? `${roleFor(config, defaults.agentA, messages)} <-> ${roleFor(config, defaults.agentB, messages)}` : messages.tui.noValue;
  const askRoles = roleLineForMode(config, "ask", messages);
  const summary = mode === "ask"
    ? defaults.askSummaryAgent ?? defaults.summaryAgent ?? messages.tui.lastAskAgent
    : defaults.summaryAgent ?? defaults.agentB ?? messages.tui.noValue;
  const ollamaAgent = config.agents["ollama-local"];
  const ollamaModel = ollamaAgent?.type === "ollama" ? ollamaAgent.model : undefined;
  const ollamaUrl = ollamaAgent?.type === "ollama" ? ollamaAgent.baseUrl ?? DEFAULT_OLLAMA_BASE_URL : undefined;
  const ollamaEffectiveUrl = ollamaUrl ? safeEffectiveOllamaUrl(ollamaUrl) : undefined;

  const generalBox = card(rows([
    [messages.tui.activeMode, messages.tui.modeValue(mode)],
    [messages.tui.configFile, configPath],
    [messages.tui.interface, defaults.interface ?? "tui"],
    [messages.tui.language, config.language ?? "fr"],
    [messages.tui.availableAgentsShort, agentInventoryLine(config, messages)]
  ]), width, messages.tui.configSectionGeneral);

  const ollamaBox = ollamaModel
    ? card(rows([
        [messages.tui.ollamaModel, ollamaModel] as const,
        ...(ollamaUrl ? [[messages.tui.ollamaUrl, ollamaUrl] as const] : []),
        ...(ollamaEffectiveUrl && ollamaEffectiveUrl !== ollamaUrl ? [[messages.tui.ollamaUrlEffective, ollamaEffectiveUrl] as const] : [])
      ]), width, "Ollama")
    : [];

  const sessionEntries: RowEntry[] = mode === "ask"
    ? [
        [messages.tui.activeAgents, askAgents],
        [messages.tui.roles, askRoles],
        [messages.tui.summary, summary]
      ]
    : [
        [messages.tui.activeAgents, debateAgents],
        [messages.tui.roles, debateRoles],
        [messages.tui.summary, summary],
        [messages.tui.responses, String(defaults.turns ?? "?")]
      ];
  const sessionBox = card(rows(sessionEntries), width, messages.tui.modeValue(mode));

  const commandRows = [
    bold(messages.tui.availableCommands),
    "",
    ...(mode === "ask"
      ? [
          row("/agents", messages.tui.askAgentsUsage),
          row("/roles", messages.tui.rolesUsage),
          row("/summary", messages.tui.summaryUsage)
        ]
      : [
          row("/agents", messages.tui.debateAgentsUsage),
          row("/roles", messages.tui.rolesUsage),
          row("/turns", messages.tui.turnsUsage),
          row("/summary", messages.tui.summaryUsage)
        ]),
    row("/mode", messages.tui.modeConfigCommand),
    ...(ollamaModel ? [
      row("/ollama", messages.tui.ollamaInfoCommand),
      row("/ollama-model", messages.tui.ollamaModelUsage),
      row("/ollama-url", messages.tui.ollamaUrlCommand),
      row("/ollama-sync", messages.tui.ollamaSyncCommand)
    ] : []),
    row("/interface", messages.tui.interfaceUsage),
    row("/language", messages.tui.languageUsage),
    "",
    row("/home", messages.tui.backCommand),
    row("/quit", messages.tui.quitCommand)
  ];

  const lines = [
    "",
    ...padBlock([brandHeader(messages.tui.configTitle)]),
    "",
    ...padBlock(generalBox),
    "",
    ...padBlock(sessionBox),
    ...(ollamaBox.length > 0 ? ["", ...padBlock(ollamaBox)] : []),
    "",
    ...padBlock(commandRows),
    ...(state.message ? ["", ...padBlock([state.message])] : [])
  ];

  process.stdout.write(lines.join("\n") + "\n");
}

/** Résout l'URL Ollama effective sans lever : retombe sur `OLLAMA_HOST` ou l'URL config brute. */
function safeEffectiveOllamaUrl(configUrl: string): string {
  try {
    return resolveOllamaBaseUrl({ configUrl });
  } catch {
    return process.env.OLLAMA_HOST?.trim() || configUrl;
  }
}

function roleFor(config: PalabreConfig, agent: string, messages: Messages): AgentRole | string {
  return config.agents[agent]?.role ?? messages.tui.noValue;
}

function roleLineForMode(config: PalabreConfig, mode: PalabreMode, messages: Messages): string {
  const agents = activeAgentNamesForMode(config, mode);
  if (mode === "ask") {
    return agents.length > 0 ? agents.map((agent) => roleFor(config, agent, messages)).join(", ") : messages.tui.noValue;
  }

  return agents.length === 2
    ? `${roleFor(config, agents[0]!, messages)} <-> ${roleFor(config, agents[1]!, messages)}`
    : messages.tui.noValue;
}

function activeAgentNamesForMode(config: PalabreConfig, mode: PalabreMode): string[] {
  const defaults = config.defaults ?? {};
  if (mode === "ask") {
    const agents = defaults.askAgents && defaults.askAgents.length > 0
      ? defaults.askAgents
      : [defaults.agentA, defaults.agentB].filter((agent): agent is string => Boolean(agent));
    return agents.filter((agent) => Boolean(config.agents[agent]) && !isRetiredAgentName(agent));
  }

  return [defaults.agentA, defaults.agentB].filter((agent): agent is string =>
    typeof agent === "string" && Boolean(config.agents[agent]) && !isRetiredAgentName(agent)
  );
}

function agentInventoryLine(config: PalabreConfig, messages: Messages): string {
  const agents = Object.entries(config.agents)
    .filter(([name]) => !isRetiredAgentName(name))
    .map(([name]) => name)
    .sort();
  return agents.length > 0 ? agents.map(agentLabel).join(", ") : messages.tui.noValue;
}

function agentInventoryRows(config: PalabreConfig, messages: Messages): string[] {
  const entries = Object.entries(config.agents)
    .filter(([name]) => !isRetiredAgentName(name))
    .sort(([agentA], [agentB]) => agentA.localeCompare(agentB));
  if (entries.length === 0) {
    return [dim(messages.tui.noConfiguredAgents)];
  }

  return entries.map(([name, agent]) => row(name, `${agent.type} ${dim("·")} ${agent.role}`));
}

function exampleAgentsForMode(config: PalabreConfig, mode: PalabreMode): string[] {
  const activeAgents = activeAgentNamesForMode(config, mode);
  if (activeAgents.length > 0) {
    return activeAgents;
  }

  const available = Object.keys(config.agents).filter((agent) => !isRetiredAgentName(agent)).sort();
  return mode === "ask" ? available.slice(0, 3) : available.slice(0, 2);
}

function documentationUrl(config: PalabreConfig): string {
  return `https://palab.re/${config.language === "en" ? "en" : "fr"}`;
}

function exampleRolesForMode(mode: PalabreMode, count: number): AgentRole[] {
  const roles: AgentRole[] = mode === "ask"
    ? ["critic", "implementer", "scout", "architect"]
    : ["implementer", "critic"];
  while (roles.length < count) {
    roles.push("reviewer");
  }
  return roles.slice(0, count);
}
