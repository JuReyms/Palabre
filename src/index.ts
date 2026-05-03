#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { configExists, DEFAULT_CONFIG_PATH, loadConfig, writeExampleConfig } from "./config.js";
import { loadProjectFiles } from "./context.js";
import { formatAgentPrompt } from "./prompt.js";
import { listPresetNames, resolvePreset } from "./presets.js";
import { runDebate } from "./orchestrator.js";
import { writeDebateMarkdown } from "./output.js";
import type { DebateOptions } from "./types.js";

interface ParsedArgs {
  command: string;
  flags: Record<string, string | string[] | boolean>;
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));

  if (parsed.command === "version" || parsed.flags.version) {
    console.log(await getPackageVersion());
    return;
  }

  if (parsed.command === "help" || parsed.flags.help) {
    printHelp();
    return;
  }

  if (parsed.command === "init" || parsed.command === "setup") {
    if (await configExists(DEFAULT_CONFIG_PATH)) {
      console.log(`${DEFAULT_CONFIG_PATH} existe deja.`);
      return;
    }

    await writeExampleConfig(DEFAULT_CONFIG_PATH);
    console.log(`${DEFAULT_CONFIG_PATH} cree.`);
    return;
  }

  const configPath = String(parsed.flags.config ?? DEFAULT_CONFIG_PATH);

  if (!(await configExists(configPath))) {
    await writeExampleConfig(configPath);
    console.log(`${configPath} cree. Edite la config puis relance chicane run.`);
    return;
  }

  const config = await loadConfig(configPath);
  const topic = String(parsed.flags.topic ?? "").trim();
  const files = await loadProjectFiles(getStringListFlag(parsed.flags.files));
  const presetName = optionalString(parsed.flags.preset);
  const preset = presetName ? resolvePreset(presetName) : undefined;

  if (!topic) {
    throw new Error("Le parametre --topic est requis.");
  }

  const options: DebateOptions = {
    topic,
    agentA: String(parsed.flags["agent-a"] ?? preset?.agentA ?? config.defaults?.agentA ?? "codex"),
    agentB: String(parsed.flags["agent-b"] ?? preset?.agentB ?? config.defaults?.agentB ?? "ollama-local"),
    turns: Number(parsed.flags.turns ?? config.defaults?.turns ?? 4),
    files,
    modelA: optionalString(parsed.flags["model-a"]),
    modelB: optionalString(parsed.flags["model-b"]),
    pullModels: Boolean(parsed.flags["pull-models"]),
    summaryAgent: optionalString(parsed.flags["summary-agent"]),
    summaryModel: optionalString(parsed.flags["summary-model"]),
    summaryEnabled: !parsed.flags["no-summary"]
  };

  if (parsed.flags["show-prompt"]) {
    printPromptPreview(config, options);
    return;
  }

  const result = await runDebate(config, options);
  const outputPath = await writeDebateMarkdown(config.outputDir ?? ".", result.options, result.messages, result.summary);

  console.log(`\nDebat exporte: ${outputPath}`);
}

function printPromptPreview(config: Awaited<ReturnType<typeof loadConfig>>, options: DebateOptions): void {
  const agentConfig = config.agents[options.agentA];

  if (!agentConfig) {
    throw new Error(`Agent inconnu: ${options.agentA}`);
  }

  const prompt = formatAgentPrompt({
    topic: options.topic,
    turn: 1,
    selfName: options.agentA,
    peerName: options.agentB,
    files: options.files,
    transcript: []
  });

  console.log(`# Prompt preview`);
  console.log(`Agent: ${options.agentA} (${agentConfig.role})`);
  console.log(`Peer: ${options.agentB}`);
  console.log(`Models: ${options.modelA ?? "default"} <-> ${options.modelB ?? "default"}`);
  console.log(`Pull missing Ollama models: ${options.pullModels ? "yes" : "no"}`);
  console.log(`Summary: ${options.summaryEnabled ? options.summaryAgent ?? options.agentB : "disabled"}`);
  console.log("");
  console.log(prompt);
  console.log("");
  console.log("Note: seuls les prompts du premier tour sont exacts sans executer les agents. Les tours suivants incluent le transcript reel.");
}

function optionalString(value: string | string[] | boolean | undefined): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function parseArgs(args: string[]): ParsedArgs {
  const flags: Record<string, string | string[] | boolean> = {};
  let command = "run";

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];

    if (!value.startsWith("-") && index === 0) {
      command = value;
      continue;
    }

    if (value === "-h") {
      flags.help = true;
      continue;
    }

    if (value === "-v") {
      flags.version = true;
      continue;
    }

    if (value.startsWith("--")) {
      const key = value.slice(2);

      if (key === "files") {
        const values: string[] = [];

        while (args[index + 1] && !args[index + 1].startsWith("--")) {
          values.push(args[index + 1]);
          index += 1;
        }

        flags[key] = [...getStringListFlag(flags[key]), ...values];
        continue;
      }

      const next = args[index + 1];

      if (!next || next.startsWith("--")) {
        flags[key] = true;
      } else {
        flags[key] = next;
        index += 1;
      }
    }
  }

  return { command, flags };
}

async function getPackageVersion(): Promise<string> {
  const packageJsonPath = path.resolve("package.json");
  const raw = await readFile(packageJsonPath, "utf8");
  const packageJson = JSON.parse(raw) as { version?: string };

  return packageJson.version ?? "0.0.0";
}

function getStringListFlag(value: string | string[] | boolean | undefined): string[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string") {
    return [value];
  }

  return [];
}

function printHelp(): void {
  console.log(`
Chicane

Commandes:
  chicane init
  chicane run --topic "Sujet" [--agent-a codex] [--agent-b ollama-local] [--turns 4]
  chicane help
  chicane version

Options:
  -h, --help           Affiche cette aide
  -v, --version        Affiche la version
  --config <path>      Chemin vers chicane.config.json
  --topic <text>       Sujet du debat
  --agent-a <name>     Premier agent
  --agent-b <name>     Second agent
  --preset <name>      Preset de paire d'agents (${listPresetNames().join(", ")})
  --model-a <model>    Modele brut transmis a l'agent A
  --model-b <model>    Modele brut transmis a l'agent B
  --pull-models        Autorise Ollama a telecharger un modele manquant
  --summary-agent <n>  Agent utilise pour produire la synthese finale (defaut: agent B)
  --summary-model <m>  Modele brut transmis a l'agent de synthese
  --no-summary         Desactive la synthese finale
  --turns <number>     Nombre total de tours
  --files <paths...>   Fichiers texte a injecter explicitement dans le contexte
  --show-prompt        Affiche le prompt du premier tour sans appeler d'agent
`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Erreur: ${message}`);
  process.exitCode = 1;
});
