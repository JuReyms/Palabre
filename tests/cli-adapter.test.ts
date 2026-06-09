import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { CliAdapter } from "../src/adapters/cli.js";
import { AdapterError } from "../src/errors.js";
import type { AgentPrompt, CliAgentConfig } from "../src/types.js";

const nodeCommand = process.execPath;

function basePrompt(overrides: Partial<AgentPrompt> = {}): AgentPrompt {
  return {
    topic: "Smoke test CLI",
    turn: 1,
    totalTurns: 4,
    selfName: "mock-a",
    peerName: "mock-b",
    selfRole: "reviewer",
    session: {
      startedAt: "2026-05-06T10:00:00.000Z",
      localDate: "2026-05-06",
      timeZone: "Europe/Paris",
      cwd: process.cwd()
    },
    files: [],
    transcript: [],
    ...overrides
  };
}

function cliConfig(overrides: Partial<CliAgentConfig> = {}): CliAgentConfig {
  return {
    type: "cli",
    command: nodeCommand,
    args: [],
    promptMode: "stdin",
    shell: false,
    role: "reviewer",
    timeoutMs: 2_000,
    ...overrides
  };
}

test("CliAdapter sends the rendered prompt through stdin", async () => {
  const adapter = new CliAdapter("mock", cliConfig({
    args: ["-e", "process.stdin.pipe(process.stdout)"]
  }));

  const response = await adapter.generate(basePrompt({ topic: "Sujet stdin" }));

  assert.match(response.content, /Sujet: Sujet stdin/);
  assert.match(response.raw ?? "", /Tu es mock/);
});

test("CliAdapter can pass the rendered prompt as an argument", async () => {
  const adapter = new CliAdapter("mock", cliConfig({
    args: ["-e", "process.stdout.write(process.argv.at(-1) ?? '')"],
    promptMode: "argument"
  }));

  const response = await adapter.generate(basePrompt({ topic: "Sujet argument" }));

  assert.match(response.content, /Sujet: Sujet argument/);
});

test("CliAdapter inserts model arguments before the stdin marker", async () => {
  const fakeCliPath = await writeFakeCli("print-argv", "process.stdout.write(JSON.stringify(process.argv.slice(2)));");
  const adapter = new CliAdapter("mock", cliConfig({
    args: [fakeCliPath, "-"],
    model: "model-x",
    modelArg: "--model"
  }));

  const response = await adapter.generate(basePrompt());
  const args = JSON.parse(response.content) as string[];
  const markerIndex = args.lastIndexOf("-");
  const modelArgIndex = args.indexOf("--model");

  assert.ok(modelArgIndex >= 0);
  assert.equal(args[modelArgIndex + 1], "model-x");
  assert.ok(markerIndex > modelArgIndex);
});

test("CliAdapter rejects empty output by default", async () => {
  const adapter = new CliAdapter("mock", cliConfig({
    args: ["-e", "process.stderr.write('nothing useful')"]
  }));

  await assert.rejects(
    adapter.generate(basePrompt()),
    (error) => error instanceof AdapterError && error.kind === "empty-output"
  );
});

test("CliAdapter classifies non-zero exits with no stdout", async () => {
  const adapter = new CliAdapter("mock", cliConfig({
    args: ["-e", "process.stderr.write('boom'); process.exit(3)"]
  }));

  await assert.rejects(
    adapter.generate(basePrompt()),
    (error) => error instanceof AdapterError && error.kind === "non-zero-exit"
  );
});

test("CliAdapter classifies usage limit errors", async () => {
  const adapter = new CliAdapter("mock", cliConfig({
    args: ["-e", "process.stderr.write('ERROR: usage limit reached. Try again later.'); process.exit(1)"]
  }));

  await assert.rejects(
    adapter.generate(basePrompt()),
    (error) => error instanceof AdapterError && error.kind === "usage-limit"
  );
});

test("CliAdapter classifies unsupported model errors", async () => {
  const script = "process.stderr.write(JSON.stringify({ type: 'error', status: 400, error: { type: 'invalid_request_error', message: \"The '5.4' model is not supported when using Codex with a ChatGPT account.\" } })); process.exit(1)";
  const adapter = new CliAdapter("codex", cliConfig({
    args: ["-e", script]
  }));

  await assert.rejects(
    adapter.generate(basePrompt()),
    (error) => error instanceof AdapterError
      && error.kind === "unsupported-model"
      && error.message.includes("5.4")
      && error.message.includes("not supported")
  );
});

test("CliAdapter classifies unsupported model errors even when the CLI exits empty", async () => {
  const script = "process.stderr.write('ERROR: ' + JSON.stringify({ type: 'error', status: 400, error: { type: 'invalid_request_error', message: \"The 'gpt-5.3-codex' model is not supported when using Codex with a ChatGPT account.\" } }));";
  const adapter = new CliAdapter("codex", cliConfig({
    args: ["-e", script]
  }));

  await assert.rejects(
    adapter.generate(basePrompt()),
    (error) => error instanceof AdapterError
      && error.kind === "unsupported-model"
      && error.message.includes("gpt-5.3-codex")
      && error.message.includes("ChatGPT account")
  );
});

test("CliAdapter strips Windows taskkill status noise from stdout", async () => {
  const script = [
    "process.stdout.write('Opération réussie : le processus de PID 42120 (processus enfant de PID 45636) a été\\n');",
    "process.stdout.write('arrêté.\\n');",
    "process.stdout.write('Nous sommes le lundi 8 juin 2026.');"
  ].join("");
  const adapter = new CliAdapter("codex", cliConfig({
    args: ["-e", script]
  }));

  const response = await adapter.generate(basePrompt());

  assert.equal(response.content, "Nous sommes le lundi 8 juin 2026.");
});

test("CliAdapter strips mojibake Windows taskkill status noise from stdout", async () => {
  const script = [
    "process.stdout.write('Op�ration r�ussie�: le processus de PID 45240 (processus enfant de PID 52352) a �t�\\n');",
    "process.stdout.write('arr�t�.\\n');",
    "process.stdout.write('Nous sommes le lundi 8 juin 2026.');"
  ].join("");
  const adapter = new CliAdapter("codex", cliConfig({
    args: ["-e", script]
  }));

  const response = await adapter.generate(basePrompt());

  assert.equal(response.content, "Nous sommes le lundi 8 juin 2026.");
});

test("CliAdapter rejects output above maxOutputBytes", async () => {
  const adapter = new CliAdapter("mock", cliConfig({
    args: ["-e", "process.stdout.write('x'.repeat(128))"],
    maxOutputBytes: 32
  }));

  await assert.rejects(
    adapter.generate(basePrompt()),
    (error) => error instanceof AdapterError
      && error.kind === "output-too-large"
      && error.details?.maxOutputBytes === 32
  );
});
async function writeFakeCli(name: string, source: string): Promise<string> {
  const dir = path.join(os.tmpdir(), "palabre-cli-adapter-tests");
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `${name}-${process.pid}-${Date.now()}.mjs`);
  await writeFile(filePath, source, "utf8");
  return filePath;
}
