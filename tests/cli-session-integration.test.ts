import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
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

function countingAgent(response: string, countPath: string) {
  const script = [
    "const fs = require('node:fs');",
    "process.stdin.resume();",
    `process.stdin.on('end', () => { fs.appendFileSync(${JSON.stringify(countPath)}, 'x'); process.stdout.write(${JSON.stringify(response)}); });`
  ].join(" ");
  return { type: "cli", command: process.execPath, args: ["-e", script], promptMode: "stdin", shell: false };
}

function gatedAgent(response: string, markerPath: string, countPath: string) {
  const script = [
    "const fs = require('node:fs');",
    "process.stdin.resume();",
    `process.stdin.on('end', () => { fs.appendFileSync(${JSON.stringify(countPath)}, 'x');`,
    `if (!fs.existsSync(${JSON.stringify(markerPath)})) { process.stderr.write('gate closed'); process.exitCode = 2; return; }`,
    `process.stdout.write(${JSON.stringify(response)}); });`
  ].join(" ");
  return { type: "cli", command: process.execPath, args: ["-e", script], promptMode: "stdin", shell: false };
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
  assert.match(result.stdout, /resume with: palabre resume [a-z0-9-]+/);
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

test("CLI resume continues a failed debate without replaying a complete response", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "palabre-resume-debate-"));
  const configPath = path.join(dir, "palabre.config.json");
  const marker = path.join(dir, "second-ready");
  const firstCount = path.join(dir, "first-count");
  const secondCount = path.join(dir, "second-count");
  await writeFile(configPath, JSON.stringify({
    language: "en",
    outputDir: path.join(dir, "out"),
    defaults: { agentA: "first", agentB: "second", turns: 2 },
    agents: {
      first: { ...countingAgent("First complete answer.", firstCount), role: "architect" },
      second: { ...gatedAgent("Second recovered answer.", marker, secondCount), role: "critic" }
    }
  }), "utf8");
  const entry = path.resolve(".tmp", "test-dist", "src", "index.js");
  const initial = await run(process.execPath, [
    entry, "run", "--config", configPath, "--trust-config", "--terminal", "--checkpoint",
    "--no-summary", "--no-early-stop", "-s", "Resume this debate"
  ], dir);
  assert.equal(initial.code, 1);
  const [checkpointName] = await readdir(path.join(dir, ".palabre", "sessions"));
  const id = checkpointName!.replace(/\.json$/, "");

  const missingConfirmation = await run(process.execPath, [entry, "resume", id, "--terminal"], dir);
  assert.equal(missingConfirmation.code, 1);
  assert.match(missingConfirmation.stderr, /requires --yes/);

  await writeFile(marker, "ready", "utf8");
  const resumed = await run(process.execPath, [entry, "resume", id, "--renderer", "ndjson", "--yes"], dir);
  assert.equal(resumed.code, 0, resumed.stderr);
  assert.match(resumed.stdout, /Second recovered answer\./);
  const events = resumed.stdout.trim().split(/\r?\n/).map((line) => JSON.parse(line));
  assert.equal(events[0]?.type, "notice");
  assert.ok(events.some((event) => event.type === "message" && event.content === "Second recovered answer."));
  assert.equal(events.at(-1)?.type, "done");
  assert.equal((await readFile(firstCount, "utf8")).length, 1);
  assert.equal((await readFile(secondCount, "utf8")).length, 2);
  const checkpoint = JSON.parse(await readFile(path.join(dir, ".palabre", "sessions", checkpointName!), "utf8"));
  assert.equal(checkpoint.status, "completed");
  assert.deepEqual(checkpoint.transcript.map((message: { content: string }) => message.content), [
    "First complete answer.",
    "Second recovered answer."
  ]);

  const completed = await run(process.execPath, [entry, "resume", id, "--terminal", "--yes"], dir);
  assert.equal(completed.code, 1);
  assert.match(completed.stderr, /already complete/);
});

test("CLI resume continues only the remaining Ask agents", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "palabre-resume-ask-"));
  const configPath = path.join(dir, "palabre.config.json");
  const marker = path.join(dir, "second-ready");
  const counts = ["first", "second", "third"].map((name) => path.join(dir, `${name}-count`));
  await writeFile(configPath, JSON.stringify({
    language: "en",
    outputDir: path.join(dir, "out"),
    defaults: { agentA: "first", agentB: "second", askAgents: ["first", "second", "third"] },
    agents: {
      first: { ...countingAgent("First opinion.", counts[0]!), role: "architect" },
      second: { ...gatedAgent("Second opinion.", marker, counts[1]!), role: "critic" },
      third: { ...countingAgent("Third opinion.", counts[2]!), role: "reviewer" }
    }
  }), "utf8");
  const entry = path.resolve(".tmp", "test-dist", "src", "index.js");
  const initial = await run(process.execPath, [
    entry, "ask", "--config", configPath, "--trust-config", "--terminal", "--checkpoint",
    "--no-summary", "-s", "Resume independent answers"
  ], dir);
  assert.equal(initial.code, 1);
  const [checkpointName] = await readdir(path.join(dir, ".palabre", "sessions"));
  const id = checkpointName!.replace(/\.json$/, "");
  await writeFile(marker, "ready", "utf8");

  const resumed = await run(process.execPath, [entry, "resume", id, "--terminal", "--yes"], dir);
  assert.equal(resumed.code, 0, resumed.stderr);
  assert.equal((await readFile(counts[0]!, "utf8")).length, 1);
  assert.equal((await readFile(counts[1]!, "utf8")).length, 2);
  assert.equal((await readFile(counts[2]!, "utf8")).length, 1);
  const checkpoint = JSON.parse(await readFile(path.join(dir, ".palabre", "sessions", checkpointName!), "utf8"));
  assert.deepEqual(checkpoint.transcript.map((message: { agent: string }) => message.agent), ["first", "second", "third"]);
});

test("CLI resume retries only a failed summary", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "palabre-resume-summary-"));
  const configPath = path.join(dir, "palabre.config.json");
  const marker = path.join(dir, "summary-ready");
  const counts = ["first", "second", "summary"].map((name) => path.join(dir, `${name}-count`));
  await writeFile(configPath, JSON.stringify({
    language: "en",
    outputDir: path.join(dir, "out"),
    defaults: { agentA: "first", agentB: "second", summaryAgent: "summary", turns: 2 },
    agents: {
      first: { ...countingAgent("First answer.", counts[0]!), role: "architect" },
      second: { ...countingAgent("Second answer.", counts[1]!), role: "critic" },
      summary: { ...gatedAgent("Recovered summary.", marker, counts[2]!), role: "summarizer" }
    }
  }), "utf8");
  const entry = path.resolve(".tmp", "test-dist", "src", "index.js");
  const initial = await run(process.execPath, [
    entry, "run", "--config", configPath, "--trust-config", "--terminal", "--checkpoint",
    "--no-early-stop", "-s", "Resume only summary"
  ], dir);
  assert.equal(initial.code, 1);
  const [checkpointName] = await readdir(path.join(dir, ".palabre", "sessions"));
  const id = checkpointName!.replace(/\.json$/, "");
  await writeFile(marker, "ready", "utf8");

  const resumed = await run(process.execPath, [entry, "resume", id, "--terminal", "--yes"], dir);
  assert.equal(resumed.code, 0, resumed.stderr);
  assert.match(resumed.stdout, /Recovered summary\./);
  assert.equal((await readFile(counts[0]!, "utf8")).length, 1);
  assert.equal((await readFile(counts[1]!, "utf8")).length, 1);
  assert.equal((await readFile(counts[2]!, "utf8")).length, 2);
});

test("CLI resume blocks changed configuration and context before agent calls", async () => {
  const entry = path.resolve(".tmp", "test-dist", "src", "index.js");

  const configDir = await mkdtemp(path.join(os.tmpdir(), "palabre-resume-config-"));
  const configPath = path.join(configDir, "palabre.config.json");
  const configCount = path.join(configDir, "first-count");
  const config = {
    language: "en",
    outputDir: path.join(configDir, "out"),
    defaults: { agentA: "first", agentB: "second", turns: 2 },
    agents: {
      first: { ...countingAgent("First answer.", configCount), role: "architect" },
      second: { ...failingAgent(), role: "critic" }
    }
  };
  await writeFile(configPath, JSON.stringify(config), "utf8");
  await run(process.execPath, [entry, "run", "--config", configPath, "--trust-config", "--terminal", "--checkpoint", "--no-summary", "-s", "Config guard"], configDir);
  const [configCheckpoint] = await readdir(path.join(configDir, ".palabre", "sessions"));
  await writeFile(configPath, `${JSON.stringify(config)}\n`, "utf8");
  const configResume = await run(process.execPath, [entry, "resume", configCheckpoint!.replace(/\.json$/, ""), "--terminal", "--yes"], configDir);
  assert.equal(configResume.code, 1);
  assert.match(configResume.stderr, /configuration changed/i);
  assert.equal((await readFile(configCount, "utf8")).length, 1);

  const contextDir = await mkdtemp(path.join(os.tmpdir(), "palabre-resume-context-"));
  const contextConfigPath = path.join(contextDir, "palabre.config.json");
  const contextPath = path.join(contextDir, "decision.txt");
  await writeFile(contextPath, "original context", "utf8");
  await writeFile(contextConfigPath, JSON.stringify({ ...config, outputDir: path.join(contextDir, "out") }), "utf8");
  await run(process.execPath, [
    entry, "run", "--config", contextConfigPath, "--trust-config", "--terminal", "--checkpoint", "--no-summary",
    "--files", contextPath, "-s", "Context guard"
  ], contextDir);
  const [contextCheckpoint] = await readdir(path.join(contextDir, ".palabre", "sessions"));
  await writeFile(contextPath, "changed context", "utf8");
  const contextResume = await run(process.execPath, [entry, "resume", contextCheckpoint!.replace(/\.json$/, ""), "--terminal", "--yes"], contextDir);
  assert.equal(contextResume.code, 1);
  assert.match(contextResume.stderr, /Context changed/);
});

test("CLI resume rejects a corrupted checkpoint before resolving configuration", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "palabre-resume-corrupt-"));
  const sessionsDir = path.join(dir, ".palabre", "sessions");
  await mkdir(sessionsDir, { recursive: true });
  await writeFile(path.join(sessionsDir, "broken-session.json"), "{ not json", "utf8");
  const entry = path.resolve(".tmp", "test-dist", "src", "index.js");

  const result = await run(process.execPath, [entry, "resume", "broken-session", "--terminal", "--yes"], dir);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /Checkpoint invalid/);
});

test("CLI resume rejects an unchanged but untrusted checkpoint configuration", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "palabre-resume-untrusted-"));
  const sessionsDir = path.join(dir, ".palabre", "sessions");
  const configPath = path.join(dir, "external.config.json");
  const configContent = JSON.stringify({
    language: "en",
    agents: {
      first: { ...failingAgent(), role: "architect" },
      second: { ...failingAgent(), role: "critic" }
    }
  });
  await mkdir(sessionsDir, { recursive: true });
  await writeFile(configPath, configContent, "utf8");
  const canonicalConfigPath = process.platform === "win32" ? path.resolve(configPath).toLowerCase() : path.resolve(configPath);
  await writeFile(path.join(sessionsDir, "untrusted-session.json"), JSON.stringify({
    v: 1,
    id: "untrusted-session",
    createdAt: "2026-08-30T12:00:00.000Z",
    updatedAt: "2026-08-30T12:01:00.000Z",
    status: "failed",
    nextPhase: "debate",
    mode: "debate",
    language: "en",
    topic: "Do not call agents",
    agents: [{ name: "first", role: "architect" }, { name: "second", role: "critic" }],
    turns: 2,
    earlyStopOnAgreement: true,
    summaryEnabled: false,
    config: { path: canonicalConfigPath, sha256: createHash("sha256").update(configContent).digest("hex") },
    context: [],
    transcript: [],
    completedPhases: [],
    diagnostics: []
  }), "utf8");
  const entry = path.resolve(".tmp", "test-dist", "src", "index.js");

  const result = await run(process.execPath, [entry, "resume", "untrusted-session", "--terminal", "--yes"], dir);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /no longer trusted/);
});
