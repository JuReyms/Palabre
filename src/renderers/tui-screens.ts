/**
 * @file Écrans plein terminal du TUI : accueil, aide, agents, rôles, historique,
 * configuration et instructions de mise à jour. Chaque écran efface l'écran en TTY
 * puis compose des blocs du thème (`tui-theme`) ; aucune lecture d'entrée ici.
 */
import path from "node:path";
import type { AgentRole, PalabreConfig, PalabreMode } from "../types.js";
import type { TuiHomeMode } from "./tui-prompts.js";
import type { Messages } from "../messages/index.js";
import type { HistoryEntry } from "../history.js";
import type { ToolDiscovery } from "../discovery.js";
import { sanitizeTerminalText } from "../adapters/terminal.js";
import { isRetiredAgentName } from "../agentRegistry.js";
import { listAgentsWithAvailability } from "../presets.js";
import { formatUpdateStep, hasAvailableUpdate, type UpdateInfo } from "../update.js";
import {
  accent,
  bold,
  brandHeader,
  card,
  clearScreen,
  compactFileName,
  compactPath,
  composerCard,
  dim,
  dirnamePortable,
  packItems,
  logoBlock,
  muted,
  padBlock,
  panel,
  row,
  rows,
  supportsInteractiveOutput,
  surfaceWidth,
  terminalLink,
  visibleLength,
  warningIcon,
  type RowEntry
} from "./tui-theme.js";

/** Affiche l'ecran d'accueil TUI lance par `palabre` sans sujet. */
export function renderTuiHome(config: PalabreConfig, _configPath: string, messages: Messages, state: { mode?: TuiHomeMode; version?: string; latestVersion?: string; discovery?: ToolDiscovery } = {}): void {
  if (supportsInteractiveOutput) {
    clearScreen();
  }

  const defaults = config.defaults ?? {};
  const width = surfaceWidth();
  const mode: TuiHomeMode = state.mode ?? defaults.mode ?? "debate";
  const isChat = mode === "chat";
  const activeAgentNames = activeAgentNamesForMode(config, mode as PalabreMode);
  const agentSeparator = mode === "ask" ? ", " : " <-> ";
  const activeAgents = activeAgentNames.length > 0
    ? activeAgentNames.join(agentSeparator)
    : messages.tui.noValue;
  const activeRoles = roleLineForMode(config, mode as PalabreMode, messages);
  const summary = activeSummaryAgentForMode(config, mode as PalabreMode, activeAgentNames, messages);
  const version = state.version ?? "0.0.0";
  const updateLines = state.latestVersion
    ? [accent(messages.tui.updateAvailable(version, state.latestVersion))]
    : [];
  const separator = ` ${dim("·")} `;
  const sessionDetails = [[
    `${accent(messages.tui.session)}${separator}${isChat ? "Chat" : messages.tui.modeValue(mode as PalabreMode)}`,
    `${accent(messages.tui.availableAgentsShort)}${separator}${activeAgents}`,
    `${accent(messages.tui.roles)}${separator}${activeRoles}`
  ]];
  if (!isChat) {
    const responseCount = mode === "ask" ? activeAgentNames.length : defaults.turns ?? "?";
    sessionDetails.push([
      `${accent(messages.tui.responses)}${separator}${String(responseCount)}`,
      `${accent(messages.tui.summary)}${separator}${summary}`
    ]);
  }

  const contentWidth = width - 4;
  const sessionLines = sessionDetails.flatMap((details) => packItems(details, contentWidth, separator));
  const quickActionLines = packItems([
    `${accent(messages.tui.homeCommands)}${separator}/${separator}/help${separator}/config`,
    `${accent(messages.tui.homeGuidedSession)} /new`,
    `${accent(messages.tui.homeRecentSessions)} /history`
  ], contentWidth, separator);
  const folderLines = labeledFullValueLines(messages.tui.directory, process.cwd(), contentWidth);
  const unavailableAgents = state.discovery
    ? unavailableActiveAgentNames(config, state.discovery, activeAgentNames, isChat ? undefined : summary, messages)
    : [];
  const unavailableCommand = unavailableAgents.some((agent) => activeAgentNames.includes(agent)) ? "/agents" : "/config";
  const warningLines = unavailableAgents.length > 0
    ? [`${warningIcon("⚠")} ${muted(messages.tui.unavailableSessionAgents(unavailableAgents.join(", "), unavailableAgents.length, unavailableCommand))}`]
    : [];
  const lines = [
    "",
    ...padBlock(logoBlock(messages, `v${version}`)),
    ...padBlock(updateLines),
    "",
    ...padBlock(composerCard([
      ...sessionLines,
      "",
      ...quickActionLines,
      `${accent(messages.tui.homeContext)} ${dim("·")} --context <${messages.tui.directory.toLowerCase()}> ${dim("·")} --files <${messages.tui.historyFile.toLowerCase()}...>`,
      ...folderLines,
      ...(warningLines.length > 0 ? ["", ...warningLines] : []),
    ], width))
  ];

  process.stdout.write(lines.join("\n") + "\n");
}

/** Affiche l'état et l'action de mise à jour dans une carte Palabre dédiée. */
export function renderTuiUpdate(info: UpdateInfo, messages: Messages): void {
  if (supportsInteractiveOutput) {
    clearScreen();
  }

  const width = surfaceWidth();
  const separator = ` ${dim("·")} `;
  const versionDetails = info.channel === "source"
    ? [`${accent(messages.tui.updateSourceVersion)}${separator}${info.version}`]
    : info.latestVersion
    ? packItems([
        `${accent(messages.tui.updateInstalledVersion)}${separator}${info.version}`,
        `${accent(messages.tui.updateAvailableVersion)}${separator}${info.latestVersion}`
      ], width - 4, separator)
    : [`${accent(messages.tui.updateInstalledVersion)}${separator}${info.version}`];
  const channel = `${accent(messages.tui.updateChannel)}${separator}${messages.tui.updateChannelValue(info.channel)}`;
  const status = info.channel === "source"
    ? messages.tui.updateSourceStatus
    : info.channel === "unknown"
      ? messages.tui.updateUnknownStatus
      : !info.latestVersion
        ? messages.tui.updateCheckUnavailable
        : hasAvailableUpdate(info)
          ? messages.tui.updateAvailableStatus
          : messages.tui.updateCurrentStatus;
  const actionLines = info.steps.length > 0
    ? info.steps.map((step, index) => index === 0
      ? `${accent(messages.tui.updateAction)}${separator}${formatUpdateStep(step)}`
      : `  ${formatUpdateStep(step)}`)
    : [];
  const notes = info.channel === "source" || !info.latestVersion
    ? undefined
    : `${accent(messages.tui.updateNotes)}${separator}${terminalLink(`v${info.latestVersion}`, `https://github.com/JuReyms/Palabre/releases/tag/v${info.latestVersion}`)}`;
  process.stdout.write([
    "",
    ...padBlock([brandHeader(messages.tui.updateTitle)]),
    "",
    ...padBlock(card([
      ...versionDetails,
      channel,
      "",
      status,
      ...(actionLines.length > 0 ? ["", ...actionLines] : []),
      ...(notes ? ["", notes] : [])
    ], width, messages.tui.updateCardTitle)),
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
      bold(messages.tui.helpSectionStart),
      "",
      row("/chat", messages.tui.helpChat),
      row("/ask", messages.tui.helpAsk),
      row("/debat", messages.tui.helpDebate),
      row("/new", messages.tui.helpNew),
      "",
      bold(messages.tui.helpSectionPrepare),
      "",
      row("/agents", messages.tui.helpAgents),
      row("/roles", messages.tui.helpRoles),
      row("/config", messages.tui.helpConfig),
      row("--context <dossier>", messages.tui.helpContext),
      row("--files <fichiers>", messages.tui.helpFiles),
      "",
      bold(messages.tui.helpSectionContinue),
      "",
      row("/retry", messages.tui.helpRetry),
      row("/history", messages.tui.helpHistory),
      "",
      bold(messages.tui.helpSectionPalabre),
      "",
      row("/update", messages.tui.helpUpdate),
      row("/home", messages.tui.backCommand),
      row("/quit", messages.tui.helpQuit)
    ], width, messages.tui.helpCardTitle)),
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
      row(messages.tui.activeMode, messages.tui.modeValue(mode as PalabreMode)),
      row(messages.tui.activeAgents, activeAgents.length > 0 ? activeAgents.join(separator) : messages.tui.noValue),
      "",
      bold(messages.tui.availableAgents),
      "",
      ...agentInventoryRows(config, messages),
      "",
      dim(`${messages.tui.example}: ${messages.tui.modeLabel(mode)} > ${messages.tui.agentsPrompt} > ${exampleAgents.join(" ")}`)
    ], width, messages.tui.agentsCardTitle)),
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
    ], Math.min(width, 82), messages.tui.rolesCardTitle)),
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
        row(messages.tui.historyMode(entry.mode), sanitizeTerminalText(entry.topic)),
        row(messages.tui.activeAgents, sanitizeTerminalText(entry.agents) || messages.tui.noValue),
        ...(entry.count ? [row(messages.tui.historyCount(entry.mode), entry.count)] : []),
        row(messages.tui.historyFile, terminalLink(entry.path, compactFileName(entry.fileName, width - 24))),
        row(messages.tui.folder, terminalLink(folderPath, compactPath(folderLabel, width - 24))),
        ...(entry.date ? [row("Date", sanitizeTerminalText(entry.date))] : []),
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
    ], width, messages.tui.historyCardTitle)),
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
  const isChat = mode === "chat";
  const summary = mode === "ask"
    ? defaults.askSummaryAgent ?? defaults.summaryAgent ?? messages.tui.lastAskAgent
    : defaults.summaryAgent ?? defaults.agentB ?? messages.tui.noValue;
  const sessionEntries: RowEntry[] = isChat ? [
        [messages.tui.session, messages.tui.modeValue(mode)],
        [messages.tui.activeAgents, defaults.agentA ?? messages.tui.noValue],
        [messages.tui.roles, defaults.agentA ? roleFor(config, defaults.agentA, messages) : messages.tui.noValue]
      ] : mode === "ask"
    ? [
        [messages.tui.session, messages.tui.modeValue(mode)],
        [messages.tui.activeAgents, askAgents],
        [messages.tui.roles, askRoles],
        [messages.tui.responses, String(activeAgentNamesForMode(config, "ask").length)],
        [messages.tui.summary, summary]
      ]
    : [
        [messages.tui.session, messages.tui.modeValue(mode)],
        [messages.tui.activeAgents, debateAgents],
        [messages.tui.roles, debateRoles],
        [messages.tui.responses, String(defaults.turns ?? "?")],
        [messages.tui.summary, summary]
      ];
  const sessionBox = card(rows(sessionEntries), width, messages.tui.configSectionSession);

  const editSessionRows = [
    ...(isChat ? [
          row("/agents", messages.tui.chatAgentsUsage),
          row("/roles", messages.tui.rolesUsage)
        ] : mode === "ask"
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
    row("/mode", messages.tui.modeConfigCommand)
  ];
  const applicationRows = [
    row(messages.tui.language, config.language ?? "fr"),
    row(messages.tui.interface, defaults.interface ?? "tui"),
    "",
    row("/interface", messages.tui.interfaceUsage),
    row("/language", messages.tui.languageUsage),
    "",
    dim(messages.tui.configMoreCommands),
    "",
    ...labeledFullValueLines(messages.tui.configFile, configPath, width - 4)
  ];

  const lines = [
    "",
    ...padBlock([brandHeader(messages.tui.configTitle)]),
    "",
    ...padBlock(sessionBox),
    "",
    ...padBlock(card(editSessionRows, width, messages.tui.configSectionEdit)),
    "",
    ...padBlock(card(applicationRows, width, messages.tui.configSectionApplication)),
    ...(state.message ? ["", ...padBlock([state.message])] : [])
  ];

  process.stdout.write(lines.join("\n") + "\n");
}

/** Conserve une valeur complète et indente ses continuations sous son intitulé. */
function labeledFullValueLines(label: string, value: string, width: number): string[] {
  const prefix = `${accent(label)} ${dim("·")} `;
  const indent = " ".repeat(visibleLength(prefix));
  const chunkWidth = Math.max(12, width - visibleLength(prefix));
  const chunks: string[] = [];

  for (let offset = 0; offset < value.length; offset += chunkWidth) {
    chunks.push(value.slice(offset, offset + chunkWidth));
  }

  return chunks.length > 0
    ? chunks.map((chunk, index) => `${index === 0 ? prefix : indent}${chunk}`)
    : [prefix];
}


function activeSummaryAgentForMode(
  config: PalabreConfig,
  mode: PalabreMode,
  activeAgents: string[],
  messages: Messages
): string {
  const candidates = mode === "ask"
    ? [config.defaults?.askSummaryAgent, config.defaults?.summaryAgent, activeAgents[activeAgents.length - 1]]
    : [config.defaults?.summaryAgent, activeAgents[1]];
  return candidates.find((agent): agent is string => Boolean(
    agent && config.agents[agent] && !isRetiredAgentName(agent)
  )) ?? messages.tui.noValue;
}

function unavailableActiveAgentNames(
  config: PalabreConfig,
  discovery: ToolDiscovery,
  activeAgents: string[],
  summaryAgent: string | undefined,
  messages: Messages
): string[] {
  const requiredAgents = [...activeAgents, summaryAgent]
    .filter((agent): agent is string => Boolean(agent && config.agents[agent]))
    .filter((agent, index, agents) => agents.indexOf(agent) === index);
  const availability = new Map(
    listAgentsWithAvailability(config, discovery, messages).map((agent) => [agent.name, agent.available])
  );
  return requiredAgents.filter((agent) => availability.get(agent) === false);
}


function roleFor(config: PalabreConfig, agent: string, messages: Messages): AgentRole | string {
  return config.agents[agent]?.role ?? messages.tui.noValue;
}

function roleLineForMode(config: PalabreConfig, mode: PalabreMode, messages: Messages): string {
  const agents = activeAgentNamesForMode(config, mode);
  if (mode === "ask") {
    return agents.length > 0 ? agents.map((agent) => roleFor(config, agent, messages)).join(", ") : messages.tui.noValue;
  }

  if (mode === "chat") {
    return agents.length === 1 ? roleFor(config, agents[0]!, messages) : messages.tui.noValue;
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

  if (mode === "chat") {
    return [defaults.agentA].filter((agent): agent is string =>
      typeof agent === "string" && Boolean(config.agents[agent]) && !isRetiredAgentName(agent)
    );
  }

  return [defaults.agentA, defaults.agentB].filter((agent): agent is string =>
    typeof agent === "string" && Boolean(config.agents[agent]) && !isRetiredAgentName(agent)
  );
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
  return mode === "ask" ? available.slice(0, 3) : mode === "chat" ? available.slice(0, 1) : available.slice(0, 2);
}

function exampleRolesForMode(mode: PalabreMode, count: number): AgentRole[] {
  const roles: AgentRole[] = mode === "ask"
    ? ["critic", "implementer", "scout", "architect"]
    : mode === "chat"
      ? ["architect"]
      : ["implementer", "critic"];
  while (roles.length < count) {
    roles.push("reviewer");
  }
  return roles.slice(0, count);
}
