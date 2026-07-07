import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { runDoctor } from "../src/doctor.js";

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
