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
import { DEFAULT_TURNS, parseTurnsFlag, turnsOrDefault } from "./limits.js";
import { formatAgentPrompt } from "./prompt.js";
import { runNewWizard } from "./new.js";
import { listPresetNames, resolvePreset } from "./presets.js";
import { createConsoleRenderer } from "./renderers/console.js";
import { createNdjsonRenderer } from "./renderers/ndjson.js";
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

/** Point d'entrée principal du CLI Palabre. Dispatche vers la commande appropriée selon les arguments. */
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
    const result = await runDoctor(optionalString(parsed.flags.config), Boolean(parsed.flags.plain));
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

  if (parsed.command === "presets" || parsed.command === "preset") {
    runPresetsCommand(parsed.flags);
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
    turns: parseTurnsFlag(parsed.flags.turns, config.defaults?.turns ?? DEFAULT_TURNS, "--turns"),
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

  const renderer = createRendererFromFlags(parsed.flags, options.plainOutput);
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

/**
 * Exécute la commande `agents` : charge la config et affiche les agents déclarés avec leur état de détection.
 * @param flags - Flags parsés depuis la ligne de commande.
 */
async function runAgentsCommand(flags: Record<string, string | string[] | boolean>): Promise<void> {
  const configPath = optionalString(flags.config) ?? await resolveDefaultConfigPath();

  if (!(await configExists(configPath))) {
    throw new Error("Aucune config trouvée. Lance `palabre init`, puis `palabre agents`.");
  }

  const config = await loadConfig(configPath);
  const discovery = await discoverLocalTools();
  printAgents(configPath, config, discovery);
}
/**
 * Exécute la commande `config` : wizard interactif ou mise à jour directe des paramètres par défaut.
 * @param flags - Flags parsés depuis la ligne de commande.
 */
async function runConfigCommand(flags: Record<string, string | string[] | boolean>): Promise<void> {
  const configPath = optionalString(flags.config) ?? await resolveDefaultConfigPath();

  if (!(await configExists(configPath))) {
    await writeExampleConfig(configPath);
    console.log(`${configPath} créé. Édite la config puis relance palabre config.`);
    return;
  }

  const config = await loadConfig(configPath);
  if (flags["sync-agents"]) {
    const discovery = await discoverLocalTools();
    const addedAgents = syncDetectedAgents(config, discovery);

    if (addedAgents.length === 0) {
      console.log(`Aucun agent détecté manquant dans ${configPath}.`);
      return;
    }

    await writeExampleConfig(configPath, config);
    console.log(`Agents ajoutés dans ${configPath}: ${addedAgents.join(", ")}.`);
    return;
  }

  const defaultAgents = getStringListFlag(flags["set-defaults"]);
  const hasTurnsFlag = flags.turns !== undefined;
  const summaryAgentValue = optionalString(flags["summary-agent"]);

  if (defaultAgents.length > 0 || hasTurnsFlag || summaryAgentValue !== undefined) {
    const nextDefaults = { ...(config.defaults ?? {}) };

    if (defaultAgents.length > 0) {
      const [agentA, agentB] = defaultAgents;

      if (!agentA || !agentB) {
        throw new Error("L'option --set-defaults attend deux agents: --set-defaults <agentA> <agentB>.");
      }

      assertKnownAgent(config, agentA, "defaults.agentA");
      assertKnownAgent(config, agentB, "defaults.agentB");

      nextDefaults.agentA = agentA;
      nextDefaults.agentB = agentB;
    }

    if (hasTurnsFlag) {
      nextDefaults.turns = parseTurnsFlag(flags.turns, nextDefaults.turns ?? DEFAULT_TURNS, "--turns");
    }

    if (summaryAgentValue !== undefined) {
      if (isNoneValue(summaryAgentValue)) {
        delete nextDefaults.summaryAgent;
      } else {
        assertKnownAgent(config, summaryAgentValue, "defaults.summaryAgent");
        nextDefaults.summaryAgent = summaryAgentValue;
      }
    }

    config.defaults = nextDefaults;

    await writeExampleConfig(configPath, config);
    console.log(`Paramètres par défaut mis à jour dans ${configPath}: ${formatDefaultsForMessage(config.defaults)}.`);
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
/**
 * Renvoie `true` si la valeur représente une désactivation explicite (ex. "none", "0", "disabled").
 * @param value - Chaîne saisie par l'utilisateur.
 */
function isNoneValue(value: string): boolean {
  return ["0", "none", "aucun", "disabled", "désactivé", "desactive"].includes(value.trim().toLowerCase());
}

/**
 * Formate les paramètres par défaut en une ligne lisible pour les messages console.
 * @param defaults - Objet `defaults` de la config Palabre.
 * @returns Chaîne résumant la paire d'agents, le nombre de réponses et l'agent de synthèse.
 */
function formatDefaultsForMessage(defaults: NonNullable<PalabreConfig["defaults"]>): string {
  const pair = defaults.agentA && defaults.agentB
    ? `agents: ${defaults.agentA} <-> ${defaults.agentB}`
    : "agents: non définis";
  const summary = defaults.summaryAgent ? `synthèse: ${defaults.summaryAgent}` : "synthèse: agent B";

  return `${pair}, réponses: ${turnsOrDefault(defaults.turns)}, ${summary}`;
}
/**
 * Lève une erreur si `agentName` n'est pas déclaré dans la config.
 * @param config - Config chargée.
 * @param agentName - Nom de l'agent à vérifier.
 * @param fieldName - Nom du champ (utilisé dans le message d'erreur).
 */
function assertKnownAgent(config: Awaited<ReturnType<typeof loadConfig>>, agentName: string, fieldName: string): void {
  if (!config.agents[agentName]) {
    throw new Error(`Agent inconnu pour ${fieldName}: ${agentName}. Agents disponibles: ${Object.keys(config.agents).join(", ")}.`);
  }
}
/**
 * Résout le nom d'un agent selon la priorité : flag CLI > preset > défaut config.
 * Lève une erreur si aucune source ne fournit de valeur.
 * @param label - Libellé humain utilisé dans le message d'erreur (ex. "agent A").
 * @param explicitValue - Valeur passée via flag CLI.
 * @param presetValue - Valeur issue du preset sélectionné.
 * @param defaultValue - Valeur issue des défauts de la config.
 * @returns Nom de l'agent résolu.
 */
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
/**
 * Affiche un aperçu du prompt du premier tour sans appeler aucun agent (flag `--show-prompt`).
 * @param config - Config chargée.
 * @param options - Options du débat résolues.
 */
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
  console.log(`Pull missing Ollama models: ${options.pullModels ? "yes" : "no"}`);
  console.log(`Summary: ${options.summaryEnabled ? options.summaryAgent ?? options.agentB : "disabled"}`);
  console.log("");
  console.log(prompt);
  console.log("");
  console.log("Note: seuls les prompts du premier tour sont exacts sans exécuter les agents. Les tours suivants incluent le transcript réel.");
}

/**
 * Extrait une chaîne non vide depuis une valeur de flag, ou renvoie `undefined`.
 * @param value - Valeur brute issue du parseur de flags.
 */
function optionalString(value: string | string[] | boolean | undefined): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

/** Liste des kinds de renderer acceptés par `--renderer`. */
const SUPPORTED_RENDERERS = ["auto", "pretty", "plain", "ndjson"] as const;
type RendererKind = (typeof SUPPORTED_RENDERERS)[number];

/**
 * Instancie le renderer en fonction des flags CLI.
 *
 * Précédence :
 *  1. `--renderer <kind>` (canonique).
 *  2. `--json` (alias pour `--renderer ndjson`).
 *  3. `--plain` (rétro-compatible, équivalent `--renderer plain`).
 *  4. par défaut : `auto` (pretty si TTY, plain sinon, hérité de `createConsoleRenderer`).
 *
 * Lève si la valeur de `--renderer` n'est pas dans `SUPPORTED_RENDERERS`.
 */
function createRendererFromFlags(
  flags: Record<string, string | string[] | boolean>,
  plainOutputFallback: boolean,
) {
  const explicit = optionalString(flags.renderer);
  if (explicit) {
    if (!(SUPPORTED_RENDERERS as readonly string[]).includes(explicit)) {
      throw new Error(
        `Renderer inconnu: ${explicit}. Valeurs supportées: ${SUPPORTED_RENDERERS.join(", ")}.`,
      );
    }
    const kind = explicit as RendererKind;
    switch (kind) {
      case "ndjson":
        return createNdjsonRenderer();
      case "plain":
        return createConsoleRenderer(true);
      case "pretty":
        return createConsoleRenderer(false);
      case "auto":
        return createConsoleRenderer(plainOutputFallback);
    }
  }
  if (flags.json) {
    return createNdjsonRenderer();
  }
  return createConsoleRenderer(plainOutputFallback);
}

/**
 * Exécute la commande `palabre presets`.
 *
 * Sortie humaine par défaut (liste alignée), ou JSON avec `--json` pour les
 * intégrations (extension VS Code, scripts shell). Le schéma JSON est versionné
 * via le champ `v` au cas où on enrichirait plus tard (ex : description par
 * preset, tags premium/local).
 *
 * @param flags - Flags parsés depuis la ligne de commande.
 */
function runPresetsCommand(flags: Record<string, string | string[] | boolean>): void {
  const presets = listPresetNames().map((name) => {
    const pair = resolvePreset(name);
    return { name, agentA: pair.agentA, agentB: pair.agentB };
  });

  if (flags.json) {
    process.stdout.write(JSON.stringify({ v: 1, presets }) + "\n");
    return;
  }

  console.log("Presets disponibles:");
  console.log("");
  for (const preset of presets) {
    console.log(`  ${preset.name.padEnd(20)} ${preset.agentA} <-> ${preset.agentB}`);
  }
  console.log("");
  console.log(`Total : ${presets.length} preset(s). Utilise --json pour une sortie machine-readable.`);
}

/**
 * Parse `process.argv` en une structure typée `ParsedArgs`.
 * Gère les flags courts (-h, -v, -s, -t, -a), les flags longs (--topic, --agent-a…),
 * les flags multi-valeurs (--files, --context, --set-defaults) et les positionnels.
 * @param args - Tableau d'arguments (généralement `process.argv.slice(2)`).
 * @returns Commande détectée, indicateur d'explicitation et map de flags.
 */
function parseArgs(args: string[]): ParsedArgs {
  const flags: Record<string, string | string[] | boolean> = {};
  let command = "run";
  let commandExplicit = false;
  const positionals: string[] = [];
  const commands = new Set(["run", "new", "init", "setup", "help", "version", "update", "doctor", "config", "agent", "agents", "preset", "presets"]);
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

/**
 * Détecte si une valeur ressemble à une faute de frappe d'une commande connue
 * (même première lettre et distance de Levenshtein ≤ 2).
 * @param value - Token saisi par l'utilisateur.
 * @param commands - Ensemble des commandes valides.
 */
function isLikelyCommandTypo(value: string, commands: Set<string>): boolean {
  const normalized = value.toLowerCase();

  for (const command of commands) {
    if (normalized[0] === command[0] && levenshteinDistance(normalized, command) <= 2) {
      return true;
    }
  }

  return false;
}

/**
 * Calcule la distance de Levenshtein entre deux chaînes (insertions, suppressions, substitutions).
 * @param left - Première chaîne.
 * @param right - Deuxième chaîne.
 * @returns Distance entière ≥ 0.
 */
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
/**
 * Interprète les arguments positionnels pour la commande `run` :
 * premier positionnel = preset si connu, sinon sujet complet concaténé.
 * @param positionals - Arguments positionnels extraits du parseur.
 * @param flags - Map de flags à muter si un preset ou un sujet est détecté.
 * @param presets - Ensemble des noms de presets valides.
 * @param commandExplicit - `true` si l'utilisateur a tapé `palabre run` explicitement.
 */
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

/**
 * Normalise un nom de flag long en son alias canonique (ex. `subject` → `topic`).
 * @param value - Nom brut extrait après `--`.
 */
function normalizeFlagName(value: string): string {
  const aliases: Record<string, string> = {
    s: "topic",
    subject: "topic",
    t: "turns"
  };

  return aliases[value] ?? value;
}

/**
 * Indique si un flag long nécessite une valeur suivante (lève une erreur si absente).
 * @param value - Nom canonique du flag (sans `--`).
 */
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

/** Lit la version depuis `package.json` adjacent au bundle compilé. */
async function getPackageVersion(): Promise<string> {
  const packageJsonPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "package.json");
  const raw = await readFile(packageJsonPath, "utf8");
  const packageJson = JSON.parse(raw) as { version?: string };

  return packageJson.version ?? "0.0.0";
}

/**
 * Normalise une valeur de flag multi-valeur en tableau de chaînes.
 * @param value - Valeur brute (tableau, chaîne unique ou absent).
 * @returns Tableau de chaînes, vide si la valeur n'est pas applicable.
 */
function getStringListFlag(value: string | string[] | boolean | undefined): string[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string") {
    return [value];
  }

  return [];
}

/**
 * Écrit les avertissements de contexte sur `stderr`.
 * @param warnings - Messages d'avertissement issus du chargement des fichiers de contexte.
 */
function printContextWarnings(warnings: string[]): void {
  for (const warning of warnings) {
    process.stderr.write(`Warning: ${warning}\n`);
  }
}

/**
 * Ajoute dans `config.agents` les agents détectés localement mais absents de la config.
 * Mute `config` directement ; l'appelant est responsable de persister la config.
 * @param config - Config Palabre à compléter.
 * @param discovery - Résultat de la découverte locale des outils.
 * @returns Noms des agents nouvellement ajoutés.
 */
function syncDetectedAgents(
  config: PalabreConfig,
  discovery: Awaited<ReturnType<typeof discoverLocalTools>>
): string[] {
  const discoveredConfig = createConfigFromDiscovery(discovery);
  const missingAgents = findDetectedMissingAgents(config, discovery);

  for (const agentName of missingAgents) {
    config.agents[agentName] = discoveredConfig.agents[agentName];
  }

  return missingAgents;
}

/**
 * Renvoie les noms des agents détectés localement qui ne sont pas encore dans `config.agents`.
 * @param config - Config Palabre existante.
 * @param discovery - Résultat de la découverte locale des outils.
 */
function findDetectedMissingAgents(
  config: PalabreConfig,
  discovery: Awaited<ReturnType<typeof discoverLocalTools>>
): string[] {
  const detectedAgents = [
    discovery.codex.available ? "codex" : undefined,
    discovery.claude.available ? "claude" : undefined,
    discovery.gemini.available ? "gemini" : undefined,
    discovery.opencode.available ? "opencode" : undefined,
    discovery.ollama.available ? "ollama-local" : undefined
  ].filter((agent): agent is string => Boolean(agent));

  return detectedAgents.filter((agentName) => !config.agents[agentName]);
}
/**
 * Affiche la liste des agents déclarés avec leur type, rôle, état de détection et défauts.
 * @param configPath - Chemin du fichier de config (affiché en en-tête).
 * @param config - Config Palabre chargée.
 * @param discovery - Résultat de la découverte locale des outils.
 */
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
  console.log(`Défauts: ${config.defaults?.agentA ?? "aucun"} <-> ${config.defaults?.agentB ?? "aucun"}, réponses: ${turnsOrDefault(config.defaults?.turns)}, synthèse: ${config.defaults?.summaryAgent ?? "agent B"}`);
}

/**
 * Renvoie un libellé indiquant si l'agent est agent A, agent B ou agent de synthèse par défaut.
 * @param name - Nom de l'agent.
 * @param config - Config Palabre contenant les défauts.
 */
function formatAgentDefaults(name: string, config: PalabreConfig): string {
  const labels: string[] = [];

  if (config.defaults?.agentA === name) labels.push("agent A par défaut");
  if (config.defaults?.agentB === name) labels.push("agent B par défaut");
  if (config.defaults?.summaryAgent === name) labels.push("synthèse par défaut");

  return labels.join(", ");
}

/**
 * Renvoie une ligne de détails pour un agent : commande CLI ou modèle Ollama.
 * @param agentConfig - Configuration de l'agent.
 */
function formatAgentDetails(agentConfig: AgentConfig): string {
  if (agentConfig.type === "ollama") {
    return `modèle: ${agentConfig.model}`;
  }

  return `commande: ${agentConfig.command}${agentConfig.model ? ` | modèle: ${agentConfig.model}` : ""}`;
}

/**
 * Renvoie le statut de détection d'un agent sous forme de chaîne lisible.
 * Pour Ollama, vérifie la disponibilité du serveur et la présence du modèle.
 * @param name - Nom de l'agent dans la config.
 * @param agentConfig - Configuration de l'agent.
 * @param discovery - Résultat de la découverte locale des outils.
 */
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

/**
 * Résout l'entrée de détection correspondant à un agent CLI dans le résultat de découverte.
 * Renvoie un objet `{ available: true }` pour les agents CLI non reconnus (considérés disponibles).
 * @param name - Nom de l'agent dans la config.
 * @param agentConfig - Configuration de l'agent.
 * @param discovery - Résultat de la découverte locale des outils.
 */
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

/**
 * Extrait le nom de base d'une commande en supprimant le chemin et l'extension Windows éventuelle.
 * @param command - Chemin ou nom de commande brut (ex. `C:\bin\claude.cmd`).
 */
function normalizeCommandName(command: string): string {
  return path.basename(command).replace(/\.(cmd|exe|ps1|bat)$/i, "").toLowerCase();
}
/**
 * Affiche le récapitulatif de détection locale après `palabre init`.
 * @param discovery - Résultat de la découverte locale des outils.
 * @param config - Config générée à partir de la découverte.
 */
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

/**
 * Formate le statut de détection d'un outil CLI (disponible ou non).
 * @param detection - Résultat de détection d'un outil CLI.
 */
function formatCommandDetection(detection: Awaited<ReturnType<typeof discoverLocalTools>>["codex"]): string {
  return detection.available
    ? `détecté (${detection.command})`
    : "non détecté";
}

/**
 * Formate le statut de détection d'Ollama : commande absente, serveur injoignable ou modèles disponibles.
 * @param detection - Résultat de détection d'Ollama.
 */
function formatOllamaDetection(detection: Awaited<ReturnType<typeof discoverLocalTools>>["ollama"]): string {
  if (!detection.available) {
    return detection.commandAvailable
      ? `serveur non joignable (${detection.baseUrl})`
      : "non détecté";
  }

  const modelCount = detection.models.length;
  return `détectée (${modelCount} modèle${modelCount > 1 ? "s" : ""})`;
}

/** Affiche le texte d'aide complet sur `stdout`. */
function printHelp(): void {
  console.log(`
PALABRE
_____________________________________________

Usage rapide:

  palabre init 
      Crée une config globale et détecte les agents AI disponibles sur la machine.

  palabre agents
      Affiche les agents déclarés dans la config.

  palabre config
      Assistant pour définir ou supprimer les paramètres par défaut.

  palabre new
      Assistant interactif pour choisir les agents, le sujet et les options.

  palabre claude-gemini "Sujet" -t 4
      Lance avec un preset et un sujet positionnel.

  palabre "Sujet"
      Lance le débat avec paramètres par défaut de la config.

_____________________________________________


Commandes:

  palabre init [--local]
      Crée une config locale et détecte Codex, Claude, Gemini, OpenCode et Ollama.

  palabre agents [--config <path>]
      Liste les agents déclarés dans la config et leur détection locale.

  palabre presets [--json]
      Liste les presets de paires d'agents. \`--json\` émet la liste structurée
      pour les intégrations (extension VS Code, scripts).

  palabre config
      Assistant pour définir ou supprimer les paramètres par défaut.

  palabre config --set-defaults <agentA> <agentB> [-t <n>] [--summary-agent <name>]
      Définit les agents par défaut, et optionnellement les réponses et la synthèse.

  palabre config -t <n>
      Définit seulement le nombre de réponses par défaut.

  palabre config --summary-agent <name|none>
      Définit ou retire seulement l'agent de synthèse par défaut.

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

_____________________________________________


Notation:

  [option] signifie facultatif. Ne tape pas les crochets.
  <valeur> signifie qu'il faut remplacer ce texte par ta valeur.

Options générales:

  -h, --help              Affiche cette aide
  -v, --version           Affiche la version
  -a, --agents            Liste les agents. Identique à palabre agents
  --config <path>         Chemin vers un fichier de config explicite
  --plain                 Utilise le rendu console simple sans habillage TUI
  --json                  Émet un événement NDJSON par ligne sur stdout (alias de --renderer ndjson)
  --renderer <kind>       Force le renderer : auto | pretty | plain | ndjson

Sujet et lancement:

  -s, --subject <text>    Sujet du débat, option recommandée
  --topic <text>          Alias compatible de --subject
  --agent-a <name>        Premier agent
  --agent-b <name>        Second agent
  --preset <name>         Preset de paire d'agents. Exemples: codex-claude, claude-gemini
  -t, --turns <number>    Nombre total de réponses (1 à 20)
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
  --summary-agent <name>  Avec config, définit l'agent de synthèse par défaut
  --summary-agent none    Avec config, retire l'agent de synthèse par défaut
  --clear-defaults        Avec config, supprime les paramètres par défaut
  --sync-agents           Avec config, ajoute les agents détectés manquants

Mise à jour:

  --apply                 Avec update, exécute les étapes de mise à jour

_____________________________________________


Presets disponibles:

  ${listPresetNames().join(", ")}

_____________________________________________

`);
}
main().catch((error: unknown) => {
  const message = error instanceof AdapterError
    ? formatAdapterError(error)
    : error instanceof Error ? error.message : String(error);
  console.error(`Erreur: ${message}`);
  process.exitCode = 1;
});
