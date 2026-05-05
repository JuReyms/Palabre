#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { configExists, createConfigFromDiscovery, DEFAULT_CONFIG_PATH, GLOBAL_CONFIG_PATH, loadConfig, resolveDefaultConfigPath, writeExampleConfig } from "./config.js";
import { loadProjectInputs } from "./context.js";
import { discoverLocalTools } from "./discovery.js";
import { runDoctor } from "./doctor.js";
import { AdapterError, formatAdapterError } from "./errors.js";
import { runConfigWizard } from "./configWizard.js";
import { formatAgentPrompt } from "./prompt.js";
import { runNewWizard } from "./new.js";
import { listPresetNames, resolvePreset } from "./presets.js";
import { createConsoleRenderer } from "./renderers/console.js";
import { runDebate } from "./orchestrator.js";
import { writeDebateMarkdown } from "./output.js";
import { applySourceUpdate, formatUpdateInstructions, getUpdateInfo } from "./update.js";
import { createSessionContext } from "./session.js";
import type { AgentConfig, DebateOptions, PalabreConfig } from "./types.js";

interface ParsedArgs {
  command: string;
  commandExplicit: boolean;
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

  if (parsed.command === "doctor") {
    const result = await runDoctor(optionalString(parsed.flags.config));
    console.log(result.output);
    process.exitCode = result.ok ? 0 : 1;
    return;
  }

  if (parsed.command === "config") {
    await runConfigCommand(parsed.flags);
    return;
  }

  if (parsed.command === "agents" || parsed.command === "agent") {
    await runAgentsCommand(parsed.flags);
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
    const initConfigPath = optionalString(parsed.flags.config) ?? (parsed.flags.local ? DEFAULT_CONFIG_PATH : GLOBAL_CONFIG_PATH);

    if (await configExists(initConfigPath)) {
      console.log(`${initConfigPath} existe déjà.`);
      return;
    }

    const discovery = await discoverLocalTools();
    const config = createConfigFromDiscovery(discovery);
    await writeExampleConfig(initConfigPath, config);
    console.log(`${initConfigPath} créé.`);
    printInitDiscovery(discovery, config);
    return;
  }

  const configPath = optionalString(parsed.flags.config) ?? await resolveDefaultConfigPath();

  if (!(await configExists(configPath))) {
    await writeExampleConfig(configPath);
    console.log(`${configPath} créé. Édite la config puis relance palabre run.`);
    return;
  }

  const config = await loadConfig(configPath);

  if (parsed.command === "new") {
    const selection = await runNewWizard(config);

    if (!selection) {
      console.log("Création de débat annulée.");
      return;
    }

    parsed.flags["agent-a"] = selection.agentA;
    parsed.flags["agent-b"] = selection.agentB;
    parsed.flags.topic = selection.topic;
    if (selection.modelA) parsed.flags["model-a"] = selection.modelA;
    if (selection.modelB) parsed.flags["model-b"] = selection.modelB;
    if (selection.turns) parsed.flags.turns = String(selection.turns);
    if (selection.summaryAgent) parsed.flags["summary-agent"] = selection.summaryAgent;
    if (selection.summaryModel) parsed.flags["summary-model"] = selection.summaryModel;
    if (selection.summaryEnabled === false) parsed.flags["no-summary"] = true;
    if (selection.showPrompt) parsed.flags["show-prompt"] = true;
    if (selection.plainOutput) parsed.flags.plain = true;
    if (selection.files.length > 0) parsed.flags.files = selection.files;
    if (selection.context.length > 0) parsed.flags.context = selection.context;
  }

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
    agentA: resolveAgentName("agent A", parsed.flags["agent-a"], preset?.agentA, config.defaults?.agentA),
    agentB: resolveAgentName("agent B", parsed.flags["agent-b"], preset?.agentB, config.defaults?.agentB),
    turns: Number(parsed.flags.turns ?? config.defaults?.turns ?? 4),
    session: createSessionContext(),
    files: context.files,
    modelA: optionalString(parsed.flags["model-a"]),
    modelB: optionalString(parsed.flags["model-b"]),
    pullModels: Boolean(parsed.flags["pull-models"]),
    summaryAgent: optionalString(parsed.flags["summary-agent"]) ?? config.defaults?.summaryAgent,
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

async function runAgentsCommand(flags: Record<string, string | string[] | boolean>): Promise<void> {
  const configPath = optionalString(flags.config) ?? await resolveDefaultConfigPath();

  if (!(await configExists(configPath))) {
    throw new Error("Aucune config trouvée. Lance `palabre init`, puis `palabre agents`.");
  }

  const config = await loadConfig(configPath);
  const discovery = await discoverLocalTools();
  printAgents(configPath, config, discovery);
}
async function runConfigCommand(flags: Record<string, string | string[] | boolean>): Promise<void> {
  const configPath = optionalString(flags.config) ?? await resolveDefaultConfigPath();

  if (!(await configExists(configPath))) {
    await writeExampleConfig(configPath);
    console.log(`${configPath} créé. Édite la config puis relance palabre config.`);
    return;
  }

  const config = await loadConfig(configPath);

  const defaultAgents = getStringListFlag(flags["set-defaults"]);
  const turnsValue = optionalString(flags.turns);
  const summaryAgentValue = optionalString(flags["summary-agent"]);

  if (defaultAgents.length > 0 || turnsValue || summaryAgentValue) {
    const currentDefaults = config.defaults ?? {};
    const [agentA = currentDefaults.agentA, agentB = currentDefaults.agentB] = defaultAgents;

    if (!agentA || !agentB) {
      throw new Error("Impossible de définir les paramètres par défaut: indique d'abord deux agents avec --set-defaults <agentA> <agentB>.");
    }

    assertKnownAgent(config, agentA, "defaults.agentA");
    assertKnownAgent(config, agentB, "defaults.agentB");

    const turns = turnsValue ? Number(turnsValue) : currentDefaults.turns ?? 4;

    if (!Number.isInteger(turns) || turns <= 0) {
      throw new Error("L'option --turns attend un nombre entier positif.");
    }

    const summaryAgent = summaryAgentValue ?? currentDefaults.summaryAgent;

    if (summaryAgent) {
      assertKnownAgent(config, summaryAgent, "defaults.summaryAgent");
    }

    config.defaults = {
      agentA,
      agentB,
      ...(summaryAgent ? { summaryAgent } : {}),
      turns
    };

    await writeExampleConfig(configPath, config);
    console.log(`Paramètres par défaut définis dans ${configPath}: ${agentA} <-> ${agentB}, réponses: ${turns}${summaryAgent ? `, synthèse: ${summaryAgent}` : ""}.`);
    return;
  }

  if (flags["clear-defaults"]) {
    delete config.defaults;
    await writeExampleConfig(configPath, config);
    console.log(`Paramètres par défaut supprimés dans ${configPath}. Utilise maintenant un preset ou --agent-a/--agent-b pour lancer un débat.`);
    return;
  }

  await runConfigWizard(configPath, config);
}
function assertKnownAgent(config: Awaited<ReturnType<typeof loadConfig>>, agentName: string, fieldName: string): void {
  if (!config.agents[agentName]) {
    throw new Error(`Agent inconnu pour ${fieldName}: ${agentName}. Agents disponibles: ${Object.keys(config.agents).join(", ")}.`);
  }
}
function resolveAgentName(
  label: string,
  explicitValue: string | string[] | boolean | undefined,
  presetValue: string | undefined,
  defaultValue: string | undefined
): string {
  const resolved = optionalString(explicitValue) ?? presetValue ?? defaultValue;

  if (!resolved) {
    throw new Error(`Aucun ${label} défini. Utilise --agent-a/--agent-b, un preset, ou lance palabre init pour définir defaults.agentA/defaults.agentB.`);
  }

  return resolved;
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
    selfRole: agentConfig.role,
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
  console.log("Note: seuls les prompts du premier tour sont exacts sans exécuter les agents. Les tours suivants incluent le transcript réel.");
}

function optionalString(value: string | string[] | boolean | undefined): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function parseArgs(args: string[]): ParsedArgs {
  const flags: Record<string, string | string[] | boolean> = {};
  let command = "run";
  let commandExplicit = false;
  const positionals: string[] = [];
  const commands = new Set(["run", "new", "init", "setup", "help", "version", "update", "doctor", "config", "agent", "agents"]);
  const presets = new Set(listPresetNames());

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];

    if (!value.startsWith("-") && index === 0) {
      if (commands.has(value)) {
        command = value;
        commandExplicit = true;
      } else if (isLikelyCommandTypo(value, commands)) {
        throw new Error(`Commande inconnue: ${value}. Commandes disponibles: ${Array.from(commands).join(", ")}.`);
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

    if (value === "-a") {
      command = "agents";
      commandExplicit = true;
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

      if (key === "set-defaults") {
        const values: string[] = [];

        while (args[index + 1] && !args[index + 1].startsWith("-") && values.length < 2) {
          values.push(args[index + 1]);
          index += 1;
        }

        if (values.length !== 2) {
          throw new Error("L'option --set-defaults attend deux agents: --set-defaults <agentA> <agentB>.");
        }

        flags[key] = values;
        continue;
      }

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
    applyRunPositionals(positionals, flags, presets, commandExplicit);
  }

  return { command, commandExplicit, flags };
}

function isLikelyCommandTypo(value: string, commands: Set<string>): boolean {
  const normalized = value.toLowerCase();

  for (const command of commands) {
    if (normalized[0] === command[0] && levenshteinDistance(normalized, command) <= 2) {
      return true;
    }
  }

  return false;
}

function levenshteinDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    let diagonal = previous[0];
    previous[0] = leftIndex + 1;

    for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
      const insertCost = previous[rightIndex + 1] + 1;
      const deleteCost = previous[rightIndex] + 1;
      const replaceCost = diagonal + (left[leftIndex] === right[rightIndex] ? 0 : 1);
      diagonal = previous[rightIndex + 1];
      previous[rightIndex + 1] = Math.min(insertCost, deleteCost, replaceCost);
    }
  }

  return previous[right.length] ?? 0;
}
function applyRunPositionals(
  positionals: string[],
  flags: Record<string, string | string[] | boolean>,
  presets: Set<string>,
  commandExplicit: boolean
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

  if (!commandExplicit && positionals.length === 1 && !positionals[0]?.includes(" ")) {
    throw new Error(`Commande inconnue ou sujet ambigu: ${positionals[0]}. Utilise -s "${positionals[0]}" pour un sujet en un mot, ou palabre help pour voir les commandes.`);
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
    "set-defaults",
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

function printAgents(
  configPath: string,
  config: PalabreConfig,
  discovery: Awaited<ReturnType<typeof discoverLocalTools>>
): void {
  const entries = Object.entries(config.agents).sort(([left], [right]) => left.localeCompare(right));

  console.log(`Config: ${configPath}`);
  console.log("");
  console.log("Agents déclarés:");

  for (const [name, agentConfig] of entries) {
    const status = formatAgentDetection(name, agentConfig, discovery);
    const defaults = formatAgentDefaults(name, config);
    const details = formatAgentDetails(agentConfig);
    const suffix = defaults ? ` | ${defaults}` : "";

    console.log(`- ${name.padEnd(13)} ${`${agentConfig.type}/${agentConfig.role}`.padEnd(18)} ${status}${suffix}`);
    if (details) {
      console.log(`  ${details}`);
    }
  }

  console.log("");
  console.log(`Défauts: ${config.defaults?.agentA ?? "aucun"} <-> ${config.defaults?.agentB ?? "aucun"}, réponses: ${config.defaults?.turns ?? 4}, synthèse: ${config.defaults?.summaryAgent ?? "agent B"}`);
}

function formatAgentDefaults(name: string, config: PalabreConfig): string {
  const labels: string[] = [];

  if (config.defaults?.agentA === name) labels.push("agent A par défaut");
  if (config.defaults?.agentB === name) labels.push("agent B par défaut");
  if (config.defaults?.summaryAgent === name) labels.push("synthèse par défaut");

  return labels.join(", ");
}

function formatAgentDetails(agentConfig: AgentConfig): string {
  if (agentConfig.type === "ollama") {
    return `modèle: ${agentConfig.model}`;
  }

  return `commande: ${agentConfig.command}${agentConfig.model ? ` | modèle: ${agentConfig.model}` : ""}`;
}

function formatAgentDetection(
  name: string,
  agentConfig: AgentConfig,
  discovery: Awaited<ReturnType<typeof discoverLocalTools>>
): string {
  if (agentConfig.type === "ollama") {
    if (!discovery.ollama.available) {
      return discovery.ollama.commandAvailable ? "Ollama non joignable" : "Ollama non détecté";
    }

    return discovery.ollama.models.includes(agentConfig.model)
      ? "détecté"
      : `modèle absent (${agentConfig.model})`;
  }

  const detection = cliDetectionForAgent(name, agentConfig, discovery);
  return detection.available ? `détecté (${detection.command})` : "non détecté";
}

function cliDetectionForAgent(
  name: string,
  agentConfig: AgentConfig,
  discovery: Awaited<ReturnType<typeof discoverLocalTools>>
): Awaited<ReturnType<typeof discoverLocalTools>>["codex"] {
  const command = normalizeCommandName(agentConfig.type === "cli" ? agentConfig.command : name);

  if (command === "codex") return discovery.codex;
  if (command === "claude") return discovery.claude;
  if (command === "gemini") return discovery.gemini;
  if (command === "opencode") return discovery.opencode;

  return { available: true, command: agentConfig.type === "cli" ? agentConfig.command : name };
}

function normalizeCommandName(command: string): string {
  return path.basename(command).replace(/\.(cmd|exe|ps1|bat)$/i, "").toLowerCase();
}
function printInitDiscovery(
  discovery: Awaited<ReturnType<typeof discoverLocalTools>>,
  config: Awaited<ReturnType<typeof loadConfig>>
): void {
  console.log("");
  console.log("Détection locale:");
  console.log(`- Codex CLI: ${formatCommandDetection(discovery.codex)}`);
  console.log(`- Claude CLI: ${formatCommandDetection(discovery.claude)}`);
  console.log(`- Gemini CLI: ${formatCommandDetection(discovery.gemini)}`);
  console.log(`- OpenCode CLI: ${formatCommandDetection(discovery.opencode)}`);
  console.log(`- Ollama API: ${formatOllamaDetection(discovery.ollama)}`);
  console.log("");
  console.log(`Défauts: ${config.defaults?.agentA ?? "codex"} <-> ${config.defaults?.agentB ?? "ollama-local"}`);
}

function formatCommandDetection(detection: Awaited<ReturnType<typeof discoverLocalTools>>["codex"]): string {
  return detection.available
    ? `détecté (${detection.command})`
    : "non détecté";
}

function formatOllamaDetection(detection: Awaited<ReturnType<typeof discoverLocalTools>>["ollama"]): string {
  if (!detection.available) {
    return detection.commandAvailable
      ? `serveur non joignable (${detection.baseUrl})`
      : "non détecté";
  }

  const modelCount = detection.models.length;
  return `détectée (${modelCount} modèle${modelCount > 1 ? "s" : ""})`;
}

function printHelp(): void {
  console.log(`
PALABRE

Usage rapide:
  palabre new
      Assistant interactif pour choisir les agents, le sujet et les options.
  palabre run -s "Sujet"
      Lance avec les agents par défaut de la config.
  palabre claude-gemini "Sujet" -t 4
      Lance avec un preset et un sujet positionnel.

Commandes:
  palabre init [--local]
      Crée une config et détecte Codex, Claude, Gemini, OpenCode et Ollama.
  palabre agents [--config <path>]
      Liste les agents déclarés dans la config et leur détection locale.
  palabre config
      Assistant pour définir ou supprimer les paramètres par défaut.
  palabre config --set-defaults <agentA> <agentB> [-t <n>] [--summary-agent <name>]
      Définit les agents par défaut, et optionnellement les réponses et la synthèse.
  palabre config --clear-defaults
      Supprime les paramètres par défaut.
  palabre doctor [--config <path>]
      Vérifie la config et les outils locaux.
  palabre update [--apply]
      Affiche ou exécute les étapes de mise à jour d'un checkout git.
  palabre help
      Affiche cette aide. Identique à -h ou --help.
  palabre version
      Affiche la version. Identique à -v ou --version.

Notation:
  [option] signifie facultatif. Ne tape pas les crochets.
  <valeur> signifie qu'il faut remplacer ce texte par ta valeur.

Options générales:
  -h, --help              Affiche cette aide
  -v, --version           Affiche la version
  -a                      Liste les agents. Identique à palabre agents
  --config <path>         Chemin vers un fichier de config explicite
  --plain                 Utilise le rendu console simple sans habillage TUI

Sujet et lancement:
  -s, --subject <text>    Sujet du débat, option recommandée
  --topic <text>          Alias compatible de --subject
  --agent-a <name>        Premier agent
  --agent-b <name>        Second agent
  --preset <name>         Preset de paire d'agents. Exemples: codex-claude, claude-gemini
  -t, --turns <number>    Nombre total de réponses
  --no-early-stop         Désactive l'arrêt anticipé si les agents sont clairement d'accord

Modèles:
  --model-a <model>       Modèle brut transmis à l'agent A
  --model-b <model>       Modèle brut transmis à l'agent B
  --pull-models           Autorise Ollama à télécharger un modèle manquant

Synthèse:
  --summary-agent <name>  Agent utilisé pour produire la synthèse finale
  --summary-model <model> Modèle brut transmis à l'agent de synthèse
  --no-summary            Désactive la synthèse finale

Contexte:
  --files <paths...>      Fichiers texte à injecter explicitement dans le contexte
  --context <paths...>    Scanne fichiers/dossiers texte en respectant les limites de contexte
  --show-prompt           Affiche le prompt du premier tour sans appeler d'agent

Configuration:
  --local                 Avec init/setup, crée ./palabre.config.json
  --set-defaults <a b>    Avec config, définit les agents par défaut
  --clear-defaults        Avec config, supprime les paramètres par défaut

Mise à jour:
  --apply                 Avec update, exécute les étapes de mise à jour

Presets disponibles:
  ${listPresetNames().join(", ")}
`);
}
main().catch((error: unknown) => {
  const message = error instanceof AdapterError
    ? formatAdapterError(error)
    : error instanceof Error ? error.message : String(error);
  console.error(`Erreur: ${message}`);
  process.exitCode = 1;
});
