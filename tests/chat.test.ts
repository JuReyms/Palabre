import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { runStatelessChatTurn } from "../src/chat.js";
import { buildChatHandoffTopic, ChatSession } from "../src/chatSession.js";
import { createTranslator } from "../src/i18n.js";
import { resolveChatOptions } from "../src/runOptions.js";

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

function runInteractive(command: string, args: string[], cwd: string, input: string, env: NodeJS.ProcessEnv = process.env): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, stdio: ["pipe", "pipe", "pipe"] });
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
    outputDir: dir,
    agents: { mock: { type: "cli", command: process.execPath, args: ["-e", mock], promptMode: "stdin", shell: false, role: "reviewer" }, second: { type: "cli", command: process.execPath, args: ["-e", mock], promptMode: "stdin", shell: false, role: "architect" } }
  }), "utf8");
  const entry = path.resolve(".tmp", "test-dist", "src", "index.js");
  const result = await runInteractive(
    process.execPath,
    [entry, "chat", "--config", configPath, "--trust-config"],
    process.cwd(),
    "/agents\nFirst question\n/consult second\n/use second\nSecond question\n/end\n",
    { ...process.env, PALABRE_CLIENT: "palabre-vscode", PALABRE_CLIENT_VERSION: "1.7.1" }
  );
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Palabre · mock \(reviewer\)/);
  assert.match(result.stdout, /What would you like to explore/);
  assert.match(result.stdout, /Available agents: mock \(reviewer\), second \(architect\)/);
  assert.match(result.stdout, /First question/);
  assert.match(result.stdout, /Second question/);
  assert.match(result.stdout, /second is joining the conversation/);
  assert.match(result.stdout, /second\x27s opinion/);
  assert.match(result.stdout, /Conversation now continues with second/);
  assert.match(result.stdout, /Conversation with the user/);
  assert.match(result.stdout, /Conversation ended/);
  const exported = (await readdir(dir)).find((name) => name.endsWith(".chat.md"));
  assert.ok(exported);
  const markdown = await readFile(path.join(dir, exported), "utf8");
  assert.match(markdown, /\| --- \| --- \|/);
  assert.match(markdown, /\| Palabre CLI version \| \d+\.\d+\.\d+ \|/);
  assert.match(markdown, /\| Invocation source \| palabre-vscode \|/);
  assert.match(markdown, /\| Client version \| 1\.7\.1 \|/);
  assert.match(markdown, /Ended by the user with \/end/);
  assert.match(markdown, /Session ended/);
});

test("CLI chat exports a partial transcript with error termination metadata", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "palabre-chat-error-"));
  const configPath = path.join(dir, "palabre.config.json");
  const success = "process.stdin.resume(); process.stdin.on('end',()=>process.stdout.write('ok'))";
  const failure = "process.stdin.resume(); process.stdin.on('end',()=>process.exit(1))";
  await writeFile(configPath, JSON.stringify({
    language: "en",
    outputDir: dir,
    defaults: { agentA: "ok" },
    agents: {
      ok: { ...config, args: ["-e", success] },
      broken: { ...config, args: ["-e", failure], role: "critic" }
    }
  }), "utf8");
  const entry = path.resolve(".tmp", "test-dist", "src", "index.js");
  const result = await runInteractive(
    process.execPath,
    [entry, "chat", "--config", configPath, "--trust-config"],
    process.cwd(),
    "Hello\n/use broken\nFail now\n"
  );

  assert.equal(result.code, 1);
  assert.match(result.stderr, /partial transcript saved/);
  const exported = (await readdir(dir)).find((name) => name.endsWith(".chat.md"));
  assert.ok(exported);
  const markdown = await readFile(path.join(dir, exported), "utf8");
  assert.match(markdown, /Interrupted by an error/);
  assert.match(markdown, /Error/);
  assert.match(markdown, /Hello/);
});

test("chat options apply runtime overrides without requiring an agent B", () => {
  const messages = createTranslator("en");
  const projectConfig = {
    defaults: { agentA: "mock" },
    agents: { mock: { ...config, model: "configured" } }
  };
  const options = resolveChatOptions({
    flags: { "model-a": "override", "role-a": "architect" },
    config: projectConfig,
    language: "en",
    topic: "",
    files: []
  }, messages);
  const chat = new ChatSession(projectConfig, options, messages);

  assert.equal(chat.activeAgentConfig.model, "override");
  assert.equal(chat.activeAgentConfig.role, "architect");
});

test("run --mode chat is dispatched to Chat instead of Debate", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "palabre-run-chat-"));
  const configPath = path.join(dir, "palabre.config.json");
  await writeFile(configPath, JSON.stringify({
    language: "en",
    defaults: { mode: "debate", agentA: "mock" },
    agents: { mock: config }
  }), "utf8");
  const entry = path.resolve(".tmp", "test-dist", "src", "index.js");
  const result = await runInteractive(
    process.execPath,
    [entry, "run", "--mode", "chat", "--config", configPath, "--trust-config"],
    process.cwd(),
    "Hello\n/exit\n"
  );

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Palabre · mock \(reviewer\)/);
  assert.doesNotMatch(result.stdout, /PALABRE Debate/);
});

test("Chat honors --json with a complete NDJSON v1 flow", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "palabre-chat-ndjson-"));
  const configPath = path.join(dir, "palabre.config.json");
  const mock = "process.stdin.resume(); process.stdin.on('end',()=>process.stdout.write('answer'))";
  await writeFile(configPath, JSON.stringify({
    language: "en",
    outputDir: dir,
    defaults: { agentA: "mock" },
    agents: {
      mock: { ...config, args: ["-e", mock] },
      second: { ...config, args: ["-e", mock], role: "architect" }
    }
  }), "utf8");
  const entry = path.resolve(".tmp", "test-dist", "src", "index.js");
  const result = await runInteractive(
    process.execPath,
    [entry, "run", "--mode", "chat", "--json", "--config", configPath, "--trust-config"],
    process.cwd(),
    "Hello\n/consult second\n/use second\n/end\n"
  );

  assert.equal(result.code, 0, result.stderr);
  const events = result.stdout.trim().split("\n").map((line) => JSON.parse(line));
  assert.deepEqual(events.map((event) => event.type), [
    "start",
    "thinking-start",
    "thinking-end",
    "chat-user-message",
    "chat-message",
    "chat-consultation-start",
    "thinking-start",
    "thinking-end",
    "chat-consultation",
    "chat-agent-changed",
    "done"
  ]);
  assert.equal(events[0].mode, "chat");
  assert.ok(events.every((event) => event.v === 1));
  assert.match(events.at(-1).outputPath, /\.chat\.md$/);
});

test("chat reports when the bounded transcript drops older messages", async () => {
  const messages = createTranslator("en");
  const projectConfig = { defaults: { agentA: "mock" }, agents: { mock: config } };
  const options = resolveChatOptions({
    flags: {},
    config: projectConfig,
    language: "en",
    topic: "",
    files: []
  }, messages);
  const chat = new ChatSession(projectConfig, options, messages);

  await chat.send("one");
  await chat.send("two");
  await chat.send("three");
  await chat.send("four");

  assert.equal(chat.droppedMessageCount, 1);
});

test("chat handoff exposes provenance and keeps only recent exchanges without a summary", () => {
  const transcript = Array.from({ length: 8 }, (_, index) => ({
    agent: `agent-${index + 1}`,
    role: "reviewer" as const,
    content: `message-${index + 1}`,
    createdAt: session.startedAt
  }));
  const handoff = buildChatHandoffTopic("Original subject", "debate", undefined, transcript, "en");

  assert.match(handoff, /Context continued from a Palabre debate session/);
  assert.match(handoff, /Original subject/);
  assert.doesNotMatch(handoff, /message-1/);
  assert.doesNotMatch(handoff, /message-2/);
  assert.match(handoff, /message-8/);
});
