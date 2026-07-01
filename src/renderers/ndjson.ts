import type {
  AgentRole,
  DebateOptions,
  DebateRenderer,
  DebateStartAgentInfo,
  DebateFailure,
} from "../types.js";

/**
 * Renderer NDJSON : émet une ligne JSON par événement DebateRenderer.
 *
 * Cible : intégrations qui pilotent Palabre en out-of-process (extension
 * VS Code, plugin Obsidian, scripts shell). Le rendu humain reste
 * `PrettyConsoleRenderer` ou `PlainConsoleRenderer`.
 *
 * Contrat :
 * - une ligne = un événement JSON valide, terminé par `\n` ;
 * - tous les événements portent un champ `v` (entier) pour le versioning ;
 * - toute évolution cassante du schéma doit incrémenter `v` et documenter
 *   la migration dans AGENTS.md (section "Renderer NDJSON").
 *
 * Sortie : stdout uniquement. stderr reste libre pour les messages bas
 * niveau (Node, shell) que les consommateurs peuvent agréger comme ils
 * veulent.
 */
export class NdjsonRenderer implements DebateRenderer {
  private readonly schemaVersion = 1;
  private currentSection: "debate" | "ask" | "summary" = "debate";
  private currentTurn = 0;
  private currentAgent: string | null = null;
  private currentRole: AgentRole | null = null;

  /** Émet `start` avec le sujet, les agents, les options principales et le contexte de session. */
  start(options: DebateOptions, agents: DebateStartAgentInfo[] = []): void {
    this.emit({
      type: "start",
      mode: options.mode,
      topic: options.topic,
      turns: options.turns,
      agents: agents.map((a) => ({ name: a.name, role: a.role, type: a.type })),
      summaryEnabled: options.summaryEnabled,
      summaryAgent: options.summaryEnabled
        ? options.summaryAgent
        : null,
      earlyStop: options.earlyStopOnAgreement,
      filesCount: options.files.length,
      session: {
        startedAt: options.session.startedAt,
        localDate: options.session.localDate,
        timeZone: options.session.timeZone,
        cwd: options.session.cwd,
      },
    });
  }

  /** Émet un événement informatif. */
  notice(message: string): void {
    this.emit({ type: "notice", message });
  }

  /** Émet un avertissement. Reste sur stdout pour conserver l'ordre des événements. */
  warning(message: string): void {
    this.emit({ type: "warning", message });
  }

  /** Émet `turn-start` et bascule la section courante en débat. */
  turnStart(turn: number, totalTurns: number, agent: string, role: AgentRole): void {
    this.currentSection = "debate";
    this.currentTurn = turn;
    this.currentAgent = agent;
    this.currentRole = role;
    this.emit({ type: "turn-start", turn, totalTurns, agent, role });
  }

  askResponseStart(response: number, totalResponses: number, agent: string, role: AgentRole): void {
    this.currentSection = "ask";
    this.currentTurn = response;
    this.currentAgent = agent;
    this.currentRole = role;
    this.emit({ type: "ask-response-start", response, totalResponses, agent, role });
  }

  /**
   * Émet `thinking-start`. Les consommateurs UI peuvent l'utiliser pour un
   * indicateur "agent en cours" ; les consommateurs purement data peuvent
   * l'ignorer sans perte d'information sémantique.
   */
  thinkingStart(agent: string, role: AgentRole): void {
    this.emit({ type: "thinking-start", agent, role });
  }

  /** Émet `thinking-end`. */
  thinkingEnd(): void {
    this.emit({ type: "thinking-end" });
  }

  /**
   * Émet `message` (section débat) ou `summary-message` (section synthèse)
   * selon l'état courant. La discrimination par type permet aux
   * consommateurs de router sans maintenir d'état eux-mêmes.
   */
  message(content: string): void {
    if (this.currentSection === "summary") {
      this.emit({
        type: "summary-message",
        agent: this.currentAgent,
        role: this.currentRole,
        content,
      });
    } else if (this.currentSection === "ask") {
      this.emit({
        type: "ask-response",
        response: this.currentTurn,
        agent: this.currentAgent,
        role: this.currentRole,
        content,
      });
    } else {
      this.emit({
        type: "message",
        turn: this.currentTurn,
        agent: this.currentAgent,
        role: this.currentRole,
        content,
      });
    }
  }

  askResponseMessage(content: string): void {
    this.message(content);
  }

  /** Émet `summary-start` et bascule la section courante en synthèse. */
  summaryStart(agent: string, role: AgentRole): void {
    this.currentSection = "summary";
    this.currentAgent = agent;
    this.currentRole = role;
    this.emit({ type: "summary-start", agent, role });
  }

  /** Émet une erreur runtime structurée. */
  error(failure: DebateFailure): void {
    this.emit({ type: "error", ...failure });
  }

  /** Émet `done` avec le chemin du `.debate.md` écrit. */
  done(outputPath: string): void {
    this.emit({ type: "done", outputPath });
  }

  /** Sérialise un événement et l'écrit sur stdout, terminé par `\n`. */
  private emit(event: Record<string, unknown>): void {
    process.stdout.write(
      JSON.stringify({ v: this.schemaVersion, ...event }) + "\n",
    );
  }
}

/** Factory pratique pour conserver la symétrie avec `createConsoleRenderer`. */
export function createNdjsonRenderer(): DebateRenderer {
  return new NdjsonRenderer();
}
