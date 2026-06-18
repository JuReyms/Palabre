import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import type { AgentRole, DebateFailure, DebateOptions, DebateRenderer, DebateStartAgentInfo, Language, PalabreConfig, PalabreInterface, PalabreMode } from "../types.js";
import type { Messages } from "../messages/index.js";

const supportsColor = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
const supportsInteractiveOutput = Boolean(process.stdout.isTTY);

/** Cree le premier renderer TUI leger, sans dependance UI externe. */
export function createTuiRenderer(messages: Messages): DebateRenderer {
  return new TuiRenderer(messages, supportsColor, supportsInteractiveOutput);
}

/** Affiche l'ecran d'accueil TUI lance par `palabre` sans sujet. */
export function renderTuiHome(config: PalabreConfig, _configPath: string, messages: Messages, state: { mode?: PalabreMode; version?: string } = {}): void {
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

  const lines = [
    "",
    ...centerLogo(viewport, messages),
    ...centerBlock([dim(`v${state.version ?? "0.0.0"}`)], viewport),
    "",
    ...centerBlock(composerCard([
      `${accent(messages.tui.modeValue(mode))} ${dim("·")} ${mode === "ask" ? askAgents : debateAgents}`,
      `${accent(messages.tui.roles)} ${dim("·")} ${mode === "ask" ? askRoles : debateRoles}`,
      `${accent(messages.tui.summary)} ${dim("·")} ${summary}${mode === "debate" ? ` ${dim("·")} ${accent(messages.tui.responses)} ${String(defaults.turns ?? "?")}` : ""}`,
      `${accent(messages.tui.folder)} ${dim("·")} ${compactPath(process.cwd(), Math.min(width - 4, viewport - 12))}`,
      `${accent(messages.tui.docs)} ${dim("·")} ${documentationUrl(config)}`,
      "",
      `${accent("/help")} ${dim(messages.tui.commands)}   ${accent("/roles")} ${dim(messages.tui.roles.toLowerCase())}   ${accent("/config")} ${dim(messages.tui.settings)}   ${accent(mode === "ask" ? "/debat" : "/ask")} ${dim(messages.tui.changeMode)}`
    ], width, "center"), viewport),
    "",
    ...centerBlock([
      dim(messages.tui.tipContext)
    ], viewport)
  ];

  process.stdout.write(lines.join("\n") + "\n");
}

/** Affiche l'aide interne du composer TUI. */
export function renderTuiHelp(messages: Messages): void {
  const viewport = viewportWidth();
  const width = surfaceWidth();
  process.stdout.write([
    "",
    ...centerBlock(card([
      bold(messages.tui.helpTitle),
      `${accent("/ask")}      ${messages.tui.helpAsk}`,
      `${accent("/debat")}    ${messages.tui.helpDebate}`,
      `${accent("/agents")}   ${messages.tui.helpAgents}`,
      `${accent("/roles")}    ${messages.tui.helpRoles}`,
      `${accent("/config")}   ${messages.tui.helpConfig}`,
      `${accent("/new")}      ${messages.tui.helpNew}`,
      `${accent("/help")}     ${messages.tui.helpHelp}`,
      `${accent("/quit")}     ${messages.tui.helpQuit}`,
      "",
      dim(messages.tui.helpFallback)
    ], Math.min(width, 78)), viewport),
    ""
  ].join("\n"));
}

/** Affiche l'aide rapide des agents configures. */
export function renderTuiAgentsHelp(config: PalabreConfig, mode: PalabreMode, messages: Messages): void {
  const viewport = viewportWidth();
  const width = surfaceWidth();
  const activeAgents = activeAgentNamesForMode(config, mode);
  const separator = mode === "ask" ? ", " : " <-> ";
  const exampleAgents = exampleAgentsForMode(config, mode);
  process.stdout.write([
    "",
    ...centerBlock(card([
      bold(messages.tui.agentsTitle),
      "",
      row(messages.tui.activeMode, messages.tui.modeValue(mode)),
      row(messages.tui.activeAgents, activeAgents.length > 0 ? activeAgents.join(separator) : messages.tui.noValue),
      "",
      bold(messages.tui.availableAgents),
      "",
      ...agentInventoryRows(config, messages),
      "",
      dim(`${messages.tui.example}: ${messages.tui.modeLabel(mode)} > ${messages.tui.agentsPrompt} > ${exampleAgents.join(" ")}`)
    ], Math.min(width, 82)), viewport),
    ""
  ].join("\n"));
}

/** Affiche l'aide rapide des roles disponibles. */
export function renderTuiRolesHelp(mode: PalabreMode, messages: Messages, config?: PalabreConfig): void {
  const viewport = viewportWidth();
  const width = surfaceWidth();
  const currentRoles = config ? roleLineForMode(config, mode, messages) : undefined;
  const activeAgents = config ? activeAgentNamesForMode(config, mode) : [];
  const expectedCount = activeAgents.length || (mode === "ask" ? 3 : 2);
  const exampleRoles = exampleRolesForMode(mode, expectedCount);
  process.stdout.write([
    "",
    ...centerBlock(card([
      bold(messages.tui.rolesTitle),
      "",
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
    ], Math.min(width, 82)), viewport),
    ""
  ].join("\n"));
}

export type TuiRolesWizardInput =
  | { kind: "roles"; roles: string[] }
  | { kind: "back" }
  | { kind: "quit" };

export type TuiAgentsWizardInput =
  | { kind: "agents"; agents: string[] }
  | { kind: "back" }
  | { kind: "quit" };

/** Assistant minimal pour modifier les agents du mode courant. */
export async function promptTuiAgentsWizard(config: PalabreConfig, mode: PalabreMode, messages: Messages): Promise<TuiAgentsWizardInput> {
  if (!input.isTTY) {
    return { kind: "back" };
  }

  renderTuiAgentsHelp(config, mode, messages);
  const rl = createInterface({ input, output });
  try {
    const result = await questionWithInterrupt(rl, tuiPrompt(mode, messages.tui.agentsPrompt, messages));
    if (result.kind === "quit") {
      return { kind: "quit" };
    }
    if (result.kind === "back") {
      return { kind: "back" };
    }
    const value = result.value.trim();
    if (!value || value === "/back") {
      return { kind: "back" };
    }
    if (value === "/quit" || value === "/q") {
      return { kind: "quit" };
    }
    return { kind: "agents", agents: value.split(/\s+/).filter(Boolean) };
  } finally {
    rl.close();
  }
}

/** Assistant minimal pour modifier les roles du mode courant. */
export async function promptTuiRolesWizard(config: PalabreConfig, mode: PalabreMode, messages: Messages): Promise<TuiRolesWizardInput> {
  if (!input.isTTY) {
    return { kind: "back" };
  }

  renderTuiRolesHelp(mode, messages, config);
  const rl = createInterface({ input, output });
  try {
    const result = await questionWithInterrupt(rl, tuiPrompt(mode, messages.tui.rolesPrompt, messages));
    if (result.kind === "quit") {
      return { kind: "quit" };
    }
    if (result.kind === "back") {
      return { kind: "back" };
    }
    const answer = result.value;
    const value = answer.trim();
    if (!value || value === "/back") {
      return { kind: "back" };
    }
    if (value === "/quit" || value === "/q") {
      return { kind: "quit" };
    }
    return { kind: "roles", roles: value.split(/\s+/).filter(Boolean) };
  } finally {
    rl.close();
  }
}

/** Affiche un composer visuel juste avant la vraie ligne readline. */
export function renderTuiComposer(mode: PalabreMode, messages: Messages, labelPrefix = messages.tui.subject, options: { force?: boolean } = {}): void {
  if (!options.force && !input.isTTY) {
    return;
  }

  const viewport = viewportWidth();
  const width = surfaceWidth();
  process.stdout.write([
    "",
    ...centerBlock(composerInputBox(mode, labelPrefix, width, messages), viewport),
    ""
  ].join("\n"));
}

/** Affiche l'ecran de config natif TUI, adapte au mode courant. */
export function renderTuiConfig(config: PalabreConfig, configPath: string, mode: PalabreMode, messages: Messages, state: { message?: string } = {}): void {
  if (supportsInteractiveOutput) {
    clearScreen();
  }

  const viewport = viewportWidth();
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

  const currentLines = mode === "ask"
    ? [
        row(messages.tui.activeAgents, askAgents),
        row(messages.tui.currentConfig, askRoles),
        row(messages.tui.summary, summary),
        "",
        bold(messages.tui.availableCommands),
        "",
        row("/agents", "/agents codex claude opencode"),
        row("/roles", "/roles architect critic scout"),
        row("/summary", `/summary opencode  ${dim(messages.tui.or)} /summary none`)
      ]
    : [
        row(messages.tui.activeAgents, debateAgents),
        row(messages.tui.currentConfig, debateRoles),
        row(messages.tui.summary, summary),
        row(messages.tui.responses, String(defaults.turns ?? "?")),
        "",
        bold(messages.tui.availableCommands),
        "",
        row("/agents", "/agents codex gemini"),
        row("/roles", "/roles implementer critic"),
        row("/turns", "/turns 4"),
        row("/summary", `/summary ollama-local  ${dim(messages.tui.or)} /summary none`)
      ];

  const lines = [
    "",
    ...centerLogo(viewport, messages),
    "",
    ...centerBlock(card([
      bold(messages.tui.configTitle),
      "",
      row(messages.tui.activeMode, messages.tui.modeValue(mode)),
      row(messages.tui.configFile, configPath),
      row(messages.tui.interface, defaults.interface ?? "tui"),
      row(messages.tui.language, config.language ?? "fr"),
      row(messages.tui.availableAgentsShort, agentInventoryLine(config, messages)),
      ...(ollamaModel ? [row(messages.tui.ollamaModel, ollamaModel)] : []),
      "",
      ...currentLines,
      "",
      row("/default", messages.tui.defaultModeCommand(mode)),
      ...(ollamaModel ? [
        row("/ollama", messages.tui.ollamaInfoCommand),
        row("/ollama-model", messages.tui.ollamaModelUsage),
        row("/ollama-sync", messages.tui.ollamaSyncCommand)
      ] : []),
      row("/interface", `/interface tui  ${dim(messages.tui.or)} /interface terminal`),
      row("/language", `/language fr  ${dim(messages.tui.or)} /language en`),
      row("/mode", messages.tui.modeConfigCommand),
      row("/back", messages.tui.backCommand),
      row("/quit", messages.tui.quitCommand)
    ], width), viewport),
    ...(state.message ? ["", ...centerBlock([state.message], viewport)] : [])
  ];

  process.stdout.write(lines.join("\n") + "\n");
}

export type TuiHomeInput =
  | { kind: "topic"; topic: string }
  | { kind: "new" }
  | { kind: "config" }
  | { kind: "mode"; mode: PalabreMode }
  | { kind: "help" }
  | { kind: "agents"; agents: string[] }
  | { kind: "roles"; roles: string[] }
  | undefined;

export type TuiConfigInput =
  | { kind: "back" }
  | { kind: "quit" }
  | { kind: "mode" }
  | { kind: "default-mode" }
  | { kind: "interface"; interfaceName: PalabreInterface }
  | { kind: "language"; language: Language }
  | { kind: "agents"; agents: string[] }
  | { kind: "roles"; roles: string[] }
  | { kind: "turns"; turns: number }
  | { kind: "summary"; agent: string | undefined }
  | { kind: "ollama-info" }
  | { kind: "ollama-model"; model: string }
  | { kind: "ollama-sync" }
  | { kind: "unknown"; message: string };

type TuiQuestionResult =
  | { kind: "answer"; value: string }
  | { kind: "back" }
  | { kind: "quit" };

let lastTuiInterruptAt = 0;
const doubleInterruptMs = 1200;

function nextInterruptKind(): "back" | "quit" {
  const now = Date.now();
  const kind = now - lastTuiInterruptAt <= doubleInterruptMs ? "quit" : "back";
  lastTuiInterruptAt = now;
  return kind;
}

function questionWithInterrupt(rl: ReturnType<typeof createInterface>, prompt: string): Promise<TuiQuestionResult> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => rl.off("SIGINT", onSigint);
    const settle = (result: TuiQuestionResult) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };
    const onSigint = () => {
      const kind = nextInterruptKind();
      rl.close();
      settle({ kind });
    };

    rl.once("SIGINT", onSigint);
    rl.question(prompt).then(
      (value) => settle({ kind: "answer", value }),
      (error) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      }
    );
  });
}

/** Lit une demande depuis l'accueil TUI. Retourne undefined si l'utilisateur quitte. */
export async function promptTuiHomeTopic(mode: PalabreMode = "debate", messages: Messages, options: { showComposer?: boolean; notice?: string } = {}): Promise<TuiHomeInput> {
  if (!input.isTTY) {
    return undefined;
  }

  const rl = createInterface({ input, output });
  try {
    const result = await questionWithInterrupt(rl, tuiPrompt(mode, messages.tui.subject, messages, options.notice));
    if (result.kind !== "answer") {
      return undefined;
    }
    const answer = result.value;
    const value = answer.trim();
    const parts = value.split(/\s+/).filter(Boolean);
    const command = parts[0]?.toLowerCase() ?? "";
    if (!value || command === "/quit" || command === "/q" || command === "/exit") {
      return undefined;
    }

    if (command === "/new") {
      return { kind: "new" };
    }

    if (command === "/config") {
      return { kind: "config" };
    }

    if (command === "/agents") {
      return { kind: "agents", agents: parts.slice(1) };
    }

    if (command === "/ask") {
      return { kind: "mode", mode: "ask" };
    }

    if (command === "/debat" || command === "/débat" || command === "/debate") {
      return { kind: "mode", mode: "debate" };
    }

    if (command === "/help" || command === "/h" || command === "/?") {
      return { kind: "help" };
    }

    if (command === "/roles" || command === "/role") {
      return { kind: "roles", roles: parts.slice(1) };
    }

    if (value.startsWith("/")) {
      return { kind: "help" };
    }

    return { kind: "topic", topic: value };
  } finally {
    rl.close();
  }
}

/** Lit une commande depuis l'ecran de config TUI. */
export async function promptTuiConfigCommand(mode: PalabreMode, messages: Messages): Promise<TuiConfigInput> {
  if (!input.isTTY) {
    return { kind: "back" };
  }

  const rl = createInterface({ input, output });
  try {
    renderTuiComposer(mode, messages, messages.tui.configPrompt);
    const result = await questionWithInterrupt(rl, tuiPrompt(mode, messages.tui.configPrompt, messages));
    if (result.kind === "quit") {
      return { kind: "quit" };
    }
    if (result.kind === "back") {
      return { kind: "back" };
    }
    const answer = result.value;
    const parts = answer.trim().split(/\s+/).filter(Boolean);
    const command = parts[0]?.toLowerCase();

    if (!command || command === "/back" || command === "/b") {
      return { kind: "back" };
    }

    if (command === "/quit" || command === "/q" || command === "/exit") {
      return { kind: "quit" };
    }

    if (command === "/mode") {
      return { kind: "mode" };
    }

    if (command === "/default") {
      return { kind: "default-mode" };
    }

    if (command === "/interface") {
      const value = parts[1];
      if (value === "tui" || value === "terminal") {
        return { kind: "interface", interfaceName: value };
      }
      return { kind: "unknown", message: "Usage: /interface <tui|terminal>" };
    }

    if (command === "/language" || command === "/langue" || command === "/lang") {
      const value = parts[1];
      if (value === "fr" || value === "en") {
        return { kind: "language", language: value };
      }
      return { kind: "unknown", message: "Usage: /language <fr|en>" };
    }

    if (command === "/agents") {
      return parts.length > 1
        ? { kind: "agents", agents: parts.slice(1) }
        : { kind: "agents", agents: [] };
    }

    if (command === "/roles" || command === "/role") {
      return { kind: "roles", roles: parts.slice(1) };
    }

    if (command === "/turns") {
      const turns = Number(parts[1]);
      return Number.isInteger(turns)
        ? { kind: "turns", turns }
        : { kind: "unknown", message: messages.tui.turnsUsage };
    }

    if (command === "/summary") {
      const value = parts[1];
      if (!value) {
        return { kind: "unknown", message: messages.tui.summaryUsage };
      }
      return { kind: "summary", agent: isNoneValue(value) ? undefined : value };
    }

    if (command === "/ollama") {
      const value = parts[1];
      return value ? { kind: "ollama-model", model: value } : { kind: "ollama-info" };
    }

    if (command === "/ollama-model") {
      const value = parts[1];
      return value ? { kind: "ollama-model", model: value } : { kind: "unknown", message: messages.tui.ollamaModelUsage };
    }

    if (command === "/model") {
      const [first, second] = parts.slice(1);
      const value = first === "ollama-local" ? second : first;
      return value ? { kind: "ollama-model", model: value } : { kind: "unknown", message: messages.tui.ollamaModelUsage };
    }

    if (command === "/ollama-sync") {
      return { kind: "ollama-sync" };
    }

    return { kind: "unknown", message: messages.tui.unknownCommand };
  } finally {
    rl.close();
  }
}

/**
 * Renderer TUI V0.
 *
 * Il ne tente pas encore de faire du scrolling controle ou des panes interactives :
 * il fournit un tableau de bord plein terminal, un statut d'agent en cours et des
 * sections lisibles tout en conservant la sortie complete dans le flux terminal.
 */
class TuiRenderer implements DebateRenderer {
  private spinner?: ReturnType<typeof setInterval>;
  private spinnerFrame = 0;
  private currentSection: "debate" | "ask" | "summary" = "debate";
  private currentAgent?: string;
  private readonly frames = ["-", "\\", "|", "/"];

  constructor(
    private readonly messages: Messages,
    private readonly color: boolean,
    private readonly interactive: boolean
  ) {}

  start(options: DebateOptions, agents: DebateStartAgentInfo[] = []): void {
    if (this.interactive) {
      clearScreen();
    }

    process.stdout.write(this.renderSessionHeader(options, agents).join("\n") + "\n");
  }

  notice(message: string): void {
    process.stdout.write(`${this.c("green", this.messages.renderers.infoPrefix)} ${message}\n`);
  }

  warning(message: string): void {
    process.stderr.write(`${this.c("yellow", this.messages.renderers.warningPrefix)} ${message}\n`);
  }

  turnStart(turn: number, totalTurns: number, agent: string, role: AgentRole): void {
    this.currentSection = "debate";
    this.currentAgent = agent;
    this.promptBlock(`${agentLabel(agent)} (${role}) - ${this.messages.renderers.turn(turn, totalTurns)}`, agent);
  }

  askResponseStart(response: number, totalResponses: number, agent: string, role: AgentRole): void {
    this.currentSection = "ask";
    this.currentAgent = agent;
    this.promptBlock(`${agentLabel(agent)} (${role}) - ${this.messages.tui.askResponse(response, totalResponses)}`, agent);
  }

  thinkingStart(agent: string, role: AgentRole): void {
    this.thinkingEnd();
    const text = this.messages.renderers.thinking(agent, role);

    if (!this.interactive) {
      process.stdout.write(`${text}...\n`);
      return;
    }

    process.stdout.write("\u001b[?25l");
    const render = () => {
      const frame = this.frames[this.spinnerFrame % this.frames.length];
      this.spinnerFrame += 1;
      process.stdout.write(`\r\u001b[2K${surfacePadding()}${agentColor(agent, frame)} ${text}...`);
    };

    render();
    this.spinner = setInterval(render, 120);
  }

  thinkingEnd(): void {
    if (this.spinner) {
      clearInterval(this.spinner);
      this.spinner = undefined;
    }

    if (this.interactive) {
      process.stdout.write("\r\u001b[2K\u001b[?25h");
    }
  }

  message(content: string): void {
    const trimmed = content.trim();
    process.stdout.write(`${this.formatMessage(this.currentSection === "summary" ? this.formatSummary(trimmed) : trimmed)}\n`);
  }

  askResponseMessage(content: string): void {
    this.message(content);
  }

  summaryStart(agent: string, role: AgentRole): void {
    this.currentSection = "summary";
    this.currentAgent = agent;
    this.promptBlock(`${this.messages.renderers.summaryTitle} - ${agent} (${role})`, agent);
  }

  error(failure: DebateFailure): void {
    this.thinkingEnd();
    process.stderr.write(`\n${this.c("red", this.messages.common.errorPrefix)} ${formatFailureLocation(failure, this.messages)}: ${failure.message}\n`);
  }

  done(outputPath: string): void {
    this.thinkingEnd();
    const viewport = viewportWidth();
    const width = this.width();
    process.stdout.write(`\n${centerBlock(card([
      bold(this.messages.tui.sessionDone),
      this.messages.renderers.exported(outputPath)
    ], width), viewport).join("\n")}\n\n`);
  }

  private renderSessionHeader(options: DebateOptions, agents: DebateStartAgentInfo[]): string[] {
    const viewport = viewportWidth();
    const width = this.width();
    const mode = messagesModeLabel(this.messages, options.mode).toUpperCase();
    const main = [
      ...card([
        `${bold("PALABRE")} ${dim("-")} ${accent(mode)}`,
        this.messages.renderers.subject(options.topic),
        this.messages.renderers.agents(formatAgents(options, agents)),
        this.messages.renderers.responsesSummary(formatResponseCount(options), formatSummary(options, this.messages)),
        this.messages.renderers.context(formatContext(options, this.messages)),
        ...formatPtyNotice(agents, this.messages)
      ], width)
    ];

    return [
      ...centerBlock(main, viewport),
      "",
      ...centerBlock(this.planPanel(options, width), viewport),
      ""
    ];
  }

  private planPanel(options: DebateOptions, width: number): string[] {
    return panel([
      bold(this.messages.tui.planTitle),
      dim(options.session.localDate),
      "",
      `${accent("1")} ${options.mode === "ask" ? this.messages.tui.planCollectAsk : this.messages.tui.planLaunchDebate}`,
      `${accent("2")} ${options.summaryEnabled ? this.messages.tui.planSummaryComparative : this.messages.tui.planSummaryDisabled}`,
      `${accent("3")} ${this.messages.tui.planExport}`
    ], width);
  }

  private promptBlock(title: string, agent?: string): void {
    const viewport = viewportWidth();
    const width = this.width();
    const underline = underlineFor(title, width, agent);
    process.stdout.write(`\n${centerBlock(card([bold(title), underline], width), viewport).join("\n")}\n`);
  }

  private formatMessage(content: string): string {
    const width = this.width();
    const contentWidth = Math.max(24, width - 4);
    const body = content
      .split(/\r?\n/)
      .flatMap((line) => line ? wrapLine(line, contentWidth) : [""]);
    return `\n${centerBlock(textSurface(body, width, this.currentAgent), viewportWidth()).join("\n")}\n`;
  }

  private formatSummary(content: string): string {
    return content
      .split(/\r?\n/)
      .map((line) => {
        const heading = line.match(/^###\s+(.+)$/);
        if (!heading) {
          return line;
        }

        return [
          "",
          this.c("magenta", heading[1] ?? line),
          this.dim("-".repeat(Math.min(48, this.width())))
        ].join("\n");
      })
      .join("\n")
      .trimStart();
  }

  private width(): number {
    return surfaceWidth();
  }

  private c(color: keyof typeof codes, value: string): string {
    if (!this.color) return value;
    return `${codes[color]}${value}${codes.reset}`;
  }

  private dim(value: string): string {
    if (!this.color) return value;
    return `${codes.dim}${value}${codes.reset}`;
  }
}

function formatAgents(options: DebateOptions, agents: DebateStartAgentInfo[]): string {
  if (options.mode === "ask") {
    return agents.length > 0
      ? agents.map(formatAgent).join(", ")
      : (options.askAgents ?? [options.agentA, options.agentB]).join(", ");
  }

  if (agents.length >= 2) {
    return `${formatAgent(agents[0])} <-> ${formatAgent(agents[1])}`;
  }

  return `${options.agentA} <-> ${options.agentB}`;
}

function formatAgent(agent: DebateStartAgentInfo | undefined): string {
  return agent ? `${agentLabel(agent.name)} (${agent.role}, ${agent.type})` : "?";
}

function formatPtyNotice(agents: DebateStartAgentInfo[], messages: Messages): string[] {
  const ptyAgents = agents.filter((agent) => agent.type === "cli-pty").map((agent) => agent.name);
  return ptyAgents.length > 0
    ? ["", orange(messages.tui.ptyNotice(ptyAgents.join(", ")))]
    : [];
}

function formatSummary(options: DebateOptions, messages: Messages): string {
  if (!options.summaryEnabled) {
    return messages.renderers.disabled;
  }

  if (options.summaryAgent) {
    return options.summaryAgent;
  }

  if (options.mode === "ask" && options.askAgents && options.askAgents.length > 0) {
    return options.askAgents[options.askAgents.length - 1] ?? options.agentB;
  }

  return options.agentB;
}

function formatResponseCount(options: DebateOptions): number {
  return options.mode === "ask" ? options.askAgents?.length ?? 2 : options.turns;
}

function formatContext(options: DebateOptions, messages: Messages): string {
  return options.files.length === 0
    ? messages.renderers.noInjectedFiles
    : messages.renderers.injectedFiles(options.files.length);
}

function formatFailureLocation(failure: DebateFailure, messages: Messages): string {
  if (failure.phase === "summary") {
    return messages.renderers.summaryTitle;
  }

  const turn = failure.turn === undefined ? "" : `, ${messages.tui.turnLabel(failure.turn)}`;
  return `${failure.agent ?? "?"} (${failure.role ?? "?"}${turn})`;
}

function stripAnsi(value: string): string {
  return value.replace(/\u001b\[[0-9;?]*[A-Za-z]/g, "");
}

function clearScreen(): void {
  process.stdout.write("\u001bc\u001b[?25h");
}

function surfaceWidth(): number {
  return Math.max(72, Math.min(viewportWidth() - 8, 96));
}

function viewportWidth(): number {
  return Math.max(72, Math.min(process.stdout.columns || 100, 180));
}

function tuiPrompt(mode: PalabreMode, labelPrefix: string, messages: Messages, notice?: string): string {
  const label = promptModeLabel(mode, messages);
  const padding = surfacePadding();
  const promptLine = `${padding}${accent(label)} ${dim(">")} ${bold(labelPrefix)} ${dim(">")} `;
  return [
    "",
    promptRuleLine(),
    ...(notice ? [
      `${padding}${accent(label)} ${dim(">")} ${bold(labelPrefix)} ${dim(">")}`,
      ...promptNoticeLines(notice),
      ""
    ] : []),
    promptLine
  ].join("\n");
}

function promptRuleLine(): string {
  return `${surfacePadding()}${violet("-".repeat(surfaceWidth()))}`;
}

function promptNoticeLines(notice: string): string[] {
  const padding = surfacePadding();
  const contentWidth = surfaceWidth();
  return [
    `${padding}${dim("-".repeat(contentWidth))}`,
    ...wrapLine(notice, contentWidth).map((line) => `${padding}${line}`)
  ];
}

function surfacePadding(): string {
  return " ".repeat(Math.max(0, Math.floor((viewportWidth() - surfaceWidth()) / 2)));
}

function promptModeLabel(mode: PalabreMode, messages: Messages): string {
  return `Mode ${messages.tui.modeValue(mode).toLowerCase()}`;
}

function messagesModeLabel(messages: Messages, mode: PalabreMode): string {
  return messages.tui.modeValue(mode);
}

function compactPath(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  const marker = "...";
  const tailLength = Math.max(12, maxLength - marker.length);
  return `${marker}${value.slice(-tailLength)}`;
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
    return agents.filter((agent) => Boolean(config.agents[agent]));
  }

  return [defaults.agentA, defaults.agentB].filter((agent): agent is string => Boolean(agent && config.agents[agent]));
}

function agentInventoryLine(config: PalabreConfig, messages: Messages): string {
  const agents = Object.keys(config.agents).sort();
  return agents.length > 0 ? agents.map(agentLabel).join(", ") : messages.tui.noValue;
}

function agentInventoryRows(config: PalabreConfig, messages: Messages): string[] {
  const entries = Object.entries(config.agents).sort(([agentA], [agentB]) => agentA.localeCompare(agentB));
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

  const available = Object.keys(config.agents).sort();
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

function isNoneValue(value: string): boolean {
  return ["none", "aucun", "off", "non", "0", "disabled"].includes(value.toLowerCase());
}

function centerLogo(width: number, messages: Messages): string[] {
  return [
    ...logo(),
    "",
    bold(messages.tui.tagline)
  ].map((line) => padLeft(line, Math.max(0, Math.floor((width - visibleLength(line)) / 2))));
}

function logo(): string[] {
  return [
    " ___  ___  _    ___  ___  ___  ___ ",
    "| _ \\| _ || |  | _ || _ )| _ \\| __|",
    "|  _/|   || |_ |   || _ \\|   /| _| ",
    "|_|  |_|_||___||_|_||___/|_|_\\|___|"
  ].map((line) => supportsColor ? `${codes.logoViolet}${line}${codes.reset}` : line);
}

function centerBlock(lines: string[], width: number): string[] {
  const blockWidth = Math.max(...lines.map(visibleLength), 0);
  const left = Math.max(0, Math.floor((width - blockWidth) / 2));
  return lines.map((line) => padLeft(line, left));
}

function card(lines: string[], width: number): string[] {
  const contentWidth = Math.max(24, width - 4);
  const body = lines.flatMap((line) => wrapLine(line, contentWidth));
  return body.map((line) => `${dim("|")} ${padRight(line, contentWidth)} ${dim("|")}`);
}

function composerCard(lines: string[], width: number, align: "left" | "center" = "left"): string[] {
  const contentWidth = Math.max(24, width - 4);
  const body = lines.flatMap((line) => wrapLine(line, contentWidth));
  return [
    `${dim("|")} ${" ".repeat(contentWidth)} ${dim("|")}`,
    ...body.map((line) => `${dim("|")} ${padRight(align === "center" ? centerLine(line, contentWidth) : line, contentWidth)} ${dim("|")}`),
    `${dim("|")} ${" ".repeat(contentWidth)} ${dim("|")}`
  ];
}

function centerLine(line: string, width: number): string {
  const left = Math.max(0, Math.floor((width - visibleLength(line)) / 2));
  return `${" ".repeat(left)}${line}`;
}

function composerInputBox(mode: PalabreMode, labelPrefix: string, width: number, messages: Messages): string[] {
  const label = promptModeLabel(mode, messages);
  return composerCard([
    `${accent(label)} ${dim(">")} ${bold(labelPrefix)} ${dim(">")}`
  ], width, "center");
}

function panel(lines: string[], width: number): string[] {
  const contentWidth = Math.max(18, width - 4);
  const body = lines.flatMap((line) => wrapLine(line, contentWidth));
  return [
    `${dim("+")}${dim("-".repeat(contentWidth + 2))}${dim("+")}`,
    ...body.map((line) => `${dim("|")} ${padRight(line, contentWidth)} ${dim("|")}`),
    `${dim("+")}${dim("-".repeat(contentWidth + 2))}${dim("+")}`
  ];
}

function textSurface(lines: string[], width: number, agent?: string): string[] {
  const contentWidth = Math.max(24, width - 4);
  const body = lines.length > 0 ? lines : [""];
  const border = agent ? (value: string) => agentColor(agent, value) : violet;
  return [
    `${border("|")} ${" ".repeat(contentWidth)} ${border("|")}`,
    ...body.map((line) => `${border("|")} ${padRight(line, contentWidth)} ${border("|")}`),
    `${border("|")} ${" ".repeat(contentWidth)} ${border("|")}`
  ];
}

function underlineFor(title: string, width: number, agent?: string): string {
  const length = Math.max(8, Math.min(48, visibleLength(title), width - 4));
  const line = "-".repeat(length);
  return agent ? agentColor(agent, line) : accent(line);
}

function row(label: string, value: string): string {
  return `${bold(label.padEnd(16))} ${value}`;
}

function wrapLine(value: string, width: number): string[] {
  const clean = value.replace(/\r?\n/g, " ");
  if (visibleLength(clean) <= width) {
    return [clean];
  }

  const words = clean.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (visibleLength(next) <= width) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);
  return lines;
}

function padLeft(value: string, width: number): string {
  return `${" ".repeat(width)}${value}`;
}

function padRight(value: string, width: number): string {
  const missing = Math.max(0, width - visibleLength(value));
  return `${value}${" ".repeat(missing)}`;
}

function visibleLength(value: string): number {
  return stripAnsi(value).length;
}

function bold(value: string): string {
  return supportsColor ? `${codes.bright}${value}${codes.reset}` : value;
}

function dim(value: string): string {
  return supportsColor ? `${codes.dim}${value}${codes.reset}` : value;
}

function accent(value: string): string {
  return supportsColor ? `${codes.violet}${value}${codes.reset}` : value;
}

function violet(value: string): string {
  return supportsColor ? `${codes.violet}${value}${codes.reset}` : value;
}

function orange(value: string): string {
  return supportsColor ? `${codes.orange}${value}${codes.reset}` : value;
}

function muted(value: string): string {
  return supportsColor ? `${codes.gray}${value}${codes.reset}` : value;
}

function agentLabel(agent: string): string {
  return supportsColor ? `${agentAnsi(agent)}${agent}${codes.reset}` : agent;
}

function agentColor(agent: string, value: string): string {
  return supportsColor ? `${agentAnsi(agent)}${value}${codes.reset}` : value;
}

function agentAnsi(agent: string): string {
  const normalized = agent.toLowerCase();
  const color = agentColors[normalized] ?? hashedAgentColor(normalized);
  return `\u001b[38;2;${color[0]};${color[1]};${color[2]}m`;
}

function hashedAgentColor(agent: string): [number, number, number] {
  let hash = 0;
  for (let index = 0; index < agent.length; index += 1) {
    hash = (hash * 31 + agent.charCodeAt(index)) | 0;
  }

  const hue = Math.abs(hash) % 360;
  return hslToRgb(hue, 55, 55);
}

function hslToRgb(hue: number, saturation: number, lightness: number): [number, number, number] {
  const s = saturation / 100;
  const l = lightness / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((hue / 60) % 2 - 1));
  const m = l - c / 2;
  const [r, g, b] = hue < 60 ? [c, x, 0]
    : hue < 120 ? [x, c, 0]
      : hue < 180 ? [0, c, x]
        : hue < 240 ? [0, x, c]
          : hue < 300 ? [x, 0, c]
            : [c, 0, x];

  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255)
  ];
}

const agentColors: Record<string, [number, number, number]> = {
  antigravity: [76, 141, 255],
  claude: [222, 115, 86],
  gemini: [71, 150, 227],
  codex: [136, 82, 197],
  opencode: [80, 168, 103],
  vibe: [234, 92, 126],
  "ollama-local": [179, 176, 31],
  ollama: [179, 176, 31]
};

const codes = {
  reset: "\u001b[0m",
  bright: "\u001b[1m",
  dim: "\u001b[2m",
  logoViolet: "\u001b[38;2;167;139;250m",
  violet: "\u001b[38;5;141m",
  cyan: "\u001b[36m",
  gray: "\u001b[38;5;244m",
  green: "\u001b[32m",
  magenta: "\u001b[35m",
  orange: "\u001b[38;5;214m",
  red: "\u001b[31m",
  yellow: "\u001b[33m"
};
