import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  activeConfiguredAgentEntries,
  activeConfiguredAgentNames,
  applyDetectedCommands,
  detectedAgentNames,
  detectionForCommand,
  isAgentDetected,
  isRetiredAgentName,
  normalizeCommandName
} from "../src/agentRegistry.js";
import type { ToolDiscovery } from "../src/discovery.js";
import type { AgentConfig, PalabreConfig } from "../src/types.js";
import { listAgentsWithAvailability } from "../src/presets.js";

test("disponibilité : vérifie le fichier absolu configuré, jamais une autre CLI du PATH", t => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "palabre-agent-path-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const selected = path.join(dir, "claude.exe");
  const tools = discoveryWith({ claude: true }); tools.claude.path = "/other/claude.exe";
  const config: PalabreConfig = { agents: { claude: { type: "cli", command: selected, role: "reviewer" } } };
  assert.equal(detectionForCommand(selected, tools)?.available, false);
  assert.equal(isAgentDetected("claude", config.agents.claude, tools), false);
  assert.equal(listAgentsWithAvailability(config, tools).find(agent => agent.name === "claude")?.available, false);
  writeFileSync(selected, "not executed"); tools.claude.available = false;
  assert.equal(detectionForCommand(selected, tools)?.path, selected);
  assert.equal(isAgentDetected("claude", config.agents.claude, tools), true);
  assert.equal(listAgentsWithAvailability(config, tools).find(agent => agent.name === "claude")?.available, true);
  assert.equal(detectionForCommand(dir, tools)?.available, false, "un dossier n'est pas un fichier CLI");
});

test("la synchronisation conserve les chemins absolus POSIX, Windows et UNC, même absents", () => {
  for (const command of ["/missing/claude", "C:\\Tools\\Claude\\claude.exe", "C:/Tools/Claude/claude.exe", "\\\\server\\share\\claude.exe"]) {
    for (const type of ["cli", "cli-pty"] as const) {
      const config: PalabreConfig = { agents: { claude: { type, command, args: ["custom"], role: "reviewer" } } };
      const before = structuredClone(config);
      applyDetectedCommands(config, discoveryWith({ claude: true }));
      assert.deepEqual(config, before);
    }
  }
});

test("les commandes non épinglées continuent d'être synchronisées, les agents personnalisés restent intacts", () => {
  for (const command of ["claude", "claude.exe", "./claude", ".\\claude.exe"]) {
    const config: PalabreConfig = { agents: {
      claude: { type: "cli", command, args: ["custom"], role: "reviewer" },
      "claude-review": { type: "cli", command: "/explicit/claude", role: "reviewer" }
    } };
    const originalCustom = structuredClone(config.agents["claude-review"]);
    const discovery = discoveryWith({ claude: true }); discovery.claude.command = "/detected/claude";
    applyDetectedCommands(config, discovery);
    const cli = config.agents.claude;
    assert.equal(cli.type, "cli");
    if (cli.type !== "cli") throw Error("CLI required");
    assert.equal(cli.command, "/detected/claude");
    assert.deepEqual(cli.args, ["custom"]); assert.deepEqual(config.agents["claude-review"], originalCustom);
  }
});

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

test("isRetiredAgentName keeps archived agents out of active inventories", () => {
  assert.equal(isRetiredAgentName("gemini"), true);
  assert.equal(isRetiredAgentName("Gemini"), true);
  assert.equal(isRetiredAgentName("antigravity"), false);
});

test("active configured agents exclude Gemini from every user-facing inventory", () => {
  const config = {
    agents: {
      codex: { type: "cli" as const, command: "codex", role: "implementer" as const },
      gemini: { type: "cli" as const, command: "gemini", role: "reviewer" as const },
      antigravity: { type: "cli-pty" as const, command: "agy", role: "critic" as const }
    }
  };

  assert.deepEqual(activeConfiguredAgentNames(config), ["codex", "antigravity"]);
  assert.deepEqual(activeConfiguredAgentEntries(config).map(([name]) => name), ["codex", "antigravity"]);
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

function discoveryWith(available: Partial<Record<"codex" | "claude" | "antigravity" | "opencode" | "vibe" | "ollama", boolean>>): ToolDiscovery {
  const cli = (command: string, ok?: boolean) => ({ available: Boolean(ok), command });

  return {
    codex: cli("codex", available.codex),
    claude: cli("claude", available.claude),
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
