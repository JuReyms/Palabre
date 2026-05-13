import test from "node:test";
import assert from "node:assert/strict";
import { exampleConfig } from "../src/config.js";
import { createTranslator } from "../src/i18n.js";
import { listPresetsWithAvailability, resolvePreset } from "../src/presets.js";
import type { ToolDiscovery } from "../src/discovery.js";

function discovery(overrides: Partial<ToolDiscovery> = {}): ToolDiscovery {
  return {
    codex: { available: true, command: "codex", path: "C:/bin/codex.cmd" },
    claude: { available: true, command: "claude.exe", path: "C:/bin/claude.exe" },
    gemini: { available: false, command: "gemini" },
    opencode: { available: false, command: "opencode" },
    ollama: {
      available: true,
      commandAvailable: true,
      baseUrl: "http://localhost:11434",
      models: ["nemotron-3-nano:4b"]
    },
    ...overrides
  };
}

test("listPresetsWithAvailability marks presets using missing CLIs unavailable", () => {
  const presets = listPresetsWithAvailability(exampleConfig, discovery());
  const codexClaude = presets.find((preset) => preset.name === "codex-claude");
  const codexOpencode = presets.find((preset) => preset.name === "codex-opencode");

  assert.equal(codexClaude?.available, true);
  assert.equal(codexOpencode?.available, false);
  assert.deepEqual(codexOpencode?.missingAgents, ["opencode"]);
  assert.match(codexOpencode?.unavailableReasons[0] ?? "", /opencode/);
});

test("listPresetsWithAvailability marks Ollama presets unavailable when the configured model is missing", () => {
  const config = structuredClone(exampleConfig);
  const presets = listPresetsWithAvailability(config, discovery({
    ollama: {
      available: true,
      commandAvailable: true,
      baseUrl: "http://localhost:11434",
      models: ["gemma4:e4b"]
    }
  }));
  const codexOllama = presets.find((preset) => preset.name === "codex-ollama");

  assert.equal(codexOllama?.available, false);
  assert.deepEqual(codexOllama?.missingAgents, ["ollama-local"]);
  assert.match(codexOllama?.unavailableReasons[0] ?? "", /modèle Ollama absent/);
});

test("listPresetsWithAvailability localizes unavailable reasons", () => {
  const presets = listPresetsWithAvailability(exampleConfig, discovery(), createTranslator("en"));
  const codexOpencode = presets.find((preset) => preset.name === "codex-opencode");

  assert.equal(codexOpencode?.available, false);
  assert.equal(codexOpencode?.unavailableReasons[0], "command not detected for opencode: opencode");
});

test("resolvePreset localizes unknown preset errors", () => {
  assert.throws(
    () => resolvePreset("codex-codex", createTranslator("en")),
    /Unknown preset: codex-codex/
  );
});
