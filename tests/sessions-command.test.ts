import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { sessionCheckpointPath, writeSessionCheckpoint, type SessionCheckpoint } from "../src/sessionCheckpoint.js";

const HASH = "b".repeat(64);

function run(args: string[], cwd: string): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const entry = path.resolve(".tmp", "test-dist", "src", "index.js");
    const child = spawn(process.execPath, [entry, ...args], { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

function checkpoint(id: string): SessionCheckpoint {
  return {
    v: 1,
    id,
    createdAt: "2026-08-30T12:00:00.000Z",
    updatedAt: "2026-08-30T12:01:00.000Z",
    status: "failed",
    nextPhase: "ask",
    mode: "ask",
    language: "en",
    topic: "Review the release",
    agents: [{ name: "codex", role: "reviewer" }],
    turns: 1,
    earlyStopOnAgreement: true,
    summaryEnabled: false,
    config: { path: "C:/work/palabre.config.json", sha256: HASH },
    context: [],
    transcript: [],
    completedPhases: [],
    diagnostics: [{ phase: "ask", kind: "timeout", message: "Agent timed out" }]
  };
}

test("sessions JSON lists corruption and deletion requires explicit non-interactive consent", async (t) => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "palabre-sessions-cli-"));
  t.after(() => rm(workspace, { recursive: true, force: true }));
  await writeSessionCheckpoint(workspace, checkpoint("failed-review"));
  const brokenPath = sessionCheckpointPath(workspace, "broken-review");
  await writeFile(brokenPath, "{ invalid", "utf8");
  const exportPath = path.join(workspace, ".palabre", "decision.ask.md");
  await writeFile(exportPath, "# preserved export", "utf8");

  const listed = await run(["sessions", "--json"], workspace);
  assert.equal(listed.code, 0, listed.stderr);
  const payload = JSON.parse(listed.stdout);
  assert.equal(payload.v, 1);
  assert.equal(payload.sessions.length, 2);
  assert.equal(payload.sessions.find((entry: { id: string }) => entry.id === "failed-review").resumable, true);
  assert.equal(payload.sessions.find((entry: { id: string }) => entry.id === "broken-review").valid, false);

  const refused = await run(["sessions", "delete", "failed-review", "--json"], workspace);
  assert.equal(refused.code, 1);
  assert.match(refused.stderr, /(?:requires|exige) --yes/i);
  assert.match(await readFile(sessionCheckpointPath(workspace, "failed-review"), "utf8"), /failed-review/);

  const deleted = await run(["sessions", "delete", "broken-review", "--yes", "--json"], workspace);
  assert.equal(deleted.code, 0, deleted.stderr);
  assert.deepEqual(JSON.parse(deleted.stdout), { v: 1, deleted: { id: "broken-review" } });
  await assert.rejects(readFile(brokenPath, "utf8"), /ENOENT/);
  assert.equal(await readFile(exportPath, "utf8"), "# preserved export");
});
