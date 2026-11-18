/** @file Refus et repli stdin de l'adapter PTY Windows, avec des fichiers témoins inoffensifs. */
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { CliPtyAdapter } from "../src/adapters/cli-pty.js";
import { AdapterError } from "../src/errors.js";
import { formatAgentPrompt } from "../src/prompt.js";
import type { AgentPrompt } from "../src/types.js";
import { npmPowerShellShim } from "./fixtures/external-sessions/npm-shim.js";
import { fakePtyStdinCli } from "./fixtures/pty-stdin.js";

for (const extension of ["cmd", "bat"]) {
  test(`CliPtyAdapter refuse un prompt en argument pour un .${extension} seul`, { skip: process.platform !== "win32" }, async t => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "palabre-pty-batch-"));
    t.after(() => rm(dir, { recursive: true, force: true }));
    const command = path.join(dir, `witness.${extension}`);
    const marker = path.join(dir, "started.txt");
    await writeFile(command, '@echo off\r\n> "%~dp0started.txt" echo started\r\nexit /b 0\r\n');
    const adapter = new CliPtyAdapter("mock-pty", {
      type: "cli-pty", command, promptMode: "argument", role: "reviewer", timeoutMs: 5_000,
    });
    await assert.rejects(adapter.generate(prompt()), (error) =>
      error instanceof AdapterError && error.kind === "spawn-failed" && error.details?.promptMode === "argument");
    await assert.rejects(readFile(marker), { code: "ENOENT" });
  });

  test(`CliPtyAdapter transmet le prompt sur stdin via un .${extension} seul`, { skip: process.platform !== "win32" }, async t => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "palabre-pty-batch-"));
    t.after(() => rm(dir, { recursive: true, force: true }));
    const command = path.join(dir, `witness.${extension}`);
    const capture = path.join(dir, "capture.json");
    const node = process.execPath.replaceAll("%", "%%");
    await writeFile(path.join(dir, "witness.cjs"), fakePtyStdinCli(capture));
    await writeFile(command, [
      "@echo off",
      "setlocal DisableDelayedExpansion",
      `"${node}" "%~dp0witness.cjs" "argument fixe"`,
      "exit /b %errorlevel%",
      "",
    ].join("\r\n"));
    const input = prompt();
    const adapter = new CliPtyAdapter("mock-pty", {
      type: "cli-pty", command, promptMode: "stdin", role: "reviewer", timeoutMs: 15_000,
    });

    const response = await adapter.generate(input);
    const seen = JSON.parse(await readFile(capture, "utf8"));

    assert.ok(response.content.includes("ok"));
    assert.deepEqual(seen.argv, ["argument fixe"]);
    assert.equal(seen.stdin, `${formatAgentPrompt(input)}\r`);
  });
}

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
    topic: "Sujet français de qualification",
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
