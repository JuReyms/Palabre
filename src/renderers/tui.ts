import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import type { AgentRole, DebateFailure, DebateOptions, DebateRenderer, DebateStartAgentInfo, PalabreConfig, PalabreInterface, PalabreMode } from "../types.js";
import type { Messages } from "../messages/index.js";

const supportsColor = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
const supportsInteractiveOutput = Boolean(process.stdout.isTTY);

/** Cree le premier renderer TUI leger, sans dependance UI externe. */
export function createTuiRenderer(messages: Messages): DebateRenderer {
  return new TuiRenderer(messages, supportsColor, supportsInteractiveOutput);
}

/** Affiche l'ecran d'accueil TUI lance par `palabre` sans sujet. */
export function renderTuiHome(config: PalabreConfig, configPath: string, messages: Messages, state: { mode?: PalabreMode; version?: string } = {}): void {
  if (supportsInteractiveOutput) {
    clearScreen();
  }

  const viewport = viewportWidth();
  const width = surfaceWidth();
  const defaults = config.defaults ?? {};
  const mode = state.mode ?? defaults.mode ?? "debate";
  const debateAgents = defaults.agentA && defaults.agentB
    ? `${defaults.agentA} <-> ${defaults.agentB}`
    : "non definis";
  const askAgents = defaults.askAgents && defaults.askAgents.length > 0
    ? defaults.askAgents.join(", ")
    : debateAgents.replace(" <-> ", ", ");
  const summary = mode === "ask"
    ? defaults.askSummaryAgent ?? defaults.summaryAgent ?? "dernier agent ask"
    : defaults.summaryAgent ?? defaults.agentB ?? "agent B";
  const promptLabel = mode === "ask" ? "Mode ask > Sujet >" : "Mode debat > Sujet >";

  const lines = [
    "",
    ...centerLogo(viewport),
    ...centerBlock([dim(`v${state.version ?? "0.0.0"}`)], viewport),
    "",
    ...centerBlock(composerCard([
      muted("Pose une question, compare plusieurs agents, exporte une synthese."),
      "",
      bold("Session"),
      row("Mode actuel", accent(mode === "ask" ? "Ask" : "Debat")),
      row("Debat", debateAgents),
      row("Ask", askAgents),
      row("Reponses", String(defaults.turns ?? "?")),
      row("Synthese", summary),
      row("Interface", defaults.interface ?? "tui"),
      "",
      bold("Composer"),
      row("Invite", accent(promptLabel)),
      row("Action", "ecris ton sujet puis Entree"),
      row("/ask", "passer en mode Ask"),
      row("/debat", "passer en mode Debat"),
      row("/config", "configurer Palabre"),
      row("/new", "ouvrir l'assistant guide"),
      row("/help", "afficher les commandes TUI"),
      row("/quit", "quitter"),
      "",
      row("Config", configPath)
    ], width), viewport),
    "",
    ...centerBlock([
      `${orange("* Tip")} Utilise --context <dossier> ou --files <fichier> pour donner du contexte.`
    ], viewport)
  ];

  process.stdout.write(lines.join("\n") + "\n");
}

/** Affiche l'aide interne du composer TUI. */
export function renderTuiHelp(): void {
  const viewport = viewportWidth();
  const width = surfaceWidth();
  process.stdout.write([
    "",
    ...centerBlock(card([
      bold("Commandes TUI"),
      `${accent("/ask")}      passer en mode Ask pour collecter plusieurs reponses independantes`,
      `${accent("/debat")}    passer en mode Debat pour lancer une conversation entre deux agents`,
      `${accent("/config")}   configurer Palabre sans sortir de la TUI`,
      `${accent("/new")}      ouvrir l'assistant guide`,
      `${accent("/help")}     afficher cette aide`,
      `${accent("/quit")}     quitter la TUI`,
      "",
      dim("Tout autre texte est utilise comme demande a envoyer aux agents.")
    ], Math.min(width, 78)), viewport),
    ""
  ].join("\n"));
}

/** Affiche un composer visuel juste avant la vraie ligne readline. */
export function renderTuiComposer(mode: PalabreMode, labelPrefix = "Sujet", options: { force?: boolean } = {}): void {
  if (!options.force && !input.isTTY) {
    return;
  }

  const viewport = viewportWidth();
  const width = surfaceWidth();
  process.stdout.write([
    "",
    ...centerBlock(composerInputBox(mode, labelPrefix, width), viewport),
    ""
  ].join("\n"));
}

/** Affiche l'ecran de config natif TUI, adapte au mode courant. */
export function renderTuiConfig(config: PalabreConfig, configPath: string, mode: PalabreMode, state: { message?: string } = {}): void {
  if (supportsInteractiveOutput) {
    clearScreen();
  }

  const viewport = viewportWidth();
  const width = surfaceWidth();
  const defaults = config.defaults ?? {};
  const agents = Object.keys(config.agents).join(", ");
  const debateAgents = defaults.agentA && defaults.agentB ? `${defaults.agentA} <-> ${defaults.agentB}` : "non definis";
  const askAgents = defaults.askAgents && defaults.askAgents.length > 0
    ? defaults.askAgents.join(", ")
    : debateAgents.replace(" <-> ", ", ");
  const summary = mode === "ask"
    ? defaults.askSummaryAgent ?? defaults.summaryAgent ?? "dernier agent ask"
    : defaults.summaryAgent ?? defaults.agentB ?? "agent B";

  const modeLines = mode === "ask"
    ? [
        row("Ask", askAgents),
        row("Synthese ask", summary),
        "",
        row("/agents", "/agents codex claude opencode"),
        row("/summary", `/summary opencode  ${dim("ou")} /summary none`)
      ]
    : [
        row("Debat", debateAgents),
        row("Tours", String(defaults.turns ?? "?")),
        row("Synthese debat", summary),
        "",
        row("/agents", "/agents codex gemini"),
        row("/turns", "/turns 4"),
        row("/summary", `/summary ollama-local  ${dim("ou")} /summary none`)
      ];

  const lines = [
    "",
    ...centerBlock(card([
      `${bold("PALABRE")} ${dim("-")} ${accent("/config")} ${dim("-")} ${accent(mode === "ask" ? "Ask" : "Debat")}`,
      row("Config", configPath),
      row("Agents dispo", agents || "aucun"),
      row("Interface", defaults.interface ?? "tui"),
      "",
      ...modeLines,
      "",
      row("/default", `utiliser ${mode === "ask" ? "Ask" : "Debat"} par defaut`),
      row("/interface", `/interface tui  ${dim("ou")} /interface terminal`),
      row("/mode", "changer de mode de configuration"),
      row("/back", "revenir a l'accueil"),
      row("/quit", "quitter")
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
  | undefined;

export type TuiConfigInput =
  | { kind: "back" }
  | { kind: "quit" }
  | { kind: "mode" }
  | { kind: "default-mode" }
  | { kind: "interface"; interfaceName: PalabreInterface }
  | { kind: "agents"; agents: string[] }
  | { kind: "turns"; turns: number }
  | { kind: "summary"; agent: string | undefined }
  | { kind: "unknown"; message: string };

/** Lit une demande depuis l'accueil TUI. Retourne undefined si l'utilisateur quitte. */
export async function promptTuiHomeTopic(mode: PalabreMode = "debate"): Promise<TuiHomeInput> {
  if (!input.isTTY) {
    return undefined;
  }

  const rl = createInterface({ input, output });
  try {
    renderTuiComposer(mode);
    const answer = await rl.question(tuiPrompt(mode));
    const value = answer.trim();
    const command = value.toLowerCase();
    if (!value || command === "/quit" || command === "/q" || command === "/exit") {
      return undefined;
    }

    if (command === "/new") {
      return { kind: "new" };
    }

    if (command === "/config") {
      return { kind: "config" };
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

    if (value.startsWith("/")) {
      return { kind: "help" };
    }

    return { kind: "topic", topic: value };
  } finally {
    rl.close();
  }
}

/** Lit une commande depuis l'ecran de config TUI. */
export async function promptTuiConfigCommand(mode: PalabreMode): Promise<TuiConfigInput> {
  if (!input.isTTY) {
    return { kind: "back" };
  }

  const rl = createInterface({ input, output });
  try {
    renderTuiComposer(mode, "Config");
    const answer = await rl.question(tuiPrompt(mode, "Config"));
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

    if (command === "/agents") {
      return parts.length > 1
        ? { kind: "agents", agents: parts.slice(1) }
        : { kind: "unknown", message: "Usage: /agents <agent...>" };
    }

    if (command === "/turns") {
      const turns = Number(parts[1]);
      return Number.isInteger(turns)
        ? { kind: "turns", turns }
        : { kind: "unknown", message: "Usage: /turns <nombre>" };
    }

    if (command === "/summary") {
      const value = parts[1];
      if (!value) {
        return { kind: "unknown", message: "Usage: /summary <agent|none>" };
      }
      return { kind: "summary", agent: isNoneValue(value) ? undefined : value };
    }

    return { kind: "unknown", message: "Commande inconnue. Utilise /back pour revenir." };
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
    this.promptBlock(`${agentLabel(agent)} (${role}) - reponse ${response}/${totalResponses}`, agent);
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
      bold("Session terminee"),
      this.messages.renderers.exported(outputPath)
    ], width), viewport).join("\n")}\n\n`);
  }

  private renderSessionHeader(options: DebateOptions, agents: DebateStartAgentInfo[]): string[] {
    const viewport = viewportWidth();
    const width = this.width();
    const mode = options.mode === "ask" ? "ASK" : "DEBAT";
    const main = [
      ...card([
        `${bold("PALABRE")} ${dim("-")} ${accent(mode)}`,
        this.messages.renderers.subject(options.topic),
        this.messages.renderers.agents(formatAgents(options, agents)),
        this.messages.renderers.responsesSummary(formatResponseCount(options), formatSummary(options, this.messages)),
        this.messages.renderers.context(formatContext(options, this.messages)),
        ...formatPtyNotice(agents)
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
      bold("Plan de session"),
      dim(options.session.localDate),
      "",
      `${accent("1")} ${options.mode === "ask" ? "Collecter les reponses" : "Lancer le debat"}`,
      `${accent("2")} ${options.summaryEnabled ? "Synthese comparative" : "Synthese desactivee"}`,
      `${accent("3")} Export Markdown`
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

function formatPtyNotice(agents: DebateStartAgentInfo[]): string[] {
  const ptyAgents = agents.filter((agent) => agent.type === "cli-pty").map((agent) => agent.name);
  return ptyAgents.length > 0
    ? ["", `${orange("Note:")} ${ptyAgents.join(", ")} utilise un pseudo-terminal; une fenetre peut apparaitre brievement.`]
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

  const turn = failure.turn === undefined ? "" : `, turn ${failure.turn}`;
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

function tuiPrompt(mode: PalabreMode, labelPrefix = "Sujet"): string {
  const label = mode === "ask" ? "Mode ask" : "Mode debat";
  return `\n${surfacePadding()}${accent(label)} ${dim(">")} ${bold(labelPrefix)} ${dim(">")} `;
}

function surfacePadding(): string {
  return " ".repeat(Math.max(0, Math.floor((viewportWidth() - surfaceWidth()) / 2)));
}

function isNoneValue(value: string): boolean {
  return ["none", "aucun", "off", "non", "0", "disabled"].includes(value.toLowerCase());
}

function centerLogo(width: number): string[] {
  return [
    ...logo(),
    "",
    dim("Conversations entre agents IA")
  ].map((line) => padLeft(line, Math.max(0, Math.floor((width - visibleLength(line)) / 2))));
}

function logo(): string[] {
  return [
    "██████   █████  ██       █████  ██████  ██████  ███████",
    "██   ██ ██   ██ ██      ██   ██ ██   ██ ██   ██ ██     ",
    "██████  ███████ ██      ███████ ██████  ██████  █████  ",
    "██      ██   ██ ██      ██   ██ ██   ██ ██   ██ ██     ",
    "██      ██   ██ ███████ ██   ██ ██████  ██   ██ ███████"
  ].map((line) => supportsColor ? `${codes.violet}${line}${codes.reset}` : line);
}

function centerBlock(lines: string[], width: number): string[] {
  const blockWidth = Math.max(...lines.map(visibleLength), 0);
  const left = Math.max(0, Math.floor((width - blockWidth) / 2));
  return lines.map((line) => padLeft(line, left));
}

function card(lines: string[], width: number): string[] {
  const contentWidth = Math.max(24, width - 4);
  const body = lines.flatMap((line) => wrapLine(line, contentWidth));
  return body.map((line) => `${violet("|")} ${padRight(line, contentWidth)} ${dim("|")}`);
}

function composerCard(lines: string[], width: number): string[] {
  const contentWidth = Math.max(24, width - 4);
  const body = lines.flatMap((line) => wrapLine(line, contentWidth));
  return [
    `${violet("|")} ${" ".repeat(contentWidth)} ${dim("|")}`,
    ...body.map((line) => `${violet("|")} ${padRight(line, contentWidth)} ${dim("|")}`),
    `${violet("|")} ${" ".repeat(contentWidth)} ${dim("|")}`
  ];
}

function composerInputBox(mode: PalabreMode, labelPrefix: string, width: number): string[] {
  const label = mode === "ask" ? "Mode ask" : "Mode debat";
  const commandHint = labelPrefix === "Config"
    ? "/agents  /summary  /default  /mode  /back"
    : "/ask  /debat  /config  /new  /help  /quit";

  return composerCard([
    `${accent(label)} ${dim(">")} ${bold(labelPrefix)}`,
    dim(labelPrefix === "Config" ? "Tape une commande de configuration, puis Entree." : "Ecris ton sujet, puis Entree."),
    dim(commandHint)
  ], width);
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
  "ollama-local": [179, 176, 31],
  ollama: [179, 176, 31]
};

const codes = {
  reset: "\u001b[0m",
  bright: "\u001b[1m",
  dim: "\u001b[2m",
  violet: "\u001b[38;5;141m",
  cyan: "\u001b[36m",
  gray: "\u001b[38;5;244m",
  green: "\u001b[32m",
  magenta: "\u001b[35m",
  orange: "\u001b[38;5;214m",
  red: "\u001b[31m",
  yellow: "\u001b[33m"
};
