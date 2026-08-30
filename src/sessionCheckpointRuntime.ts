/** @file Raccord entre l'orchestrateur et le stockage atomique des checkpoints. */
import { createHash, randomUUID } from "node:crypto";
import { getConfigIdentity } from "./configTrust.js";
import { SESSION_CHECKPOINT_VERSION, sessionCheckpointPath, writeSessionCheckpoint, type SessionCheckpoint } from "./sessionCheckpoint.js";
import type { DebateFailure, DebateMessage, DebateOptions, DebateSummary, PalabreConfig, SessionCheckpointObserver } from "./types.js";

interface CheckpointCompletion {
  messages: DebateMessage[];
  summary?: DebateSummary;
  failure?: DebateFailure;
}

export interface SessionCheckpointRuntime extends SessionCheckpointObserver {
  readonly id: string;
  readonly filePath: string;
  start(): Promise<void>;
  finish(result: CheckpointCompletion): Promise<void>;
}

/** Construit le writer opt-in après résolution complète des options de session. */
export async function createSessionCheckpointRuntime(
  config: PalabreConfig,
  configPath: string,
  options: DebateOptions
): Promise<SessionCheckpointRuntime> {
  const configIdentity = await getConfigIdentity(configPath);
  const id = `${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
  const agentNames = options.mode === "ask"
    ? options.askAgents ?? [options.agentA, options.agentB]
    : [options.agentA, options.agentB];
  const agents = agentNames.map((name) => ({
    name,
    role: options.mode === "ask"
      ? options.askRole ?? config.agents[name]?.role ?? "critic"
      : name === options.agentA
        ? options.roleA ?? config.agents[name]?.role ?? "critic"
        : options.roleB ?? config.agents[name]?.role ?? "critic",
    ...(modelForAgent(options, name) ? { model: modelForAgent(options, name) } : {})
  }));
  const context = options.files.map((file) => ({ path: file.path, sha256: sha256(file.content) }));

  const base = {
    v: SESSION_CHECKPOINT_VERSION,
    id,
    createdAt: options.session.startedAt,
    mode: options.mode,
    language: options.language,
    topic: options.topic,
    agents,
    turns: options.turns,
    earlyStopOnAgreement: options.earlyStopOnAgreement,
    summaryEnabled: options.summaryEnabled,
    ...(options.summaryEnabled ? { summaryAgent: options.summaryAgent } : {}),
    ...(options.summaryModel ? { summaryModel: options.summaryModel } : {}),
    config: configIdentity,
    context
  } satisfies Omit<SessionCheckpoint, "updatedAt" | "status" | "nextPhase" | "transcript" | "summary" | "completedPhases" | "diagnostics">;

  return buildSessionCheckpointRuntime(base, options, [], options.mode, []);
}

/** Rouvre le writer d'un checkpoint validé sans changer son identité ni son état fonctionnel. */
export function createResumedSessionCheckpointRuntime(
  checkpoint: SessionCheckpoint,
  options: DebateOptions
): SessionCheckpointRuntime {
  const {
    updatedAt: _updatedAt,
    status: _status,
    nextPhase,
    transcript,
    summary: _summary,
    completedPhases,
    diagnostics: _diagnostics,
    ...base
  } = checkpoint;

  if (!nextPhase) {
    throw new Error(`Checkpoint ${checkpoint.id} has no phase to resume`);
  }

  return buildSessionCheckpointRuntime(base, options, transcript, nextPhase, completedPhases);
}

function buildSessionCheckpointRuntime(
  base: Omit<SessionCheckpoint, "updatedAt" | "status" | "nextPhase" | "transcript" | "summary" | "completedPhases" | "diagnostics">,
  options: DebateOptions,
  initialTranscript: DebateMessage[],
  initialNextPhase: NonNullable<SessionCheckpoint["nextPhase"]>,
  initialCompletedPhases: SessionCheckpoint["completedPhases"]
): SessionCheckpointRuntime {
  let transcript = [...initialTranscript];

  const persist = async (state: Pick<SessionCheckpoint, "status" | "nextPhase" | "completedPhases" | "diagnostics"> & { summary?: DebateSummary }) => {
    await writeSessionCheckpoint(options.session.cwd, {
      ...base,
      updatedAt: new Date().toISOString(),
      transcript,
      ...state
    });
  };

  return {
    id: base.id,
    filePath: sessionCheckpointPath(options.session.cwd, base.id),
    async start() {
      await persist({
        status: "running",
        nextPhase: initialNextPhase,
        completedPhases: [...initialCompletedPhases],
        diagnostics: []
      });
    },
    async response(messages, modeComplete) {
      transcript = [...messages];
      await persist({
        status: modeComplete && !options.summaryEnabled ? "completed" : "running",
        nextPhase: modeComplete ? (options.summaryEnabled ? "summary" : null) : options.mode,
        completedPhases: modeComplete ? [options.mode] : [],
        diagnostics: []
      });
    },
    async finish(result) {
      transcript = [...result.messages];
      if (result.failure) {
        const completedPhases = result.failure.phase === "summary" ? [options.mode] : [];
        await persist({
          status: result.failure.kind === "cancelled" ? "cancelled" : "failed",
          nextPhase: result.failure.phase === "summary" ? "summary" : options.mode,
          completedPhases,
          diagnostics: [{ phase: result.failure.phase, kind: result.failure.kind, message: result.failure.message }]
        });
        return;
      }
      await persist({
        status: "completed",
        nextPhase: null,
        completedPhases: [options.mode, ...(result.summary ? ["summary" as const] : [])],
        diagnostics: [],
        ...(result.summary ? { summary: result.summary } : {})
      });
    }
  };
}

function modelForAgent(options: DebateOptions, name: string): string | undefined {
  if (name === options.agentA) return options.modelA;
  if (name === options.agentB) return options.modelB;
  return undefined;
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}
