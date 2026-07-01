import test from "node:test";
import assert from "node:assert/strict";
import { createTranslator } from "../src/i18n.js";
import { resolveRunOptions } from "../src/runOptions.js";
import type { PalabreConfig } from "../src/types.js";

const messages = createTranslator("en");
const agents: PalabreConfig["agents"] = {
  codex: { type: "cli", command: "codex", role: "implementer" },
  claude: { type: "cli", command: "claude", role: "reviewer" },
  opencode: { type: "cli", command: "opencode", role: "critic" }
};

function config(defaults: PalabreConfig["defaults"] = {}): PalabreConfig {
  return { agents, defaults };
}

function resolve(flags: Record<string, string | string[] | boolean>, currentConfig: PalabreConfig, preset?: { agentA: string; agentB: string }) {
  return resolveRunOptions({
    flags,
    config: currentConfig,
    language: "en",
    topic: "Review this project",
    files: [],
    preset
  }, messages);
}

test("run options prioritize explicit agents over preset and config defaults", () => {
  const options = resolve(
    { "agent-a": "opencode", "agent-b": "codex", turns: "3", terminal: true },
    config({ agentA: "codex", agentB: "claude", turns: 7 }),
    { agentA: "claude", agentB: "opencode" }
  );

  assert.equal(options.agentA, "opencode");
  assert.equal(options.agentB, "codex");
  assert.equal(options.turns, 3);
  assert.equal(options.plainOutput, true);
  assert.equal(options.summaryAgent, "codex");
});

test("ask mode uses configured agents and ask summary agent", () => {
  const options = resolve({}, config({
    mode: "ask",
    agentA: "codex",
    agentB: "claude",
    askAgents: ["codex", "claude", "opencode"],
    summaryAgent: "claude",
    askSummaryAgent: "opencode"
  }));

  assert.equal(options.mode, "ask");
  assert.deepEqual(options.askAgents, ["codex", "claude", "opencode"]);
  assert.equal(options.summaryAgent, "opencode");
});

test("explicit ask agents are deduplicated and the last one is the summary fallback", () => {
  const options = resolve(
    { mode: "ask", agents: ["codex", "claude", "codex"], "no-summary": true },
    config()
  );

  assert.deepEqual(options.askAgents, ["codex", "claude"]);
  assert.equal(options.summaryAgent, "claude");
  assert.equal(options.summaryEnabled, false);
});

test("invalid mode is rejected while resolving run options", () => {
  assert.throws(() => resolve({ mode: "panel" }, config({ agentA: "codex", agentB: "claude" })), /Unknown mode/);
});
