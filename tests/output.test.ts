import assert from "node:assert/strict";
import { test } from "node:test";
import { renderDebateMarkdown } from "../src/output.js";
import type { DebateOptions } from "../src/types.js";

function baseOptions(overrides: Partial<DebateOptions> = {}): DebateOptions {
  return {
    topic: "Model display",
    agentA: "codex",
    agentB: "ollama-local",
    turns: 2,
    session: {
      startedAt: "2026-05-06T10:00:00.000Z",
      localDate: "2026-05-06",
      timeZone: "Europe/Paris",
      cwd: process.cwd()
    },
    files: [],
    modelInfo: {
      agentA: "CLI default",
      agentB: "nemotron-3-nano:4b",
      summary: "claude-sonnet (override)"
    },
    pullModels: false,
    summaryAgent: "claude",
    summaryModel: "claude-sonnet",
    summaryEnabled: true,
    earlyStopOnAgreement: true,
    plainOutput: false,
    ...overrides
  };
}

test("renderDebateMarkdown displays known debate and summary models", () => {
  const markdown = renderDebateMarkdown(baseOptions(), [], undefined);

  assert.match(markdown, /\| Modeles \| codex=CLI default <-> ollama-local=nemotron-3-nano:4b \|/);
  assert.match(markdown, /\| Modele synthese \| claude-sonnet \(override\) \|/);
});