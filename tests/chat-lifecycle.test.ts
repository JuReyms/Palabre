/**
 * Cycle de vie de Chat (#101) : lignes vides sur stdin, terminaison NDJSON après une erreur
 * d'agent ou une annulation, rôle effectif d'une consultation et refus explicite de `--dry-run`.
 * Agents factices Node, dossiers temporaires.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const entry = path.resolve(".tmp", "test-dist", "src", "index.js");
// Agent qui répond en citant le dernier message reçu, et agent qui échoue (code 1).
const echo = "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const m=d.match(/[A-Za-z]+-marker/g)||[];process.stdout.write('reply to '+(m.at(-1)||'?'))})";
const broken = "process.stdin.resume(); process.stdin.on('end',()=>process.exit(1))";

interface Run { code: number | null; stdout: string; stderr: string }

// Module chargé par `--import` dans le seul processus CLI testé. Il observe les événements NDJSON
// écrits sur stdout : `PALABRE_TEST_ABORT_AT` émet l'événement `SIGINT` traité par le gestionnaire
// d'annulation du CLI (sans prétendre simuler une touche Ctrl+C native), et
// `PALABRE_TEST_LIST_AT` note sur stderr le nombre d'exports présents à cet instant.
const hookSource = `
import { readdirSync } from "node:fs";
const write = process.stdout.write.bind(process.stdout);
let aborted = false;
process.stdout.write = (chunk, ...rest) => {
  const result = write(chunk, ...rest);
  for (const line of String(chunk).split("\\n").filter(Boolean)) {
    let event; try { event = JSON.parse(line); } catch { continue; }
    if (event.type === process.env.PALABRE_TEST_LIST_AT) {
      const count = readdirSync(process.env.PALABRE_TEST_LIST_DIR).filter((name) => name.endsWith(".chat.md")).length;
      process.stderr.write("exports-at-" + event.type + "=" + count + "\\n");
    }
    if (!aborted && event.type === process.env.PALABRE_TEST_ABORT_AT) {
      aborted = true;
      setTimeout(() => process.emit("SIGINT"), 50);
    }
  }
  return result;
};
`;

async function hookUrl(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "palabre-chat-hook-"));
  const file = path.join(dir, "hook.mjs");
  await writeFile(file, hookSource, "utf8");
  return pathToFileURL(file).href;
}

/**
 * Lance le CLI avec le hook, en gardant stdin **ouvert** : les lignes sont écrites sans fermer
 * l'entrée. stdin n'est fermé qu'après l'événement `done`, pour vérifier qu'une fermeture
 * ultérieure ne change pas l'issue.
 */
async function runWithOpenStdin(args: string[], lines: string[], env: Record<string, string>): Promise<Run & { doneWhileOpen: boolean }> {
  const hook = await hookUrl();
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", hook, entry, ...args], { stdio: ["pipe", "pipe", "pipe"], env: { ...process.env, ...env } });
    let stdout = "";
    let stderr = "";
    let doneWhileOpen = false;
    const guard = setTimeout(() => child.kill(), 20_000);
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      if (!doneWhileOpen && /"type":"done"/.test(stdout)) {
        doneWhileOpen = true;
        child.stdin.end();
      }
    });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => { clearTimeout(guard); resolve({ code, stdout, stderr, doneWhileOpen }); });
    for (const line of lines) child.stdin.write(`${line}\n`);
  });
}

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
  // `flaky` répond au premier appel puis échoue : il sert d'agent initial puis d'agent consulté.
  const flakyCalls = path.join(dir, "flaky.log");
  const flaky = `const fs=require('fs');const n=fs.existsSync(${JSON.stringify(flakyCalls)})?fs.readFileSync(${JSON.stringify(flakyCalls)},'utf8').length:0;fs.appendFileSync(${JSON.stringify(flakyCalls)},'x');process.stdin.resume();process.stdin.on('end',()=>{if(n>0)process.exit(1);process.stdout.write('first answer')})`;
  const configPath = path.join(dir, "palabre.config.json");
  await writeFile(configPath, JSON.stringify({
    language: "en",
    outputDir: options.outputDir ?? dir,
    defaults: { agentA: "ok" },
    agents: { ok: agent(echo, "reviewer"), broken: agent(broken, "critic"), flaky: agent(flaky, "critic") }
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

test("cancelling while Chat waits for its first message ends the flow: cancelled error, done null, code 130", async () => {
  const env = await setup();
  const result = await runWithOpenStdin(["chat", "--json", ...env.base], [], { PALABRE_TEST_ABORT_AT: "start" });

  assert.equal(result.doneWhileOpen, true, "done must arrive while stdin is still open");
  assert.equal(result.code, 130, result.stderr);
  const flow = events(result.stdout);
  assert.deepEqual(flow.map((event) => event.type), ["start", "error", "done"]);
  assert.deepEqual(flow[1], { v: 1, type: "error", phase: "chat", kind: "cancelled", message: "Conversation cancelled by the user." });
  assert.deepEqual(flow[2], { v: 1, type: "done", outputPath: null });
  assert.deepEqual(await env.exports(), []);
  assert.equal(await env.callCount(), 0);
});

test("cancelling between two messages exports the partial transcript and does not blame the finished send", async () => {
  const env = await setup();
  const result = await runWithOpenStdin(["chat", "--json", ...env.base], [json({ type: "chat-send", content: "first-marker" })], { PALABRE_TEST_ABORT_AT: "chat-message" });

  assert.equal(result.doneWhileOpen, true, "done must arrive while stdin is still open");
  assert.equal(result.code, 130, result.stderr);
  const flow = events(result.stdout);
  assert.deepEqual(flow.slice(-3).map((event) => event.type), ["chat-message", "error", "done"]);
  const error = flow.at(-2);
  assert.equal(error.kind, "cancelled");
  assert.equal(error.message, "Conversation cancelled by the user.");
  // Au repos, aucune action n'est en cours : ni action, ni agent, ni rôle hérités du dernier envoi.
  assert.equal("action" in error, false);
  assert.equal("agent" in error, false);
  assert.equal("role" in error, false);
  assert.equal(flow.filter((event) => event.type === "done").length, 1);
  assert.match(flow.at(-1).outputPath, /\.chat\.md$/);
  assert.match(await readFile(flow.at(-1).outputPath, "utf8"), /first-marker/);
  assert.equal(await env.callCount(), 1);
});

test("a consultation announces the agent's effective role, temporary override included", async () => {
  const env = await setup();
  const input = [
    json({ type: "chat-send", content: "first-marker" }),
    json({ type: "chat-use", agent: "ok" }),
    json({ type: "chat-consult", agent: "flaky" })
  ];
  const result = await run(["chat", "--json", "--agent-a", "flaky", "--role-a", "architect", ...env.base], input.join("\n") + "\n");

  assert.equal(result.code, 1, result.stderr);
  const flow = events(result.stdout);
  assert.equal(flow.find((event) => event.type === "chat-message").role, "architect");
  assert.equal(flow.find((event) => event.type === "chat-consultation-start").role, "architect");
  assert.equal(flow.filter((event) => event.type === "thinking-start").at(-1).role, "architect");
  const error = flow.find((event) => event.type === "error");
  assert.deepEqual([error.action, error.agent, error.role], ["consult", "flaky", "architect"]);
});

test("the error event is emitted before the partial export is written", async () => {
  const env = await setup();
  const result = await runWithOpenStdin(["chat", "--json", ...env.base], [
    json({ type: "chat-send", content: "first-marker" }),
    json({ type: "chat-use", agent: "broken" }),
    json({ type: "chat-send", content: "Fail now" })
  ], { PALABRE_TEST_LIST_AT: "error", PALABRE_TEST_LIST_DIR: env.dir });

  assert.equal(result.code, 1, result.stderr);
  assert.match(result.stderr, /exports-at-error=0/);
  const flow = events(result.stdout);
  assert.deepEqual(flow.slice(-2).map((event) => event.type), ["error", "done"]);
  assert.match(flow.at(-1).outputPath, /\.chat\.md$/);
  assert.equal((await env.exports()).length, 1);
});
