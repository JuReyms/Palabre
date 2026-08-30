import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
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

function recordingAgent(response: string, promptPath: string) {
  const script = [
    "const fs = require('node:fs');",
    "let prompt = '';",
    "process.stdin.setEncoding('utf8');",
    "process.stdin.on('data', (chunk) => { prompt += chunk; });",
    `process.stdin.on('end', () => { fs.writeFileSync(${JSON.stringify(promptPath)}, prompt, 'utf8'); process.stdout.write(${JSON.stringify(response)}); });`
  ].join(" ");

  return {
    type: "cli",
    command: process.execPath,
    args: ["-e", script],
    promptMode: "stdin",
    shell: false
  };
}

function failingAgent() {
  return {
    type: "cli",
    command: process.execPath,
    args: ["-e", "process.stderr.write('simulated failure'); process.exit(2)"],
    promptMode: "stdin",
    shell: false
  };
}

test("CLI terminal session carries prompts through debate, summary, and Markdown export", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "palabre-session-"));
  const outputDir = path.join(dir, "out");
  const prompts = {
    first: path.join(dir, "first-prompt.txt"),
    second: path.join(dir, "second-prompt.txt"),
    summary: path.join(dir, "summary-prompt.txt")
  };
  const configPath = path.join(dir, "palabre.config.json");

  await writeFile(configPath, JSON.stringify({
    language: "en",
    outputDir,
    defaults: { agentA: "first", agentB: "second", summaryAgent: "summary", turns: 2 },
    agents: {
      first: { ...recordingAgent("First recommendation.", prompts.first), role: "architect" },
      second: { ...recordingAgent("Second critique.", prompts.second), role: "critic" },
      summary: { ...recordingAgent("Final decision.", prompts.summary), role: "summarizer" }
    }
  }), "utf8");

  const entry = path.resolve(".tmp", "test-dist", "src", "index.js");
  const result = await run(process.execPath, [
    entry,
    "run",
    "--config", configPath,
    "--terminal",
    "--no-early-stop",
    "-s", "Choose the safest release path"
  ], process.cwd());

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /First recommendation\./);
  assert.match(result.stdout, /Second critique\./);
  assert.match(result.stdout, /Final decision\./);
  assert.match(result.stdout, /Palabre exported:/);

  const [exportName] = await readdir(outputDir);
  assert.match(exportName ?? "", /^palabre-choose-the-safest-release-path-.*\.debate\.md$/);
  const markdown = await readFile(path.join(outputDir, exportName!), "utf8");
  assert.match(markdown, /# PALABRE Debate/);
  assert.match(markdown, /\| Subject \| Choose the safest release path \|/);
  assert.match(markdown, /### first \(architect\)/);
  assert.match(markdown, /### second \(critic\)/);
  assert.match(markdown, /## Final summary/);
  assert.match(markdown, /Final decision\./);

  const [firstPrompt, secondPrompt, summaryPrompt] = await Promise.all([
    readFile(prompts.first, "utf8"),
    readFile(prompts.second, "utf8"),
    readFile(prompts.summary, "utf8")
  ]);
  assert.match(firstPrompt, /Choose the safest release path/);
  assert.match(firstPrompt, /PALABRE session context/);
  assert.match(secondPrompt, /First recommendation\./);
  assert.match(summaryPrompt, /First recommendation\./);
  assert.match(summaryPrompt, /Second critique\./);
});

test("CLI checkpoint opt-in persists a completed debate with its summary", async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "palabre-checkpoint-cli-"));
  const outputDir = path.join(dir, "out");
  const configPath = path.join(dir, "palabre.config.json");
  await writeFile(configPath, JSON.stringify({
    language: "en",
    outputDir,
    defaults: { agentA: "first", agentB: "second", summaryAgent: "summary", turns: 2 },
    agents: {
      first: { ...recordingAgent("First answer.", path.join(dir, "first.txt")), role: "architect" },
      second: { ...recordingAgent("Second answer.", path.join(dir, "second.txt")), role: "critic" },
      summary: { ...recordingAgent("Final summary.", path.join(dir, "summary.txt")), role: "summarizer" }
    }
  }), "utf8");

  const entry = path.resolve(".tmp", "test-dist", "src", "index.js");
  const result = await run(process.execPath, [
    entry, "run", "--config", configPath, "--trust-config", "--terminal", "--checkpoint",
    "--no-early-stop", "-s", "Checkpoint this decision"
  ], dir);

  assert.equal(result.code, 0, result.stderr);
  const checkpointDir = path.join(dir, ".palabre", "sessions");
  const files = await readdir(checkpointDir);
  assert.equal(files.length, 1);
  const checkpoint = JSON.parse(await readFile(path.join(checkpointDir, files[0]!), "utf8"));
  assert.equal(checkpoint.v, 1);
  assert.equal(checkpoint.status, "completed");
  assert.equal(checkpoint.nextPhase, null);
  assert.deepEqual(checkpoint.transcript.map((message: { content: string }) => message.content), ["First answer.", "Second answer."]);
  assert.equal(checkpoint.summary.content, "Final summary.");
  assert.deepEqual(checkpoint.completedPhases, ["debate", "summary"]);
});

test("CLI checkpoint records a failed phase without a partial response", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "palabre-checkpoint-failure-"));
  const configPath = path.join(dir, "palabre.config.json");
  await writeFile(configPath, JSON.stringify({
    language: "en",
    outputDir: path.join(dir, "out"),
    defaults: { agentA: "first", agentB: "second", turns: 2 },
    agents: {
      first: { ...failingAgent(), role: "architect" },
      second: { ...recordingAgent("Never reached.", path.join(dir, "second.txt")), role: "critic" }
    }
  }), "utf8");

  const entry = path.resolve(".tmp", "test-dist", "src", "index.js");
  const result = await run(process.execPath, [
    entry, "run", "--config", configPath, "--trust-config", "--terminal",
    "--checkpoint", "--no-summary", "-s", "Preserve this failure"
  ], dir);

  assert.equal(result.code, 1);
  const checkpointDir = path.join(dir, ".palabre", "sessions");
  const [checkpointName] = await readdir(checkpointDir);
  const checkpoint = JSON.parse(await readFile(path.join(checkpointDir, checkpointName!), "utf8"));
  assert.equal(checkpoint.status, "failed");
  assert.equal(checkpoint.nextPhase, "debate");
  assert.deepEqual(checkpoint.transcript, []);
  assert.equal(checkpoint.diagnostics[0].kind, "non-zero-exit");
});

test("CLI checkpoint persists a completed Ask session", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "palabre-checkpoint-ask-"));
  const configPath = path.join(dir, "palabre.config.json");
  await writeFile(configPath, JSON.stringify({
    language: "en",
    outputDir: path.join(dir, "out"),
    defaults: { agentA: "first", agentB: "second", askSummaryAgent: "summary" },
    agents: {
      first: { ...recordingAgent("First opinion.", path.join(dir, "first.txt")), role: "architect" },
      second: { ...recordingAgent("Second opinion.", path.join(dir, "second.txt")), role: "critic" },
      summary: { ...recordingAgent("Ask synthesis.", path.join(dir, "summary.txt")), role: "summarizer" }
    }
  }), "utf8");

  const entry = path.resolve(".tmp", "test-dist", "src", "index.js");
  const result = await run(process.execPath, [
    entry, "ask", "--config", configPath, "--trust-config", "--terminal", "--checkpoint",
    "--agents", "first", "second", "-s", "Compare independent opinions"
  ], dir);

  assert.equal(result.code, 0, result.stderr);
  const checkpointDir = path.join(dir, ".palabre", "sessions");
  const [checkpointName] = await readdir(checkpointDir);
  const checkpoint = JSON.parse(await readFile(path.join(checkpointDir, checkpointName!), "utf8"));
  assert.equal(checkpoint.mode, "ask");
  assert.equal(checkpoint.status, "completed");
  assert.deepEqual(checkpoint.completedPhases, ["ask", "summary"]);
  assert.equal(checkpoint.transcript.length, 2);
  assert.equal(checkpoint.summary.content, "Ask synthesis.");
});
