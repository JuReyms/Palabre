import test from "node:test";
import assert from "node:assert/strict";
import { assertRunnableConfig, DEFAULT_OUTPUT_DIR, createConfigFromDiscovery, exampleConfig, resolveOutputDir, setOllamaModel, syncDetectedAgents, syncDetectedAgentsDetailed, syncOllamaModel } from "../src/config.js";
import { createTranslator } from "../src/i18n.js";
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
  assert.equal(exampleConfig.defaults?.interface, "tui");
});

test("createConfigFromDiscovery clears default agents when no pair is detected", () => {
  const config = createConfigFromDiscovery(noDetectedTools());

  assert.equal(config.defaults?.agentA, undefined);
  assert.equal(config.defaults?.agentB, undefined);
  assert.equal(config.defaults?.summaryAgent, undefined);
  assert.equal(config.defaults?.askSummaryAgent, undefined);
  assert.equal(config.defaults?.turns, 4);
  assert.equal(config.defaults?.interface, "tui");
});

test("createConfigFromDiscovery applies the detected Antigravity command alias", () => {
  const discovery = noDetectedTools();
  discovery.codex = { available: true, command: "codex" };
  discovery.antigravity = { available: true, command: "antigravity", path: "C:/bin/antigravity.cmd" };

  const config = createConfigFromDiscovery(discovery);
  const antigravity = config.agents.antigravity;

  assert.equal(antigravity?.type, "cli-pty");
  assert.equal(antigravity?.command, "antigravity");
});

test("syncDetectedAgents refreshes commands for already configured known agents", () => {
  const discovery = noDetectedTools();
  discovery.claude = { available: true, command: "claude", path: "C:/bin/claude.cmd" };
  discovery.antigravity = { available: true, command: "agy", path: "C:/bin/agy.exe" };
  const config = createConfigFromDiscovery(noDetectedTools());
  const claude = config.agents.claude;

  assert.equal(claude?.type, "cli");
  if (claude?.type === "cli") {
    claude.command = "claude.exe";
  }
  delete config.agents.antigravity;

  const added = syncDetectedAgents(config, discovery);

  assert.deepEqual(added, ["antigravity"]);
  assert.equal(config.agents.claude?.type === "cli" ? config.agents.claude.command : undefined, "claude");
  assert.equal(config.agents.antigravity?.type, "cli-pty");
});

test("syncDetectedAgentsDetailed reports command refreshes without new agents", () => {
  const discovery = noDetectedTools();
  discovery.claude = { available: true, command: "claude", path: "C:/bin/claude.cmd" };
  const config = createConfigFromDiscovery(noDetectedTools());
  const claude = config.agents.claude;

  assert.equal(claude?.type, "cli");
  if (claude?.type === "cli") {
    claude.command = "claude.exe";
  }

  const result = syncDetectedAgentsDetailed(config, discovery);

  assert.deepEqual(result.addedAgents, []);
  assert.equal(result.changed, true);
  assert.equal(config.agents.claude?.type === "cli" ? config.agents.claude.command : undefined, "claude");
});

test("syncDetectedAgentsDetailed leaves custom CLI agents untouched", () => {
  const discovery = noDetectedTools();
  discovery.codex = { available: true, command: "codex", path: "C:/bin/codex.cmd" };
  const config = createConfigFromDiscovery(noDetectedTools());
  const codex = config.agents.codex;
  assert.equal(codex?.type, "cli");
  if (codex?.type === "cli") {
    codex.command = "old-codex";
  }
  config.agents.custom = {
    type: "cli",
    command: "my-custom-agent",
    role: "reviewer"
  };

  const result = syncDetectedAgentsDetailed(config, discovery);

  assert.equal(result.changed, true);
  assert.deepEqual(result.addedAgents, []);
  assert.equal(config.agents.custom?.type === "cli" ? config.agents.custom.command : undefined, "my-custom-agent");
  assert.equal(config.agents.codex?.type === "cli" ? config.agents.codex.command : undefined, "codex");
});

test("syncOllamaModel updates a missing configured model to an installed model", () => {
  const config = createConfigFromDiscovery(noDetectedTools());
  const agent = config.agents["ollama-local"];
  assert.equal(agent?.type, "ollama");
  if (agent?.type !== "ollama") return;
  agent.model = "missing-model:latest";

  const discovery = noDetectedTools();
  discovery.ollama = {
    available: true,
    commandAvailable: true,
    baseUrl: "http://localhost:11434",
    models: ["gemma3:4b", "gemma3:12b"]
  };

  const result = syncOllamaModel(config, discovery);

  assert.deepEqual(result, {
    previousModel: "missing-model:latest",
    nextModel: "gemma3:4b"
  });
  assert.equal(agent.model, "gemma3:4b");
});

test("setOllamaModel updates the configured Ollama model", () => {
  const config = createConfigFromDiscovery(noDetectedTools());
  const result = setOllamaModel(config, "gemma3:12b");

  assert.equal(config.agents["ollama-local"]?.type, "ollama");
  assert.equal(
    config.agents["ollama-local"]?.type === "ollama"
      ? config.agents["ollama-local"].model
      : undefined,
    "gemma3:12b"
  );
  assert.equal(result?.nextModel, "gemma3:12b");
});

test("assertRunnableConfig rejects configs without a usable agents block", () => {
  const messages = createTranslator("en");

  assert.throws(
    () => assertRunnableConfig(null as never, messages, "broken.json"),
    /does not contain a JSON object/
  );
  assert.throws(
    () => assertRunnableConfig({} as never, messages, "broken.json"),
    /has no "agents" block/
  );
  assert.throws(
    () => assertRunnableConfig({ agents: {} } as never, messages, "broken.json"),
    /declares no agent/
  );
});

function noDetectedTools(): ToolDiscovery {
  return {
    codex: { available: false, command: "codex" },
    claude: { available: false, command: "claude" },
    gemini: { available: false, command: "gemini" },
    antigravity: { available: false, command: "agy" },
    opencode: { available: false, command: "opencode" },
    vibe: { available: false, command: "vibe" },
    ollama: {
      available: false,
      commandAvailable: false,
      baseUrl: "http://localhost:11434",
      models: []
    }
  };
}
