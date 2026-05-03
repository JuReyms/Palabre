import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ChicaneConfig } from "./types.js";

export const DEFAULT_CONFIG_PATH = "chicane.config.json";

export const exampleConfig: ChicaneConfig = {
  outputDir: ".",
  defaults: {
    agentA: "codex",
    agentB: "ollama-local",
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

export async function writeExampleConfig(configPath = DEFAULT_CONFIG_PATH): Promise<void> {
  await writeFile(path.resolve(configPath), `${JSON.stringify(exampleConfig, null, 2)}\n`, "utf8");
}
