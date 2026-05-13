import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_OUTPUT_DIR, createConfigFromDiscovery, exampleConfig, resolveOutputDir } from "../src/config.js";
import type { ToolDiscovery } from "../src/discovery.js";

test("resolveOutputDir groups default and legacy root exports in .palabre", () => {
  assert.equal(DEFAULT_OUTPUT_DIR, ".palabre");
  assert.equal(resolveOutputDir(undefined), ".palabre");
  assert.equal(resolveOutputDir(""), ".palabre");
  assert.equal(resolveOutputDir("."), ".palabre");
});

test("resolveOutputDir preserves explicit custom output folders", () => {
  assert.equal(resolveOutputDir("debates"), "debates");
  assert.equal(resolveOutputDir("exports/palabre"), "exports/palabre");
});

test("exampleConfig declares the default interface language", () => {
  assert.equal(exampleConfig.language, "fr");
});

test("createConfigFromDiscovery clears default agents when no pair is detected", () => {
  const config = createConfigFromDiscovery(noDetectedTools());

  assert.equal(config.defaults?.agentA, undefined);
  assert.equal(config.defaults?.agentB, undefined);
  assert.equal(config.defaults?.summaryAgent, undefined);
  assert.equal(config.defaults?.turns, 4);
});

function noDetectedTools(): ToolDiscovery {
  return {
    codex: { available: false, command: "codex" },
    claude: { available: false, command: "claude" },
    gemini: { available: false, command: "gemini" },
    opencode: { available: false, command: "opencode" },
    ollama: {
      available: false,
      commandAvailable: false,
      baseUrl: "http://localhost:11434",
      models: []
    }
  };
}
