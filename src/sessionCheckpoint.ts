/** @file Contrat versionné et stockage atomique des checkpoints de session. */
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AgentRole, DebateMessage, DebateSummary, Language, OrchestrationMode } from "./types.js";

export const SESSION_CHECKPOINT_VERSION = 1 as const;

export type SessionCheckpointStatus = "running" | "failed" | "cancelled" | "completed";
export type SessionCheckpointPhase = OrchestrationMode | "summary";

export interface SessionCheckpointAgent {
  name: string;
  role: AgentRole;
  model?: string;
}

/** Référence vérifiable à la configuration approuvée au démarrage de la session. */
export interface SessionCheckpointConfig {
  path: string;
  sha256: string;
}

/** Référence à un fichier de contexte, sans en persister le contenu. */
export interface SessionCheckpointContext {
  path: string;
  sha256: string;
}

/** Diagnostic stable, sans sortie brute de processus ni donnée secrète. */
export interface SessionCheckpointDiagnostic {
  phase: SessionCheckpointPhase;
  kind: string;
  message: string;
}

/** État machine minimal d'une session Débat ou Ask, prêt à être repris plus tard. */
export interface SessionCheckpoint {
  v: typeof SESSION_CHECKPOINT_VERSION;
  id: string;
  createdAt: string;
  updatedAt: string;
  status: SessionCheckpointStatus;
  nextPhase: SessionCheckpointPhase | null;
  mode: OrchestrationMode;
  language: Language;
  topic: string;
  agents: SessionCheckpointAgent[];
  turns: number;
  summaryEnabled: boolean;
  summaryAgent?: string;
  summaryModel?: string;
  config: SessionCheckpointConfig;
  context: SessionCheckpointContext[];
  transcript: DebateMessage[];
  summary?: DebateSummary;
  completedPhases: SessionCheckpointPhase[];
  diagnostics: SessionCheckpointDiagnostic[];
}

/** Erreur de checkpoint exploitable par la future commande `palabre resume`. */
export class SessionCheckpointError extends Error {
  constructor(
    readonly kind: "invalid-checkpoint" | "unsupported-version",
    message: string
  ) {
    super(message);
    this.name = "SessionCheckpointError";
  }
}

/** Dossier de checkpoints appartenant au workspace, distinct des exports Markdown. */
export function sessionCheckpointDirectory(workspace: string): string {
  return path.resolve(workspace, ".palabre", "sessions");
}

/** Chemin déterministe d'un checkpoint, après validation de son identifiant. */
export function sessionCheckpointPath(workspace: string, id: string): string {
  assertSessionId(id);
  return path.join(sessionCheckpointDirectory(workspace), `${id}.json`);
}

/**
 * Écrit un checkpoint complet de façon atomique : fichier temporaire dans le même
 * dossier, puis renommage. Une interruption ne doit donc jamais remplacer le
 * dernier JSON valide par un contenu partiel.
 */
export async function writeSessionCheckpoint(workspace: string, checkpoint: SessionCheckpoint): Promise<string> {
  const normalized = normalizeCheckpoint(checkpoint);
  const target = sessionCheckpointPath(workspace, normalized.id);
  const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;

  await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
  try {
    await writeFile(temporary, `${JSON.stringify(normalized, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600
    });
    await rename(temporary, target);
  } finally {
    await rm(temporary, { force: true }).catch(() => undefined);
  }

  return target;
}

/** Lit et valide un checkpoint ; aucune reprise ne devra consommer un JSON approximatif. */
export async function readSessionCheckpoint(workspace: string, id: string): Promise<SessionCheckpoint> {
  const filePath = sessionCheckpointPath(workspace, id);
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new SessionCheckpointError("invalid-checkpoint", `Checkpoint invalid: ${filePath}`);
    }
    throw error;
  }
  return normalizeCheckpoint(parsed);
}

/** Valide et reconstruit le schéma connu, en ignorant toute propriété non contractuelle. */
export function parseSessionCheckpoint(value: unknown): SessionCheckpoint {
  return normalizeCheckpoint(value);
}

function normalizeCheckpoint(value: unknown): SessionCheckpoint {
  const record = asRecord(value, "Checkpoint must be an object");
  if (record.v !== SESSION_CHECKPOINT_VERSION) {
    throw new SessionCheckpointError(
      record.v === undefined ? "invalid-checkpoint" : "unsupported-version",
      `Unsupported checkpoint version: ${String(record.v)}`
    );
  }

  const mode = asMode(record.mode);
  const status = asStatus(record.status);
  const nextPhase = record.nextPhase === null ? null : asPhase(record.nextPhase, mode);
  if (status === "completed" ? nextPhase !== null : nextPhase === null) {
    throw invalid("Completed checkpoints must not have a next phase; unfinished checkpoints must have one");
  }

  const agents = asArray(record.agents, "agents").map(asAgent);
  const minimumAgents = mode === "debate" ? 2 : 1;
  if (agents.length < minimumAgents) {
    throw invalid(`${mode} checkpoints require at least ${minimumAgents} agent${minimumAgents === 1 ? "" : "s"}`);
  }

  const summaryEnabled = asBoolean(record.summaryEnabled, "summaryEnabled");
  const summaryAgent = record.summaryAgent === undefined ? undefined : asText(record.summaryAgent, "summaryAgent");
  const summaryModel = record.summaryModel === undefined ? undefined : asText(record.summaryModel, "summaryModel");
  if (summaryEnabled && !summaryAgent) {
    throw invalid("summaryAgent is required when summaryEnabled is true");
  }
  if (!summaryEnabled && (nextPhase === "summary" || asArray(record.completedPhases, "completedPhases").includes("summary"))) {
    throw invalid("summary phase requires summaryEnabled to be true");
  }

  const completedPhases = asArray(record.completedPhases, "completedPhases")
    .map((phase) => asPhase(phase, mode));
  if (new Set(completedPhases).size !== completedPhases.length) {
    throw invalid("completedPhases must not contain duplicates");
  }
  const summary = record.summary === undefined ? undefined : asSummary(record.summary);
  if (completedPhases.includes("summary") !== Boolean(summary)) {
    throw invalid("A completed summary phase must include its summary, and vice versa");
  }

  return {
    v: SESSION_CHECKPOINT_VERSION,
    id: asSessionId(record.id),
    createdAt: asDate(record.createdAt, "createdAt"),
    updatedAt: asDate(record.updatedAt, "updatedAt"),
    status,
    nextPhase,
    mode,
    language: asLanguage(record.language),
    topic: asText(record.topic, "topic"),
    agents,
    turns: asPositiveInteger(record.turns, "turns"),
    summaryEnabled,
    ...(summaryAgent === undefined ? {} : { summaryAgent }),
    ...(summaryModel === undefined ? {} : { summaryModel }),
    config: asConfig(record.config),
    context: asArray(record.context, "context").map(asContext),
    transcript: asArray(record.transcript, "transcript").map(asTranscriptMessage),
    ...(summary === undefined ? {} : { summary }),
    completedPhases,
    diagnostics: asArray(record.diagnostics, "diagnostics").map((diagnostic) => asDiagnostic(diagnostic, mode))
  };
}

function asSummary(value: unknown): DebateSummary {
  const record = asRecord(value, "summary must be an object");
  return {
    agent: asText(record.agent, "summary.agent"),
    role: asAgentRole(record.role, "summary.role"),
    content: asText(record.content, "summary.content"),
    createdAt: asDate(record.createdAt, "summary.createdAt")
  };
}

function asAgent(value: unknown): SessionCheckpointAgent {
  const record = asRecord(value, "agent must be an object");
  return {
    name: asText(record.name, "agent.name"),
    role: asAgentRole(record.role, "agent.role"),
    ...(record.model === undefined ? {} : { model: asText(record.model, "agent.model") })
  };
}

function asConfig(value: unknown): SessionCheckpointConfig {
  const record = asRecord(value, "config must be an object");
  return {
    path: asText(record.path, "config.path"),
    sha256: asSha256(record.sha256, "config.sha256")
  };
}

function asContext(value: unknown): SessionCheckpointContext {
  const record = asRecord(value, "context entry must be an object");
  return {
    path: asText(record.path, "context.path"),
    sha256: asSha256(record.sha256, "context.sha256")
  };
}

function asTranscriptMessage(value: unknown): DebateMessage {
  const record = asRecord(value, "transcript message must be an object");
  return {
    agent: asText(record.agent, "transcript.agent"),
    role: asAgentRole(record.role, "transcript.role"),
    content: asText(record.content, "transcript.content"),
    createdAt: asDate(record.createdAt, "transcript.createdAt")
  };
}

function asDiagnostic(value: unknown, mode: OrchestrationMode): SessionCheckpointDiagnostic {
  const record = asRecord(value, "diagnostic must be an object");
  return {
    phase: asPhase(record.phase, mode),
    kind: asText(record.kind, "diagnostic.kind"),
    message: asText(record.message, "diagnostic.message")
  };
}

function asPhase(value: unknown, mode: OrchestrationMode): SessionCheckpointPhase {
  if (value === mode) {
    return mode;
  }
  if (value === "summary") {
    return "summary";
  }
  throw invalid(`Invalid phase for ${mode} checkpoint`);
}

function asMode(value: unknown): OrchestrationMode {
  if (value === "debate" || value === "ask") {
    return value;
  }
  throw invalid("mode must be debate or ask");
}

function asStatus(value: unknown): SessionCheckpointStatus {
  if (value === "running" || value === "failed" || value === "cancelled" || value === "completed") {
    return value;
  }
  throw invalid("Invalid checkpoint status");
}

function asLanguage(value: unknown): Language {
  if (value === "fr" || value === "en") {
    return value;
  }
  throw invalid("language must be fr or en");
}

function asAgentRole(value: unknown, field: string): AgentRole {
  if (value === "implementer" || value === "reviewer" || value === "architect" || value === "scout" || value === "critic" || value === "summarizer") {
    return value;
  }
  throw invalid(`${field} must be a supported agent role`);
}

function asArray(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) {
    throw invalid(`${field} must be an array`);
  }
  return value;
}

function asRecord(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw invalid(message);
  }
  return value as Record<string, unknown>;
}

function asText(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw invalid(`${field} must be a non-empty string`);
  }
  return value;
}

function asDate(value: unknown, field: string): string {
  const date = asText(value, field);
  if (Number.isNaN(Date.parse(date))) {
    throw invalid(`${field} must be an ISO date`);
  }
  return date;
}

function asPositiveInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw invalid(`${field} must be a positive integer`);
  }
  return value;
}

function asBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw invalid(`${field} must be a boolean`);
  }
  return value;
}

function asSha256(value: unknown, field: string): string {
  const hash = asText(value, field);
  if (!/^[a-f0-9]{64}$/i.test(hash)) {
    throw invalid(`${field} must be a SHA-256 hash`);
  }
  return hash.toLowerCase();
}

function asSessionId(value: unknown): string {
  const id = asText(value, "id");
  assertSessionId(id);
  return id;
}

function assertSessionId(id: string): void {
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(id)) {
    throw invalid("id must use lowercase letters, digits, and hyphens only");
  }
}

function invalid(message: string): SessionCheckpointError {
  return new SessionCheckpointError("invalid-checkpoint", message);
}
