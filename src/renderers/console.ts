/** @file Renderers console historiques : `PrettyConsoleRenderer` (TTY, spinner, couleurs) et `PlainConsoleRenderer` (logs bruts). */
import type { AgentRole, DebateFailure, DebateOptions, DebateRenderer, DebateStartAgentInfo } from "../types.js";
import type { Messages } from "../messages/index.js";

const supportsColor = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
const supportsInteractiveOutput = Boolean(process.stdout.isTTY);

/** Instancie le renderer adapté : pretty (spinner, couleurs ANSI, sections) ou plain (logs bruts). */
export function createConsoleRenderer(plain: boolean, messages: Messages): DebateRenderer {
  return plain ? new PlainConsoleRenderer(messages) : new PrettyConsoleRenderer(supportsColor, supportsInteractiveOutput, messages);
}

/**
 * Renderer interactif avec spinner, couleurs ANSI et encadrés de section.
 * Utilisé quand `stdout` est un TTY et que `--plain` n'est pas passé.
 */
class PrettyConsoleRenderer implements DebateRenderer {
  private spinner?: ReturnType<typeof setInterval>;
  private spinnerFrame = 0;
  private renderingSummary = false;
  private readonly frames = ["-", "\\", "|", "/"];

  /**
   * @param color - Active les codes couleur ANSI.
   * @param interactive - Active le spinner en place (mode TTY interactif).
   */
  constructor(
    private readonly color: boolean,
    private readonly interactive: boolean,
    private readonly messages: Messages
  ) {}

  /** Affiche l'en-tête du débat (sujet, agents, options). */
  start(options: DebateOptions, agents: DebateStartAgentInfo[] = []): void {
    const title = "PALABRE CLI";
    process.stdout.write([
      "",
      this.c("cyan", `┌─ ${title} ${"─".repeat(Math.max(1, 54 - title.length))}`),
      this.c("cyan", `│`) + ` ${this.messages.renderers.subject(options.topic)}`,
      this.c("cyan", `│`) + ` ${this.messages.renderers.agents(formatAgentPair(options, agents))}`,
      this.c("cyan", `│`) + ` ${this.messages.renderers.responsesSummary(formatResponseCount(options), formatSummary(options, this.messages))}`,
      this.c("cyan", `│`) + ` ${this.messages.renderers.context(formatContext(options, this.messages))}`,
      this.c("cyan", `│`) + ` ${this.messages.renderers.options(options.earlyStopOnAgreement, options.pullModels)}`,
      this.c("cyan", `└${"─".repeat(57)}`),
      ""
    ].join("\n"));
  }

  /** Écrit un avertissement sur `stderr` en jaune. */
  warning(message: string): void {
    process.stderr.write(`${this.c("yellow", this.messages.renderers.warningPrefix)} ${message}\n`);
  }

  /** Écrit une notice informative sur `stdout` en vert. */
  notice(message: string): void {
    process.stdout.write(`${this.c("green", this.messages.renderers.infoPrefix)} ${message}\n`);
  }

  /** Affiche l'en-tête d'un nouveau tour (agent, rôle, progression). */
  turnStart(turn: number, totalTurns: number, agent: string, role: AgentRole): void {
    this.renderingSummary = false;
    process.stdout.write([
      "",
      this.c("orange", `◆ ${agent}`) + this.dim(` · ${role} · ${this.messages.renderers.turn(turn, totalTurns)}`),
      this.dim("─".repeat(60)),
      ""
    ].join("\n"));
  }

  askResponseStart(response: number, totalResponses: number, agent: string, role: AgentRole): void {
    this.renderingSummary = false;
    process.stdout.write([
      "",
      this.c("orange", `◆ ${agent}`) + this.dim(` · ${role} · réponse ${response}/${totalResponses}`),
      this.dim("─".repeat(60)),
      ""
    ].join("\n"));
  }

  /** Démarre le spinner de réflexion (ou affiche une ligne fixe si non interactif). */
  thinkingStart(agent: string, role: AgentRole): void {
    this.thinkingEnd();

    const text = this.messages.renderers.thinking(agent, role);

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

  /** Arrête le spinner et efface la ligne de réflexion en mode interactif. */
  thinkingEnd(): void {
    if (this.spinner) {
      clearInterval(this.spinner);
      this.spinner = undefined;
    }

    if (this.interactive) {
      process.stdout.write("\r\u001b[2K");
    }
  }

  /** Écrit le contenu d'un message agent, avec formatage de synthèse si applicable. */
  message(content: string): void {
    const trimmed = content.trim();
    process.stdout.write(`${this.renderingSummary ? this.formatSummaryMessage(trimmed) : trimmed}\n`);
  }

  askResponseMessage(content: string): void {
    this.message(content);
  }

  /** Affiche l'en-tête de section synthèse et active le mode formatage de résumé. */
  summaryStart(agent: string, role: AgentRole): void {
    this.renderingSummary = true;
    process.stdout.write([
      "",
      this.c("pink", `◆ ${this.messages.renderers.summaryTitle}`) + this.dim(` · ${agent} · ${role}`),
      this.dim("─".repeat(60)),
      ""
    ].join("\n"));
  }

  error(failure: DebateFailure): void {
    this.thinkingEnd();
    process.stderr.write(`\n${this.c("red", this.messages.common.errorPrefix)} ${formatFailureLocation(failure, this.messages)}: ${failure.message}\n`);
  }

  /** Affiche le chemin du fichier de sortie en vert à la fin du débat. */
  done(outputPath: string): void {
    process.stdout.write(`\n\n${this.c("green", this.messages.renderers.exported(outputPath))}\n\n`);
  }

  /**
   * Convertit les titres Markdown `### Heading` en titres colorés avec séparateur.
   * @param content - Contenu texte de la synthèse.
   */
  private formatSummaryMessage(content: string): string {
    return content
      .split(/\r?\n/)
      .map((line) => {
        const heading = line.match(/^###\s+(.+)$/);
        if (!heading) return line;

        return [
          "",
          this.c("pink", heading[1] ?? line),
          this.dim("─".repeat(40))
        ].join("\n");
      })
      .join("\n")
      .trimStart();
  }

  /** Entoure `value` avec le code couleur ANSI si les couleurs sont activées. */
  private c(color: keyof typeof codes, value: string): string {
    if (!this.color) return value;
    return `${codes[color]}${value}${codes.reset}`;
  }

  /** Applique le style dim (atténué) si les couleurs sont activées. */
  private dim(value: string): string {
    if (!this.color) return value;
    return `${codes.dim}${value}${codes.reset}`;
  }
}

/**
 * Renderer minimaliste sans couleurs ni spinner.
 * Utilisé avec `--plain` ou quand `stdout` n'est pas un TTY.
 */
class PlainConsoleRenderer implements DebateRenderer {
  constructor(private readonly messages: Messages) {}

  /** Affiche les informations de démarrage du débat en texte brut. */
  start(options: DebateOptions, agents: DebateStartAgentInfo[] = []): void {
    process.stdout.write(this.messages.renderers.subject(options.topic) + "\n");
    process.stdout.write(this.messages.renderers.agents(formatAgentPair(options, agents)) + "\n");
    process.stdout.write(this.messages.renderers.responsesSummaryContext(formatResponseCount(options), formatSummary(options, this.messages), formatContext(options, this.messages)) + "\n");
  }

  /** Écrit un avertissement sur `stderr`. */
  warning(message: string): void {
    process.stderr.write(`${this.messages.renderers.warningPrefix} ${message}\n`);
  }

  /** Écrit une notice informative sur `stdout`. */
  notice(message: string): void {
    process.stdout.write(`${this.messages.renderers.infoPrefix} ${message}\n`);
  }

  /** Affiche la progression du tour en texte brut. */
  turnStart(turn: number, totalTurns: number, agent: string, role: AgentRole): void {
    process.stdout.write(`\n[${turn}/${totalTurns}] ${agent} (${role})...\n`);
  }

  askResponseStart(response: number, totalResponses: number, agent: string, role: AgentRole): void {
    process.stdout.write(`\n[${response}/${totalResponses}] ${agent} (${role})...\n`);
  }

  /** No-op : pas de spinner en mode plain. */
  thinkingStart(_agent: string, _role: AgentRole): void {}

  /** No-op : pas de spinner à arrêter en mode plain. */
  thinkingEnd(): void {}

  /** Écrit le contenu du message agent trimé. */
  message(content: string): void {
    process.stdout.write(`${content.trim()}\n`);
  }

  askResponseMessage(content: string): void {
    this.message(content);
  }

  /** Affiche l'en-tête de la section synthèse en texte brut. */
  summaryStart(agent: string, role: AgentRole): void {
    process.stdout.write(`\n[${this.messages.renderers.summaryTitle}] ${agent} (${role})...\n`);
  }

  error(failure: DebateFailure): void {
    process.stderr.write(`\n${this.messages.common.errorPrefix}: ${formatFailureLocation(failure, this.messages)}: ${failure.message}\n`);
  }

  /** Affiche le chemin du fichier de sortie à la fin du débat. */
  done(outputPath: string): void {
    process.stdout.write(`\n${this.messages.renderers.exported(outputPath)}\n`);
  }
}

/**
 * Formate la paire d'agents pour l'en-tête : utilise les infos enrichies si disponibles,
 * sinon les noms bruts des options.
 * @param options - Options du débat.
 * @param agents - Infos de démarrage des agents (type, rôle, nom).
 */
function formatAgentPair(options: DebateOptions, agents: DebateStartAgentInfo[]): string {
  if (options.mode === "ask") {
    if (agents.length > 0) {
      return agents.map(formatAgentLabel).join(", ");
    }

    return (options.askAgents ?? [options.agentA, options.agentB]).join(", ");
  }

  if (agents.length >= 2) {
    return `${formatAgentLabel(agents[0])} <-> ${formatAgentLabel(agents[1])}`;
  }

  return `${options.agentA} <-> ${options.agentB}`;
}

/**
 * Formate un agent en `nom (rôle, type)` ou `"?"` si absent.
 * @param agent - Info de démarrage de l'agent, ou `undefined`.
 */
function formatAgentLabel(agent: DebateStartAgentInfo | undefined): string {
  if (!agent) {
    return "?";
  }

  return `${agent.name} (${agent.role}, ${agent.type})`;
}

/**
 * Renvoie le nom de l'agent de synthèse ou `"désactivée"` si la synthèse est désactivée.
 * @param options - Options du débat.
 */
function formatSummary(options: DebateOptions, messages: Messages): string {
  if (!options.summaryEnabled) {
    return messages.renderers.disabled;
  }

  return options.summaryAgent;
}

function formatResponseCount(options: DebateOptions): number {
  return options.mode === "ask" ? options.askAgents?.length ?? 2 : options.turns;
}

/**
 * Renvoie un résumé du contexte injecté (nombre de fichiers ou mention d'absence).
 * @param options - Options du débat.
 */
function formatContext(options: DebateOptions, messages: Messages): string {
  const count = options.files.length;

  if (count === 0) {
    return messages.renderers.noInjectedFiles;
  }

  return messages.renderers.injectedFiles(count);
}

function formatFailureLocation(failure: DebateFailure, messages: Messages): string {
  if (failure.phase === "summary") {
    return messages.renderers.summaryTitle;
  }

  const turn = failure.turn === undefined ? "" : `, turn ${failure.turn}`;
  return `${failure.agent ?? "?"} (${failure.role ?? "?"}${turn})`;
}

/** Codes d'échappement ANSI utilisés par `PrettyConsoleRenderer`. */
const codes = {
  reset: "\u001b[0m",
  dim: "\u001b[2m",
  blue: "\u001b[34m",
  cyan: "\u001b[36m",
  green: "\u001b[32m",
  magenta: "\u001b[35m",
  red: "\u001b[31m",
  yellow: "\u001b[33m",
  orange: "\u001b[38;5;208m",
  pink: "\u001b[38;5;205m"
};
