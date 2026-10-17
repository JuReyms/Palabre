import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createTranslator } from "../src/i18n.js";
import { renderTuiChat, renderTuiChatComplete } from "../src/renderers/tui-chat.js";
import { resolveChatOptions } from "../src/runOptions.js";
import { runChatTurnWithThinking, runTuiChatSession, tuiChatInterruptResult, type TuiChatIo } from "../src/tuiChat.js";
import type { AgentRole } from "../src/types.js";

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

test("a consultation spinner uses the consulted agent identity", async () => {
  const events: string[] = [];
  const renderer = {
    thinkingStart: (agent: string, role: string) => { events.push(`start:${agent}:${role}`); },
    thinkingEnd: () => { events.push("end"); }
  };

  await runChatTurnWithThinking(renderer, "vibe", "critic", async () => { events.push("operation"); });

  assert.deepEqual(events, ["start:vibe:critic", "operation", "end"]);
  assert.equal(createTranslator("fr").chat.consulting("Vibe"), "Vibe se connecte à la conversation…");
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

// --- #103 : boucle TUI pilotée par une saisie scriptée et des agents Node factices, sans TTY. ---

/** Config temporaire : `ok` répond, `flaky` répond une fois puis échoue ; chaque lancement est compté. */
async function tuiChatFixture() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "palabre-tui-chat-"));
  const calls = path.join(dir, "calls.log");
  const flakyCalls = path.join(dir, "flaky.log");
  const counted = (script: string) => `require('fs').appendFileSync(${JSON.stringify(calls)},'x');${script}`;
  const ok = "process.stdin.resume();process.stdin.on('end',()=>process.stdout.write('ok answer'))";
  const flaky = `const fs=require('fs');const n=fs.existsSync(${JSON.stringify(flakyCalls)})?fs.readFileSync(${JSON.stringify(flakyCalls)},'utf8').length:0;fs.appendFileSync(${JSON.stringify(flakyCalls)},'x');process.stdin.resume();process.stdin.on('end',()=>{if(n>0)process.exit(1);process.stdout.write('flaky answer')})`;
  const agent = (script: string, role: AgentRole) => ({ type: "cli" as const, command: process.execPath, args: ["-e", counted(script)], promptMode: "stdin" as const, shell: false, role });
  const config = { defaults: { agentA: "ok" }, agents: { ok: agent(ok, "critic"), flaky: agent(flaky, "critic"), second: agent(ok, "reviewer") } };
  const callCount = async () => existsSync(calls) ? (await readFile(calls, "utf8")).length : 0;
  const exports = async () => (await readdir(dir)).filter((name) => name.endsWith(".chat.md"));
  return { dir, config, callCount, exports };
}

/** Entrées/sorties factices : réponses scriptées, rendu capturé, indicateur d'attente enregistré. */
function scriptedIo(answers: string[]) {
  const thinking: string[] = [];
  const notices: Array<string | undefined> = [];
  const io: TuiChatIo = {
    promptMessage: async () => {
      const value = answers.shift();
      return value === undefined ? { kind: "quit" } : { kind: "answer", value };
    },
    promptHomeTopic: async () => undefined,
    render: (_agent, _transcript, _messages, notice) => { notices.push(notice); },
    renderComplete: () => {},
    thinking: {
      thinkingStart: (agent, role) => { thinking.push(`${agent}:${role}`); },
      thinkingEnd: () => {}
    }
  };
  return { io, thinking, notices, remaining: answers };
}

const tuiMessages = createTranslator("en");
const chatOptions = (config: Awaited<ReturnType<typeof tuiChatFixture>>["config"], flags: Record<string, string> = {}) =>
  resolveChatOptions({ flags, config, language: "en", topic: "", files: [] }, tuiMessages);

test("an empty or whitespace entry keeps the TUI conversation and calls no agent (#103)", async () => {
  const env = await tuiChatFixture();
  const script = scriptedIo(["Hello", "", "   ", "Later", "/end"]);
  const result = await runTuiChatSession(env.config, chatOptions(env.config), tuiMessages, env.dir, undefined, undefined, script.io);

  // /end exporte, puis l'invite d'accueil factice ne rend rien : la session se termine.
  assert.equal(result.destination, "quit");
  assert.deepEqual(script.remaining, []);
  assert.equal(await env.callCount(), 2);
  const [exported] = await env.exports();
  assert.ok(exported);
  const markdown = await readFile(path.join(env.dir, exported), "utf8");
  assert.match(markdown, /Hello/);
  assert.match(markdown, /Later/);
});

test("explicit /home, /back, /exit and /quit still return home without an export", async () => {
  for (const command of ["/home", "/back", "/exit", "/quit"]) {
    const env = await tuiChatFixture();
    const script = scriptedIo(["Hello", command, "Never sent"]);
    const result = await runTuiChatSession(env.config, chatOptions(env.config), tuiMessages, env.dir, undefined, undefined, script.io);
    assert.equal(result.destination, "home", command);
    assert.deepEqual(script.remaining, ["Never sent"], command);
    assert.deepEqual(await env.exports(), [], command);
    assert.equal(await env.callCount(), 1, command);
  }
});

test("a TUI consultation shows the effective role after a role override and an agent change", async () => {
  const env = await tuiChatFixture();
  const script = scriptedIo(["Hello", "/use second", "/consult ok", "/end"]);
  await runTuiChatSession(env.config, chatOptions(env.config, { "agent-a": "ok", "role-a": "architect" }), tuiMessages, env.dir, undefined, undefined, script.io);

  // Envoi par `ok` (architect), puis consultation de `ok` : architect, pas le rôle brut critic.
  assert.deepEqual(script.thinking, ["ok:architect", "ok:architect"]);
});

test("a failing TUI consultation also shows the effective role before the error", async () => {
  const env = await tuiChatFixture();
  const script = scriptedIo(["Hello", "/use second", "/consult flaky"]);
  await assert.rejects(
    runTuiChatSession(env.config, chatOptions(env.config, { "agent-a": "flaky", "role-a": "architect" }), tuiMessages, env.dir, undefined, undefined, script.io)
  );
  assert.deepEqual(script.thinking, ["flaky:architect", "flaky:architect"]);
});
