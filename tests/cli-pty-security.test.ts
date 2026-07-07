import assert from "node:assert/strict";
import test from "node:test";
import { CliPtyAdapter } from "../src/adapters/cli-pty.js";
import { AdapterError } from "../src/errors.js";
import type { AgentPrompt } from "../src/types.js";

test("CliPtyAdapter rejects argument prompts through unresolved Windows wrappers", { skip: process.platform !== "win32" }, async () => {
  const adapter = new CliPtyAdapter("mock-pty", {
    type: "cli-pty",
    command: "missing-wrapper.cmd",
    promptMode: "argument",
    role: "reviewer"
  });

  await assert.rejects(
    adapter.generate(prompt()),
    (error) => error instanceof AdapterError
      && error.kind === "spawn-failed"
      && error.details?.promptMode === "argument"
  );
});

function prompt(): AgentPrompt {
  return {
    topic: "Sujet & echo INJECTED",
    turn: 1,
    totalTurns: 1,
    selfName: "mock-pty",
    peerName: "peer",
    selfRole: "reviewer",
    session: {
      startedAt: "2026-07-07T00:00:00.000Z",
      localDate: "2026-07-07",
      timeZone: "Europe/Paris",
      cwd: process.cwd()
    },
    files: [],
    transcript: []
  };
}
