import test from "node:test";
import assert from "node:assert/strict";
import { createTranslator } from "../src/i18n.js";
import { renderDebateMarkdown } from "../src/output.js";
import type { DebateOptions } from "../src/types.js";

function baseOptions(overrides: Partial<DebateOptions> = {}): DebateOptions {
  return {
    mode: "debate",
    language: "fr",
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

test("renderDebateMarkdown renders ask mode with agent responses", () => {
  const markdown = renderDebateMarkdown(
    baseOptions({
      mode: "ask",
      askAgents: ["codex", "claude"],
      summaryEnabled: true,
      summaryAgent: "claude"
    }),
    [
      {
        agent: "codex",
        role: "implementer",
        content: "Codex answer",
        createdAt: "2026-05-13T10:01:00.000Z"
      },
      {
        agent: "claude",
        role: "reviewer",
        content: "Claude answer",
        createdAt: "2026-05-13T10:02:00.000Z"
      }
    ],
    {
      agent: "claude",
      role: "reviewer",
      content: "Faithful summary",
      createdAt: "2026-05-13T10:03:00.000Z"
    },
    undefined,
    createTranslator("en")
  );

  assert.match(markdown, /^# PALABRE Ask/);
  assert.match(markdown, /\| Mode \| ask \|/);
  assert.match(markdown, /\| Agents \| codex, claude \|/);
  assert.match(markdown, /\| Expected responses \| 2 \|/);
  assert.match(markdown, /\| Received responses \| 2 \|/);
  assert.match(markdown, /## Agent responses/);
  assert.match(markdown, /Codex answer/);
  assert.match(markdown, /Claude answer/);
  assert.match(markdown, /Faithful summary/);
});

test("renderDebateMarkdown includes interruption metadata", () => {
  const markdown = renderDebateMarkdown(
    baseOptions(),
    [],
    undefined,
    undefined,
    createTranslator("en"),
    {
      phase: "debate",
      agent: "codex",
      role: "implementer",
      turn: 1,
      kind: "output-too-large",
      message: "codex produced too much output"
    }
  );

  assert.match(markdown, /## Interruption/);
  assert.match(markdown, /\| Phase \| debate \|/);
  assert.match(markdown, /\| Agent \| codex \|/);
  assert.match(markdown, /\| Error kind \| output-too-large \|/);
});
