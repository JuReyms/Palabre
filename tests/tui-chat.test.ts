import assert from "node:assert/strict";
import test from "node:test";
import { createTranslator } from "../src/i18n.js";
import { renderTuiChat, renderTuiChatComplete } from "../src/renderers/tui-chat.js";
import { tuiChatInterruptResult } from "../src/tuiChat.js";

process.env.PALABRE_ASCII = "1";

test("TUI chat renders a conversation and a consultation as distinct cards", () => {
  const output: string[] = [];
  const originalWrite = process.stdout.write;
  process.stdout.write = ((chunk: string | Uint8Array) => { output.push(String(chunk)); return true; }) as typeof process.stdout.write;
  try {
    renderTuiChat("claude", [
      { agent: "user", role: "architect", content: "Should we add an API?", createdAt: "2026-07-12T10:00:00Z" },
      { agent: "claude", role: "architect", content: "It depends on consumers.", createdAt: "2026-07-12T10:01:00Z" },
      { agent: "codex", role: "critic", content: "Validate the need first.", createdAt: "2026-07-12T10:02:00Z" }
    ], createTranslator("en"));
  } finally {
    process.stdout.write = originalWrite;
  }
  const text = output.join("");
  assert.doesNotMatch(text, /Agents actifs/);
  assert.doesNotMatch(text, /CHAT/);
  assert.doesNotMatch(text, /Messages\s+3/);
  assert.doesNotMatch(text, /to save and finish/);
  assert.match(text, /Should we add an API/);
  assert.match(text, /codex's opinion \(critic\)/);
});

test("Chat interruption returns home first and quits on the second interrupt", () => {
  assert.equal(tuiChatInterruptResult("back"), "home");
  assert.equal(tuiChatInterruptResult("quit"), "quit");
});

test("Chat completion appends the Debate-style footer with links and continuation commands", () => {
  const output: string[] = [];
  const originalWrite = process.stdout.write;
  process.stdout.write = ((chunk: string | Uint8Array) => { output.push(String(chunk)); return true; }) as typeof process.stdout.write;
  try {
    renderTuiChatComplete("C:\\tmp\\palabre-session.chat.md", createTranslator("en"));
  } finally {
    process.stdout.write = originalWrite;
  }

  const text = output.join("");
  assert.match(text, /Session complete/);
  assert.match(text, /palabre-session\.chat\.md/);
  assert.match(text, /C:\\tmp/);
  assert.match(text, /\/new/);
  assert.match(text, /\/debat/);
  assert.match(text, /\/ask/);
  assert.match(text, /\/history/);
  assert.doesNotMatch(text, /PALABRE.*Conversation ended/);
});
