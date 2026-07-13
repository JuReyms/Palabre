import test from "node:test";
import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import { createInterface } from "node:readline";
import { createTranslator } from "../src/i18n.js";
import { normalizeBufferedComposerLines, promptTuiChatMessage, questionWithBufferedComposer, renderChatSessionPrompt, tuiHomeInterruptInput } from "../src/renderers/tui-prompts.js";

test("first Ctrl+C from a TUI view returns home and the second quits", () => {
  assert.deepEqual(tuiHomeInterruptInput("back"), { kind: "home" });
  assert.equal(tuiHomeInterruptInput("quit"), undefined);
});

test("multiline bracketed paste is kept as one composer answer", () => {
  assert.equal(normalizeBufferedComposerLines([
    "\u001b[200~first line",
    "second line\u001b[201~"
  ]), "first line\nsecond line");
});

test("the shared composer accepts Enter after repeated Config and Home cycles", async () => {
  const input = new PassThrough();
  const output = new PassThrough();
  const rl = createInterface({ input, output, terminal: false });

  try {
    const firstConfig = questionWithBufferedComposer(rl, "home> ", "home> ", 0, { input, output });
    input.write("/config\n");
    assert.deepEqual(await firstConfig, { kind: "answer", value: "/config" });

    const home = questionWithBufferedComposer(rl, "config> ", "config> ", 0, { input, output });
    input.write("/home\n");
    assert.deepEqual(await home, { kind: "answer", value: "/home" });

    const secondConfig = questionWithBufferedComposer(rl, "home> ", "home> ", 0, { input, output });
    input.write("/config\n");
    assert.deepEqual(await secondConfig, { kind: "answer", value: "/config" });
  } finally {
    rl.close();
  }
});

test("Chat prompt exits cleanly when no interactive terminal is available", async () => {
  const result = await promptTuiChatMessage(createTranslator("en"));
  assert.deepEqual(result, { kind: "quit" });
});

test("active Chat composer shows only session commands and the prompt cursor", () => {
  const text = renderChatSessionPrompt(createTranslator("en"));
  assert.match(text, /\/consult/);
  assert.match(text, /\/agents/);
  assert.match(text, /\/end/);
  assert.match(text, /\/home/);
  assert.match(text, />/);
  assert.doesNotMatch(text, /Mode chat|one conversation/);
});
