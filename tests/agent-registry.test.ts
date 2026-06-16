import test from "node:test";
import assert from "node:assert/strict";
import {
  detectedAgentNames,
  detectionForCommand,
  isAgentDetected,
  normalizeCommandName
} from "../src/agentRegistry.js";
import type { ToolDiscovery } from "../src/discovery.js";
import type { AgentConfig } from "../src/types.js";

test("normalizeCommandName strips path and Windows executable extensions", () => {
  assert.equal(normalizeCommandName("C:\\bin\\claude.EXE"), "claude");
  assert.equal(normalizeCommandName("agy.ps1"), "agy");
  assert.equal(normalizeCommandName("/usr/local/bin/codex"), "codex");
});

test("detectionForCommand resolves both Antigravity aliases and ignores custom commands", () => {
  const discovery = discoveryWith({ antigravity: true });

  assert.equal(detectionForCommand("agy", discovery)?.available, true);
  assert.equal(detectionForCommand("antigravity", discovery)?.available, true);
  assert.equal(detectionForCommand("agy.cmd", discovery)?.available, true);
  assert.equal(detectionForCommand("my-custom-cli", discovery), undefined);
});

test("detectedAgentNames lists detected agents in canonical order", () => {
  const discovery = discoveryWith({ codex: true, opencode: true, vibe: true, ollama: true });

  assert.deepEqual(detectedAgentNames(discovery), ["codex", "opencode", "vibe", "ollama-local"]);
});

test("isAgentDetected reflects discovery, and treats unknown CLIs as available", () => {
  const discovery = discoveryWith({ ollama: true });

  const ollamaAgent: AgentConfig = { type: "ollama", model: "m", role: "critic" };
  assert.equal(isAgentDetected("ollama-local", ollamaAgent, discovery), true);

  const missingCli: AgentConfig = { type: "cli", command: "codex", role: "implementer" };
  assert.equal(isAgentDetected("codex", missingCli, discovery), false);

  const customCli: AgentConfig = { type: "cli", command: "my-custom-cli", role: "reviewer" };
  assert.equal(isAgentDetected("custom", customCli, discovery), true);
});

function discoveryWith(available: Partial<Record<"codex" | "claude" | "gemini" | "antigravity" | "opencode" | "vibe" | "ollama", boolean>>): ToolDiscovery {
  const cli = (command: string, ok?: boolean) => ({ available: Boolean(ok), command });

  return {
    codex: cli("codex", available.codex),
    claude: cli("claude", available.claude),
    gemini: cli("gemini", available.gemini),
    antigravity: cli("agy", available.antigravity),
    opencode: cli("opencode", available.opencode),
    vibe: cli("vibe", available.vibe),
    ollama: {
      available: Boolean(available.ollama),
      commandAvailable: Boolean(available.ollama),
      baseUrl: "http://localhost:11434",
      models: []
    }
  };
}
