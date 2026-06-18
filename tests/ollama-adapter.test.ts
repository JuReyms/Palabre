import test from "node:test";
import assert from "node:assert/strict";
import { OllamaAdapter } from "../src/adapters/ollama.js";
import type { AgentPrompt } from "../src/types.js";

test("OllamaAdapter localizes the default system prompt from the agent prompt language", async () => {
  const originalFetch = globalThis.fetch;
  let requestBody: { messages?: Array<{ role: string; content: string }> } | undefined;

  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    requestBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ message: { content: "ok" } }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  }) as typeof fetch;

  try {
    const adapter = new OllamaAdapter("ollama-local", {
      type: "ollama",
      model: "test-model",
      role: "critic",
      validateModel: false,
      unloadOtherModels: false
    });

    await adapter.generate(agentPrompt("en"));

    assert.equal(
      requestBody?.messages?.[0]?.content,
      "You are taking part in an orchestrated technical debate. Stay precise, useful, and honest about your limits."
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("OllamaAdapter reports auto-pull progress on stderr, not stdout", async () => {
  const originalFetch = globalThis.fetch;
  const originalStdoutWrite = process.stdout.write.bind(process.stdout) as typeof process.stdout.write;
  const originalStderrWrite = process.stderr.write.bind(process.stderr) as typeof process.stderr.write;
  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];
  let tagsCalls = 0;

  process.stdout.write = ((chunk: string | Uint8Array) => {
    stdoutChunks.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));
    return true;
  }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: string | Uint8Array) => {
    stderrChunks.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));
    return true;
  }) as typeof process.stderr.write;

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/api/tags")) {
      tagsCalls += 1;
      return new Response(JSON.stringify({
        models: tagsCalls === 1 ? [] : [{ name: "test-model" }]
      }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
    if (url.endsWith("/api/pull")) {
      return new Response(JSON.stringify({ status: "success" }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
    if (url.endsWith("/api/chat")) {
      return new Response(JSON.stringify({ message: { content: "ok" } }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
    throw new Error(`Unexpected fetch URL: ${url}`);
  }) as typeof fetch;

  try {
    const adapter = new OllamaAdapter("ollama-local", {
      type: "ollama",
      model: "test-model",
      role: "critic",
      autoPullModel: true,
      unloadOtherModels: false
    });

    await adapter.generate(agentPrompt("fr"));

    assert.equal(stdoutChunks.join(""), "");
    assert.match(stderrChunks.join(""), /telechargement: test-model/);
  } finally {
    globalThis.fetch = originalFetch;
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
  }
});

function agentPrompt(language: AgentPrompt["language"]): AgentPrompt {
  return {
    language,
    topic: "Topic",
    turn: 1,
    totalTurns: 2,
    selfName: "ollama-local",
    peerName: "codex",
    selfRole: "critic",
    session: {
      startedAt: "2026-06-09T00:00:00.000Z",
      localDate: "2026-06-09",
      timeZone: "Europe/Paris",
      cwd: "C:\\Users\\jurey\\Documents\\Dev\\Palabre"
    },
    files: [],
    transcript: []
  };
}
