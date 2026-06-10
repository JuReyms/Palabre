import test from "node:test";
import assert from "node:assert/strict";
import { runDebate } from "../src/orchestrator.js";
import { createTranslator } from "../src/i18n.js";
import type { DebateOptions, PalabreConfig, SessionContext } from "../src/types.js";

test("runDebate can early-stop on explicit English agreement", async () => {
  const config: PalabreConfig = {
    agents: {
      first: scriptedCliAgent("First point."),
      second: scriptedCliAgent("Complete agreement. Nothing to add.")
    }
  };
  const result = await runDebate(config, debateOptions({
    language: "en",
    turns: 4,
    summaryEnabled: false
  }), undefined, createTranslator("en"));

  assert.equal(result.messages.length, 2);
  assert.equal(result.stopReason, "Clear agreement detected after a complete round.");
});

test("runDebate stops before launching the next turn when aborted", async () => {
  const controller = new AbortController();
  const config: PalabreConfig = {
    agents: {
      first: scriptedCliAgent("First point."),
      second: scriptedCliAgent("Should not run.")
    }
  };
  const options = debateOptions({
    turns: 2,
    summaryEnabled: false,
    signal: controller.signal
  });
  controller.abort();

  const result = await runDebate(config, options, undefined, createTranslator("en"));

  assert.equal(result.messages.length, 0);
  assert.equal(result.failure?.kind, "cancelled");
  assert.equal(result.failure?.message, "Debate cancelled by the user.");
});

function scriptedCliAgent(output: string): PalabreConfig["agents"][string] {
  return {
    type: "cli",
    command: process.execPath,
    args: ["-e", `console.log(${JSON.stringify(output)})`],
    promptMode: "stdin",
    role: "reviewer"
  };
}

function debateOptions(overrides: Partial<DebateOptions> = {}): DebateOptions {
  return {
    language: "fr",
    topic: "Test topic",
    agentA: "first",
    agentB: "second",
    turns: 2,
    session: session(),
    files: [],
    pullModels: false,
    summaryEnabled: false,
    earlyStopOnAgreement: true,
    plainOutput: true,
    ...overrides
  };
}

function session(): SessionContext {
  return {
    startedAt: "2026-06-09T00:00:00.000Z",
    localDate: "2026-06-09",
    timeZone: "Europe/Paris",
    cwd: "C:\\Users\\jurey\\Documents\\Dev\\Palabre"
  };
}
