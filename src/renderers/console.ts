import type { AgentRole, DebateOptions, DebateRenderer } from "../types.js";

const supportsColor = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
const supportsInteractiveOutput = Boolean(process.stdout.isTTY);

export function createConsoleRenderer(plain: boolean): DebateRenderer {
  return plain ? new PlainConsoleRenderer() : new PrettyConsoleRenderer(supportsColor, supportsInteractiveOutput);
}

class PrettyConsoleRenderer implements DebateRenderer {
  private spinner?: ReturnType<typeof setInterval>;
  private spinnerFrame = 0;
  private readonly frames = ["-", "\\", "|", "/"];

  constructor(
    private readonly color: boolean,
    private readonly interactive: boolean
  ) {}

  start(options: DebateOptions): void {
    const title = "PALABRE";
    process.stdout.write([
      "",
      this.c("cyan", `┌─ ${title} ${"─".repeat(Math.max(1, 54 - title.length))}`),
      this.c("cyan", `│`) + ` Sujet: ${options.topic}`,
      this.c("cyan", `│`) + ` Agents: ${options.agentA} <-> ${options.agentB}`,
      this.c("cyan", `│`) + ` Tours: ${options.turns} | Synthese: ${options.summaryEnabled ? options.summaryAgent ?? options.agentB : "disabled"}`,
      this.c("cyan", `└${"─".repeat(57)}`),
      ""
    ].join("\n"));
  }

  warning(message: string): void {
    process.stderr.write(`${this.c("yellow", "Warning:")} ${message}\n`);
  }

  notice(message: string): void {
    process.stdout.write(`${this.c("green", "Info:")} ${message}\n`);
  }

  turnStart(turn: number, totalTurns: number, agent: string, role: AgentRole): void {
    process.stdout.write([
      "",
      this.c("blue", `◆ ${agent}`) + this.dim(` · ${role} · tour ${turn}/${totalTurns}`),
      this.dim("─".repeat(60)),
      ""
    ].join("\n"));
  }

  thinkingStart(agent: string, role: AgentRole): void {
    this.thinkingEnd();

    const text = `${agent} (${role}) reflechit`;

    if (!this.interactive) {
      process.stdout.write(`${this.dim(`${text}...`)}\n`);
      return;
    }

    const render = () => {
      const frame = this.frames[this.spinnerFrame % this.frames.length];
      this.spinnerFrame += 1;
      process.stdout.write(`\r${this.c("cyan", frame)} ${this.dim(`${text}...`)}`);
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
      process.stdout.write("\r\u001b[2K");
    }
  }

  message(content: string): void {
    process.stdout.write(`${content.trim()}\n`);
  }

  summaryStart(agent: string, role: AgentRole): void {
    process.stdout.write([
      "",
      this.c("magenta", `◆ Synthese`) + this.dim(` · ${agent} · ${role}`),
      this.dim("─".repeat(60)),
      ""
    ].join("\n"));
  }

  done(outputPath: string): void {
    process.stdout.write(`\n${this.c("green", "Debat exporte:")} ${outputPath}\n`);
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

class PlainConsoleRenderer implements DebateRenderer {
  start(_options: DebateOptions): void {}

  warning(message: string): void {
    process.stderr.write(`Warning: ${message}\n`);
  }

  notice(message: string): void {
    process.stdout.write(`Info: ${message}\n`);
  }

  turnStart(turn: number, totalTurns: number, agent: string, role: AgentRole): void {
    process.stdout.write(`\n[${turn}/${totalTurns}] ${agent} (${role})...\n`);
  }

  thinkingStart(_agent: string, _role: AgentRole): void {}

  thinkingEnd(): void {}

  message(content: string): void {
    process.stdout.write(`${content.trim()}\n`);
  }

  summaryStart(agent: string, role: AgentRole): void {
    process.stdout.write(`\n[Synthese] ${agent} (${role})...\n`);
  }

  done(outputPath: string): void {
    process.stdout.write(`\nDebat exporte: ${outputPath}\n`);
  }
}

const codes = {
  reset: "\u001b[0m",
  dim: "\u001b[2m",
  blue: "\u001b[34m",
  cyan: "\u001b[36m",
  green: "\u001b[32m",
  magenta: "\u001b[35m",
  yellow: "\u001b[33m"
};

