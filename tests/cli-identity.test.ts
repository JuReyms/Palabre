/** @file Titres humains, restauration et absence de contrôles dans les sorties machine. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";
import { rawCommandName } from "../src/args.js";
import { startCliIdentity, type CliIdentityHost } from "../src/cliIdentity.js";

const ESC = "\x1b";
const push = `${ESC}[22;0t`;
const pop = `${ESC}[23;0t`;
const title = (mode: string) => `${ESC}]2;Palabre · ${mode}${ESC}\\`;

/** Faux hôte : conserve l'ordre entre la pile terminal et le titre natif. */
function fixture(overrides: Partial<CliIdentityHost> = {}) {
  const effects: string[] = [];
  const host: CliIdentityHost = {
    getTitle: () => "Titre précédent",
    setTitle: (value) => { effects.push(`process:${value}`); },
    write: (value) => { effects.push(value); },
    isTTY: true, env: {}, ...overrides
  };
  return { host, effects };
}

test("logical name uses a known command, never a subject or an option value", () => {
  for (const [args, expected] of [
    [["relay", "--help"], "relay"], [["--language", "en", "ask"], "ask"],
    [["--config", "relay", "chat"], "chat"], [["-s", "relay"], "run"],
    [["codex-claude", "topic"], "run"], [[`subject${ESC}]2;injection`], "run"],
    [[], "run"]
  ] as const) assert.equal(rawCommandName(args), expected);
});

test("TTY saves before renaming, updates a closed mode list, restores once", () => {
  const { host, effects } = fixture();
  const identity = startCliIdentity(["relay"], "fr", host);
  identity.update("debate", "en");
  identity.update("debate", "en");
  identity.update("chat", "fr");
  identity.update("mission", "fr");
  identity.update(`injected${ESC}`, "fr");
  identity.dispose();
  identity.dispose();
  identity.update("ask", "fr");
  assert.deepEqual(effects, [push, "process:palabre relay", title("Relay"), title("Debate"),
    title("Chat"), title("Mission"), `${ESC}]2;Palabre${ESC}\\`, "process:Titre précédent", pop]);
});

test("French Debate, Ask and ASCII titles follow the selected mode", () => {
  const normal = fixture();
  const identity = startCliIdentity(["run", "--mode", "debate"], "fr", normal.host);
  identity.update("ask", "fr");
  identity.dispose();
  assert.ok(normal.effects.includes(title("Débat")));
  assert.ok(normal.effects.includes(title("Ask")));
  const ascii = fixture({ env: { PALABRE_ASCII: "1" } });
  startCliIdentity(["run", "--mode", "debate"], "fr", ascii.host).dispose();
  assert.ok(ascii.effects.includes(`${ESC}]2;Palabre - Debat${ESC}\\`));
});

for (const [name, args, overrides] of [
  ["pipe", ["relay"], { isTTY: false }],
  ["JSON", ["relay", "--json"], {}],
  ["JSON assignment", ["relay", "--json=true"], {}],
  ["NDJSON", ["run", "--renderer", "ndjson"], {}],
  ["NDJSON assignment", ["run", "--renderer=ndjson"], {}],
  ["NO_COLOR", ["relay"], { env: { NO_COLOR: "" } }],
  ["dumb terminal", ["relay"], { env: { TERM: "dumb" } }]
] as [string, string[], Partial<CliIdentityHost>][]) {
  test(`${name}: no title bytes, even after a mode change or cleanup`, () => {
    const { host, effects } = fixture(overrides);
    const identity = startCliIdentity(args, "fr", host);
    identity.update("chat", "en");
    identity.dispose();
    assert.deepEqual(effects, ["process:palabre " + rawCommandName(args), "process:Titre précédent"]);
  });
}

test("decorative failures do not throw or invent a title to restore", () => {
  const { host } = fixture({
    getTitle: () => { throw Error("unavailable"); },
    setTitle: () => { throw Error("unavailable"); },
    write: () => { throw Error("unavailable"); }
  });
  assert.doesNotThrow(() => startCliIdentity(["relay"], "fr", host).dispose());
});

/** Exécute le vrai point d'entrée, avec un TTY simulé au besoin et sans agent réel. */
function runCli(args: string[], preload: string): Promise<{ code: number | null; stdout: string; stderr: string }> {
  const entry = fileURLToPath(new URL("../src/index.js", import.meta.url));
  const env: NodeJS.ProcessEnv = { ...process.env, TERM: "xterm-256color" };
  delete env.NO_COLOR;
  delete env.PALABRE_ASCII;
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", pathToFileURL(preload).href, entry, ...args], {
      env, stdio: ["ignore", "pipe", "pipe"], timeout: 30_000
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

test("real CLI: TTY help gets a temporary title; JSON errors and piped help do not", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "palabre-title-"));
  try {
    const tty = path.join(dir, "tty.mjs");
    const pipe = path.join(dir, "pipe.mjs");
    await writeFile(tty, "Object.defineProperty(process.stdout, 'isTTY', {value:true});");
    await writeFile(pipe, "Object.defineProperty(process.stdout, 'isTTY', {value:false});");
    const help = await runCli(["relay", "--help"], tty);
    assert.equal(help.code, 0, help.stderr);
    assert.ok(help.stdout.startsWith(push + title("Relay")));
    assert.ok(help.stdout.endsWith(pop));
    const json = await runCli(["relay", "--json"], tty);
    assert.notEqual(json.code, 0);
    assert.ok(!json.stdout.includes(ESC));
    assert.equal(JSON.parse(json.stdout).v, 1);
    const piped = await runCli(["--help"], pipe);
    assert.equal(piped.code, 0, piped.stderr);
    assert.ok(!piped.stdout.includes(ESC));
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("real CLI: a complete NDJSON run remains JSON-only in a simulated TTY", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "palabre-title-ndjson-"));
  try {
    const preload = path.join(dir, "tty.mjs");
    await writeFile(preload, "Object.defineProperty(process.stdout, 'isTTY', {value:true});");
    const mock = "process.stdin.resume();process.stdin.on('end',()=>process.stdout.write('mock response'))";
    const agent = { type: "cli", command: process.execPath, args: ["-e", mock], promptMode: "stdin", shell: false, role: "reviewer" };
    const config = path.join(dir, "palabre.config.json");
    await writeFile(config, JSON.stringify({ language: "en", outputDir: path.join(dir, "out"),
      defaults: { agentA: "a", agentB: "b", turns: 2 }, agents: { a: agent, b: agent } }));
    for (const machineFlags of [["--renderer", "ndjson"], ["--json"]]) {
      const result = await runCli(["run", "--config", config, ...machineFlags, "--no-summary", "--no-early-stop", "-s", "Fictional title check"], preload);
      assert.equal(result.code, 0, result.stderr);
      assert.ok(!result.stdout.includes(ESC));
      const events = result.stdout.trim().split(/\r?\n/).map((line) => JSON.parse(line));
      assert.equal(events[0].type, "start");
      assert.equal(events.at(-1).type, "done");
      assert.ok(events.every((event) => event.v === 1));
    }
    // Sans --mode explicite, le titre suit aussi le mode et la langue de la configuration.
    await writeFile(config, JSON.stringify({ language: "fr", outputDir: path.join(dir, "out"),
      defaults: { agentA: "a", agentB: "b", mode: "ask", turns: 2 }, agents: { a: agent, b: agent } }));
    const ask = await runCli(["run", "--config", config, "--renderer", "plain", "--no-summary", "-s", "Fictional title check"], preload);
    assert.equal(ask.code, 0, ask.stderr);
    assert.ok(ask.stdout.includes(title("Ask")));
    assert.ok(ask.stdout.endsWith(pop));
    const debate = await runCli(["run", "--config", config, "--mode", "debate", "--language", "fr", "--renderer", "plain", "--no-summary", "--no-early-stop", "-s", "Fictional title check"], preload);
    assert.equal(debate.code, 0, debate.stderr);
    assert.ok(debate.stdout.includes(title("Débat")));
    assert.ok(debate.stdout.endsWith(pop));
  } finally { await rm(dir, { recursive: true, force: true }); }
});
