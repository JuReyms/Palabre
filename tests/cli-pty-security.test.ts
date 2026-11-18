/** @file Refus des commandes PTY Windows non prises en charge, sans lancer de processus. */
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { CliPtyAdapter } from "../src/adapters/cli-pty.js";
import { AdapterError } from "../src/errors.js";
import type { AgentPrompt } from "../src/types.js";
import { npmPowerShellShim } from "./fixtures/external-sessions/npm-shim.js";

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

test("CliPtyAdapter refuse un alias WindowsApps même en repli stdin", { skip: process.platform !== "win32" }, async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), "palabre-pty-alias-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const directory = path.join(root, "WindowsApps");
  await mkdir(directory);
  const command = path.join(directory, "inert.exe");
  await writeFile(command, "");
  const adapter = new CliPtyAdapter("mock-pty", { type: "cli-pty", command, promptMode: "stdin", role: "reviewer" });
  await assert.rejects(adapter.generate(prompt()), (error) =>
    error instanceof AdapterError && error.kind === "spawn-failed" && /WindowsApps/.test(error.message));

  const shim = path.join(root, "agent.ps1");
  await writeFile(shim, npmPowerShellShim("agent.js"));
  await writeFile(path.join(root, "agent.js"), "");
  await writeFile(path.join(directory, "node.exe"), "");
  const previous = process.env.PATH;
  process.env.PATH = directory;
  try {
    const shimAdapter = new CliPtyAdapter("mock-pty", { type: "cli-pty", command: shim, promptMode: "stdin", role: "reviewer" });
    await assert.rejects(shimAdapter.generate(prompt()), (error) =>
      error instanceof AdapterError && error.kind === "spawn-failed" && /WindowsApps/.test(error.message));
  } finally {
    if (previous === undefined) delete process.env.PATH;
    else process.env.PATH = previous;
  }
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
