import test from "node:test";
import assert from "node:assert/strict";
import { buildExplicitCommand } from "../src/new.js";

test("new wizard builds an equivalent Chat command", () => {
  assert.equal(buildExplicitCommand({
    mode: "chat",
    agentA: "codex",
    agentB: "codex",
    topic: "Review this plan",
    modelA: "gpt-5.6"
  }), 'palabre chat "Review this plan" --agent-a codex --model-a gpt-5.6');
});

test("new wizard keeps the existing Debate command contract", () => {
  assert.equal(buildExplicitCommand({
    mode: "debate",
    agentA: "codex",
    agentB: "claude",
    topic: "Review this plan",
    turns: 4
  }), 'palabre --agent-a codex --agent-b claude "Review this plan" -t 4');
});
