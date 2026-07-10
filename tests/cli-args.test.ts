import test from "node:test";
import assert from "node:assert/strict";
import { parseArgs } from "../src/args.js";
import { createTranslator } from "../src/i18n.js";

const messages = createTranslator("en");

function parse(args: string[]) {
  return parseArgs(args, messages);
}

test("a boolean flag does not swallow the following preset positional", () => {
  const parsed = parse(["--plain", "codex-claude", "mon sujet"]);

  assert.equal(parsed.flags.plain, true);
  assert.equal(parsed.flags.preset, "codex-claude");
  assert.equal(parsed.flags.topic, "mon sujet");
});

test("--no-summary stays boolean regardless of position", () => {
  const before = parse(["--no-summary", "codex-claude", "sujet"]);
  assert.equal(before.flags["no-summary"], true);
  assert.equal(before.flags.preset, "codex-claude");

  const after = parse(["codex-claude", "sujet", "--no-summary"]);
  assert.equal(after.flags["no-summary"], true);
  assert.equal(after.flags.preset, "codex-claude");
});

test("single-value flags consume exactly one value", () => {
  const parsed = parse(["--agent-a", "codex", "--agent-b", "claude", "-s", "topic"]);

  assert.equal(parsed.flags["agent-a"], "codex");
  assert.equal(parsed.flags["agent-b"], "claude");
  assert.equal(parsed.flags.topic, "topic");
});

test("--ollama-url consumes one value without changing the topic", () => {
  const parsed = parse(["codex-ollama", "topic", "--ollama-url", "gpu-box:11434"]);

  assert.equal(parsed.flags["ollama-url"], "gpu-box:11434");
  assert.equal(parsed.flags.preset, "codex-ollama");
  assert.equal(parsed.flags.topic, "topic");
});

test("--trust-config stays boolean and does not swallow the subject", () => {
  const parsed = parseArgs(["--trust-config", "codex-claude", "Sujet"], messages);

  assert.equal(parsed.flags["trust-config"], true);
  assert.equal(parsed.flags.preset, "codex-claude");
  assert.equal(parsed.flags.topic, "Sujet");
});

test("a single-value flag without value throws", () => {
  assert.throws(() => parse(["--turns", "--plain"]), /expects a value/);
  assert.throws(() => parse(["--model-a"]), /expects a value/);
  assert.throws(() => parse(["--ollama-url"]), /expects a value/);
});

test("multi-value flags collect until the next flag", () => {
  const parsed = parse(["--files", "a.ts", "b.ts", "--plain"]);

  assert.deepEqual(parsed.flags.files, ["a.ts", "b.ts"]);
  assert.equal(parsed.flags.plain, true);
});

test("--set-defaults requires exactly two agents", () => {
  const parsed = parse(["config", "--set-defaults", "codex", "claude"]);
  assert.equal(parsed.command, "config");
  assert.deepEqual(parsed.flags["set-defaults"], ["codex", "claude"]);

  assert.throws(() => parse(["config", "--set-defaults", "codex"]), /two agents/);
});

test("an unknown flag is treated as boolean and never swallows a positional", () => {
  const parsed = parse(["--frobnicate", "codex-claude", "sujet"]);

  assert.equal(parsed.flags.frobnicate, true);
  assert.equal(parsed.flags.preset, "codex-claude");
  assert.equal(parsed.flags.topic, "sujet");
});

test("a known preset positional becomes the preset, the rest becomes the subject", () => {
  const parsed = parse(["codex-claude", "quel jour sommes nous ?"]);

  assert.equal(parsed.command, "run");
  assert.equal(parsed.flags.preset, "codex-claude");
  assert.equal(parsed.flags.topic, "quel jour sommes nous ?");
});

test("ask command treats positionals as the subject", () => {
  const parsed = parse(["ask", "compare les options"]);

  assert.equal(parsed.command, "ask");
  assert.equal(parsed.flags.mode, "ask");
  assert.equal(parsed.flags.topic, "compare les options");
});

test("--mode and --agents are parsed for ask sessions", () => {
  const parsed = parse(["--mode", "ask", "--agents", "codex", "claude", "ollama-local", "--ask-summary-agent", "claude", "-s", "topic"]);

  assert.equal(parsed.command, "run");
  assert.equal(parsed.flags.mode, "ask");
  assert.deepEqual(parsed.flags.agents, ["codex", "claude", "ollama-local"]);
  assert.equal(parsed.flags["ask-summary-agent"], "claude");
  assert.equal(parsed.flags.topic, "topic");
});

test("--agents keeps all values so command validation can report too many agents", () => {
  const parsed = parse(["--mode", "ask", "--agents", "a", "b", "c", "d", "e", "-s", "topic"]);

  assert.deepEqual(parsed.flags.agents, ["a", "b", "c", "d", "e"]);
  assert.equal(parsed.flags.topic, "topic");
  assert.deepEqual(parsed.positionals, []);
});

test("--ask-agents is parsed for config defaults", () => {
  const parsed = parse(["config", "--mode", "ask", "--ask-agents", "codex", "claude", "opencode"]);

  assert.equal(parsed.command, "config");
  assert.equal(parsed.flags.mode, "ask");
  assert.deepEqual(parsed.flags["ask-agents"], ["codex", "claude", "opencode"]);
});

test("--renderer tui is parsed as an explicit renderer", () => {
  const parsed = parse(["--renderer", "tui", "-s", "topic"]);

  assert.equal(parsed.flags.renderer, "tui");
  assert.equal(parsed.flags.topic, "topic");
});

test("--tui and --terminal are parsed as boolean renderer shortcuts", () => {
  const tui = parse(["--tui", "-s", "topic"]);
  assert.equal(tui.flags.tui, true);
  assert.equal(tui.flags.topic, "topic");

  const terminal = parse(["--terminal", "-s", "topic"]);
  assert.equal(terminal.flags.terminal, true);
  assert.equal(terminal.flags.topic, "topic");
});

test("--no-tui aliases to --terminal", () => {
  const parsed = parse(["--no-tui", "-s", "topic"]);

  assert.equal(parsed.flags.terminal, true);
  assert.equal(parsed.flags.topic, "topic");
});

test("--interface is parsed for config defaults", () => {
  const parsed = parse(["config", "--interface", "terminal"]);

  assert.equal(parsed.command, "config");
  assert.equal(parsed.flags.interface, "terminal");
});

test("flag aliases normalize to their canonical name", () => {
  const parsed = parse(["--subject", "topic", "--lang", "fr", "--turns", "3"]);

  assert.equal(parsed.flags.topic, "topic");
  assert.equal(parsed.flags.language, "fr");
  assert.equal(parsed.flags.turns, "3");
});

test("an explicit command is detected as the first positional", () => {
  assert.equal(parse(["doctor"]).command, "doctor");
  assert.equal(parse(["doctor"]).commandExplicit, true);
  assert.equal(parse(["init", "--local"]).command, "init");
  assert.equal(parse(["init", "--local"]).flags.local, true);
});

test("an ambiguous single-word subject throws", () => {
  assert.throws(() => parse(["bonjour"]), /ambiguous subject/);
});

test("role flags and agent-role command are parsed", () => {
  const run = parse(["codex-claude", "topic", "--role-a", "architect", "--role-b", "critic"]);

  assert.equal(run.flags["role-a"], "architect");
  assert.equal(run.flags["role-b"], "critic");
  assert.equal(run.flags.topic, "topic");

  const persistent = parse(["agent-role", "claude", "critic"]);
  assert.equal(persistent.command, "agent-role");
  assert.deepEqual(persistent.positionals, ["claude", "critic"]);
});
