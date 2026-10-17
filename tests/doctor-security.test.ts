import assert from "node:assert/strict";
import { mkdir, writeFile, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { runDoctor } from "../src/doctor.js";
import type { ToolDiscovery } from "../src/discovery.js";

test("doctor décrit le chemin configuré, présent ou absent, sans lui substituer le PATH", async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "palabre-doctor-path-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const present = path.join(dir, "claude.exe"); await writeFile(present, "never execute this file");
  const cli = { available: false, command: "absent" };
  const discovery: ToolDiscovery = { codex: cli, claude: { available: true, command: "claude", path: "/other/claude.exe" },
    antigravity: cli, opencode: cli, vibe: cli, ollama: { available: false, commandAvailable: false, baseUrl: "http://localhost:11434", models: [] } };
  for (const language of ["fr", "en"] as const) {
    for (const exists of [false, true]) {
      const command = exists ? present : path.join(dir, "missing", "claude.exe");
      const config = path.join(dir, `${language}-${exists}.json`);
      await writeFile(config, JSON.stringify({ agents: { chosen: { type: "cli", command, role: "reviewer" } } }));
      const result = await runDoctor(config, true, language, { checkVersion: false, discovery });
      const line = result.output.split("\n").find(line => line.includes("chosen [cli:reviewer]"));
      assert.ok(line); assert.ok(line.includes(command)); assert.ok(!line.includes("/other/claude.exe"));
      assert.match(line, exists ? /fichier configuré présent|configured file exists/ : /introuvable ou inaccessible|missing or inaccessible/);
    }
  }
});

test("doctor inspects an untrusted project config without contacting its Ollama URLs", async () => {
  const cwd = process.cwd();
  const originalFetch = globalThis.fetch;
  const dir = path.join(os.tmpdir(), `palabre-doctor-security-${process.pid}-${Date.now()}`);
  const requested: string[] = [];
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "palabre.config.json"), JSON.stringify({
    language: "en",
    agents: {
      hostile: {
        type: "ollama",
        baseUrl: "http://hostile.invalid:11434",
        model: "\u001b]52;c;payload\u0007model",
        role: "critic"
      }
    }
  }), "utf8");

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    requested.push(url);
    if (url.includes("registry.npmjs.org")) {
      return new Response(JSON.stringify({ version: "0.0.0" }), { status: 200 });
    }
    return new Response(JSON.stringify({ models: [] }), { status: 200 });
  }) as typeof fetch;

  try {
    process.chdir(dir);
    const result = await runDoctor(undefined, true, "en", { checkVersion: false });
    assert.match(result.output, /Untrusted project config/);
    assert.equal(requested.some((url) => url.includes("hostile.invalid")), false);
    assert.doesNotMatch(result.output, /\u001b\]52|payload/);
  } finally {
    process.chdir(cwd);
    globalThis.fetch = originalFetch;
  }
});
