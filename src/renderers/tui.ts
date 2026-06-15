import type { AgentRole, DebateFailure, DebateOptions, DebateRenderer, DebateStartAgentInfo } from "../types.js";
import type { Messages } from "../messages/index.js";

const supportsColor = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
const supportsInteractiveOutput = Boolean(process.stdout.isTTY);

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
  private readonly frames = ["-", "\\", "|", "/"];

  constructor(
    private readonly messages: Messages,
    private readonly color: boolean,
    private readonly interactive: boolean
  ) {}

  start(options: DebateOptions, agents: DebateStartAgentInfo[] = []): void {
    if (this.interactive) {
      process.stdout.write("\u001b[2J\u001b[H");
    }

    const width = this.width();
    const title = options.mode === "ask" ? "PALABRE TUI - ASK" : "PALABRE TUI - DEBAT";
    const lines = [
      this.bar(width),
      this.center(title, width),
      this.bar(width),
      this.row(this.messages.renderers.subject(options.topic), width),
      this.row(this.messages.renderers.agents(formatAgents(options, agents)), width),
      this.row(this.messages.renderers.responsesSummary(formatResponseCount(options), formatSummary(options, this.messages)), width),
      this.row(this.messages.renderers.context(formatContext(options, this.messages)), width),
      this.row(this.messages.renderers.options(options.earlyStopOnAgreement, options.pullModels), width),
      this.bar(width),
      ""
    ];

    process.stdout.write(lines.join("\n"));
  }

  notice(message: string): void {
    process.stdout.write(`${this.c("green", this.messages.renderers.infoPrefix)} ${message}\n`);
  }

  warning(message: string): void {
    process.stderr.write(`${this.c("yellow", this.messages.renderers.warningPrefix)} ${message}\n`);
  }

  turnStart(turn: number, totalTurns: number, agent: string, role: AgentRole): void {
    this.currentSection = "debate";
    this.section(`${agent} (${role}) - ${this.messages.renderers.turn(turn, totalTurns)}`);
  }

  askResponseStart(response: number, totalResponses: number, agent: string, role: AgentRole): void {
    this.currentSection = "ask";
    this.section(`${agent} (${role}) - reponse ${response}/${totalResponses}`);
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
      process.stdout.write(`\r${this.c("cyan", frame)} ${text}...`);
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
    process.stdout.write(`${this.currentSection === "summary" ? this.formatSummary(trimmed) : trimmed}\n`);
  }

  askResponseMessage(content: string): void {
    this.message(content);
  }

  summaryStart(agent: string, role: AgentRole): void {
    this.currentSection = "summary";
    this.section(`${this.messages.renderers.summaryTitle} - ${agent} (${role})`);
  }

  error(failure: DebateFailure): void {
    this.thinkingEnd();
    process.stderr.write(`\n${this.c("red", this.messages.common.errorPrefix)} ${formatFailureLocation(failure, this.messages)}: ${failure.message}\n`);
  }

  done(outputPath: string): void {
    this.thinkingEnd();
    this.section(this.messages.renderers.exported(outputPath));
    process.stdout.write("\n");
  }

  private section(title: string): void {
    const width = this.width();
    process.stdout.write([
      "",
      this.c("cyan", this.bar(width)),
      this.c("cyan", this.row(title, width)),
      this.c("cyan", this.bar(width)),
      ""
    ].join("\n"));
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
    return Math.max(52, Math.min(process.stdout.columns || 80, 100));
  }

  private bar(width: number): string {
    return `+${"-".repeat(width - 2)}+`;
  }

  private row(value: string, width: number): string {
    const contentWidth = width - 4;
    const clean = stripAnsi(value).replace(/\s+/g, " ").trim();
    const clipped = clean.length > contentWidth ? `${clean.slice(0, Math.max(0, contentWidth - 1))}.` : clean;
    return `| ${clipped.padEnd(contentWidth)} |`;
  }

  private center(value: string, width: number): string {
    const contentWidth = width - 4;
    const clean = stripAnsi(value).trim();
    const left = Math.max(0, Math.floor((contentWidth - clean.length) / 2));
    const right = Math.max(0, contentWidth - clean.length - left);
    return `| ${" ".repeat(left)}${clean}${" ".repeat(right)} |`;
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
  return agent ? `${agent.name} (${agent.role}, ${agent.type})` : "?";
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

const codes = {
  reset: "\u001b[0m",
  dim: "\u001b[2m",
  cyan: "\u001b[36m",
  green: "\u001b[32m",
  magenta: "\u001b[35m",
  red: "\u001b[31m",
  yellow: "\u001b[33m"
};
