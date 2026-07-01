import test from "node:test";
import assert from "node:assert/strict";
import { runAsk, runDebate } from "../src/orchestrator.js";
import { createTranslator } from "../src/i18n.js";
import type { DebateOptions, PalabreConfig, SessionContext } from "../src/types.js";

test("runDebate can early-stop on explicit English agreement", async () => {
  const config: PalabreConfig = {
    agents: {
      first: scriptedCliAgent("First point."),
      second: scriptedCliAgent("Complete agreement. Nothing to add.")
    }
  };
  const result = await runDebate(config, debateOptions({
    language: "en",
    turns: 4,
    summaryEnabled: false
  }), undefined, createTranslator("en"));

  assert.equal(result.messages.length, 2);
  assert.equal(result.stopReason, "Clear agreement detected after a complete round.");
});

test("runDebate stops before launching the next turn when aborted", async () => {
  const controller = new AbortController();
  const config: PalabreConfig = {
    agents: {
      first: scriptedCliAgent("First point."),
      second: scriptedCliAgent("Should not run.")
    }
  };
  const options = debateOptions({
    turns: 2,
    summaryEnabled: false,
    signal: controller.signal
  });
  controller.abort();

  const result = await runDebate(config, options, undefined, createTranslator("en"));

  assert.equal(result.messages.length, 0);
  assert.equal(result.failure?.kind, "cancelled");
  assert.equal(result.failure?.message, "Debate cancelled by the user.");
});

test("runAsk collects independent responses before summary", async () => {
  const config: PalabreConfig = {
    agents: {
      first: scriptedCliAgent("First answer."),
      second: scriptedCliAgent("Second answer."),
      summary: scriptedCliAgent("Summary answer.")
    }
  };
  const result = await runAsk(config, debateOptions({
    mode: "ask",
    agentA: "first",
    agentB: "second",
    askAgents: ["first", "second"],
    summaryAgent: "summary",
    summaryEnabled: true
  }), undefined, createTranslator("en"));

  assert.deepEqual(result.messages.map((message) => message.agent), ["first", "second"]);
  assert.deepEqual(result.messages.map((message) => message.content), ["First answer.", "Second answer."]);
  assert.equal(result.summary?.agent, "summary");
  assert.equal(result.summary?.role, "summarizer");
  assert.equal(result.summary?.content, "Summary answer.");
});

test("runDebate exposes summarizer as the runtime summary role", async () => {
  const config: PalabreConfig = {
    agents: {
      first: scriptedCliAgent("First point."),
      second: scriptedCliAgent("Second point."),
      vibe: { ...scriptedCliAgent("Summary answer."), role: "critic" }
    }
  };
  const result = await runDebate(config, debateOptions({
    summaryAgent: "vibe",
    summaryEnabled: true
  }), undefined, createTranslator("en"));

  assert.equal(result.summary?.agent, "vibe");
  assert.equal(result.summary?.role, "summarizer");
});

test("Ollama URL override covers debate, ask, and summary without mutating config", async () => {
  const originalFetch = globalThis.fetch;
  const urls: string[] = [];
  const config: PalabreConfig = {
    agents: {
      first: ollamaAgent("http://config-first:11434"),
      second: ollamaAgent("http://config-second:11434"),
      summary: ollamaAgent("http://config-summary:11434")
    }
  };

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    urls.push(String(input));
    return new Response(JSON.stringify({ message: { content: "ok" } }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  }) as typeof fetch;

  try {
    await runDebate(config, debateOptions({
      turns: 2,
      summaryEnabled: true,
      summaryAgent: "summary",
      ollamaUrl: "runtime-host:11434"
    }), undefined, createTranslator("en"));

    await runAsk(config, debateOptions({
      mode: "ask",
      askAgents: ["first", "second"],
      summaryEnabled: true,
      summaryAgent: "summary",
      ollamaUrl: "runtime-host:11434"
    }), undefined, createTranslator("en"));

    assert.equal(urls.length, 6);
    assert.ok(urls.every((url) => url === "http://runtime-host:11434/api/chat"));
    assert.equal(config.agents.first?.type === "ollama" ? config.agents.first.baseUrl : undefined, "http://config-first:11434");
    assert.equal(config.agents.summary?.type === "ollama" ? config.agents.summary.baseUrl : undefined, "http://config-summary:11434");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("runDebate localizes invalid Ollama URL failures", async () => {
  const config: PalabreConfig = {
    agents: {
      first: ollamaAgent("http://config.example:11434"),
      second: scriptedCliAgent("unused")
    }
  };

  const result = await runDebate(config, debateOptions({
    turns: 1,
    ollamaUrl: "ftp://invalid.example:11434",
    summaryEnabled: false
  }), undefined, createTranslator("fr"));

  assert.equal(result.failure?.kind, "unknown");
  assert.equal(result.failure?.message, "Protocole Ollama invalide: ftp:. Utilise http: ou https:.");
});

function ollamaAgent(baseUrl: string): PalabreConfig["agents"][string] {
  return {
    type: "ollama",
    baseUrl,
    model: "test-model",
    role: "critic",
    validateModel: false,
    unloadOtherModels: false
  };
}

function scriptedCliAgent(output: string): PalabreConfig["agents"][string] {
  return {
    type: "cli",
    command: process.execPath,
    args: ["-e", `console.log(${JSON.stringify(output)})`],
    promptMode: "stdin",
    role: "reviewer"
  };
}

function debateOptions(overrides: Partial<DebateOptions> = {}): DebateOptions {
  return {
    mode: "debate",
    language: "fr",
    topic: "Test topic",
    agentA: "first",
    agentB: "second",
    turns: 2,
    session: session(),
    files: [],
    pullModels: false,
    summaryEnabled: false,
    earlyStopOnAgreement: true,
    plainOutput: true,
    ...overrides,
    summaryAgent: overrides.summaryAgent ?? "second"
  };
}

function session(): SessionContext {
  return {
    startedAt: "2026-06-09T00:00:00.000Z",
    localDate: "2026-06-09",
    timeZone: "Europe/Paris",
    cwd: "C:\\Users\\jurey\\Documents\\Dev\\Palabre"
  };
}
