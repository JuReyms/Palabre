import assert from "node:assert/strict";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  SessionCheckpointError,
  parseSessionCheckpoint,
  readSessionCheckpoint,
  sessionCheckpointPath,
  writeSessionCheckpoint,
  type SessionCheckpoint
} from "../src/sessionCheckpoint.js";

const HASH = "a".repeat(64);

function checkpoint(overrides: Partial<SessionCheckpoint> = {}): SessionCheckpoint {
  return {
    v: 1,
    id: "release-path-20260830",
    createdAt: "2026-08-30T12:00:00.000Z",
    updatedAt: "2026-08-30T12:00:00.000Z",
    status: "running",
    nextPhase: "debate",
    mode: "debate",
    language: "fr",
    topic: "Choisir le chemin de release",
    agents: [
      { name: "codex", role: "architect", model: "provider/model" },
      { name: "claude", role: "critic" }
    ],
    turns: 2,
    summaryEnabled: true,
    summaryAgent: "claude",
    config: { path: "C:/work/palabre.config.json", sha256: HASH },
    context: [{ path: "README.md", sha256: HASH }],
    transcript: [{
      agent: "codex",
      role: "architect",
      content: "Comparer les risques avant de publier.",
      createdAt: "2026-08-30T12:01:00.000Z"
    }],
    completedPhases: [],
    diagnostics: [],
    ...overrides
  };
}

test("writes and reads a normalized atomic session checkpoint", async (t) => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "palabre-checkpoint-"));
  t.after(() => rm(workspace, { recursive: true, force: true }));

  const written = await writeSessionCheckpoint(workspace, checkpoint({
    updatedAt: "2026-08-30T12:02:00.000Z",
    config: { path: "C:/work/palabre.config.json", sha256: "A".repeat(64) }
  }));

  assert.equal(written, sessionCheckpointPath(workspace, "release-path-20260830"));
  assert.deepEqual(await readSessionCheckpoint(workspace, "release-path-20260830"), checkpoint({
    updatedAt: "2026-08-30T12:02:00.000Z"
  }));
  assert.deepEqual(await readdir(path.dirname(written)), ["release-path-20260830.json"]);
});

test("rewriting a checkpoint replaces the complete state without temporary leftovers", async (t) => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "palabre-checkpoint-"));
  t.after(() => rm(workspace, { recursive: true, force: true }));

  await writeSessionCheckpoint(workspace, checkpoint());
  await writeSessionCheckpoint(workspace, checkpoint({
    status: "completed",
    nextPhase: null,
    updatedAt: "2026-08-30T12:04:00.000Z",
    completedPhases: ["debate", "summary"],
    summary: {
      agent: "claude",
      role: "summarizer",
      content: "Décision finale.",
      createdAt: "2026-08-30T12:03:00.000Z"
    }
  }));

  const restored = await readSessionCheckpoint(workspace, "release-path-20260830");
  assert.equal(restored.status, "completed");
  assert.equal(restored.nextPhase, null);
  assert.equal(restored.updatedAt, "2026-08-30T12:04:00.000Z");
  assert.deepEqual(await readdir(path.join(workspace, ".palabre", "sessions")), ["release-path-20260830.json"]);
});

test("rejects malformed, incompatible, and traversal-prone checkpoints", async (t) => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "palabre-checkpoint-"));
  t.after(() => rm(workspace, { recursive: true, force: true }));

  assert.throws(
    () => parseSessionCheckpoint({ ...checkpoint(), v: 2 }),
    (error: unknown) => error instanceof SessionCheckpointError && error.kind === "unsupported-version"
  );
  assert.throws(
    () => sessionCheckpointPath(workspace, "../outside"),
    (error: unknown) => error instanceof SessionCheckpointError && error.kind === "invalid-checkpoint"
  );
  assert.throws(
    () => parseSessionCheckpoint({ ...checkpoint(), status: "completed", nextPhase: "debate" }),
    (error: unknown) => error instanceof SessionCheckpointError && error.kind === "invalid-checkpoint"
  );
  assert.throws(
    () => parseSessionCheckpoint({ ...checkpoint(), agents: [checkpoint().agents[0]] }),
    (error: unknown) => error instanceof SessionCheckpointError && error.kind === "invalid-checkpoint"
  );
  assert.throws(
    () => parseSessionCheckpoint({ ...checkpoint(), summaryEnabled: false, nextPhase: "summary" }),
    (error: unknown) => error instanceof SessionCheckpointError && error.kind === "invalid-checkpoint"
  );

  await writeSessionCheckpoint(workspace, checkpoint());
  const filePath = sessionCheckpointPath(workspace, "release-path-20260830");
  await writeFile(filePath, "{ not json", "utf8");
  await assert.rejects(
    readSessionCheckpoint(workspace, "release-path-20260830"),
    (error: unknown) => error instanceof SessionCheckpointError && error.kind === "invalid-checkpoint"
  );
});

test("drops uncontracted properties instead of persisting raw process data", () => {
  const parsed = parseSessionCheckpoint({
    ...checkpoint(),
    rawOutput: "sensitive terminal output",
    transcript: [{
      ...checkpoint().transcript[0],
      raw: "must not survive"
    }]
  }) as SessionCheckpoint & { rawOutput?: unknown };

  assert.equal(parsed.rawOutput, undefined);
  assert.deepEqual(parsed.transcript[0], checkpoint().transcript[0]);
});
