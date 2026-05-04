#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { configExists, createConfigFromDiscovery, DEFAULT_CONFIG_PATH, loadConfig, resolveDefaultConfigPath, writeExampleConfig } from "./config.js";
import { loadProjectInputs } from "./context.js";
import { discoverLocalTools } from "./discovery.js";
import { AdapterError, formatAdapterError } from "./errors.js";
import { formatAgentPrompt } from "./prompt.js";
import { listPresetNames, resolvePreset } from "./presets.js";
import { createConsoleRenderer } from "./renderers/console.js";
import { runDebate } from "./orchestrator.js";
import { writeDebateMarkdown } from "./output.js";
import { applySourceUpdate, formatUpdateInstructions, getUpdateInfo } from "./update.js";
import { createSessionContext } from "./session.js";
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

  if (parsed.command === "update") {
    const info = await getUpdateInfo(await getPackageVersion());

    if (parsed.flags.apply) {
      await applySourceUpdate(info);
      console.log("PALABRE est a jour.");
      return;
    }

    console.log(formatUpdateInstructions(info));
    return;
  }

  if (parsed.command === "init" || parsed.command === "setup") {
    const existingConfigPath = await resolveDefaultConfigPath();

    if (await configExists(existingConfigPath)) {
      console.log(`${existingConfigPath} existe deja.`);
      return;
    }

    const discovery = await discoverLocalTools();
    const config = createConfigFromDiscovery(discovery);
    await writeExampleConfig(DEFAULT_CONFIG_PATH, config);
    console.log(`${DEFAULT_CONFIG_PATH} cree.`);
    printInitDiscovery(discovery, config);
    return;
  }

  const configPath = optionalString(parsed.flags.config) ?? await resolveDefaultConfigPath();

  if (!(await configExists(configPath))) {
    await writeExampleConfig(configPath);
    console.log(`${configPath} cree. Edite la config puis relance palabre run.`);
    return;
  }

  const config = await loadConfig(configPath);
  const topic = optionalString(parsed.flags.topic) ?? "";
  const context = await loadProjectInputs(
    getStringListFlag(parsed.flags.files),
    getStringListFlag(parsed.flags.context)
  );
  const presetName = optionalString(parsed.flags.preset);
  const preset = presetName ? resolvePreset(presetName) : undefined;

  if (!topic) {
    throw new Error("Le parametre --topic/--subject est requis.");
  }

  const options: DebateOptions = {
    topic,
    agentA: String(parsed.flags["agent-a"] ?? preset?.agentA ?? config.defaults?.agentA ?? "codex"),
    agentB: String(parsed.flags["agent-b"] ?? preset?.agentB ?? config.defaults?.agentB ?? "claude"),
    turns: Number(parsed.flags.turns ?? config.defaults?.turns ?? 4),
    session: createSessionContext(),
    files: context.files,
    modelA: optionalString(parsed.flags["model-a"]),
    modelB: optionalString(parsed.flags["model-b"]),
    pullModels: Boolean(parsed.flags["pull-models"]),
    summaryAgent: optionalString(parsed.flags["summary-agent"]),
    summaryModel: optionalString(parsed.flags["summary-model"]),
    summaryEnabled: !parsed.flags["no-summary"],
    earlyStopOnAgreement: !parsed.flags["no-early-stop"],
    plainOutput: Boolean(parsed.flags.plain)
  };

  if (parsed.flags["show-prompt"]) {
    printContextWarnings(context.warnings);
    printPromptPreview(config, options);
    return;
  }

  const renderer = createConsoleRenderer(options.plainOutput);
  context.warnings.forEach((warning) => renderer.warning(warning));
  const result = await runDebate(config, options, renderer);
  const outputPath = await writeDebateMarkdown(
    config.outputDir ?? ".",
    result.options,
    result.messages,
    result.summary,
    result.stopReason
  );

  renderer.done(outputPath);
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
    session: options.session,
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
  const positionals: string[] = [];
  const commands = new Set(["run", "init", "setup", "help", "version", "update"]);
  const presets = new Set(listPresetNames());

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];

    if (!value.startsWith("-") && index === 0) {
      if (commands.has(value)) {
        command = value;
      } else {
        positionals.push(value);
      }
      continue;
    }

    if (!value.startsWith("-")) {
      positionals.push(value);
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

    if (value === "-s") {
      const next = args[index + 1];

      if (!next || next.startsWith("-")) {
        throw new Error("L'option -s attend une valeur.");
      }

      flags.topic = next;
      index += 1;
      continue;
    }

    if (value === "-t") {
      const next = args[index + 1];

      if (!next || next.startsWith("-")) {
        throw new Error("L'option -t attend une valeur.");
      }

      flags.turns = next;
      index += 1;
      continue;
    }

    if (value.startsWith("--")) {
      const rawKey = value.slice(2);
      const key = normalizeFlagName(rawKey);

      if (key === "files" || key === "context") {
        const values: string[] = [];

        while (args[index + 1] && !args[index + 1].startsWith("-")) {
          values.push(args[index + 1]);
          index += 1;
        }

        flags[key] = [...getStringListFlag(flags[key]), ...values];
        continue;
      }

      const next = args[index + 1];

      if (!next || next.startsWith("-")) {
        if (requiresFlagValue(key)) {
          throw new Error(`L'option --${rawKey} attend une valeur.`);
        }

        flags[key] = true;
      } else {
        flags[key] = next;
        index += 1;
      }
    }
  }

  if (command === "run") {
    applyRunPositionals(positionals, flags, presets);
  }

  return { command, flags };
}

function applyRunPositionals(
  positionals: string[],
  flags: Record<string, string | string[] | boolean>,
  presets: Set<string>
): void {
  if (positionals.length === 0) {
    return;
  }

  const [first, ...rest] = positionals;

  if (presets.has(first)) {
    flags.preset ??= first;

    if (rest.length > 0) {
      flags.topic ??= rest.join(" ");
    }

    return;
  }

  flags.topic ??= positionals.join(" ");
}

function normalizeFlagName(value: string): string {
  const aliases: Record<string, string> = {
    s: "topic",
    subject: "topic",
    t: "turns"
  };

  return aliases[value] ?? value;
}

function requiresFlagValue(value: string): boolean {
  return new Set([
    "agent-a",
    "agent-b",
    "config",
    "model-a",
    "model-b",
    "preset",
    "summary-agent",
    "summary-model",
    "topic",
    "turns"
  ]).has(value);
}

async function getPackageVersion(): Promise<string> {
  const packageJsonPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "package.json");
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

function printContextWarnings(warnings: string[]): void {
  for (const warning of warnings) {
    process.stderr.write(`Warning: ${warning}\n`);
  }
}

function printInitDiscovery(
  discovery: Awaited<ReturnType<typeof discoverLocalTools>>,
  config: Awaited<ReturnType<typeof loadConfig>>
): void {
  console.log("");
  console.log("Detection locale:");
  console.log(`- Codex CLI: ${formatCommandDetection(discovery.codex)}`);
  console.log(`- Claude CLI: ${formatCommandDetection(discovery.claude)}`);
  console.log(`- Gemini CLI: ${formatCommandDetection(discovery.gemini)}`);
  console.log(`- Ollama API: ${formatOllamaDetection(discovery.ollama)}`);
  console.log("");
  console.log(`Defaults: ${config.defaults?.agentA ?? "codex"} <-> ${config.defaults?.agentB ?? "ollama-local"}`);
}

function formatCommandDetection(detection: Awaited<ReturnType<typeof discoverLocalTools>>["codex"]): string {
  return detection.available
    ? `detecte (${detection.command})`
    : "non detecte";
}

function formatOllamaDetection(detection: Awaited<ReturnType<typeof discoverLocalTools>>["ollama"]): string {
  if (!detection.available) {
    return detection.commandAvailable
      ? `serveur non joignable (${detection.baseUrl})`
      : "non detecte";
  }

  const modelCount = detection.models.length;
  return `detectee (${modelCount} modele${modelCount > 1 ? "s" : ""})`;
}

function printHelp(): void {
  console.log(`
PALABRE

Commandes:
  palabre init
  palabre update [--apply]
  palabre run --subject "Sujet" [--agent-a codex] [--agent-b claude] [--turns 4]
  palabre claude-gemini "Sujet" -t 4
  palabre -s "Sujet" -t 2
  palabre help
  palabre version

Options:
  -h, --help           Affiche cette aide
  -v, --version        Affiche la version
  --config <path>      Chemin vers palabre.config.json
  -s, --subject <text> Sujet du debat
  --topic <text>       Alias compatible de --subject
  --agent-a <name>     Premier agent
  --agent-b <name>     Second agent
  --preset <name>      Preset de paire d'agents (${listPresetNames().join(", ")})
  --model-a <model>    Modele brut transmis a l'agent A
  --model-b <model>    Modele brut transmis a l'agent B
  --pull-models        Autorise Ollama a telecharger un modele manquant
  --summary-agent <n>  Agent utilise pour produire la synthese finale (defaut: agent B)
  --summary-model <m>  Modele brut transmis a l'agent de synthese
  --no-summary         Desactive la synthese finale
  --no-early-stop      Desactive l'arret anticipe si les agents sont clairement d'accord
  --turns <number>     Nombre total de tours
  -t, --t <number>     Alias court de --turns
  --files <paths...>   Fichiers texte a injecter explicitement dans le contexte
  --context <paths...> Scanne fichiers/dossiers texte en respectant les limites de contexte
  --show-prompt        Affiche le prompt du premier tour sans appeler d'agent
  --plain              Utilise le rendu console simple sans habillage TUI
  --apply              Execute les etapes de palabre update pour un checkout git
`);
}

main().catch((error: unknown) => {
  const message = error instanceof AdapterError
    ? formatAdapterError(error)
    : error instanceof Error ? error.message : String(error);
  console.error(`Erreur: ${message}`);
  process.exitCode = 1;
});

