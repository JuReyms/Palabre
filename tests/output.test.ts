import test from "node:test";
import assert from "node:assert/strict";
import { createTranslator } from "../src/i18n.js";
import { renderDebateMarkdown } from "../src/output.js";
import type { DebateOptions } from "../src/types.js";

function baseOptions(overrides: Partial<DebateOptions> = {}): DebateOptions {
  return {
    topic: "Choose a cache strategy",
    agentA: "codex",
    agentB: "claude",
    turns: 2,
    session: {
      startedAt: "2026-05-13T10:00:00.000Z",
      localDate: "2026-05-13",
      timeZone: "Europe/Paris",
      cwd: "C:\\repo\\Palabre"
    },
    files: [],
    pullModels: false,
    summaryEnabled: false,
    earlyStopOnAgreement: true,
    plainOutput: true,
    ...overrides
  };
}

test("renderDebateMarkdown localizes export metadata", () => {
  const markdown = renderDebateMarkdown(
    baseOptions(),
    [],
    undefined,
    undefined,
    createTranslator("en")
  );

  assert.match(markdown, /## Context/);
  assert.match(markdown, /\| Field \| Value \|/);
  assert.match(markdown, /\| Subject \| Choose a cache strategy \|/);
  assert.match(markdown, /\| Requested turns \| 2 \|/);
  assert.match(markdown, /\| Summary \| disabled \|/);
  assert.match(markdown, /No file context injected\./);
  assert.match(markdown, /## Final summary/);
  assert.match(markdown, /_Summary disabled\._/);
});
