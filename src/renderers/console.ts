import type { AgentRole, DebateOptions, DebateRenderer, DebateStartAgentInfo } from "../types.js";

const supportsColor = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
const supportsInteractiveOutput = Boolean(process.stdout.isTTY);

/** Instancie le renderer adapté : pretty (spinner, couleurs ANSI, sections) ou plain (logs bruts). */
export function createConsoleRenderer(plain: boolean): DebateRenderer {
  return plain ? new PlainConsoleRenderer() : new PrettyConsoleRenderer(supportsColor, supportsInteractiveOutput);
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
    private readonly interactive: boolean
  ) {}

  /** Affiche l'en-tête du débat (sujet, agents, options). */
  start(options: DebateOptions, agents: DebateStartAgentInfo[] = []): void {
    const title = "PALABRE";
    process.stdout.write([
      "",
      this.c("cyan", `┌─ ${title} ${"─".repeat(Math.max(1, 54 - title.length))}`),
      this.c("cyan", `│`) + ` Sujet: ${options.topic}`,
      this.c("cyan", `│`) + ` Agents: ${formatAgentPair(options, agents)}`,
      this.c("cyan", `│`) + ` Réponses: ${options.turns} | Synthèse: ${formatSummary(options)}`,
      this.c("cyan", `│`) + ` Contexte: ${formatContext(options)}`,
      this.c("cyan", `│`) + ` Options: arrêt anticipé ${options.earlyStopOnAgreement ? "activé" : "désactivé"}, auto-pull Ollama ${options.pullModels ? "activé" : "désactivé"}`,
      this.c("cyan", `└${"─".repeat(57)}`),
      ""
    ].join("\n"));
  }

  /** Écrit un avertissement sur `stderr` en jaune. */
  warning(message: string): void {
    process.stderr.write(`${this.c("yellow", "Warning:")} ${message}\n`);
  }

  /** Écrit une notice informative sur `stdout` en vert. */
  notice(message: string): void {
    process.stdout.write(`${this.c("green", "Info:")} ${message}\n`);
  }

  /** Affiche l'en-tête d'un nouveau tour (agent, rôle, progression). */
  turnStart(turn: number, totalTurns: number, agent: string, role: AgentRole): void {
    this.renderingSummary = false;
    process.stdout.write([
      "",
      this.c("orange", `◆ ${agent}`) + this.dim(` · ${role} · tour ${turn}/${totalTurns}`),
      this.dim("─".repeat(60)),
      ""
    ].join("\n"));
  }

  /** Démarre le spinner de réflexion (ou affiche une ligne fixe si non interactif). */
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

  /** Affiche l'en-tête de section synthèse et active le mode formatage de résumé. */
  summaryStart(agent: string, role: AgentRole): void {
    this.renderingSummary = true;
    process.stdout.write([
      "",
      this.c("pink", `◆ Synthese`) + this.dim(` · ${agent} · ${role}`),
      this.dim("─".repeat(60)),
      ""
    ].join("\n"));
  }

  /** Affiche le chemin du fichier de sortie en vert à la fin du débat. */
  done(outputPath: string): void {
    process.stdout.write(`\n\n${this.c("green", "Debat exporte:")} ${outputPath}\n\n`);
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
  /** Affiche les informations de démarrage du débat en texte brut. */
  start(options: DebateOptions, agents: DebateStartAgentInfo[] = []): void {
    process.stdout.write(`Sujet: ${options.topic}` + "\n");
    process.stdout.write(`Agents: ${formatAgentPair(options, agents)}` + "\n");
    process.stdout.write(`Réponses: ${options.turns} | Synthèse: ${formatSummary(options)} | Contexte: ${formatContext(options)}` + "\n");
  }

  /** Écrit un avertissement sur `stderr`. */
  warning(message: string): void {
    process.stderr.write(`Warning: ${message}\n`);
  }

  /** Écrit une notice informative sur `stdout`. */
  notice(message: string): void {
    process.stdout.write(`Info: ${message}\n`);
  }

  /** Affiche la progression du tour en texte brut. */
  turnStart(turn: number, totalTurns: number, agent: string, role: AgentRole): void {
    process.stdout.write(`\n[${turn}/${totalTurns}] ${agent} (${role})...\n`);
  }

  /** No-op : pas de spinner en mode plain. */
  thinkingStart(_agent: string, _role: AgentRole): void {}

  /** No-op : pas de spinner à arrêter en mode plain. */
  thinkingEnd(): void {}

  /** Écrit le contenu du message agent trimé. */
  message(content: string): void {
    process.stdout.write(`${content.trim()}\n`);
  }

  /** Affiche l'en-tête de la section synthèse en texte brut. */
  summaryStart(agent: string, role: AgentRole): void {
    process.stdout.write(`\n[Synthese] ${agent} (${role})...\n`);
  }

  /** Affiche le chemin du fichier de sortie à la fin du débat. */
  done(outputPath: string): void {
    process.stdout.write(`\nDebat exporte: ${outputPath}\n`);
  }
}

/**
 * Formate la paire d'agents pour l'en-tête : utilise les infos enrichies si disponibles,
 * sinon les noms bruts des options.
 * @param options - Options du débat.
 * @param agents - Infos de démarrage des agents (type, rôle, nom).
 */
function formatAgentPair(options: DebateOptions, agents: DebateStartAgentInfo[]): string {
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
function formatSummary(options: DebateOptions): string {
  return options.summaryEnabled ? options.summaryAgent ?? options.agentB : "désactivée";
}

/**
 * Renvoie un résumé du contexte injecté (nombre de fichiers ou mention d'absence).
 * @param options - Options du débat.
 */
function formatContext(options: DebateOptions): string {
  const count = options.files.length;

  if (count === 0) {
    return "aucun fichier injecté";
  }

  return `${count} fichier${count > 1 ? "s" : ""} injecté${count > 1 ? "s" : ""}`;
}
/** Codes d'échappement ANSI utilisés par `PrettyConsoleRenderer`. */
const codes = {
  reset: "\u001b[0m",
  dim: "\u001b[2m",
  blue: "\u001b[34m",
  cyan: "\u001b[36m",
  green: "\u001b[32m",
  magenta: "\u001b[35m",
  yellow: "\u001b[33m",
  orange: "\u001b[38;5;208m",
  pink: "\u001b[38;5;205m"
};
