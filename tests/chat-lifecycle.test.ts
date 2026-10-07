/**
 * Cycle de vie de Chat (#101) : lignes vides sur stdin, terminaison NDJSON après une erreur
 * d'agent et refus explicite de `--dry-run`. Agents factices Node, dossiers temporaires.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const entry = path.resolve(".tmp", "test-dist", "src", "index.js");
// Agent qui répond en citant le dernier message reçu, et agent qui échoue (code 1).
const echo = "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const m=d.match(/[A-Za-z]+-marker/g)||[];process.stdout.write('reply to '+(m.at(-1)||'?'))})";
const broken = "process.stdin.resume(); process.stdin.on('end',()=>process.exit(1))";

interface Run { code: number | null; stdout: string; stderr: string }

function run(args: string[], input: string): Promise<Run> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [entry, ...args], { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
    child.stdin.end(input);
  });
}

/** Config temporaire : `ok` répond, `broken` échoue ; `calls` compte chaque lancement d'agent. */
async function setup(options: { outputDir?: string } = {}) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "palabre-chat-lifecycle-"));
  const calls = path.join(dir, "calls.log");
  const counted = (script: string) => `require('fs').appendFileSync(${JSON.stringify(calls)},'x');${script}`;
  const agent = (script: string, role: string) => ({
    type: "cli", command: process.execPath, args: ["-e", counted(script)], promptMode: "stdin", shell: false, role
  });
  const configPath = path.join(dir, "palabre.config.json");
  await writeFile(configPath, JSON.stringify({
    language: "en",
    outputDir: options.outputDir ?? dir,
    defaults: { agentA: "ok" },
    agents: { ok: agent(echo, "reviewer"), broken: agent(broken, "critic") }
  }), "utf8");
  const base = ["--config", configPath, "--trust-config"];
  const exports = async () => (await readdir(dir)).filter((name) => name.endsWith(".chat.md"));
  const callCount = async () => existsSync(calls) ? (await readFile(calls, "utf8")).length : 0;
  return { dir, base, exports, callCount };
}

const json = (command: Record<string, unknown>) => JSON.stringify({ v: 1, ...command });
const events = (stdout: string) => stdout.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));

test("NDJSON Chat ignores blank and whitespace lines, then exports both exchanges", async () => {
  const env = await setup();
  const input = [json({ type: "chat-send", content: "first-marker" }), "", "   ", json({ type: "chat-send", content: "second-marker" }), json({ type: "chat-end" })].join("\n") + "\n";
  const result = await run(["chat", "--renderer", "ndjson", ...env.base], input);

  assert.equal(result.code, 0, result.stderr);
  const flow = events(result.stdout);
  assert.deepEqual(flow.filter((event) => event.type === "chat-message").map((event) => event.content), ["reply to first-marker", "reply to second-marker"]);
  assert.equal(flow.filter((event) => event.type === "done").length, 1);
  assert.match(flow.at(-1).outputPath, /\.chat\.md$/);
  const markdown = await readFile(flow.at(-1).outputPath, "utf8");
  assert.match(markdown, /first-marker/);
  assert.match(markdown, /second-marker/);
  assert.equal(await env.callCount(), 2);
});

test("terminal Chat ignores blank lines (legacy commands) and /end exports both exchanges", async () => {
  const env = await setup();
  const result = await run(["chat", ...env.base], "Hello first-marker\n\n   \nLater second-marker\n/end\n");

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /reply to first-marker/);
  assert.match(result.stdout, /reply to second-marker/);
  const [exported] = await env.exports();
  assert.ok(exported);
  const markdown = await readFile(path.join(env.dir, exported), "utf8");
  assert.match(markdown, /Later second-marker/);
});

test("explicit close and end of stdin stay distinct from /end: no export, done with null", async () => {
  for (const input of [`${json({ type: "chat-send", content: "first-marker" })}\n/home\n${json({ type: "chat-end" })}\n`, `${json({ type: "chat-send", content: "first-marker" })}\n`]) {
    const env = await setup();
    const result = await run(["chat", "--json", ...env.base], input);
    assert.equal(result.code, 0, result.stderr);
    const flow = events(result.stdout);
    assert.deepEqual(flow.filter((event) => event.type === "done"), [{ v: 1, type: "done", outputPath: null }]);
    assert.deepEqual(await env.exports(), []);
  }

  const env = await setup();
  const terminal = await run(["chat", ...env.base], "Hello first-marker\n");
  assert.equal(terminal.code, 0, terminal.stderr);
  assert.deepEqual(await env.exports(), []);
});

test("an agent error during chat-send ends the NDJSON flow with error then exactly one done", async () => {
  const env = await setup();
  const input = [json({ type: "chat-send", content: "first-marker" }), json({ type: "chat-use", agent: "broken" }), json({ type: "chat-send", content: "Fail now" }), json({ type: "chat-end" })].join("\n") + "\n";
  const result = await run(["chat", "--renderer", "ndjson", ...env.base], input);

  assert.equal(result.code, 1);
  const flow = events(result.stdout);
  assert.ok(flow.every((event) => event.v === 1));
  assert.deepEqual(flow.slice(-3).map((event) => event.type), ["thinking-end", "error", "done"]);
  const error = flow.at(-2);
  assert.equal(error.phase, "chat");
  assert.equal(error.action, "send");
  assert.equal(error.agent, "broken");
  assert.equal(error.role, "critic");
  assert.equal(error.kind, "non-zero-exit");
  assert.equal(flow.filter((event) => event.type === "done").length, 1);
  const outputPath = flow.at(-1).outputPath;
  assert.match(outputPath, /\.chat\.md$/);
  const markdown = await readFile(outputPath, "utf8");
  assert.match(markdown, /Interrupted by an error/);
  assert.match(markdown, /Fail now/);
  // La commande `chat-end` qui suit l'erreur n'est pas traitée : un seul export, partiel.
  assert.deepEqual(await env.exports(), [path.basename(outputPath)]);
});

test("an agent error during chat-consult is reported without any accepted opinion", async () => {
  const env = await setup();
  const input = [json({ type: "chat-send", content: "first-marker" }), json({ type: "chat-consult", agent: "broken" })].join("\n") + "\n";
  const result = await run(["chat", "--json", ...env.base], input);

  assert.equal(result.code, 1);
  const flow = events(result.stdout);
  assert.equal(flow.some((event) => event.type === "chat-consultation"), false);
  const error = flow.find((event) => event.type === "error");
  assert.deepEqual([error.phase, error.action, error.agent, error.kind], ["chat", "consult", "broken", "non-zero-exit"]);
  assert.deepEqual(flow.slice(-2).map((event) => event.type), ["error", "done"]);
  assert.match(flow.at(-1).outputPath, /\.chat\.md$/);
});

test("when the partial export fails, the agent error stays identifiable and done carries null", async () => {
  const blocker = path.join(await mkdtemp(path.join(os.tmpdir(), "palabre-chat-blocker-")), "not-a-directory");
  await writeFile(blocker, "file, not a folder", "utf8");
  const env = await setup({ outputDir: blocker });
  const input = [json({ type: "chat-send", content: "first-marker" }), json({ type: "chat-use", agent: "broken" }), json({ type: "chat-send", content: "Fail now" })].join("\n") + "\n";
  const result = await run(["chat", "--json", ...env.base], input);

  assert.equal(result.code, 1);
  const flow = events(result.stdout);
  const error = flow.find((event) => event.type === "error");
  assert.deepEqual([error.action, error.agent, error.kind], ["send", "broken", "non-zero-exit"]);
  assert.deepEqual(flow.at(-1), { v: 1, type: "done", outputPath: null });
});

test("Chat refuses --dry-run before starting: no start event, no agent call, no export", async () => {
  const input = "Hello first-marker\n/end\n";
  for (const args of [["chat", "--dry-run", "--json"], ["run", "--mode", "chat", "--dry-run", "--json"], ["chat", "--dry-run"]]) {
    const env = await setup();
    const result = await run([...args, ...env.base], input);
    assert.equal(result.code, 1, `${args.join(" ")} : ${result.stdout}`);
    assert.equal(result.stdout, "", args.join(" "));
    assert.match(result.stderr, /--dry-run is not available in Chat/);
    assert.equal(await env.callCount(), 0);
    assert.deepEqual(await env.exports(), []);
  }
});
