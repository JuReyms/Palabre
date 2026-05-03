import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ChicaneConfig } from "./types.js";
import type { ToolDiscovery } from "./discovery.js";

export const DEFAULT_CONFIG_PATH = "chicane.config.json";

export const exampleConfig: ChicaneConfig = {
  outputDir: ".",
  defaults: {
    agentA: "codex",
    agentB: "claude",
    turns: 4
  },
  agents: {
    codex: {
      type: "cli",
      command: "codex",
      args: [
        "exec",
        "--skip-git-repo-check",
        "--color",
        "never",
        "--sandbox",
        "read-only",
        "-"
      ],
      promptMode: "stdin",
      shell: process.platform === "win32",
      role: "implementer",
      tier: "primary"
    },
    claude: {
      type: "cli",
      command: process.platform === "win32" ? "claude.exe" : "claude",
      args: [
        "--print",
        "--output-format",
        "text",
        "--no-session-persistence"
      ],
      promptMode: "stdin",
      shell: false,
      role: "reviewer",
      tier: "primary"
    },
    gemini: {
      type: "cli",
      command: "gemini",
      args: [
        "--output-format",
        "text",
        "--approval-mode",
        "plan",
        "--skip-trust",
        "--prompt",
        "-"
      ],
      promptMode: "stdin",
      shell: process.platform === "win32",
      role: "reviewer",
      tier: "primary"
    },
    "ollama-local": {
      type: "ollama",
      baseUrl: "http://localhost:11434",
      model: "nemotron-3-nano:4b",
      role: "critic",
      tier: "local",
      temperature: 0.2,
      validateModel: true,
      unloadOtherModels: true
    }
  }
};

export async function loadConfig(configPath = DEFAULT_CONFIG_PATH): Promise<ChicaneConfig> {
  const resolved = path.resolve(configPath);
  const raw = await readFile(resolved, "utf8");
  return JSON.parse(raw) as ChicaneConfig;
}

export async function configExists(configPath = DEFAULT_CONFIG_PATH): Promise<boolean> {
  try {
    await access(path.resolve(configPath));
    return true;
  } catch {
    return false;
  }
}

export function createConfigFromDiscovery(discovery: ToolDiscovery): ChicaneConfig {
  const config = cloneConfig(exampleConfig);
  const pair = chooseDefaultPair(discovery);

  config.agents.codex = {
    ...config.agents.codex,
    ...(discovery.codex.available ? { command: discovery.codex.command } : {})
  };
  config.agents.claude = {
    ...config.agents.claude,
    ...(discovery.claude.available ? { command: discovery.claude.command } : {})
  };
  config.agents.gemini = {
    ...config.agents.gemini,
    ...(discovery.gemini.available ? { command: discovery.gemini.command } : {})
  };

  config.defaults = {
    ...config.defaults,
    ...(pair ? { agentA: pair[0], agentB: pair[1] } : {})
  };

  return config;
}

export async function writeExampleConfig(
  configPath = DEFAULT_CONFIG_PATH,
  config: ChicaneConfig = exampleConfig
): Promise<void> {
  await writeFile(path.resolve(configPath), `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

function chooseDefaultPair(discovery: ToolDiscovery): [string, string] | undefined {
  if (discovery.codex.available && discovery.claude.available) {
    return ["codex", "claude"];
  }

  if (discovery.codex.available && discovery.ollama.available) {
    return ["codex", "ollama-local"];
  }

  if (discovery.claude.available && discovery.ollama.available) {
    return ["claude", "ollama-local"];
  }

  if (discovery.gemini.available && discovery.ollama.available) {
    return ["gemini", "ollama-local"];
  }

  const cliAgents = [
    discovery.codex.available ? "codex" : undefined,
    discovery.claude.available ? "claude" : undefined,
    discovery.gemini.available ? "gemini" : undefined
  ].filter((agent): agent is string => Boolean(agent));

  if (cliAgents.length >= 2) {
    return [cliAgents[0], cliAgents[1]];
  }

  return undefined;
}

function cloneConfig(config: ChicaneConfig): ChicaneConfig {
  return JSON.parse(JSON.stringify(config)) as ChicaneConfig;
}
