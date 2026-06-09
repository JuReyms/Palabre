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
