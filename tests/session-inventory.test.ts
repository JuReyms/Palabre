import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  deleteSessionCheckpoint,
  listSessionCheckpoints
} from "../src/sessionInventory.js";
import {
  SessionCheckpointError,
  sessionCheckpointDirectory,
  sessionCheckpointPath,
  writeSessionCheckpoint,
  type SessionCheckpoint
} from "../src/sessionCheckpoint.js";

const HASH = "a".repeat(64);

function checkpoint(id: string, updatedAt: string, topic: string): SessionCheckpoint {
  return {
    v: 1,
    id,
    createdAt: "2026-08-30T10:00:00.000Z",
    updatedAt,
    status: "running",
    nextPhase: "debate",
    mode: "debate",
    language: "fr",
    topic,
    agents: [
      { name: "codex", role: "architect" },
      { name: "claude", role: "critic" }
    ],
    turns: 4,
    earlyStopOnAgreement: true,
    summaryEnabled: true,
    summaryAgent: "claude",
    config: { path: "C:/work/palabre.config.json", sha256: HASH },
    context: [],
    transcript: [{
      agent: "codex",
      role: "architect",
      content: "Première réponse.",
      createdAt: "2026-08-30T10:01:00.000Z"
    }],
    completedPhases: [],
    diagnostics: []
  };
}

test("lists valid and corrupted checkpoints by recency without blocking the inventory", async (t) => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "palabre-sessions-"));
  t.after(() => rm(workspace, { recursive: true, force: true }));

  await writeSessionCheckpoint(workspace, checkpoint("older-session", "2026-08-30T10:00:00.000Z", "Ancienne décision"));
  await writeSessionCheckpoint(workspace, checkpoint("newer-session", "2026-08-30T12:00:00.000Z", "Nouvelle décision"));
  const invalidPath = sessionCheckpointPath(workspace, "broken-session");
  await writeFile(invalidPath, "{ not json\u001b[31m", "utf8");
  await utimes(invalidPath, new Date("2026-08-30T11:00:00.000Z"), new Date("2026-08-30T11:00:00.000Z"));

  const sessions = await listSessionCheckpoints(workspace, 20);
  assert.deepEqual(sessions.map((entry) => entry.id), ["newer-session", "broken-session", "older-session"]);
  assert.deepEqual(sessions[0], {
    valid: true,
    id: "newer-session",
    status: "running",
    mode: "debate",
    topic: "Nouvelle décision",
    updatedAt: "2026-08-30T12:00:00.000Z",
    responses: 1,
    nextPhase: "debate",
    resumable: true
  });
  assert.equal(sessions[1]?.valid, false);
  if (!sessions[1]?.valid) {
    assert.doesNotMatch(sessions[1].warning, /\u001b/);
  }
  assert.deepEqual((await listSessionCheckpoints(workspace, 1)).map((entry) => entry.id), ["newer-session"]);
});

test("returns an empty inventory when the checkpoint directory does not exist", async (t) => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "palabre-sessions-empty-"));
  t.after(() => rm(workspace, { recursive: true, force: true }));
  assert.deepEqual(await listSessionCheckpoints(workspace, 20), []);
});

test("deletes exactly one safe checkpoint and preserves exports and siblings", async (t) => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "palabre-sessions-delete-"));
  t.after(() => rm(workspace, { recursive: true, force: true }));
  await mkdir(sessionCheckpointDirectory(workspace), { recursive: true });
  await writeSessionCheckpoint(workspace, checkpoint("remove-me", "2026-08-30T12:00:00.000Z", "À retirer"));
  await writeSessionCheckpoint(workspace, checkpoint("keep-me", "2026-08-30T11:00:00.000Z", "À garder"));
  const exportPath = path.join(workspace, ".palabre", "decision.debate.md");
  await writeFile(exportPath, "# export", "utf8");

  assert.equal(await deleteSessionCheckpoint(workspace, "remove-me"), true);
  assert.equal(await deleteSessionCheckpoint(workspace, "remove-me"), false);
  assert.deepEqual((await listSessionCheckpoints(workspace, 20)).map((entry) => entry.id), ["keep-me"]);
  assert.equal(await import("node:fs/promises").then(({ readFile }) => readFile(exportPath, "utf8")), "# export");
  await assert.rejects(
    deleteSessionCheckpoint(workspace, "../outside"),
    (error: unknown) => error instanceof SessionCheckpointError
  );
});
