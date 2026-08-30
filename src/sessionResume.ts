/** @file Validation stricte et reconstruction runtime d'une session reprise. */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { assertRunnableConfig, loadConfig } from "./config.js";
import { getConfigIdentity, isConfigTrusted } from "./configTrust.js";
import { createTranslator } from "./i18n.js";
import { normalizeOllamaBaseUrl } from "./ollamaUrl.js";
import { readSessionCheckpoint, type SessionCheckpoint } from "./sessionCheckpoint.js";
import { createSessionContext } from "./session.js";
import type { Messages } from "./messages/index.js";
import type { AgentRole, DebateOptions, PalabreConfig, ProjectFileContext } from "./types.js";

export interface PrepareSessionResumeInput {
  workspace?: string;
  ollamaUrl?: string;
  pullModels?: boolean;
  plainOutput?: boolean;
  signal?: AbortSignal;
}

export interface PreparedSessionResume {
  checkpoint: SessionCheckpoint;
  config: PalabreConfig;
  options: DebateOptions;
  messages: Messages;
}

/** Charge un checkpoint et bloque toute dérive de config, contexte ou progression avant un appel agent. */
export async function prepareSessionResume(
  id: string,
  input: PrepareSessionResumeInput = {}
): Promise<PreparedSessionResume> {
  const workspace = path.resolve(input.workspace ?? process.cwd());
  const checkpoint = await readSessionCheckpoint(workspace, id);
  const messages = createTranslator(checkpoint.language);

  if (checkpoint.status === "completed" || checkpoint.nextPhase === null) {
    throw new Error(messages.resume.completed(checkpoint.id));
  }

  let identity: Awaited<ReturnType<typeof getConfigIdentity>>;
  try {
    identity = await getConfigIdentity(checkpoint.config.path);
  } catch {
    throw new Error(messages.resume.configMissing(checkpoint.config.path));
  }

  if (normalizePath(identity.path) !== normalizePath(checkpoint.config.path) || identity.sha256 !== checkpoint.config.sha256) {
    throw new Error(messages.resume.configChanged(checkpoint.config.path));
  }
  if (!(await isConfigTrusted(checkpoint.config.path))) {
    throw new Error(messages.resume.configUntrusted(checkpoint.config.path));
  }

  const config = await loadConfig(checkpoint.config.path);
  assertRunnableConfig(config, messages, checkpoint.config.path);
  validateProgress(checkpoint, config, messages);
  const files = await loadCheckpointContext(workspace, checkpoint, messages);
  const agents = checkpoint.agents;
  const agentA = agents[0]!.name;
  const agentB = agents[1]?.name ?? agentA;
  const askRole = checkpoint.mode === "ask" ? resolveAskRoleOverride(checkpoint, config, messages) : undefined;

  const options: DebateOptions = {
    mode: checkpoint.mode,
    language: checkpoint.language,
    topic: checkpoint.topic,
    agentA,
    agentB,
    ...(checkpoint.mode === "ask" ? { askAgents: agents.map((agent) => agent.name) } : {}),
    turns: checkpoint.turns,
    session: createSessionContext(workspace, new Date(checkpoint.createdAt)),
    files,
    ...(agents[0]?.model ? { modelA: agents[0].model } : {}),
    ...(agents[1]?.model ? { modelB: agents[1].model } : {}),
    ...(checkpoint.mode === "debate" ? { roleA: agents[0]!.role, roleB: agents[1]!.role } : {}),
    ...(askRole ? { askRole } : {}),
    ...(input.ollamaUrl ? { ollamaUrl: normalizeOllamaBaseUrl(input.ollamaUrl) } : {}),
    pullModels: Boolean(input.pullModels),
    summaryAgent: checkpoint.summaryAgent ?? agentB,
    ...(checkpoint.summaryModel ? { summaryModel: checkpoint.summaryModel } : {}),
    summaryEnabled: checkpoint.summaryEnabled,
    earlyStopOnAgreement: checkpoint.earlyStopOnAgreement,
    plainOutput: Boolean(input.plainOutput),
    checkpoint: true,
    resume: { phase: checkpoint.nextPhase, transcript: [...checkpoint.transcript] },
    signal: input.signal
  };

  return { checkpoint, config, options, messages };
}

function validateProgress(checkpoint: SessionCheckpoint, config: PalabreConfig, messages: Messages): void {
  for (const agent of checkpoint.agents) {
    if (!config.agents[agent.name]) {
      throw new Error(messages.resume.missingAgent(agent.name));
    }
  }
  if (checkpoint.summaryEnabled && checkpoint.summaryAgent && !config.agents[checkpoint.summaryAgent]) {
    throw new Error(messages.resume.missingSummaryAgent(checkpoint.summaryAgent));
  }

  const modeCompleted = checkpoint.completedPhases.includes(checkpoint.mode);
  if (checkpoint.nextPhase === "summary" && !modeCompleted) {
    throw new Error(messages.resume.summaryBeforeMode);
  }
  if (checkpoint.nextPhase === checkpoint.mode && modeCompleted) {
    throw new Error(messages.resume.conflictingModeState);
  }

  const maximum = checkpoint.mode === "ask" ? checkpoint.agents.length : checkpoint.turns;
  if (checkpoint.transcript.length > maximum) {
    throw new Error(messages.resume.transcriptTooLong);
  }
  if (checkpoint.nextPhase === checkpoint.mode && checkpoint.transcript.length >= maximum) {
    throw new Error(messages.resume.noResponseRemaining);
  }
  if (checkpoint.mode === "ask" && checkpoint.nextPhase === "summary" && checkpoint.transcript.length !== maximum) {
    throw new Error(messages.resume.incompleteAskSummary);
  }

  checkpoint.transcript.forEach((message, index) => {
    const expected = checkpoint.mode === "ask"
      ? checkpoint.agents[index]
      : checkpoint.agents[index % 2];
    if (!expected || message.agent !== expected.name || message.role !== expected.role) {
      throw new Error(messages.resume.responseOrder(index + 1));
    }
  });
}

async function loadCheckpointContext(
  workspace: string,
  checkpoint: SessionCheckpoint,
  messages: Messages
): Promise<ProjectFileContext[]> {
  const files: ProjectFileContext[] = [];
  for (const reference of checkpoint.context) {
    const absolutePath = path.resolve(workspace, reference.path);
    let content: string;
    try {
      content = await readFile(absolutePath, "utf8");
    } catch {
      throw new Error(messages.resume.contextChanged(reference.path));
    }
    if (sha256(content) !== reference.sha256) {
      throw new Error(messages.resume.contextChanged(reference.path));
    }
    files.push({
      path: reference.path,
      absolutePath,
      content,
      sizeBytes: Buffer.byteLength(content, "utf8")
    });
  }
  return files;
}

function resolveAskRoleOverride(checkpoint: SessionCheckpoint, config: PalabreConfig, messages: Messages): AgentRole | undefined {
  const changedRoles = checkpoint.agents.filter((agent) => config.agents[agent.name]?.role !== agent.role);
  if (changedRoles.length === 0) return undefined;
  const roles = new Set(checkpoint.agents.map((agent) => agent.role));
  if (roles.size !== 1) {
    throw new Error(messages.resume.askRolesMismatch);
  }
  return checkpoint.agents[0]!.role;
}

function normalizePath(value: string): string {
  const normalized = path.normalize(value);
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
