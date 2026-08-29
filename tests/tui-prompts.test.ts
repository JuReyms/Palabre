import test from "node:test";
import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import { createInterface } from "node:readline";
import { createTranslator } from "../src/i18n.js";
import { completeTuiCommand, normalizeBufferedComposerLines, promptTuiChatMessage, promptTuiChatMessageWithReadline, promptTuiNavigationWithReadline, questionWithBufferedComposer, questionWithInterrupt, renderChatSessionPrompt, tuiHomeInterruptInput } from "../src/renderers/tui-prompts.js";

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

test("TUI command completion filters commands by prefix and context", () => {
  assert.deepEqual(completeTuiCommand("/ch", "home"), [["/chat"], "/ch"]);
  assert.deepEqual(completeTuiCommand("/ol", "config"), [["/ollama", "/ollama-model", "/ollama-url", "/ollama-sync"], "/ol"]);
  assert.deepEqual(completeTuiCommand("/co", "chat"), [["/consult"], "/co"]);
  assert.deepEqual(completeTuiCommand("/config", "chat"), [[], "/config"]);
});

test("TUI command picker suggests canonical commands only", () => {
  assert.deepEqual(completeTuiCommand("/deb", "home"), [["/debat"], "/deb"]);
  assert.deepEqual(completeTuiCommand("/hi", "home"), [["/history"], "/hi"]);
  assert.deepEqual(completeTuiCommand("/la", "config"), [["/language"], "/la"]);
  assert.deepEqual(completeTuiCommand("/ollama-h", "config"), [[], "/ollama-h"]);
  assert.deepEqual(completeTuiCommand("/ex", "chat"), [[], "/ex"]);
});

test("TUI command picker orders commands by user workflow in each context", () => {
  assert.deepEqual(completeTuiCommand("/", "home")[0].slice(0, 7), [
    "/chat", "/debat", "/ask", "/agents", "/roles", "/config", "/help"
  ]);
  assert.deepEqual(completeTuiCommand("/", "config")[0].slice(0, 8), [
    "/mode", "/default", "/interface", "/language", "/agents", "/roles", "/turns", "/summary"
  ]);
  assert.deepEqual(completeTuiCommand("/", "chat")[0].slice(0, 6), [
    "/consult", "/use", "/agents", "/end", "/home", "/back"
  ]);
  assert.deepEqual(completeTuiCommand("/", "navigation")[0], [
    "/home", "/back", "/quit"
  ]);
});

test("Home command picker excludes the command for the active mode", () => {
  assert.deepEqual(completeTuiCommand("/", "home", "chat")[0].slice(0, 6), [
    "/debat", "/ask", "/agents", "/roles", "/config", "/help"
  ]);
  assert.deepEqual(completeTuiCommand("/", "home", "ask")[0].slice(0, 6), [
    "/chat", "/debat", "/agents", "/roles", "/config", "/help"
  ]);
  assert.deepEqual(completeTuiCommand("/", "home", "debate")[0].slice(0, 6), [
    "/chat", "/ask", "/agents", "/roles", "/config", "/help"
  ]);
  assert.deepEqual(completeTuiCommand("/deb", "home", "debate"), [[], "/deb"]);
});

test("TUI command descriptions are localized and cover aliases", () => {
  const fr = createTranslator("fr");
  const en = createTranslator("en");

  assert.equal(fr.tui.commandDescription("/chat"), "Converser avec un agent");
  assert.equal(fr.tui.commandDescription("/debate"), "Faire confronter deux agents");
  assert.equal(en.tui.commandDescription("/consult"), "Ask another agent for an opinion");
  assert.equal(en.tui.completionNavigationHint, "↑↓ choose  ·  Tab or → complete  ·  Enter run");
});

test("TUI command completion leaves ordinary messages and command arguments untouched", () => {
  assert.deepEqual(completeTuiCommand("discuss this", "home"), [[], "discuss this"]);
  assert.deepEqual(completeTuiCommand("/consult codex", "chat"), [[], "/consult codex"]);
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

test("interrupting a simple wizard leaves the shared readline ready for the next composer", async () => {
  const input = new PassThrough();
  const output = new PassThrough();
  const rl = createInterface({ input, output, terminal: false });

  try {
    const interrupted = questionWithInterrupt(rl, "agents> ");
    rl.emit("SIGINT");
    assert.deepEqual(await interrupted, { kind: "back" });

    const next = questionWithInterrupt(rl, "home> ");
    input.write("ready\n");
    assert.deepEqual(await Promise.race([
      next,
      new Promise((_, reject) => setTimeout(() => reject(new Error("readline did not regain focus")), 100))
    ]), { kind: "answer", value: "ready" });
  } finally {
    rl.close();
  }
});

for (const [context, command] of [["home", "/config"], ["config", "/agents"], ["chat", "/end"], ["navigation", "/home"]] as const) {
  test(`${context} cancels any queued picker redraw when submitting a complete command`, async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const chunks: Buffer[] = [];
    output.on("data", (chunk: Buffer) => chunks.push(chunk));
    const rl = createInterface({ input, output, terminal: true });
    const prompt = `${context}> `;

    try {
      const answer = questionWithBufferedComposer(
        rl,
        prompt,
        prompt,
        0,
        { input, output, interactiveOutput: true },
        context
      );
      rl.write(command.slice(0, -1));
      const lastCharacter = command.at(-1)!;
      input.emit("keypress", lastCharacter, { name: lastCharacter, sequence: lastCharacter });
      input.emit("keypress", "\r", { name: "return", sequence: "\r" });

      assert.deepEqual(await answer, { kind: "answer", value: command });
      const rendered = Buffer.concat(chunks).toString("utf8");
      assert.equal(rendered.match(new RegExp(prompt, "g"))?.length, 1);
    } finally {
      rl.close();
    }
  });
}

test("picker navigation uses scroll-safe relative cursor movement", async () => {
  const input = new PassThrough();
  const output = new PassThrough();
  const chunks: Buffer[] = [];
  output.on("data", (chunk: Buffer) => chunks.push(chunk));
  const rl = createInterface({ input, output, terminal: true });
  const messages = createTranslator("en");

  try {
    const answer = questionWithBufferedComposer(
      rl,
      "config> ",
      "config> ",
      0,
      { input, output, interactiveOutput: true },
      "config",
      undefined,
      messages.tui
    );
    input.emit("keypress", "/", { name: "/", sequence: "/" });
    await new Promise((resolve) => setTimeout(resolve, 10));
    for (let index = 0; index < 5; index += 1) {
      input.emit("keypress", "", { name: "down", sequence: "\u001b[B" });
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    input.emit("keypress", "\r", { name: "return", sequence: "\r" });
    assert.deepEqual(await answer, { kind: "answer", value: "/roles" });

    const rendered = Buffer.concat(chunks).toString("utf8");
    assert.doesNotMatch(rendered, /\u001b\[(?:s|u)/);
    assert.match(rendered, /\u001b\[10A/);
  } finally {
    rl.close();
  }
});

test("generic TUI picker shows and accepts its default choice immediately", async () => {
  const input = new PassThrough();
  const output = new PassThrough();
  const chunks: Buffer[] = [];
  output.on("data", (chunk: Buffer) => chunks.push(chunk));
  const rl = createInterface({ input, output, terminal: true });

  try {
    const answer = questionWithBufferedComposer(
      rl,
      "mode> ",
      "mode> ",
      0,
      { input, output, interactiveOutput: true },
      "navigation",
      undefined,
      createTranslator("en").tui,
      {
        choices: [
          { value: "chat", description: "Conversation with one agent" },
          { value: "debate", description: "Debate between two agents" },
          { value: "ask", description: "Independent responses" }
        ],
        defaultValue: "debate",
        showOnEmpty: true
      }
    );
    await new Promise((resolve) => setTimeout(resolve, 10));
    input.emit("keypress", "\r", { name: "return", sequence: "\r" });

    assert.deepEqual(await answer, { kind: "answer", value: "debate" });
    const rendered = Buffer.concat(chunks).toString("utf8");
    assert.match(rendered, /Conversation with one agent/);
    assert.match(rendered, /Debate between two agents/);
  } finally {
    rl.close();
  }
});

test("informational views expose only the minimal navigation picker", async () => {
  const input = new PassThrough();
  const output = new PassThrough();
  const rl = createInterface({ input, output, terminal: false });

  try {
    const home = promptTuiNavigationWithReadline(rl, createTranslator("fr"), { input, output });
    input.write("/home\n");
    assert.deepEqual(await home, { kind: "home" });

    const quit = promptTuiNavigationWithReadline(rl, createTranslator("fr"), { input, output });
    input.write("/quit\n");
    assert.equal(await quit, undefined);
  } finally {
    rl.close();
  }
});

test("Chat keeps one reader across messages and buffers multiline paste", async () => {
  const input = new PassThrough();
  const output = new PassThrough();
  const rl = createInterface({ input, output, terminal: false });
  const messages = createTranslator("en");

  try {
    const first = promptTuiChatMessageWithReadline(rl, messages, { input, output });
    input.write("\u001b[200~first line\nsecond line\u001b[201~\n");
    assert.deepEqual(await first, { kind: "answer", value: "first line\nsecond line" });

    const second = promptTuiChatMessageWithReadline(rl, messages, { input, output });
    input.write("/home\n");
    assert.deepEqual(await second, { kind: "answer", value: "/home" });
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
