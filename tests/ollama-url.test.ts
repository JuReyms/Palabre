import test from "node:test";
import assert from "node:assert/strict";
import { discoverLocalTools } from "../src/discovery.js";
import {
  DEFAULT_OLLAMA_BASE_URL,
  normalizeOllamaBaseUrl,
  resolveOllamaBaseUrl
} from "../src/ollamaUrl.js";

test("resolveOllamaBaseUrl applies CLI, environment, config, then default priority", () => {
  assert.equal(resolveOllamaBaseUrl({
    cliUrl: "cli.example:11434",
    envUrl: "env.example:11434",
    configUrl: "config.example:11434"
  }), "http://cli.example:11434");

  assert.equal(resolveOllamaBaseUrl({
    envUrl: "env.example:11434",
    configUrl: "config.example:11434"
  }), "http://env.example:11434");

  assert.equal(resolveOllamaBaseUrl({
    envUrl: " ",
    configUrl: "https://config.example:443/ollama/"
  }), "https://config.example/ollama");

  assert.equal(resolveOllamaBaseUrl({ envUrl: " " }), DEFAULT_OLLAMA_BASE_URL);
});

test("normalizeOllamaBaseUrl accepts Ollama host formats and connectable bind addresses", () => {
  assert.equal(normalizeOllamaBaseUrl("gpu-box:11434"), "http://gpu-box:11434");
  assert.equal(normalizeOllamaBaseUrl("gpu-box"), "http://gpu-box:11434");
  assert.equal(normalizeOllamaBaseUrl(":11434"), "http://127.0.0.1:11434");
  assert.equal(normalizeOllamaBaseUrl("0.0.0.0:11434"), "http://127.0.0.1:11434");
  assert.equal(normalizeOllamaBaseUrl("http://[::]:11434"), "http://[::1]:11434");
  assert.equal(normalizeOllamaBaseUrl("https://ollama.example/api/"), "https://ollama.example/api");
});

test("normalizeOllamaBaseUrl rejects invalid or unsafe base URLs", () => {
  assert.throws(() => normalizeOllamaBaseUrl(""), /Invalid Ollama URL/);
  assert.throws(() => normalizeOllamaBaseUrl("ftp://host:11434"), /protocol/);
  assert.throws(() => normalizeOllamaBaseUrl("http://user:secret@host:11434"), /Invalid Ollama URL/);
  assert.throws(() => normalizeOllamaBaseUrl("http://host:11434?token=secret"), /Invalid Ollama URL/);
});

test("discoverLocalTools probes the effective Ollama URL", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify({ models: [{ name: "test-model" }] }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  }) as typeof fetch;

  try {
    const discovery = await discoverLocalTools({
      ollamaUrl: "discovery.example:11434",
      ollamaConfigUrl: "config.example:11434"
    });

    assert.equal(requestedUrl, "http://discovery.example:11434/api/tags");
    assert.equal(discovery.ollama.baseUrl, "http://discovery.example:11434");
    assert.deepEqual(discovery.ollama.models, ["test-model"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("discoverLocalTools probes and maps distinct Ollama agent servers", async () => {
  const originalFetch = globalThis.fetch;
  const originalHost = process.env.OLLAMA_HOST;
  const requestedUrls: string[] = [];
  delete process.env.OLLAMA_HOST;

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    requestedUrls.push(url);
    const model = url.includes("reviewer.example") ? "reviewer-model" : "local-model";
    return new Response(JSON.stringify({ models: [{ name: model }] }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  }) as typeof fetch;

  try {
    const discovery = await discoverLocalTools({
      ollamaTargets: {
        "ollama-local": "local.example:11434",
        "ollama-reviewer": "reviewer.example:11434"
      }
    });

    assert.deepEqual(requestedUrls.sort(), [
      "http://local.example:11434/api/tags",
      "http://reviewer.example:11434/api/tags"
    ]);
    assert.equal(discovery.ollama.baseUrl, "http://local.example:11434");
    assert.deepEqual(discovery.ollamaAgents?.["ollama-local"]?.models, ["local-model"]);
    assert.deepEqual(discovery.ollamaAgents?.["ollama-reviewer"]?.models, ["reviewer-model"]);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalHost === undefined) {
      delete process.env.OLLAMA_HOST;
    } else {
      process.env.OLLAMA_HOST = originalHost;
    }
  }
});
