import test from "node:test";
import assert from "node:assert/strict";
import { exampleConfig } from "../src/config.js";
import { createTranslator } from "../src/i18n.js";
import { listAgentsWithAvailability, listPresetsWithAvailability, resolvePreset } from "../src/presets.js";
import type { ToolDiscovery } from "../src/discovery.js";

function discovery(overrides: Partial<ToolDiscovery> = {}): ToolDiscovery {
  return {
    codex: { available: true, command: "codex", path: "C:/bin/codex.cmd" },
    claude: { available: true, command: "claude.exe", path: "C:/bin/claude.exe" },
    antigravity: { available: false, command: "agy" },
    opencode: { available: false, command: "opencode" },
    vibe: { available: false, command: "vibe" },
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
  const codexAntigravity = presets.find((preset) => preset.name === "codex-antigravity");

  assert.equal(codexClaude?.available, true);
  assert.equal(codexOpencode?.available, false);
  assert.deepEqual(codexOpencode?.missingAgents, ["opencode"]);
  assert.match(codexOpencode?.unavailableReasons[0] ?? "", /opencode/);
  assert.equal(codexAntigravity?.available, false);
  assert.deepEqual(codexAntigravity?.missingAgents, ["antigravity"]);
  assert.match(codexAntigravity?.unavailableReasons[0] ?? "", /agy/);
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

test("listAgentsWithAvailability exposes active configured agents with CLI-owned availability", () => {
  const config = structuredClone(exampleConfig);
  config.agents.gemini = {
    type: "cli",
    command: "gemini",
    role: "reviewer"
  };
  config.agents.custom = {
    type: "cli",
    command: "custom-agent",
    role: "scout"
  };
  const agents = listAgentsWithAvailability(config, discovery());

  assert.equal(agents.some((agent) => agent.name === "gemini"), false);
  assert.equal(agents.find((agent) => agent.name === "claude")?.available, true);
  assert.equal(agents.find((agent) => agent.name === "opencode")?.available, false);
  assert.match(
    agents.find((agent) => agent.name === "opencode")?.unavailableReason ?? "",
    /opencode/
  );
  assert.deepEqual(agents.find((agent) => agent.name === "custom"), {
    name: "custom",
    type: "cli",
    role: "scout",
    available: true
  });
});

test("listAgentsWithAvailability uses each Ollama agent server discovery", () => {
  const config = structuredClone(exampleConfig);
  config.agents["ollama-reviewer"] = {
    type: "ollama",
    baseUrl: "http://reviewer.example:11434",
    model: "reviewer-model",
    role: "reviewer"
  };
  const local = {
    available: true,
    commandAvailable: false,
    baseUrl: "http://local.example:11434",
    models: ["nemotron-3-nano:4b"]
  };
  const reviewer = {
    available: true,
    commandAvailable: false,
    baseUrl: "http://reviewer.example:11434",
    models: ["reviewer-model"]
  };
  const agents = listAgentsWithAvailability(config, discovery({
    ollama: local,
    ollamaAgents: {
      "ollama-local": local,
      "ollama-reviewer": reviewer
    }
  }));

  assert.equal(agents.find((agent) => agent.name === "ollama-local")?.available, true);
  assert.equal(agents.find((agent) => agent.name === "ollama-reviewer")?.available, true);
});

test("resolvePreset localizes unknown preset errors", () => {
  assert.throws(
    () => resolvePreset("codex-codex", createTranslator("en")),
    /Unknown preset: codex-codex/
  );
});
