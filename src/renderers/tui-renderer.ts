/**
 * @file Renderer TUI des événements de débat/ask : en-tête de session, statut
 * "agent en cours" avec spinner, messages encadrés à la couleur de l'agent,
 * synthèse structurée et panneau de fin avec liens vers l'export.
 */
import path from "node:path";
import { sanitizeTerminalText } from "../adapters/terminal.js";
import type { AdapterFailureKind, AgentRole, DebateFailure, DebateOptions, DebateRenderer, DebateStartAgentInfo, PalabreMode } from "../types.js";
import type { Messages } from "../messages/index.js";
import {
  accent,
  accentBar,
  agentColor,
  agentLabel,
  bold,
  brandHeader,
  card,
  clearScreen,
  codes,
  compactFileName,
  compactPath,
  danger,
  dim,
  glyphs,
  padBlock,
  panel,
  row,
  success,
  supportsColor,
  supportsInteractiveOutput,
  surfacePadding,
  surfaceWidth,
  terminalLink,
  underlineFor,
  warning
} from "./tui-theme.js";

/** Cree le premier renderer TUI leger, sans dependance UI externe. */
export function createTuiRenderer(messages: Messages): DebateRenderer {
  return new TuiRenderer(messages, supportsColor, supportsInteractiveOutput);
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
  private sessionMode: PalabreMode = "debate";
  /** Titre du tour en attente, rendu en tête du prochain bloc `message`. */
  private pendingHeader?: string;

  constructor(
    private readonly messages: Messages,
    private readonly color: boolean,
    private readonly interactive: boolean
  ) {}

  start(options: DebateOptions, agents: DebateStartAgentInfo[] = []): void {
    this.sessionMode = options.mode;
    if (this.interactive) {
      clearScreen();
    }

    process.stdout.write(this.renderSessionHeader(options, agents).join("\n") + "\n");
  }

  notice(message: string): void {
    const width = this.width();
    process.stdout.write(`\n${padBlock(card([
      `${success(this.messages.renderers.infoPrefix)} ${sanitizeTerminalText(message)}`
    ], width)).join("\n")}\n`);
  }

  warning(message: string): void {
    process.stderr.write(`${warning(this.messages.renderers.warningPrefix)} ${sanitizeTerminalText(message)}\n`);
  }

  turnStart(turn: number, totalTurns: number, agent: string, role: AgentRole): void {
    this.currentSection = "debate";
    this.currentAgent = sanitizeTerminalText(agent);
    this.pendingHeader = `${agentLabel(agent)} (${role}) - ${this.messages.renderers.turn(turn, totalTurns)}`;
  }

  askResponseStart(response: number, totalResponses: number, agent: string, role: AgentRole): void {
    this.currentSection = "ask";
    this.currentAgent = sanitizeTerminalText(agent);
    this.pendingHeader = `${agentLabel(agent)} (${role}) - ${this.messages.tui.askResponse(response, totalResponses)}`;
  }

  thinkingStart(agent: string, role: AgentRole): void {
    this.thinkingEnd();
    const safeAgent = sanitizeTerminalText(agent);
    const text = this.messages.renderers.thinking(safeAgent, role);

    if (!this.interactive) {
      process.stdout.write(`${text}...\n`);
      return;
    }

    process.stdout.write("\u001b[?25l");
    const frames = glyphs().spinner;
    const render = () => {
      const frame = frames[this.spinnerFrame % frames.length];
      this.spinnerFrame += 1;
      process.stdout.write(`\r\u001b[2K${surfacePadding()}${agentColor(safeAgent, frame)} ${text}...`);
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
    const trimmed = sanitizeTerminalText(content).trim();
    process.stdout.write(`${this.formatMessage(this.currentSection === "summary" ? this.formatSummary(trimmed) : trimmed)}\n`);
  }

  askResponseMessage(content: string): void {
    this.message(content);
  }

  summaryStart(agent: string, role: AgentRole): void {
    this.currentSection = "summary";
    this.currentAgent = sanitizeTerminalText(agent);
    this.pendingHeader = `${this.messages.renderers.summaryTitle} - ${agentLabel(agent)} (${role})`;
  }

  error(failure: DebateFailure): void {
    this.thinkingEnd();
    const width = this.width();
    const hint = this.messages.adapterErrors.hint(failure.kind as AdapterFailureKind);
    process.stderr.write(`\n${padBlock(card([
      danger(`${glyphs().cross} ${this.messages.common.errorPrefix}`),
      `${formatFailureLocation(failure, this.messages)}: ${sanitizeTerminalText(failure.message)}`,
      ...(hint ? ["", dim(`${this.messages.adapterErrors.suggestionPrefix}: ${hint}`)] : [])
    ], width)).join("\n")}\n`);
  }

  done(outputPath: string): void {
    this.thinkingEnd();
    const width = this.width();
    const folderPath = path.dirname(outputPath);
    const fileName = path.basename(outputPath);
    const modeCommand = this.sessionMode === "ask" ? "/debat" : "/ask";
    process.stdout.write(`\n${padBlock(panel([
      `${success(glyphs().check)} ${bold(this.messages.tui.sessionDone)}`,
      "",
      row(this.messages.tui.exportedFile, terminalLink(outputPath, compactFileName(fileName, width - 24))),
      row(this.messages.tui.exportedFolder, terminalLink(folderPath, compactPath(folderPath, width - 24))),
      "",
      `${accent("/retry")} ${dim(this.messages.tui.helpRetry)}   ${accent("/new")} ${dim(this.messages.tui.helpNew)}   ${accent(modeCommand)} ${dim(this.messages.tui.changeMode)}`,
      `${accent("/history")} ${dim(this.messages.tui.helpHistory)}   ${accent("/config")} ${dim(this.messages.tui.helpConfig)}   ${accent("/help")} ${dim(this.messages.tui.helpHelp)}`
    ], width)).join("\n")}\n\n`);
  }

  private renderSessionHeader(options: DebateOptions, agents: DebateStartAgentInfo[]): string[] {
    const width = this.width();
    const mode = messagesModeLabel(this.messages, options.mode).toUpperCase();
    const main = panel([
      accent(mode),
      this.messages.renderers.subject(sanitizeTerminalText(options.topic)),
      this.messages.renderers.agents(formatAgents(options, agents)),
      formatSessionProgress(options, this.messages),
      this.messages.renderers.context(formatContext(options, this.messages)),
      this.messages.renderers.workingFolder(compactPath(sanitizeTerminalText(options.session.cwd), Math.max(24, width - 14)))
    ], width);

    return [
      "",
      ...padBlock([brandHeader()]),
      "",
      ...padBlock(main),
      ""
    ];
  }

  /**
   * Bloc de message unique : en-tête du tour (titre souligné) et contenu dans le même
   * bloc, délimité par la seule barre latérale gauche à la couleur de l'agent.
   */
  private formatMessage(content: string): string {
    const width = this.width();
    const header = this.pendingHeader
      ? [bold(this.pendingHeader), underlineFor(this.pendingHeader, width, this.currentAgent), ""]
      : [];
    this.pendingHeader = undefined;
    const body = content.split(/\r?\n/);
    return `\n${padBlock(accentBar([...header, ...body], width, this.currentAgent)).join("\n")}\n`;
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
      : (options.askAgents ?? [options.agentA, options.agentB]).map(sanitizeTerminalText).join(", ");
  }

  if (agents.length >= 2) {
    return `${formatAgent(agents[0])} <-> ${formatAgent(agents[1])}`;
  }

  return `${sanitizeTerminalText(options.agentA)} <-> ${sanitizeTerminalText(options.agentB)}`;
}

function formatAgent(agent: DebateStartAgentInfo | undefined): string {
  return agent ? `${agentLabel(agent.name)} (${agent.role})` : "?";
}

function formatSummary(options: DebateOptions, messages: Messages): string {
  if (!options.summaryEnabled) {
    return messages.renderers.disabled;
  }

  return sanitizeTerminalText(options.summaryAgent);
}

function formatResponseCount(options: DebateOptions): number {
  return options.mode === "ask" ? options.askAgents?.length ?? 2 : options.turns;
}

function formatSessionProgress(options: DebateOptions, messages: Messages): string {
  return `${messages.tui.historyCount(options.mode)}: ${formatResponseCount(options)} | ${messages.tui.summary}: ${formatSummary(options, messages)}`;
}

function formatContext(options: DebateOptions, messages: Messages): string {
  return options.files.length === 0
    ? messages.renderers.noInjectedFiles
    : messages.renderers.injectedFiles(options.files.length, options.files.map((file) => sanitizeTerminalText(file.path)));
}

function formatFailureLocation(failure: DebateFailure, messages: Messages): string {
  if (failure.phase === "summary") {
    return messages.renderers.summaryTitle;
  }

  const turn = failure.turn === undefined ? "" : `, ${messages.tui.turnLabel(failure.turn)}`;
  return `${sanitizeTerminalText(failure.agent ?? "?")} (${failure.role ?? "?"}${turn})`;
}

function messagesModeLabel(messages: Messages, mode: PalabreMode): string {
  return messages.tui.modeValue(mode);
}
