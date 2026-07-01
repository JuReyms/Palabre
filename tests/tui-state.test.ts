import test from "node:test";
import assert from "node:assert/strict";
import { askAgentSeedsForMode, clearTuiRunOverrides } from "../src/tuiState.js";

test("clearTuiRunOverrides removes stale launch choices but keeps persistent TUI context", () => {
  const flags: Record<string, string | string[] | boolean> = {
    preset: "opencode-gemini",
    "agent-a": "opencode",
    "agent-b": "gemini",
    agents: ["opencode", "gemini"],
    "model-a": "old-a",
    "model-b": "old-b",
    "ollama-url": "http://runtime-host:11434",
    turns: "6",
    files: ["a.ts"],
    context: ["src"],
    "no-summary": true,
    plain: true,
    topic: "ancien sujet",
    mode: "debate",
    renderer: "tui",
    language: "fr",
    config: "palabre.config.json"
  };

  clearTuiRunOverrides(flags);

  assert.deepEqual(flags, {
    topic: "ancien sujet",
    mode: "debate",
    renderer: "tui",
    language: "fr",
    config: "palabre.config.json"
  });
});

test("askAgentSeedsForMode ignores ask defaults when launching a debate", () => {
  assert.deepEqual(
    askAgentSeedsForMode("debate", [], ["opencode", "gemini", "antigravity"]),
    []
  );
});

test("askAgentSeedsForMode uses explicit or configured ask agents only in ask mode", () => {
  assert.deepEqual(
    askAgentSeedsForMode("ask", ["codex", "claude"], ["opencode", "gemini"]),
    ["codex", "claude"]
  );
  assert.deepEqual(
    askAgentSeedsForMode("ask", [], ["opencode", "antigravity"]),
    ["opencode", "antigravity"]
  );
});
