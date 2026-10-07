/**
 * Dispatch des lancements directs selon le mode effectif (#104) : le raccourci avec sujet, les
 * presets et `palabre run` suivent `--mode` puis `defaults.mode` ; le lancement nu garde l'accueil
 * TUI. Unitaires sur la décision, puis bout en bout avec des agents Node factices, sans quota.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, test } from "node:test";
import { parseArgs } from "../src/args.js";
import { createTranslator } from "../src/i18n.js";
import { isDirectChatLaunch, shouldOpenTuiHome } from "../src/launchDispatch.js";

const messages = createTranslator("en");
const config = (mode: "debate" | "ask" | "chat") => ({ defaults: { mode } });
const decide = (args: string[], mode: "debate" | "ask" | "chat") => {
  const parsed = parseArgs(args, messages);
  return { home: shouldOpenTuiHome(parsed), chat: isDirectChatLaunch(parsed, config(mode)) };
};

describe("décision de lancement", () => {
  test("lancement nu : accueil TUI quel que soit le mode, jamais Chat direct", () => {
    for (const mode of ["debate", "ask", "chat"] as const) {
      assert.deepEqual(decide([], mode), { home: true, chat: false }, mode);
      // `--mode` seul ne contourne pas l'accueil : il garde son propre parcours.
      assert.deepEqual(decide(["--mode", "chat"], mode), { home: true, chat: false }, mode);
    }
  });

  test("raccourci avec sujet : suit le mode effectif, comme palabre run", () => {
    for (const args of [["-s", "Sujet"], ["--subject", "Sujet"], ["Un sujet en plusieurs mots"], ["run", "--subject", "Sujet"]]) {
      assert.deepEqual(decide(args, "chat"), { home: false, chat: true }, args.join(" "));
      assert.deepEqual(decide(args, "debate"), { home: false, chat: false }, args.join(" "));
      assert.deepEqual(decide(args, "ask"), { home: false, chat: false }, args.join(" "));
    }
  });

  test("modes explicites prioritaires sur defaults.mode, dans les deux sens", () => {
    assert.equal(decide(["-s", "Sujet", "--mode", "chat"], "debate").chat, true);
    assert.equal(decide(["-s", "Sujet", "--mode", "chat"], "ask").chat, true);
    assert.equal(decide(["-s", "Sujet", "--mode", "debate"], "chat").chat, false);
    assert.equal(decide(["-s", "Sujet", "--mode", "ask"], "chat").chat, false);
    assert.equal(decide(["codex-claude", "-s", "Sujet", "--mode", "debate"], "chat").chat, false);
  });

  test("preset et lancement machine sans sujet : dispatchés vers Chat quand le mode effectif l'est", () => {
    assert.deepEqual(decide(["codex-claude", "-s", "Sujet"], "chat"), { home: false, chat: true });
    assert.deepEqual(decide(["--json"], "chat"), { home: false, chat: true });
    assert.deepEqual(decide(["--json"], "debate"), { home: false, chat: false });
  });

  test("commandes dédiées inchangées", () => {
    assert.equal(decide(["chat"], "debate").chat, true);
    assert.equal(decide(["ask", "Une question à poser"], "chat").chat, false);
    assert.equal(decide(["new"], "chat").chat, false);
    assert.equal(decide(["new"], "chat").home, false);
  });
});

const entry = path.resolve(".tmp", "test-dist", "src", "index.js");

/** Config temporaire avec des agents factices `codex` et `claude`, et un profil utilisateur isolé. */
async function setup(mode: "debate" | "ask" | "chat") {
  const dir = await mkdtemp(path.join(os.tmpdir(), "palabre-launch-dispatch-"));
  const calls = path.join(dir, "calls.log");
  const reply = `require('fs').appendFileSync(${JSON.stringify(calls)},'x');process.stdin.resume();process.stdin.on('end',()=>process.stdout.write('factice'))`;
  const agent = (role: string) => ({ type: "cli", command: process.execPath, args: ["-e", reply], promptMode: "stdin", shell: false, role });
  const configPath = path.join(dir, "palabre.config.json");
  await writeFile(configPath, JSON.stringify({
    language: "en",
    outputDir: dir,
    defaults: { mode, agentA: "codex", agentB: "claude", askAgents: ["codex", "claude"] },
    agents: { codex: agent("implementer"), claude: agent("reviewer") }
  }), "utf8");
  const home = await mkdtemp(path.join(os.tmpdir(), "palabre-launch-home-"));
  const run = (args: string[], input = ""): Promise<{ code: number | null; stdout: string; stderr: string }> => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [entry, ...args, "--config", configPath, "--trust-config"], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, HOME: home, USERPROFILE: home }
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
    child.stdin.end(input);
  });
  const callCount = async () => existsSync(calls) ? (await readFile(calls, "utf8")).length : 0;
  const chatExports = async () => (await readdir(dir)).filter((name) => name.endsWith(".chat.md"));
  return { run, callCount, chatExports };
}

const events = (stdout: string) => stdout.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
const chatInput = `${JSON.stringify({ v: 1, type: "chat-send", content: "Hello" })}\n${JSON.stringify({ v: 1, type: "chat-end" })}\n`;

describe("lancements directs de bout en bout", () => {
  test("defaults.mode chat : le raccourci -s et le sujet positionnel ouvrent Chat, le sujet devient le contexte initial", async () => {
    for (const args of [["-s", "Sujet du chat"], ["Un sujet en plusieurs mots"]]) {
      const env = await setup("chat");
      const result = await env.run([...args, "--json"], chatInput);
      assert.equal(result.code, 0, `${args.join(" ")} : ${result.stderr}`);
      const flow = events(result.stdout);
      assert.equal(flow[0].type, "start");
      assert.equal(flow[0].mode, "chat");
      assert.equal(flow[0].topic, args.at(-1));
      assert.equal(flow.filter((event) => event.type === "chat-message").length, 1);
      assert.match(flow.at(-1).outputPath, /\.chat\.md$/);
      assert.doesNotMatch(result.stderr, /Unknown mode/);
    }
  });

  test("--mode chat explicite ouvre Chat même si le défaut est Débat ou Ask", async () => {
    for (const mode of ["debate", "ask"] as const) {
      const env = await setup(mode);
      const result = await env.run(["-s", "Sujet", "--mode", "chat", "--json"], chatInput);
      assert.equal(result.code, 0, `${mode} : ${result.stderr}`);
      assert.equal(events(result.stdout)[0].mode, "chat");
    }
  });

  test("--mode debate ou ask explicite reste prioritaire sur defaults.mode chat, preset compris", async () => {
    const env = await setup("chat");
    const cases: Array<[string[], string]> = [
      [["-s", "Sujet", "--mode", "debate"], "debate"],
      [["-s", "Sujet", "--mode", "ask"], "ask"],
      [["codex-claude", "-s", "Sujet", "--mode", "debate"], "debate"],
      [["run", "--mode", "debate", "--subject", "Sujet"], "debate"]
    ];
    for (const [args, mode] of cases) {
      const result = await env.run([...args, "--dry-run", "--json"]);
      assert.equal(result.code, 0, `${args.join(" ")} : ${result.stderr}`);
      const preview = JSON.parse(result.stdout);
      assert.deepEqual([preview.type, preview.mode], ["dry-run", mode], args.join(" "));
    }
    assert.equal(await env.callCount(), 0);
  });

  test("preset en mode Chat : refus ciblé sur la combinaison, sans appel ni export", async () => {
    const env = await setup("chat");
    for (const args of [["codex-claude", "-s", "Sujet"], ["run", "--preset", "codex-claude", "--subject", "Sujet"], ["codex-claude", "-s", "Sujet", "--mode", "chat"]]) {
      const result = await env.run([...args, "--json"], chatInput);
      assert.equal(result.code, 1, args.join(" "));
      assert.equal(result.stdout, "", args.join(" "));
      assert.match(result.stderr, /codex-claude preset selects an agent pair for Debate or Ask; Chat uses a single active agent/);
      assert.doesNotMatch(result.stderr, /Unknown mode/);
    }
    assert.equal(await env.callCount(), 0);
    assert.deepEqual(await env.chatExports(), []);
  });

  test("les chemins qui aboutissent à Chat gardent le refus de --dry-run, sans appel agent", async () => {
    const env = await setup("chat");
    for (const args of [["-s", "Sujet"], ["Un sujet en plusieurs mots"], ["-s", "Sujet", "--mode", "chat"]]) {
      const result = await env.run([...args, "--dry-run", "--json"], chatInput);
      assert.equal(result.code, 1, args.join(" "));
      assert.equal(result.stdout, "", args.join(" "));
      assert.match(result.stderr, /--dry-run is not available in Chat/);
    }
    assert.equal(await env.callCount(), 0);
    assert.deepEqual(await env.chatExports(), []);
  });
});
