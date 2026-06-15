#!/usr/bin/env node
import { assertRunnableConfig, configExists, createConfigFromDiscovery, DEFAULT_CONFIG_PATH, GLOBAL_CONFIG_PATH, loadConfig, resolveDefaultConfigPath, resolveOutputDir, setOllamaModel, syncDetectedAgents, syncOllamaModel, writeExampleConfig } from "./config.js";
import { loadProjectInputs } from "./context.js";
import { buildContextScan } from "./contextScan.js";
import { discoverLocalTools } from "./discovery.js";
import { runDoctor } from "./doctor.js";
import { AdapterError, formatAdapterError } from "./errors.js";
import { runConfigWizard } from "./configWizard.js";
import { createTranslator, DEFAULT_LANGUAGE, parseLanguage, resolveLanguage } from "./i18n.js";
import { DEFAULT_TURNS, parseTurnsFlag, turnsOrDefault, validateTurns } from "./limits.js";
import { formatAgentPrompt } from "./prompt.js";
import { runNewWizard } from "./new.js";
import { listPresetNames, listPresetsWithAvailability, resolvePreset } from "./presets.js";
import { createConsoleRenderer } from "./renderers/console.js";
import { createNdjsonRenderer } from "./renderers/ndjson.js";
import { createTuiRenderer, promptTuiConfigCommand, promptTuiHomeTopic, renderTuiConfig, renderTuiHelp, renderTuiHome } from "./renderers/tui.js";
import { MAX_ASK_AGENTS, runAsk, runDebate } from "./orchestrator.js";
import { writeDebateMarkdown } from "./output.js";
import { applySourceUpdate, formatUpdateInstructions, getUpdateInfo } from "./update.js";
import { createSessionContext } from "./session.js";
import { getStringListFlag, parseArgs, type ParsedArgs } from "./args.js";
import { detectedAgentNames, detectionForCommand } from "./agentRegistry.js";
import { getPackageVersion } from "./version.js";
import type { CommandDetection } from "./discovery.js";
import type { AgentConfig, DebateOptions, PalabreConfig, PalabreMode } from "./types.js";
import type { Messages } from "./messages/index.js";

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
    printHelp(await resolveCommandMessages(parsed.flags), commandHelpTarget(parsed));
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

  if (parsed.command === "context") {
    await runContextCommand(parsed.flags, parsed.positionals);
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

  assertRunnableConfig(config, messages, configPath);

  if (shouldOpenTuiHome(parsed)) {
    let tuiMode = config.defaults?.mode ?? "debate";
    const tuiVersion = await getPackageVersion();

    for (;;) {
      renderTuiHome(config, configPath, messages, { mode: tuiMode, version: tuiVersion });
      const tuiInput = await promptTuiHomeTopic(tuiMode);
      if (!tuiInput) {
        return;
      }

      if (tuiInput.kind === "help") {
        renderTuiHelp();
        const nextInput = await promptTuiHomeTopic(tuiMode);
        if (!nextInput) {
          return;
        }

        if (nextInput.kind === "help") {
          continue;
        }

        if (nextInput.kind === "mode") {
          tuiMode = nextInput.mode;
          continue;
        }

        if (nextInput.kind === "config") {
          const result = await runTuiConfigLoop(configPath, config, messages, tuiMode);
          if (result.quit) return;
          tuiMode = result.mode;
          continue;
        }

        if (nextInput.kind === "new") {
          parsed.command = "new";
          parsed.commandExplicit = true;
        } else {
          parsed.flags.topic = nextInput.topic;
        }
      } else if (tuiInput.kind === "mode") {
        tuiMode = tuiInput.mode;
        continue;
      } else if (tuiInput.kind === "config") {
        const result = await runTuiConfigLoop(configPath, config, messages, tuiMode);
        if (result.quit) return;
        tuiMode = result.mode;
        continue;
      } else if (tuiInput.kind === "new") {
        parsed.command = "new";
        parsed.commandExplicit = true;
      } else {
        parsed.flags.topic = tuiInput.topic;
      }

      parsed.flags.mode = tuiMode;
      parsed.flags.renderer = "tui";
      break;
    }
  }

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
    if (selection.mode) parsed.flags.mode = selection.mode;
    if (selection.askAgents && selection.askAgents.length > 0) parsed.flags.agents = selection.askAgents;
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

  const mode = parseModeFlag(optionalString(parsed.flags.mode) ?? config.defaults?.mode, messages);
  const explicitAskAgents = getStringListFlag(parsed.flags.agents);
  const askAgentSeeds = explicitAskAgents.length > 0 ? explicitAskAgents : config.defaults?.askAgents ?? [];
  const agentA = resolveAgentName("agent A", parsed.flags["agent-a"], preset?.agentA, askAgentSeeds[0] ?? config.defaults?.agentA, messages);
  const agentB = resolveAgentName("agent B", parsed.flags["agent-b"], preset?.agentB, askAgentSeeds[1] ?? askAgentSeeds[0] ?? config.defaults?.agentB, messages);
  const askAgents = mode === "ask" ? resolveAskAgents(explicitAskAgents, config.defaults?.askAgents, [agentA, agentB], messages) : undefined;

  const options: DebateOptions = {
    mode,
    language,
    topic,
    agentA,
    agentB,
    askAgents,
    turns: parseTurnsFlag(parsed.flags.turns, config.defaults?.turns ?? DEFAULT_TURNS, "--turns", messages),
    session: createSessionContext(),
    files: context.files,
    modelA: optionalString(parsed.flags["model-a"]),
    modelB: optionalString(parsed.flags["model-b"]),
    pullModels: Boolean(parsed.flags["pull-models"]),
    summaryAgent: resolveSummaryAgentOption(parsed.flags["summary-agent"], config.defaults, mode),
    summaryModel: optionalString(parsed.flags["summary-model"]),
    summaryEnabled: !parsed.flags["no-summary"],
    earlyStopOnAgreement: !parsed.flags["no-early-stop"],
    plainOutput: Boolean(parsed.flags.plain),
    signal: debateAbortSignal()
  };

  if (parsed.flags["show-prompt"]) {
    printContextWarnings(context.warnings, messages);
    printPromptPreview(config, options, language, messages);
    return;
  }

  const renderer = createRendererFromFlags(parsed.flags, options.plainOutput, messages);
  context.warnings.forEach((warning) => renderer.warning(warning));
  const result = options.mode === "ask"
    ? await runAsk(config, options, renderer, messages)
    : await runDebate(config, options, renderer, messages);
  const outputPath = await writeDebateMarkdown(
    resolveOutputDir(config.outputDir),
    result.options,
    result.messages,
    result.summary,
    result.stopReason,
    messages,
    result.failure
  );

  renderer.done(outputPath);
  if (result.failure) {
    process.exitCode = result.failure.kind === "cancelled" ? 130 : 1;
  }
}

function debateAbortSignal(): AbortSignal {
  const controller = new AbortController();
  const abort = () => {
    if (!controller.signal.aborted) {
      controller.abort();
    }
  };
  process.once("SIGINT", abort);
  process.once("SIGTERM", abort);
  return controller.signal;
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

  if (flags["ollama-models"]) {
    await runOllamaModelsCommand(config, Boolean(flags.json));
    return;
  }

  const setOllamaModelValue = optionalString(flags["set-ollama-model"]);
  if (setOllamaModelValue !== undefined) {
    await runSetOllamaModelCommand(configPath, config, setOllamaModelValue, messages);
    return;
  }

  if (flags["sync-ollama-model"]) {
    await runSyncOllamaModelCommand(configPath, config, messages);
    return;
  }

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
  const askSummaryAgentValue = optionalString(flags["ask-summary-agent"]);
  const modeValue = optionalString(flags.mode);
  const askAgentsValue = getStringListFlag(flags["ask-agents"]);
  const languageValue = explicitLanguage;
  const changesDefaults = defaultAgents.length > 0
    || hasTurnsFlag
    || summaryAgentValue !== undefined
    || askSummaryAgentValue !== undefined
    || modeValue !== undefined
    || askAgentsValue.length > 0;

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

    if (askSummaryAgentValue !== undefined) {
      if (isNoneValue(askSummaryAgentValue)) {
        delete nextDefaults.askSummaryAgent;
      } else {
        assertKnownAgent(config, askSummaryAgentValue, "defaults.askSummaryAgent", messages);
        nextDefaults.askSummaryAgent = askSummaryAgentValue;
      }
    }

    if (modeValue !== undefined) {
      nextDefaults.mode = parseModeFlag(modeValue, messages);
    }

    if (askAgentsValue.length > 0) {
      nextDefaults.askAgents = normalizeAskAgentsForConfig(config, askAgentsValue, messages);
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

async function runTuiConfigLoop(
  configPath: string,
  config: PalabreConfig,
  messages: Messages,
  initialMode: PalabreMode
): Promise<{ mode: PalabreMode; quit: boolean }> {
  let mode = initialMode;
  let notice: string | undefined;

  for (;;) {
    renderTuiConfig(config, configPath, mode, { message: notice });
    notice = undefined;

    const input = await promptTuiConfigCommand(mode);

    if (input.kind === "quit") {
      return { mode, quit: true };
    }

    if (input.kind === "back") {
      return { mode, quit: false };
    }

    if (input.kind === "unknown") {
      notice = input.message;
      continue;
    }

    if (input.kind === "mode") {
      mode = mode === "ask" ? "debate" : "ask";
      notice = mode === "ask" ? "Configuration Ask." : "Configuration Debat.";
      continue;
    }

    if (input.kind === "default-mode") {
      config.defaults = { ...(config.defaults ?? {}), mode };
      await writeExampleConfig(configPath, config);
      notice = mode === "ask" ? "Ask devient le mode par defaut." : "Debat devient le mode par defaut.";
      continue;
    }

    if (input.kind === "agents") {
      try {
        if (mode === "ask") {
          const agents = normalizeTuiAskAgents(config, input.agents, messages);
          config.defaults = { ...(config.defaults ?? {}), askAgents: agents };
          await writeExampleConfig(configPath, config);
          notice = `Agents Ask mis a jour: ${agents.join(", ")}.`;
        } else {
          const [agentA, agentB] = normalizeTuiDebateAgents(config, input.agents, messages);
          config.defaults = { ...(config.defaults ?? {}), agentA, agentB };
          await writeExampleConfig(configPath, config);
          notice = `Agents Debat mis a jour: ${agentA} <-> ${agentB}.`;
        }
      } catch (error) {
        notice = error instanceof Error ? error.message : String(error);
      }
      continue;
    }

    if (input.kind === "turns") {
      if (mode === "ask") {
        notice = "En mode Ask, le nombre de reponses depend des agents selectionnes avec /agents.";
        continue;
      }

      try {
        validateTurns(input.turns, "--turns", messages);
        config.defaults = { ...(config.defaults ?? {}), turns: input.turns };
        await writeExampleConfig(configPath, config);
        notice = `Tours mis a jour: ${input.turns}.`;
      } catch (error) {
        notice = error instanceof Error ? error.message : String(error);
      }
      continue;
    }

    if (input.kind === "summary") {
      try {
        const nextDefaults = { ...(config.defaults ?? {}) };
        if (input.agent !== undefined) {
          assertKnownAgent(config, input.agent, mode === "ask" ? "defaults.askSummaryAgent" : "defaults.summaryAgent", messages);
        }

        if (mode === "ask") {
          if (input.agent === undefined) {
            delete nextDefaults.askSummaryAgent;
            notice = "Synthese Ask revenue au fallback.";
          } else {
            nextDefaults.askSummaryAgent = input.agent;
            notice = `Synthese Ask: ${input.agent}.`;
          }
        } else if (input.agent === undefined) {
          delete nextDefaults.summaryAgent;
          notice = "Synthese Debat revenue au fallback.";
        } else {
          nextDefaults.summaryAgent = input.agent;
          notice = `Synthese Debat: ${input.agent}.`;
        }

        config.defaults = nextDefaults;
        await writeExampleConfig(configPath, config);
      } catch (error) {
        notice = error instanceof Error ? error.message : String(error);
      }
    }
  }
}

function normalizeTuiDebateAgents(config: PalabreConfig, agents: string[], messages: Messages): [string, string] {
  const unique = agents.map((agent) => agent.trim()).filter((agent, index, list) => agent && list.indexOf(agent) === index);
  if (unique.length !== 2) {
    throw new Error("Usage: /agents <agentA> <agentB>");
  }

  assertKnownAgent(config, unique[0]!, "defaults.agentA", messages);
  assertKnownAgent(config, unique[1]!, "defaults.agentB", messages);
  return [unique[0]!, unique[1]!];
}

function normalizeTuiAskAgents(config: PalabreConfig, agents: string[], messages: Messages): string[] {
  const unique = agents.map((agent) => agent.trim()).filter((agent, index, list) => agent && list.indexOf(agent) === index);
  if (unique.length === 0) {
    throw new Error("Usage: /agents <agent...>");
  }

  if (unique.length > MAX_ASK_AGENTS) {
    throw new Error(messages.common.tooManyAskAgents(MAX_ASK_AGENTS));
  }

  unique.forEach((agent) => assertKnownAgent(config, agent, "defaults.askAgents", messages));
  return unique;
}

async function runOllamaModelsCommand(config: PalabreConfig, json: boolean): Promise<void> {
  const discovery = await discoverLocalTools();
  const agent = config.agents["ollama-local"];
  const currentModel = agent?.type === "ollama" ? agent.model : null;
  const payload = {
    v: 1,
    agent: "ollama-local",
    available: discovery.ollama.available,
    baseUrl: discovery.ollama.baseUrl,
    currentModel,
    currentModelInstalled: currentModel ? discovery.ollama.models.includes(currentModel) : false,
    installedModels: discovery.ollama.models
  };

  if (json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(`ollama-local: ${currentModel ?? "(non configuré)"}`);
  console.log(`Ollama API: ${discovery.ollama.available ? "joignable" : "indisponible"} (${discovery.ollama.baseUrl})`);
  console.log(`Modèles installés: ${discovery.ollama.models.length > 0 ? discovery.ollama.models.join(", ") : "(aucun)"}`);
}

async function runSetOllamaModelCommand(
  configPath: string,
  config: PalabreConfig,
  model: string,
  messages: Messages
): Promise<void> {
  const trimmed = model.trim();

  if (!trimmed) {
    throw new Error(messages.common.optionRequiresValue("--set-ollama-model"));
  }

  const discovery = await discoverLocalTools();
  const agent = config.agents["ollama-local"];

  if (agent?.type !== "ollama") {
    throw new Error(messages.config.ollamaModelNoAgent);
  }

  if (!discovery.ollama.models.includes(trimmed)) {
    throw new Error(messages.config.ollamaModelUnavailable(trimmed));
  }

  const result = setOllamaModel(config, trimmed);
  await writeExampleConfig(configPath, config);
  console.log(result
    ? messages.config.ollamaModelUpdated(configPath, result.previousModel, result.nextModel)
    : messages.config.ollamaModelNoChange(configPath, agent.model));
}

async function runSyncOllamaModelCommand(
  configPath: string,
  config: PalabreConfig,
  messages: Messages
): Promise<void> {
  const discovery = await discoverLocalTools();
  const agent = config.agents["ollama-local"];

  if (agent?.type !== "ollama") {
    throw new Error(messages.config.ollamaModelNoAgent);
  }

  if (discovery.ollama.models.length === 0) {
    throw new Error(messages.config.ollamaModelNoInstalledModels);
  }

  const result = syncOllamaModel(config, discovery);

  if (!result) {
    console.log(messages.config.ollamaModelNoChange(configPath, agent.model));
    return;
  }

  await writeExampleConfig(configPath, config);
  console.log(messages.config.ollamaModelUpdated(configPath, result.previousModel, result.nextModel));
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
    defaults.summaryAgent,
    defaults.askSummaryAgent,
    defaults.mode,
    defaults.askAgents
  );
}

function normalizeAskAgentsForConfig(config: Awaited<ReturnType<typeof loadConfig>>, agents: string[], messages: Messages): string[] {
  const unique = agents
    .map((agent) => agent.trim())
    .filter((agent, index, list) => agent && list.indexOf(agent) === index);

  if (unique.length > MAX_ASK_AGENTS) {
    throw new Error(messages.common.tooManyAskAgents(MAX_ASK_AGENTS));
  }

  for (const agent of unique) {
    assertKnownAgent(config, agent, "defaults.askAgents", messages);
  }

  return unique;
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

function resolveSummaryAgentOption(
  explicitValue: string | string[] | boolean | undefined,
  defaults: PalabreConfig["defaults"] | undefined,
  mode: PalabreMode
): string | undefined {
  const explicit = optionalString(explicitValue);

  if (explicit) {
    return explicit;
  }

  if (mode === "ask") {
    return defaults?.askSummaryAgent ?? defaults?.summaryAgent;
  }

  return defaults?.summaryAgent;
}

function parseModeFlag(value: string | undefined, messages: Messages): PalabreMode {
  if (!value) {
    return "debate";
  }

  if (value === "debate" || value === "ask") {
    return value;
  }

  throw new Error(messages.common.unknownMode(value, "debate, ask"));
}

function resolveAskAgents(explicitAgents: string[], defaultAgents: string[] | undefined, fallbackAgents: string[], messages: Messages): string[] {
  const selected = explicitAgents.length > 0
    ? explicitAgents
    : defaultAgents && defaultAgents.length > 0 ? defaultAgents : fallbackAgents;
  const unique = selected.filter((agent, index) => agent.trim() && selected.indexOf(agent) === index);

  if (unique.length > MAX_ASK_AGENTS) {
    throw new Error(messages.common.tooManyAskAgents(MAX_ASK_AGENTS));
  }

  return unique;
}
/**
 * Affiche un aperçu du prompt du premier tour sans appeler aucun agent (flag `--show-prompt`).
 * @param config - Config chargée.
 * @param options - Options du débat résolues.
 */
function printPromptPreview(config: Awaited<ReturnType<typeof loadConfig>>, options: DebateOptions, language: string, messages: Messages): void {
  const previewAgent = options.mode === "ask" ? options.askAgents?.[0] ?? options.agentA : options.agentA;
  const peerName = options.mode === "ask" ? "independent-agents" : options.agentB;
  const agentConfig = config.agents[previewAgent];

  if (!agentConfig) {
    throw new Error(messages.common.unknownAgent(previewAgent));
  }

  const prompt = formatAgentPrompt({
    topic: options.topic,
    turn: 1,
    totalTurns: options.mode === "ask" ? options.askAgents?.length ?? 1 : options.turns,
    selfName: previewAgent,
    peerName,
    selfRole: agentConfig.role,
    mode: options.mode === "ask" ? "ask" : "debate",
    language: options.language,
    session: options.session,
    files: options.files,
    transcript: []
  });

  console.log(messages.preview.title);
  console.log(messages.preview.agent(previewAgent, agentConfig.role));
  console.log(messages.preview.peer(peerName));
  console.log(messages.preview.pullModels(options.pullModels));
  console.log(messages.preview.summary(options.summaryEnabled ? previewSummaryAgent(options) : messages.preview.disabled));
  console.log(messages.preview.interfaceLanguage(language));
  console.log("");
  console.log(prompt);
  console.log("");
  console.log(options.mode === "ask" ? messages.preview.askNote : messages.preview.note);
}

function previewSummaryAgent(options: DebateOptions): string {
  if (options.summaryAgent) {
    return options.summaryAgent;
  }

  if (options.mode === "ask" && options.askAgents && options.askAgents.length > 0) {
    return options.askAgents[options.askAgents.length - 1] ?? options.agentB;
  }

  return options.agentB;
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
const SUPPORTED_RENDERERS = ["auto", "pretty", "plain", "tui", "ndjson"] as const;
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
      case "tui":
        return createTuiRenderer(messages);
      case "auto":
        return createConsoleRenderer(plainOutputFallback, messages);
    }
  }
  if (flags.json) {
    return createNdjsonRenderer();
  }
  return createConsoleRenderer(plainOutputFallback, messages);
}

function shouldOpenTuiHome(parsed: ParsedArgs): boolean {
  return parsed.command === "run"
    && !parsed.commandExplicit
    && parsed.positionals.length === 0
    && optionalString(parsed.flags.topic) === undefined
    && optionalString(parsed.flags.renderer) === undefined
    && parsed.flags.json !== true
    && parsed.flags.plain !== true;
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

async function runContextCommand(flags: Record<string, string | string[] | boolean>, positionals: string[]): Promise<void> {
  const language = resolveLanguage({ explicitLanguage: optionalString(flags.language) });
  const messages = createTranslator(language);
  const subcommand = positionals[0] ?? "scan";

  if (subcommand !== "scan") {
    throw new Error(messages.common.unknownCommand(`context ${subcommand}`, "context scan"));
  }

  const paths = positionals.slice(1);
  const result = await buildContextScan(paths, process.cwd(), messages);
  const folders = result.items.filter((item) => item.kind === "folder");
  const files = result.items.filter((item) => item.kind === "file");

  if (flags.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  for (const folder of folders) {
    console.log(`[folder] ${folder.path}`);
  }
  for (const file of files) {
    console.log(`[file] ${file.path} (${file.sizeBytes} bytes)`);
  }
  for (const warning of result.warnings) {
    console.error(`${messages.renderers.warningPrefix} ${warning}`);
  }
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
    config.defaults?.summaryAgent ?? messages.agents.summaryAgentB,
    config.defaults?.askSummaryAgent
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
  if (config.defaults?.askSummaryAgent === name) labels.push(messages.agents.defaultAskSummary);

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
 * Résout l'entrée de détection correspondant à un agent CLI.
 * Renvoie un objet `{ available: true }` pour les agents CLI non reconnus (considérés disponibles).
 * @param name - Nom de l'agent dans la config.
 * @param agentConfig - Configuration de l'agent.
 * @param discovery - Résultat de la découverte locale des outils.
 */
function cliDetectionForAgent(
  name: string,
  agentConfig: AgentConfig,
  discovery: Awaited<ReturnType<typeof discoverLocalTools>>
): CommandDetection {
  const command = agentConfig.type === "cli" || agentConfig.type === "cli-pty" ? agentConfig.command : name;
  return detectionForCommand(command, discovery) ?? { available: true, command };
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
  console.log(`- Antigravity CLI: ${formatCommandDetection(discovery.antigravity, messages)}`);
  console.log(`- OpenCode CLI: ${formatCommandDetection(discovery.opencode, messages)}`);
  console.log(`- Ollama API: ${formatOllamaDetection(discovery.ollama, messages)}`);
  console.log("");
  console.log(config.defaults?.agentA && config.defaults.agentB
    ? messages.init.defaults(config.defaults.agentA, config.defaults.agentB)
    : messages.init.noDefaultPair(formatDetectedAgentSummary(discovery, config.language ?? DEFAULT_LANGUAGE)));
  console.log(messages.init.languageHint(config.language ?? DEFAULT_LANGUAGE));
}

function formatDetectedAgentSummary(
  discovery: Awaited<ReturnType<typeof discoverLocalTools>>,
  language: NonNullable<PalabreConfig["language"]>
): string {
  const names = detectedAgentNames(discovery);

  if (names.length === 0) {
    return language === "en" ? "no agent detected" : "aucun agent détecté";
  }

  if (names.length === 1) {
    return language === "en"
      ? `only one agent detected (${names[0]})`
      : `un seul agent détecté (${names[0]})`;
  }

  return language === "en"
    ? `no usable pair detected among ${names.join(", ")}`
    : `aucune paire utilisable détectée parmi ${names.join(", ")}`;
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
function printHelp(messages: Messages, command?: string): void {
  const commandHelp = command ? messages.help.renderCommand(command) : undefined;
  console.log(commandHelp ?? messages.help.render(listPresetNames().join(", ")));
}

function commandHelpTarget(parsed: ParsedArgs): string | undefined {
  if (parsed.command === "help" || parsed.command === "run") {
    return undefined;
  }

  if (parsed.command === "agent") return "agents";
  if (parsed.command === "preset") return "presets";
  if (parsed.command === "setup") return "init";

  return parsed.command;
}

/** Résout les messages d'une commande qui peut être affichée avant le flux principal. */
async function resolveCommandMessages(flags: Record<string, string | string[] | boolean>): Promise<Messages> {
  const explicitLanguage = optionalString(flags.language);
  const configPath = optionalString(flags.config) ?? await resolveDefaultConfigPath();
  let configLanguage: string | undefined;

  try {
    configLanguage = await configExists(configPath)
      ? (await loadConfig(configPath)).language
      : undefined;
  } catch {
    configLanguage = undefined;
  }

  return createTranslator(resolveLanguage({ explicitLanguage, configLanguage }));
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

