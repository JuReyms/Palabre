import assert from "node:assert/strict";
import { test } from "node:test";
import { NdjsonRenderer } from "../src/renderers/ndjson.js";
import type { DebateOptions, DebateStartAgentInfo } from "../src/types.js";

/**
 * Capture stdout en remplaçant `process.stdout.write` par un buffer.
 * Retourne la liste des lignes émises (sans le `\n` final) et un `restore()`
 * à appeler dans un `finally` pour ne pas polluer les autres tests.
 */
function captureStdout(): { lines: string[]; restore: () => void } {
  const original = process.stdout.write.bind(process.stdout) as typeof process.stdout.write;
  const lines: string[] = [];
  let buffer = "";

  process.stdout.write = ((chunk: string | Uint8Array) => {
    // Le renderer NDJSON n'écrit que des strings, mais Node type le paramètre
    // comme `string | Uint8Array`. On convertit explicitement via Buffer pour
    // satisfaire le typage strict sans dépendre de runtime checks fragiles.
    buffer += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
    let idx: number;
    while ((idx = buffer.indexOf("\n")) !== -1) {
      lines.push(buffer.slice(0, idx));
      buffer = buffer.slice(idx + 1);
    }
    return true;
  }) as typeof process.stdout.write;

  return {
    lines,
    restore: () => {
      process.stdout.write = original;
    },
  };
}

function baseOptions(overrides: Partial<DebateOptions> = {}): DebateOptions {
  return {
    language: "fr",
    topic: "Test",
    agentA: "codex",
    agentB: "claude",
    turns: 2,
    session: {
      startedAt: "2026-05-11T10:00:00.000Z",
      localDate: "2026-05-11",
      timeZone: "Europe/Paris",
      cwd: "/tmp/test",
    },
    files: [],
    pullModels: false,
    summaryEnabled: true,
    summaryAgent: "claude",
    earlyStopOnAgreement: true,
    plainOutput: false,
    ...overrides,
  };
}

test("NdjsonRenderer emits start event with schema version and metadata", () => {
  const capture = captureStdout();
  try {
    const renderer = new NdjsonRenderer();
    const agents: DebateStartAgentInfo[] = [
      { name: "codex", role: "implementer", type: "cli" },
      { name: "claude", role: "reviewer", type: "cli" },
    ];
    renderer.start(baseOptions(), agents);
  } finally {
    capture.restore();
  }

  assert.equal(capture.lines.length, 1);
  const event = JSON.parse(capture.lines[0]!);
  assert.equal(event.v, 1);
  assert.equal(event.type, "start");
  assert.equal(event.topic, "Test");
  assert.equal(event.turns, 2);
  assert.deepEqual(event.agents, [
    { name: "codex", role: "implementer", type: "cli" },
    { name: "claude", role: "reviewer", type: "cli" },
  ]);
  assert.equal(event.summaryEnabled, true);
  assert.equal(event.summaryAgent, "claude");
  assert.equal(event.earlyStop, true);
  assert.equal(event.filesCount, 0);
  assert.equal(event.session.cwd, "/tmp/test");
});

test("NdjsonRenderer emits message in debate section after turn-start", () => {
  const capture = captureStdout();
  try {
    const renderer = new NdjsonRenderer();
    renderer.turnStart(1, 2, "codex", "implementer");
    renderer.message("Réponse de codex");
  } finally {
    capture.restore();
  }

  const events = capture.lines.map((line) => JSON.parse(line));
  assert.equal(events.length, 2);
  assert.equal(events[0].type, "turn-start");
  assert.equal(events[0].turn, 1);
  assert.equal(events[1].type, "message");
  assert.equal(events[1].turn, 1);
  assert.equal(events[1].agent, "codex");
  assert.equal(events[1].role, "implementer");
  assert.equal(events[1].content, "Réponse de codex");
});

test("NdjsonRenderer switches to summary-message after summary-start", () => {
  const capture = captureStdout();
  try {
    const renderer = new NdjsonRenderer();
    renderer.turnStart(1, 1, "codex", "implementer");
    renderer.message("turn body");
    renderer.summaryStart("claude", "summarizer");
    renderer.message("summary body");
  } finally {
    capture.restore();
  }

  const events = capture.lines.map((line) => JSON.parse(line));
  assert.equal(events.length, 4);
  assert.equal(events[1].type, "message");
  assert.equal(events[2].type, "summary-start");
  assert.equal(events[3].type, "summary-message");
  assert.equal(events[3].agent, "claude");
  assert.equal(events[3].role, "summarizer");
  assert.equal(events[3].content, "summary body");
});

test("NdjsonRenderer emits notice and warning preserving order", () => {
  const capture = captureStdout();
  try {
    const renderer = new NdjsonRenderer();
    renderer.notice("info-1");
    renderer.warning("warn-1");
    renderer.notice("info-2");
  } finally {
    capture.restore();
  }

  const events = capture.lines.map((line) => JSON.parse(line));
  assert.deepEqual(
    events.map((e) => [e.type, e.message]),
    [
      ["notice", "info-1"],
      ["warning", "warn-1"],
      ["notice", "info-2"],
    ],
  );
});

test("NdjsonRenderer emits thinking-start and thinking-end", () => {
  const capture = captureStdout();
  try {
    const renderer = new NdjsonRenderer();
    renderer.thinkingStart("codex", "implementer");
    renderer.thinkingEnd();
  } finally {
    capture.restore();
  }

  const events = capture.lines.map((line) => JSON.parse(line));
  assert.equal(events[0].type, "thinking-start");
  assert.equal(events[0].agent, "codex");
  assert.equal(events[1].type, "thinking-end");
});

test("NdjsonRenderer emits done with outputPath", () => {
  const capture = captureStdout();
  try {
    const renderer = new NdjsonRenderer();
    renderer.done("/tmp/debate.md");
  } finally {
    capture.restore();
  }

  const event = JSON.parse(capture.lines[0]!);
  assert.equal(event.type, "done");
  assert.equal(event.outputPath, "/tmp/debate.md");
});

test("NdjsonRenderer emits start without agents argument (interface contract)", () => {
  // Le contrat DebateRenderer déclare `agents?: DebateStartAgentInfo[]` :
  // l'argument doit rester optionnel. Régression silencieuse possible si le
  // défaut `= []` est retiré côté implémentation.
  const capture = captureStdout();
  try {
    const renderer = new NdjsonRenderer();
    renderer.start(baseOptions());
  } finally {
    capture.restore();
  }

  const event = JSON.parse(capture.lines[0]!);
  assert.equal(event.type, "start");
  assert.deepEqual(event.agents, []);
});

test("NdjsonRenderer preserves embedded newlines in message content", () => {
  // Les agents répondent souvent en markdown multi-lignes. JSON.stringify doit
  // échapper les `\n` pour garantir le contrat "une ligne = un événement".
  const multiline = "Ligne 1\nLigne 2\n\nLigne 3";
  const capture = captureStdout();
  try {
    const renderer = new NdjsonRenderer();
    renderer.turnStart(1, 1, "codex", "implementer");
    renderer.message(multiline);
  } finally {
    capture.restore();
  }

  assert.equal(capture.lines.length, 2);
  const event = JSON.parse(capture.lines[1]!);
  assert.equal(event.content, multiline);
});

test("NdjsonRenderer always includes v=1 on every line", () => {
  const capture = captureStdout();
  try {
    const renderer = new NdjsonRenderer();
    renderer.notice("a");
    renderer.turnStart(1, 1, "codex", "implementer");
    renderer.message("body");
    renderer.summaryStart("claude", "summarizer");
    renderer.message("sum");
    renderer.done("/p");
  } finally {
    capture.restore();
  }

  for (const line of capture.lines) {
    const event = JSON.parse(line);
    assert.equal(event.v, 1, `événement sans v=1 : ${line}`);
  }
});
