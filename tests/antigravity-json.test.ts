/** @file Régressions hors ligne du transport JSON Antigravity : intégrité, refus stricts et migrations exactes. */
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createAgent } from "../src/adapters/index.js";
import { exampleConfig, legacyArgsInConfigFile, loadConfig, persistAgentSync } from "../src/config.js";
import { AdapterError } from "../src/errors.js";
import { runDoctor } from "../src/doctor.js";
import type { AgentPrompt, CliAgentConfig } from "../src/types.js";
import type { ToolDiscovery } from "../src/discovery.js";
import { npmPowerShellShim } from "./fixtures/external-sessions/npm-shim.js";

const prompt: AgentPrompt = {
  topic: "Fixture JSON", turn: 1, totalTurns: 1, selfName: "fixture", peerName: "peer", selfRole: "reviewer",
  session: { startedAt: "2026-10-28T00:00:00Z", localDate: "2026-10-28", timeZone: "UTC", cwd: process.cwd() }, transcript: [], files: []
};
const content = "### Consensus\n\n* Date retenue : mercredi 28 octobre 2026\n\n### Conclusion\n\nLe test est bien fini.\n";
const success = JSON.stringify({ status: "SUCCESS", response: content, conversation_id: "fixture-only", usage: { total_tokens: 1 } });

/** Lance seulement Node, jamais un outil IA ; stdout/stderr et sortie sont contrôlés par la fixture. */
function fixture(stdout: string, overrides: Partial<CliAgentConfig> = {}, exit = 0, stderr = "") {
  return createAgent("fixture", {
    type: "cli", command: process.execPath, role: "reviewer", responseFormat: "antigravity-json", timeoutMs: 3000,
    args: ["-e", `process.stdout.write(${JSON.stringify(stdout)}); process.stderr.write(${JSON.stringify(stderr)}); process.exitCode=${exit}`],
    ...overrides
  });
}

test("JSON Antigravity : espaces, accents, paragraphes et LF final préservés, métadonnées exclues", async () => {
  const response = await fixture(success).generate(prompt);
  assert.equal(response.content, content);
  assert.equal(response.raw, success);
  assert.doesNotMatch(response.content, /fixture-only|total_tokens/);
});

for (const [label, value] of Object.entries({
  text: "une réponse brute", truncated: '{"status":"SUCCESS",', logs: `log\n${success}`,
  multiple: `${success}\n${success}`, array: `[${success}]`, null: "null", wrongStatus: '{"status":"ERROR","response":"partielle"}',
  missingStatus: '{"response":"texte"}', missingResponse: '{"status":"SUCCESS"}', wrongResponse: '{"status":"SUCCESS","response":2}'
})) {
  test(`JSON Antigravity : refuse ${label} même si allowEmptyOutput`, async () => {
    await assert.rejects(fixture(value, { allowEmptyOutput: true }).generate(prompt),
      (e: unknown) => e instanceof AdapterError && e.kind === "unknown" && /JSON/.test(e.message));
  });
}

test("JSON Antigravity : réponse vide ou composée de contrôles refusée et ANSI assaini", async () => {
  for (const response of ["", " \n\t", "\u001b[31m\u001b[0m"]) {
    await assert.rejects(fixture(JSON.stringify({ status: "SUCCESS", response }), { allowEmptyOutput: true }).generate(prompt),
      (e: unknown) => e instanceof AdapterError && e.kind === "empty-output");
  }
  assert.equal((await fixture(JSON.stringify({ status: "SUCCESS", response: "\u001b[31mBien\u001b[0m\n\nfin\n" })).generate(prompt)).content, "Bien\n\nfin\n");
});

test("JSON Antigravity : exit non nul refuse même un objet SUCCESS ; quota stderr reste classé", async () => {
  await assert.rejects(fixture(success, {}, 1).generate(prompt), (e: unknown) => e instanceof AdapterError && e.kind === "non-zero-exit");
  await assert.rejects(fixture("", {}, 0, "Individual quota reached").generate(prompt), (e: unknown) => e instanceof AdapterError && e.kind === "usage-limit");
});

test("JSON Antigravity : budget cumulé, timeout et annulation restent actifs", async () => {
  await assert.rejects(fixture(success, { maxOutputBytes: 10 }).generate(prompt), (e: unknown) => e instanceof AdapterError && e.kind === "output-too-large");
  await assert.rejects(fixture(success, { args: ["-e", "setTimeout(() => {}, 10000)"], timeoutMs: 40 }).generate(prompt),
    (e: unknown) => e instanceof AdapterError && e.kind === "timeout");
  await assert.rejects(fixture(success).generate({ ...prompt, signal: AbortSignal.abort() }),
    (e: unknown) => e instanceof AdapterError && e.kind === "cancelled");
});

test("Formats CLI : texte inchangé et format inconnu refusé avant spawn", async () => {
  assert.equal((await fixture("  brut\n", { responseFormat: undefined }).generate(prompt)).content, "brut");
  await assert.rejects(fixture(success, { command: "commande-inexistante", responseFormat: "inconnu" as never }).generate(prompt),
    (e: unknown) => e instanceof AdapterError && e.kind === "spawn-failed" && /responseFormat/.test(e.message));
});

test("Format JSON sur PTY : refus avant import PTY ou lancement, doctor FR/EN actionnable", async () => {
  const agent = { type: "cli-pty", command: "commande-inexistante", role: "reviewer", responseFormat: "antigravity-json" } as const;
  await assert.rejects(createAgent("fixture", agent).generate(prompt),
    (e: unknown) => e instanceof AdapterError && e.kind === "spawn-failed" && /responseFormat/.test(e.message));
  const dir = await mkdtemp(path.join(os.tmpdir(), "agy-doctor-"));
  const file = path.join(dir, "config.json");
  for (const configured of [agent, { ...agent, type: "cli", responseFormat: "inconnu" }]) {
    await writeFile(file, JSON.stringify({ agents: { fixture: configured } }));
    for (const language of ["fr", "en"] as const) {
      const result = await runDoctor(file, true, language, { checkVersion: false, discovery, windowsPowerShell: { platform: "linux" } });
      assert.equal(result.ok, false);
      assert.match(result.output, /responseFormat.*"type": "cli"/);
    }
  }
});

test("JSON Antigravity : UTF-8 invalide refusé, aucun décodage de secours", async () => {
  await assert.rejects(fixture("", { args: ["-e", "process.stdout.write(Buffer.from([0x7b, 0xff, 0x7d]))"] }).generate(prompt),
    (e: unknown) => e instanceof AdapterError && e.kind === "unknown");
});

test("JSON batch Windows : défaut adapté à un shim npm sur PATH, sans exécuter le wrapper", { skip: process.platform !== "win32" }, async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "agy-shim-"));
  const name = `palabre-agy-fixture-${process.pid}`;
  const script = "node_modules/fake-cli/cli.cjs";
  await mkdir(path.join(dir, "node_modules/fake-cli"), { recursive: true });
  await writeFile(path.join(dir, `${name}.ps1`), npmPowerShellShim(script));
  await writeFile(path.join(dir, `${name}.cmd`), "@echo off\r\nexit /b 99\r\n");
  await writeFile(path.join(dir, script), `process.stdout.write(${JSON.stringify(success)})`);
  const previousPath = process.env.PATH;
  process.env.PATH = `${dir}${path.delimiter}${previousPath ?? ""}`;
  try {
    const config = exampleConfig.agents.antigravity;
    assert.equal(config.type, "cli");
    if (config.type !== "cli") throw new Error("batch attendu");
    assert.equal(config.shell, true);
    const response = await createAgent("fixture", { ...config, command: name }).generate(prompt);
    assert.equal(response.content, content);
  } finally {
    if (previousPath === undefined) delete process.env.PATH;
    else process.env.PATH = previousPath;
  }
});

const legacy = { type: "cli-pty", command: "C:/bin/agy.exe", args: ["--print-timeout", "5m0s", "--print"], promptMode: "argument", role: "critic", model: "choisi", timeoutMs: 12345 };
const discovery: ToolDiscovery = {
  codex: { available: false, command: "codex" }, claude: { available: false, command: "claude" },
  antigravity: { available: false, command: "agy" }, opencode: { available: false, command: "opencode" },
  vibe: { available: false, command: "vibe" }, ollama: { available: false, commandAvailable: false, baseUrl: "http://localhost:11434", models: [] }
};

test("Migration Antigravity : défaut exact seulement, persistance explicite et idempotence", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "agy-config-"));
  const file = path.join(dir, "config.json");
  const original = JSON.stringify({ agents: { antigravity: legacy } });
  await writeFile(file, original);
  const config = await loadConfig(file);
  assert.deepEqual(config.agents.antigravity, { ...legacy, type: "cli", args: ["--print-timeout", "5m0s", "--output-format", "json", "--print"], responseFormat: "antigravity-json", shell: process.platform === "win32" });
  assert.equal(await readFile(file, "utf8"), original);
  assert.deepEqual(await legacyArgsInConfigFile(file), ["antigravity"]);
  assert.equal((await persistAgentSync(file, config, async () => discovery, { persistLegacyArgs: false })).changed, false);
  assert.equal((await persistAgentSync(file, config, async () => discovery)).changed, true);
  assert.equal((await persistAgentSync(file, config, async () => discovery)).changed, false);
  assert.equal((await loadConfig(file)).agents.antigravity.type, "cli");
});

test("Migration Antigravity : personnalisations transport/commande intactes", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "agy-custom-"));
  const file = path.join(dir, "config.json");
  for (const change of [{ args: [...legacy.args, "--mode", "plan"] }, { command: "mon-wrapper" }, { command: "C:/bin/agy.ps1" }, { command: "agy.cmd" }, { type: "cli" }, { cols: 90 }, { rows: 30 }, { shell: true }, { shell: false }, { idleTimeoutMs: 60000 }, { promptMode: "stdin" }, { responseFormat: "text" }]) {
    const agent = { ...legacy, ...change };
    await writeFile(file, JSON.stringify({ agents: { antigravity: agent } }));
    assert.deepEqual((await loadConfig(file)).agents.antigravity, agent);
    assert.deepEqual(await legacyArgsInConfigFile(file), []);
  }
  assert.equal(exampleConfig.agents.antigravity.type, "cli");
});

test("Migration Antigravity : édition concurrente préservée", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "agy-race-"));
  const file = path.join(dir, "config.json");
  await writeFile(file, JSON.stringify({ agents: { antigravity: legacy } }));
  const config = await loadConfig(file);
  const edited = JSON.stringify({ agents: { antigravity: { ...legacy, model: "édition humaine" } } });
  const result = await persistAgentSync(file, config, async () => { await writeFile(file, edited); return discovery; });
  assert.equal(result.conflict, true);
  assert.equal(await readFile(file, "utf8"), edited);
});
