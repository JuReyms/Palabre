import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

function run(command: string, args: string[], cwd: string): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

test("CLI emits a complete NDJSON v1 debate flow with mock batch agents", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "palabre-ndjson-"));
  const configPath = path.join(dir, "palabre.config.json");
  const mock = "process.stdin.resume(); process.stdin.on('end',()=>process.stdout.write('mock response'))";
  await writeFile(configPath, JSON.stringify({
    language: "en", outputDir: path.join(dir, "out"), defaults: { agentA: "a", agentB: "b", turns: 2 },
    agents: {
      a: { type: "cli", command: process.execPath, args: ["-e", mock], promptMode: "stdin", shell: false, role: "implementer" },
      b: { type: "cli", command: process.execPath, args: ["-e", mock], promptMode: "stdin", shell: false, role: "reviewer" }
    }
  }), "utf8");
  const entry = path.resolve(".tmp", "test-dist", "src", "index.js");
  const result = await run(process.execPath, [entry, "run", "--config", configPath, "--renderer", "ndjson", "--no-summary", "--no-early-stop", "-s", "Fixture flow"], process.cwd());
  assert.equal(result.code, 0, result.stderr);
  const events = result.stdout.trim().split("\n").map((line) => JSON.parse(line));
  assert.deepEqual(events.map((event) => event.type), ["start", "turn-start", "thinking-start", "thinking-end", "message", "turn-start", "thinking-start", "thinking-end", "message", "done"]);
  assert.ok(events.every((event) => event.v === 1));
});
test("CLI emits NDJSON ask response events with multiline content", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "palabre-ndjson-ask-"));
  const configPath = path.join(dir, "palabre.config.json");
  const mock = "process.stdin.resume(); process.stdin.on('end',()=>process.stdout.write('line one\\nline two'))";
  await writeFile(configPath, JSON.stringify({
    language: "en", outputDir: path.join(dir, "out"), defaults: { agentA: "a", agentB: "b", turns: 2 },
    agents: {
      a: { type: "cli", command: process.execPath, args: ["-e", mock], promptMode: "stdin", shell: false, role: "implementer" },
      b: { type: "cli", command: process.execPath, args: ["-e", mock], promptMode: "stdin", shell: false, role: "reviewer" }
    }
  }), "utf8");
  const entry = path.resolve(".tmp", "test-dist", "src", "index.js");
  const result = await run(process.execPath, [entry, "run", "--config", configPath, "--renderer", "ndjson", "--mode", "ask", "--agents", "a", "b", "--no-summary", "-s", "Ask fixture"], process.cwd());
  assert.equal(result.code, 0, result.stderr);
  const events = result.stdout.trim().split("\n").map((line) => JSON.parse(line));
  assert.deepEqual(events.filter((event) => event.type === "ask-response").map((event) => event.response), [1, 2]);
  assert.ok(events.filter((event) => event.type === "ask-response").every((event) => event.content === "line one\nline two"));
  assert.ok(events.every((event) => event.v === 1));
});

test("CLI emits error then done for a failed agent and keeps the partial export flow", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "palabre-ndjson-error-"));
  const configPath = path.join(dir, "palabre.config.json");
  const success = "process.stdin.resume(); process.stdin.on('end',()=>process.stdout.write('ok'))";
  const failure = "process.stdin.resume(); process.stdin.on('end',()=>process.exit(1))";
  await writeFile(configPath, JSON.stringify({
    language: "en", outputDir: path.join(dir, "out"), defaults: { agentA: "a", agentB: "b", turns: 2 },
    agents: {
      a: { type: "cli", command: process.execPath, args: ["-e", success], promptMode: "stdin", shell: false, role: "implementer" },
      b: { type: "cli", command: process.execPath, args: ["-e", failure], promptMode: "stdin", shell: false, role: "reviewer" }
    }
  }), "utf8");
  const entry = path.resolve(".tmp", "test-dist", "src", "index.js");
  const result = await run(process.execPath, [entry, "run", "--config", configPath, "--renderer", "ndjson", "--no-summary", "--no-early-stop", "-s", "Error fixture"], process.cwd());
  assert.equal(result.code, 1);
  const events = result.stdout.trim().split("\n").map((line) => JSON.parse(line));
  const error = events.find((event) => event.type === "error");
  assert.equal(error?.kind, "non-zero-exit");
  assert.equal(events.at(-1).type, "done");
});