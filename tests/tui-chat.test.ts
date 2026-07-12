import assert from "node:assert/strict";
import test from "node:test";
import { createTranslator } from "../src/i18n.js";
import { renderTuiChat } from "../src/renderers/tui-chat.js";

process.env.PALABRE_ASCII = "1";

test("TUI chat renders a conversation and a consultation as distinct cards", () => {
  const output: string[] = [];
  const originalWrite = process.stdout.write;
  process.stdout.write = ((chunk: string | Uint8Array) => { output.push(String(chunk)); return true; }) as typeof process.stdout.write;
  try {
    renderTuiChat("claude", "architect", [
      { agent: "user", role: "architect", content: "Should we add an API?", createdAt: "2026-07-12T10:00:00Z" },
      { agent: "claude", role: "architect", content: "It depends on consumers.", createdAt: "2026-07-12T10:01:00Z" },
      { agent: "codex", role: "critic", content: "Validate the need first.", createdAt: "2026-07-12T10:02:00Z" }
    ], createTranslator("en"));
  } finally { process.stdout.write = originalWrite; }
  const text = output.join("");
  assert.match(text, /Palabre · claude \(architect\)/);
  assert.match(text, /Should we add an API/);
  assert.match(text, /claude:/);
  assert.match(text, /codex's opinion:/);
});