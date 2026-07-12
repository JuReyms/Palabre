import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { runStatelessChatTurn } from "../src/chat.js";

const config = {
  type: "cli" as const,
  command: process.execPath,
  args: ["-e", "process.stdin.pipe(process.stdout)"],
  promptMode: "stdin" as const,
  shell: false,
  role: "reviewer" as const
};
const availableAgents = [{ name: "mock", role: "reviewer" as const }, { name: "second", role: "architect" as const }];
const session = { startedAt: "2026-07-12T10:00:00.000Z", localDate: "2026-07-12", timeZone: "Europe/Paris", cwd: process.cwd() };

function runInteractive(command: string, args: string[], cwd: string, input: string): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
    child.stdin.end(input);
  });
}

test("stateless chat reinjects the accumulated transcript on every batch call", async () => {
  const first = await runStatelessChatTurn({ agentName: "mock", agentConfig: config, topic: "Discuss", userMessage: "First question", transcript: [], language: "en", session, files: [], availableAgents });
  const second = await runStatelessChatTurn({ agentName: "mock", agentConfig: config, topic: "Discuss", userMessage: "Second question", transcript: [first.user, first.assistant], language: "en", session, files: [], availableAgents });
  assert.match(first.assistant.content, /First question/);
  assert.match(second.assistant.content, /First question/);
  assert.match(second.assistant.content, /Second question/);
  assert.match(second.assistant.content, /Conversation with the user/);
  assert.doesNotMatch(second.assistant.content, /Debate transcript/);
});

test("CLI chat continues an interactive stateless conversation", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "palabre-chat-"));
  const configPath = path.join(dir, "palabre.config.json");
  const mock = "process.stdin.pipe(process.stdout)";
  await writeFile(configPath, JSON.stringify({
    language: "en",
    defaults: { agentA: "mock", agentB: "mock", turns: 2 },
    agents: { mock: { type: "cli", command: process.execPath, args: ["-e", mock], promptMode: "stdin", shell: false, role: "reviewer" }, second: { type: "cli", command: process.execPath, args: ["-e", mock], promptMode: "stdin", shell: false, role: "architect" } }
  }), "utf8");
  const entry = path.resolve(".tmp", "test-dist", "src", "index.js");
  const result = await runInteractive(process.execPath, [entry, "chat", "--config", configPath, "--trust-config"], process.cwd(), "/agents\nFirst question\n/consult second\n/use second\nSecond question\n/exit\n");
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Palabre · mock \(reviewer\)/);
  assert.match(result.stdout, /What would you like to explore/);
  assert.match(result.stdout, /Available agents: mock \(reviewer\), second \(architect\)/);
  assert.match(result.stdout, /First question/);
  assert.match(result.stdout, /Second question/);
  assert.match(result.stdout, /Consulting second/);
  assert.match(result.stdout, /second\x27s opinion/);
  assert.match(result.stdout, /Conversation now continues with second/);
  assert.match(result.stdout, /Conversation with the user/);
});