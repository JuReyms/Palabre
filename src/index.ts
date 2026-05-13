#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { configExists, createConfigFromDiscovery, DEFAULT_CONFIG_PATH, GLOBAL_CONFIG_PATH, loadConfig, resolveDefaultConfigPath, resolveOutputDir, writeExampleConfig } from "./config.js";
import { loadProjectInputs } from "./context.js";
import { discoverLocalTools } from "./discovery.js";
import { runDoctor } from "./doctor.js";
import { AdapterError, formatAdapterError } from "./errors.js";
import { runConfigWizard } from "./configWizard.js";
import { createTranslator, DEFAULT_LANGUAGE, parseLanguage, resolveLanguage } from "./i18n.js";
import { DEFAULT_TURNS, parseTurnsFlag, turnsOrDefault } from "./limits.js";
import { formatAgentPrompt } from "./prompt.js";
import { runNewWizard } from "./new.js";
import { listPresetNames, listPresetsWithAvailability, resolvePreset } from "./presets.js";
import { createConsoleRenderer } from "./renderers/console.js";
import { createNdjsonRenderer } from "./renderers/ndjson.js";
import { runDebate } from "./orchestrator.js";
import { writeDebateMarkdown } from "./output.js";
import { applySourceUpdate, formatUpdateInstructions, getUpdateInfo } from "./update.js";
import { createSessionContext } from "./session.js";
import type { AgentConfig, DebateOptions, PalabreConfig } from "./types.js";
import type { Messages } from "./messages/index.js";

interface ParsedArgs {
  command: string;
  commandExplicit: boolean;
  flags: Record<string, string | string[] | boolean>;
}

/** Point d'entrée principal du CLI Palabre. Dispatche vers la commande appropriée selon les arguments. */
async function main(): Promise<void> {
  const rawArgs = process.argv.slice(2);
  const startupLanguage = resolveLanguage({ explicitLanguage: findRawLanguageFlag(rawArgs) });
  const startupMessages = createTranslator(startupLanguage);
  const parsed = parseArgs(rawArgs, startupMessages);

  if (parsed.command === "version" || parsed.flags.version) {
    console.log(await getPackageVersion());
    return;
  }

  if (parsed.command === "help" || parsed.flags.help) {
    printHelp(startupMessages);
    return;
  }

  if (parsed.command === "doctor") {
    const result = await runDoctor(optionalString(parsed.flags.config), Boolean(parsed.flags.plain), optionalString(parsed.flags.language));
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
    await runPresetsCommand(parsed.flags);
    return;
  }

  if (parsed.command === "update") {
    const info = await getUpdateInfo(await getPackageVersion());
    const updateConfigPath = optionalString(parsed.flags.config) ?? await resolveDefaultConfigPath();
    const updateConfig = await configExists(updateConfigPath)
      ? await loadConfig(updateConfigPath)
      : undefined;
    const updateLanguage = resolveLanguage({
      explicitLanguage: optionalString(parsed.flags.language),
      configLanguage: updateConfig?.language
    });
    const updateMessages = createTranslator(updateLanguage);

    if (parsed.flags.apply) {
      await applySourceUpdate(info, updateMessages);
      console.log(updateMessages.update.upToDate);
      return;
    }

    console.log(formatUpdateInstructions(info, updateMessages));
    return;
  }

  if (parsed.command === "init" || parsed.command === "setup") {
    const initConfigPath = optionalString(parsed.flags.config) ?? (parsed.flags.local ? DEFAULT_CONFIG_PATH : GLOBAL_CONFIG_PATH);

    if (await configExists(initConfigPath)) {
      console.log(startupMessages.init.configExists(initConfigPath));
      return;
    }

    const discovery = await discoverLocalTools();
    const config = createConfigFromDiscovery(discovery);
    config.language = resolveLanguage({
      explicitLanguage: optionalString(parsed.flags.language),
      configLanguage: config.language
    });
    const initMessages = createTranslator(config.language);
    await writeExampleConfig(initConfigPath, config);
    console.log(initMessages.init.configCreated(initConfigPath));
    printInitDiscovery(discovery, config, initMessages);
    return;
  }

  const configPath = optionalString(parsed.flags.config) ?? await resolveDefaultConfigPath();

  if (!(await configExists(configPath))) {
    const config = createConfigFromDiscovery(await discoverLocalTools());
    config.language = resolveLanguage({
      explicitLanguage: optionalString(parsed.flags.language),
      configLanguage: config.language
    });
    const messages = createTranslator(config.language);
    await writeExampleConfig(configPath, config);
    console.log(messages.init.editConfigThenRerun(configPath));
    return;
  }

  const config = await loadConfig(configPath);
  const language = resolveLanguage({
    explicitLanguage: optionalString(parsed.flags.language),
    configLanguage: config.language
  });
  const messages = createTranslator(language);

  if (parsed.command === "new") {
    const selection = await runNewWizard(config, messages);

    if (!selection) {
      console.log(messages.new.cancelled);
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
    getStringListFlag(parsed.flags.context),
    process.cwd(),
    messages
  );
  const presetName = optionalString(parsed.flags.preset);
  const preset = presetName ? resolvePreset(presetName, messages) : undefined;

  if (!topic) {
    throw new Error(messages.common.topicRequired);
  }

  const options: DebateOptions = {
    language,
    topic,
    agentA: resolveAgentName("agent A", parsed.flags["agent-a"], preset?.agentA, config.defaults?.agentA, messages),
    agentB: resolveAgentName("agent B", parsed.flags["agent-b"], preset?.agentB, config.defaults?.agentB, messages),
    turns: parseTurnsFlag(parsed.flags.turns, config.defaults?.turns ?? DEFAULT_TURNS, "--turns", messages),
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
    printContextWarnings(context.warnings, messages);
    printPromptPreview(config, options, language, messages);
    return;
  }

  const renderer = createRendererFromFlags(parsed.flags, options.plainOutput, messages);
  context.warnings.forEach((warning) => renderer.warning(warning));
  const result = await runDebate(config, options, renderer, messages);
  const outputPath = await writeDebateMarkdown(
    resolveOutputDir(config.outputDir),
    result.options,
    result.messages,
    result.summary,
    result.stopReason,
    messages
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
    const messages = createTranslator(resolveLanguage({ explicitLanguage: optionalString(flags.language) }));
    throw new Error(messages.agents.noConfig);
  }

  const config = await loadConfig(configPath);
  const language = resolveLanguage({
    explicitLanguage: optionalString(flags.language),
    configLanguage: config.language
  });
  const messages = createTranslator(language);
  const discovery = await discoverLocalTools();
  printAgents(configPath, config, discovery, messages);
}
/**
 * Exécute la commande `config` : wizard interactif ou mise à jour directe des paramètres par défaut.
 * @param flags - Flags parsés depuis la ligne de commande.
 */
async function runConfigCommand(flags: Record<string, string | string[] | boolean>): Promise<void> {
  const configPath = optionalString(flags.config) ?? await resolveDefaultConfigPath();
  const explicitLanguage = optionalString(flags.language);

  if (!(await configExists(configPath))) {
    const messages = createTranslator(resolveLanguage({ explicitLanguage }));
    await writeExampleConfig(configPath);
    console.log(messages.config.createdForConfig(configPath));
    return;
  }

  const config = await loadConfig(configPath);
  const language = resolveLanguage({
    explicitLanguage,
    configLanguage: config.language
  });
  const messages = createTranslator(language);

  if (flags["sync-agents"]) {
    const discovery = await discoverLocalTools();
    const addedAgents = syncDetectedAgents(config, discovery);

    if (addedAgents.length === 0) {
      console.log(messages.config.syncNoMissing(configPath));
      return;
    }

    await writeExampleConfig(configPath, config);
    console.log(messages.config.syncAdded(configPath, addedAgents.join(", ")));
    return;
  }

  const defaultAgents = getStringListFlag(flags["set-defaults"]);
  const hasTurnsFlag = flags.turns !== undefined;
  const summaryAgentValue = optionalString(flags["summary-agent"]);
  const languageValue = explicitLanguage;
  const changesDefaults = defaultAgents.length > 0 || hasTurnsFlag || summaryAgentValue !== undefined;

  if (changesDefaults || languageValue !== undefined) {
    const nextDefaults = { ...(config.defaults ?? {}) };

    if (defaultAgents.length > 0) {
      const [agentA, agentB] = defaultAgents;

      if (!agentA || !agentB) {
        throw new Error(messages.common.setDefaultsRequiresTwo);
      }

      assertKnownAgent(config, agentA, "defaults.agentA", messages);
      assertKnownAgent(config, agentB, "defaults.agentB", messages);

      nextDefaults.agentA = agentA;
      nextDefaults.agentB = agentB;
    }

    if (hasTurnsFlag) {
      nextDefaults.turns = parseTurnsFlag(flags.turns, nextDefaults.turns ?? DEFAULT_TURNS, "--turns", messages);
    }

    if (summaryAgentValue !== undefined) {
      if (isNoneValue(summaryAgentValue)) {
        delete nextDefaults.summaryAgent;
      } else {
        assertKnownAgent(config, summaryAgentValue, "defaults.summaryAgent", messages);
        nextDefaults.summaryAgent = summaryAgentValue;
      }
    }

    if (languageValue !== undefined) {
      config.language = parseLanguage(languageValue, "--language");
    }

    if (changesDefaults) {
      config.defaults = nextDefaults;
    }

    await writeExampleConfig(configPath, config);
    console.log(messages.config.updated(configPath, formatDefaultsForMessage(config.defaults ?? {}, messages), config.language ?? DEFAULT_LANGUAGE));
    return;
  }

  if (flags["clear-defaults"]) {
    delete config.defaults;
    await writeExampleConfig(configPath, config);
    console.log(messages.config.cleared(configPath));
    return;
  }

  await runConfigWizard(configPath, config, messages);
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
function formatDefaultsForMessage(defaults: NonNullable<PalabreConfig["defaults"]>, messages: Messages): string {
  return messages.config.defaultsSummary(
    defaults.agentA,
    defaults.agentB,
    turnsOrDefault(defaults.turns),
    defaults.summaryAgent
  );
}
/**
 * Lève une erreur si `agentName` n'est pas déclaré dans la config.
 * @param config - Config chargée.
 * @param agentName - Nom de l'agent à vérifier.
 * @param fieldName - Nom du champ (utilisé dans le message d'erreur).
 */
function assertKnownAgent(config: Awaited<ReturnType<typeof loadConfig>>, agentName: string, fieldName: string, messages: Messages): void {
  if (!config.agents[agentName]) {
    throw new Error(messages.common.unknownAgentForField(fieldName, agentName, Object.keys(config.agents).join(", ")));
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
  defaultValue: string | undefined,
  messages: Messages
): string {
  const resolved = optionalString(explicitValue) ?? presetValue ?? defaultValue;

  if (!resolved) {
    throw new Error(messages.common.noAgentDefined(label));
  }

  return resolved;
}
/**
 * Affiche un aperçu du prompt du premier tour sans appeler aucun agent (flag `--show-prompt`).
 * @param config - Config chargée.
 * @param options - Options du débat résolues.
 */
function printPromptPreview(config: Awaited<ReturnType<typeof loadConfig>>, options: DebateOptions, language: string, messages: Messages): void {
  const agentConfig = config.agents[options.agentA];

  if (!agentConfig) {
    throw new Error(messages.common.unknownAgent(options.agentA));
  }

  const prompt = formatAgentPrompt({
    topic: options.topic,
    turn: 1,
    selfName: options.agentA,
    peerName: options.agentB,
    selfRole: agentConfig.role,
    language: options.language,
    session: options.session,
    files: options.files,
    transcript: []
  });

  console.log(messages.preview.title);
  console.log(messages.preview.agent(options.agentA, agentConfig.role));
  console.log(messages.preview.peer(options.agentB));
  console.log(messages.preview.pullModels(options.pullModels));
  console.log(messages.preview.summary(options.summaryEnabled ? options.summaryAgent ?? options.agentB : messages.preview.disabled));
  console.log(messages.preview.interfaceLanguage(language));
  console.log("");
  console.log(prompt);
  console.log("");
  console.log(messages.preview.note);
}

/**
 * Extrait une chaîne non vide depuis une valeur de flag, ou renvoie `undefined`.
 * @param value - Valeur brute issue du parseur de flags.
 */
function optionalString(value: string | string[] | boolean | undefined): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

/**
 * Pré-lit seulement `--language`/`--lang` dans les arguments bruts pour localiser
 * les erreurs qui peuvent survenir avant le parsing complet ou le chargement de config.
 */
function findRawLanguageFlag(args: string[]): string | undefined {
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === "--language" || value === "--lang") {
      const next = args[index + 1];
      return next && !next.startsWith("-") ? next : undefined;
    }
  }

  return undefined;
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
  messages: Messages,
) {
  const explicit = optionalString(flags.renderer);
  if (explicit) {
    if (!(SUPPORTED_RENDERERS as readonly string[]).includes(explicit)) {
      throw new Error(messages.common.unknownRenderer(explicit, SUPPORTED_RENDERERS.join(", ")));
    }
    const kind = explicit as RendererKind;
    switch (kind) {
      case "ndjson":
        return createNdjsonRenderer();
      case "plain":
        return createConsoleRenderer(true, messages);
      case "pretty":
        return createConsoleRenderer(false, messages);
      case "auto":
        return createConsoleRenderer(plainOutputFallback, messages);
    }
  }
  if (flags.json) {
    return createNdjsonRenderer();
  }
  return createConsoleRenderer(plainOutputFallback, messages);
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
async function runPresetsCommand(flags: Record<string, string | string[] | boolean>): Promise<void> {
  const discovery = await discoverLocalTools();
  const configPath = optionalString(flags.config) ?? await resolveDefaultConfigPath();
  const config = await configExists(configPath)
    ? await loadConfig(configPath)
    : createConfigFromDiscovery(discovery);
  const language = resolveLanguage({
    explicitLanguage: optionalString(flags.language),
    configLanguage: config.language
  });
  const messages = createTranslator(language);
  const presets = listPresetsWithAvailability(config, discovery, messages);

  if (flags.json) {
    process.stdout.write(JSON.stringify({ v: 1, presets }) + "\n");
    return;
  }

  console.log(messages.presets.title);
  console.log("");
  for (const preset of presets) {
    const status = preset.available
      ? messages.presets.available
      : messages.presets.unavailable(preset.unavailableReasons.join("; "));
    console.log(`  ${preset.name.padEnd(20)} ${preset.agentA} <-> ${preset.agentB}  ${status}`);
  }
  console.log("");
  console.log(messages.presets.total(presets.length));
}

/**
 * Parse `process.argv` en une structure typée `ParsedArgs`.
 * Gère les flags courts (-h, -v, -s, -t, -a), les flags longs (--topic, --agent-a…),
 * les flags multi-valeurs (--files, --context, --set-defaults) et les positionnels.
 * @param args - Tableau d'arguments (généralement `process.argv.slice(2)`).
 * @returns Commande détectée, indicateur d'explicitation et map de flags.
 */
function parseArgs(args: string[], messages: Messages): ParsedArgs {
  const flags: Record<string, string | string[] | boolean> = {};
  let command = "run";
  let commandExplicit = false;
  const positionals: string[] = [];
  const commands = new Set(["run", "new", "init", "setup", "help", "version", "update", "doctor", "config", "agent", "agents", "preset", "presets"]);
  const presets = new Set(listPresetNames());

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];

    if (!value.startsWith("-") && !commandExplicit && positionals.length === 0 && commands.has(value)) {
      command = value;
      commandExplicit = true;
      continue;
    }

    if (!value.startsWith("-") && index === 0) {
      if (commands.has(value)) {
        command = value;
        commandExplicit = true;
      } else if (isLikelyCommandTypo(value, commands)) {
        throw new Error(messages.common.unknownCommand(value, Array.from(commands).join(", ")));
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
        throw new Error(messages.common.optionRequiresValue("-s"));
      }

      flags.topic = next;
      index += 1;
      continue;
    }

    if (value === "-t") {
      const next = args[index + 1];

      if (!next || next.startsWith("-")) {
        throw new Error(messages.common.optionRequiresValue("-t"));
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
          throw new Error(messages.common.setDefaultsRequiresTwo);
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
          throw new Error(messages.common.optionRequiresValue(`--${rawKey}`));
        }

        flags[key] = true;
      } else {
        flags[key] = next;
        index += 1;
      }
    }
  }

  if (command === "run") {
    applyRunPositionals(positionals, flags, presets, commandExplicit, commands, messages);
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
  commandExplicit: boolean,
  commands: Set<string>,
  messages: Messages
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
    if (isLikelyCommandTypo(positionals[0], commands)) {
      throw new Error(messages.common.unknownCommand(positionals[0], Array.from(commands).join(", ")));
    }
    throw new Error(messages.common.ambiguousSubject(positionals[0]));
  }

  flags.topic ??= positionals.join(" ");
}

/**
 * Normalise un nom de flag long en son alias canonique (ex. `subject` → `topic`).
 * @param value - Nom brut extrait après `--`.
 */
function normalizeFlagName(value: string): string {
  const aliases: Record<string, string> = {
    lang: "language",
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
    "language",
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
function printContextWarnings(warnings: string[], messages: Messages): void {
  for (const warning of warnings) {
    process.stderr.write(`${messages.renderers.warningPrefix} ${warning}\n`);
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
  discovery: Awaited<ReturnType<typeof discoverLocalTools>>,
  messages: Messages
): void {
  const entries = Object.entries(config.agents).sort(([left], [right]) => left.localeCompare(right));

  console.log(messages.agents.config(configPath));
  console.log("");
  console.log(messages.agents.title);

  for (const [name, agentConfig] of entries) {
    const status = formatAgentDetection(name, agentConfig, discovery, messages);
    const defaults = formatAgentDefaults(name, config, messages);
    const details = formatAgentDetails(agentConfig, messages);
    const suffix = defaults ? ` | ${defaults}` : "";

    console.log(`- ${name.padEnd(13)} ${`${agentConfig.type}/${agentConfig.role}`.padEnd(18)} ${status}${suffix}`);
    if (details) {
      console.log(`  ${details}`);
    }
  }

  console.log("");
  console.log(messages.agents.defaults(
    config.defaults?.agentA ?? messages.agents.none,
    config.defaults?.agentB ?? messages.agents.none,
    turnsOrDefault(config.defaults?.turns),
    config.defaults?.summaryAgent ?? messages.agents.summaryAgentB
  ));
}

/**
 * Renvoie un libellé indiquant si l'agent est agent A, agent B ou agent de synthèse par défaut.
 * @param name - Nom de l'agent.
 * @param config - Config Palabre contenant les défauts.
 */
function formatAgentDefaults(name: string, config: PalabreConfig, messages: Messages): string {
  const labels: string[] = [];

  if (config.defaults?.agentA === name) labels.push(messages.agents.defaultAgentA);
  if (config.defaults?.agentB === name) labels.push(messages.agents.defaultAgentB);
  if (config.defaults?.summaryAgent === name) labels.push(messages.agents.defaultSummary);

  return labels.join(", ");
}

/**
 * Renvoie une ligne de détails pour un agent : commande CLI ou modèle Ollama.
 * @param agentConfig - Configuration de l'agent.
 */
function formatAgentDetails(agentConfig: AgentConfig, messages: Messages): string {
  if (agentConfig.type === "ollama") {
    return messages.agents.model(agentConfig.model);
  }

  return messages.agents.command(agentConfig.command, agentConfig.model);
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
  discovery: Awaited<ReturnType<typeof discoverLocalTools>>,
  messages: Messages
): string {
  if (agentConfig.type === "ollama") {
    if (!discovery.ollama.available) {
      return discovery.ollama.commandAvailable ? messages.agents.ollamaUnreachable : messages.agents.ollamaNotDetected;
    }

    return discovery.ollama.models.includes(agentConfig.model)
      ? messages.agents.detected()
      : messages.agents.missingModel(agentConfig.model);
  }

  const detection = cliDetectionForAgent(name, agentConfig, discovery);
  return detection.available ? messages.agents.detected(detection.command) : messages.agents.notDetected;
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
  config: Awaited<ReturnType<typeof loadConfig>>,
  messages: Messages
): void {
  console.log("");
  console.log(messages.init.localDetectionTitle);
  console.log(`- Codex CLI: ${formatCommandDetection(discovery.codex, messages)}`);
  console.log(`- Claude CLI: ${formatCommandDetection(discovery.claude, messages)}`);
  console.log(`- Gemini CLI: ${formatCommandDetection(discovery.gemini, messages)}`);
  console.log(`- OpenCode CLI: ${formatCommandDetection(discovery.opencode, messages)}`);
  console.log(`- Ollama API: ${formatOllamaDetection(discovery.ollama, messages)}`);
  console.log("");
  console.log(messages.init.defaults(config.defaults?.agentA ?? "codex", config.defaults?.agentB ?? "ollama-local"));
}

/**
 * Formate le statut de détection d'un outil CLI (disponible ou non).
 * @param detection - Résultat de détection d'un outil CLI.
 */
function formatCommandDetection(detection: Awaited<ReturnType<typeof discoverLocalTools>>["codex"], messages: Messages): string {
  return detection.available
    ? messages.init.commandDetected(detection.command)
    : messages.init.commandMissing;
}

/**
 * Formate le statut de détection d'Ollama : commande absente, serveur injoignable ou modèles disponibles.
 * @param detection - Résultat de détection d'Ollama.
 */
function formatOllamaDetection(detection: Awaited<ReturnType<typeof discoverLocalTools>>["ollama"], messages: Messages): string {
  if (!detection.available) {
    return detection.commandAvailable
      ? messages.init.ollamaServerUnreachable(detection.baseUrl)
      : messages.init.ollamaMissing;
  }

  const modelCount = detection.models.length;
  return messages.init.ollamaDetected(modelCount);
}

/** Affiche le texte d'aide complet sur `stdout`. */
function printHelp(messages: Messages): void {
  console.log(messages.help.render(listPresetNames().join(", ")));
}

main().catch((error: unknown) => {
  const language = safeStartupLanguage(process.argv.slice(2));
  const messages = createTranslator(language);
  const message = error instanceof AdapterError
    ? formatAdapterError(error, messages)
    : error instanceof Error ? error.message : String(error);
  console.error(`${messages.common.errorPrefix}: ${message}`);
  process.exitCode = 1;
});

function safeStartupLanguage(args: string[]) {
  try {
    return resolveLanguage({ explicitLanguage: findRawLanguageFlag(args) });
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

