import test from "node:test";
import assert from "node:assert/strict";
import { createTuiRenderer } from "../src/renderers/tui.js";
import { createTranslator } from "../src/i18n.js";
import type { DebateOptions } from "../src/types.js";

test("TuiRenderer renders a lightweight terminal dashboard", () => {
  const output: string[] = [];
  const originalWrite = process.stdout.write;
  process.stdout.write = ((chunk: string | Uint8Array) => {
    output.push(Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk));
    return true;
  }) as typeof process.stdout.write;

  try {
    const renderer = createTuiRenderer(createTranslator("en"));
    renderer.start(baseOptions());
    renderer.turnStart(1, 2, "codex", "implementer");
    renderer.message("Hello from codex");
    renderer.done("out.debate.md");
  } finally {
    process.stdout.write = originalWrite;
  }

  const text = output.join("");
  assert.match(text, /PALABRE TUI - DEBAT/);
  assert.match(text, /Subject: TUI test/);
  assert.match(text, /codex \(implementer\) - turn 1\/2/);
  assert.match(text, /Hello from codex/);
  assert.match(text, /Palabre exported: out\.debate\.md/);
});

function baseOptions(): DebateOptions {
  return {
    mode: "debate",
    language: "en",
    topic: "TUI test",
    agentA: "codex",
    agentB: "claude",
    turns: 2,
    session: {
      startedAt: "2026-06-15T00:00:00.000Z",
      localDate: "2026-06-15",
      timeZone: "Europe/Paris",
      cwd: "C:\\repo"
    },
    files: [],
    pullModels: false,
    summaryEnabled: true,
    earlyStopOnAgreement: true,
    plainOutput: false
  };
}
