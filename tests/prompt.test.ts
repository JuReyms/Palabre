import test from "node:test";
import assert from "node:assert/strict";
import { formatAgentPrompt } from "../src/prompt.js";
import type { AgentPrompt } from "../src/types.js";

function basePrompt(overrides: Partial<AgentPrompt> = {}): AgentPrompt {
  return {
    topic: "Choose a cache strategy",
    turn: 1,
    totalTurns: 4,
    selfName: "codex",
    peerName: "claude",
    selfRole: "architect",
    session: {
      startedAt: "2026-05-13T10:00:00.000Z",
      localDate: "2026-05-13",
      timeZone: "Europe/Paris",
      cwd: "C:\\repo\\Palabre"
    },
    files: [],
    transcript: [],
    ...overrides
  };
}

test("formatAgentPrompt follows the selected interface language", () => {
  const prompt = formatAgentPrompt(basePrompt({ language: "en" }));

  assert.match(prompt, /^Subject: Choose a cache strategy/);
  assert.match(prompt, /You are codex\. You are answering turn 1\./);
  assert.match(prompt, /PALABRE session context:/);
  assert.match(prompt, /- Current turn: 1\/4/);
  assert.match(prompt, /History: no message yet\./);
  assert.match(prompt, /Your answer:/);
});

test("formatAgentPrompt keeps French as the fallback language", () => {
  const prompt = formatAgentPrompt(basePrompt());

  assert.match(prompt, /^Sujet: Choose a cache strategy/);
  assert.match(prompt, /Tu es codex\. Tu reponds au tour 1\./);
  assert.match(prompt, /- Tour courant: 1\/4/);
  assert.match(prompt, /Ta reponse:/);
});

test("formatAgentPrompt localizes the summary prompt", () => {
  const prompt = formatAgentPrompt(basePrompt({
    language: "en",
    mode: "summary",
    selfRole: "summarizer"
  }));

  assert.match(prompt, /You are codex\. You are producing the final debate summary\./);
  assert.match(prompt, /Debate transcript:/);
  assert.match(prompt, /### Disagreements \/ uncertainties/);
  assert.match(prompt, /Summary:/);
});
