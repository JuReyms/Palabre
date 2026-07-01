#!/usr/bin/env node
import { assertRunnableConfig, configExists, createConfigFromDiscovery, DEFAULT_CONFIG_PATH, GLOBAL_CONFIG_PATH, loadConfig, resolveDefaultConfigPath, resolveOutputDir, setOllamaBaseUrl, setOllamaModel, syncDetectedAgentsDetailed, syncOllamaModel, writeExampleConfig } from "./config.js";
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
import { listAgentsWithAvailability, listPresetNames, listPresetsWithAvailability, resolvePreset } from "./presets.js";
import { listHistoryEntries } from "./history.js";
import { createConsoleRenderer } from "./renderers/console.js";
import { createNdjsonRenderer } from "./renderers/ndjson.js";
import { createTuiRenderer, promptTuiAgentsWizard, promptTuiConfigCommand, promptTuiHomeTopic, promptTuiRolesWizard, renderTuiConfig, renderTuiHelp, renderTuiHistory, renderTuiHome, renderTuiRolesHelp, type TuiHomeInput } from "./renderers/tui.js";
import { MAX_ASK_AGENTS, runAsk, runDebate } from "./orchestrator.js";
import { writeDebateMarkdown } from "./output.js";
import { applySourceUpdate, formatUpdateInstructions, getUpdateInfo } from "./update.js";
import { createSessionContext } from "./session.js";
import { getStringListFlag, parseArgs, type ParsedArgs } from "./args.js";
import { askAgentSeedsForMode, clearTuiRunOverrides } from "./tuiState.js";
import { detectedAgentNames, detectionForCommand, isRetiredAgentName } from "./agentRegistry.js";
import { configuredOllamaBaseUrl, DEFAULT_OLLAMA_BASE_URL, normalizeOllamaBaseUrl, resolveOllamaBaseUrl } from "./ollamaUrl.js";
import { getPackageVersion } from "./version.js";
import type { CommandDetection } from "./discovery.js";
import type { AgentConfig, AgentRole, DebateOptions, PalabreConfig, PalabreInterface, PalabreMode } from "./types.js";
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
    const result = await runDoctor(optionalString(parsed.flags.config), Boolean(parsed.flags.plain || parsed.flags.terminal), optionalString(parsed.flags.language));
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

  if (parsed.command === "history" || parsed.command === "historique") {
    await runHistoryCommand(parsed.flags);
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

    const discovery = await discoverLocalTools({
      ollamaUrl: optionalString(parsed.flags["ollama-url"])
    });
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
  let config: PalabreConfig;
  let tuiNotice: string | undefined;

  if (!(await configExists(configPath))) {
    config = createConfigFromDiscovery(await discoverLocalTools({
      ollamaUrl: optionalString(parsed.flags["ollama-url"])
    }));
    config.language = resolveLanguage({
      explicitLanguage: optionalString(parsed.flags.language),
      configLanguage: config.language
    });
    const messages = createTranslator(config.language);
    await writeExampleConfig(configPath, config);

    if (!shouldOpenTuiHome(parsed)) {
      console.log(messages.init.editConfigThenRerun(configPath));
      return;
    }

    tuiNotice = messages.init.configCreated(configPath);
  } else {
    config = await loadConfig(configPath);
  }

  let language = resolveLanguage({
    explicitLanguage: optionalString(parsed.flags.language),
    configLanguage: config.language
  });
  let messages = createTranslator(language);

  assertRunnableConfig(config, messages, configPath);

  let stayInTuiAfterSession = false;
  let hasCompletedTuiSession = false;
  let resetTuiRunOverridesOnNextTopic = false;
  let tuiMode = config.defaults?.mode ?? "debate";
  let tuiVersion = "";

  const handleTuiHomeInput = async (tuiInput: TuiHomeInput): Promise<"continue" | "run" | "retry" | "quit"> => {
    if (!tuiInput) {
      return "quit";
    }

    if (tuiInput.kind === "help") {
      renderTuiHelp(messages);
      const nextInput = await promptTuiHomeTopic(tuiMode, messages);
      return handleTuiHomeInput(nextInput);
    }

    if (tuiInput.kind === "history") {
      renderTuiHistory(await listHistoryEntries(resolveOutputDir(config.outputDir)), messages);
      const nextInput = await promptTuiHomeTopic(tuiMode, messages);
      return handleTuiHomeInput(nextInput);
    }

    if (tuiInput.kind === "home") {
      return "continue";
    }

    if (tuiInput.kind === "roles") {
      const result = await runTuiRolesWizard(configPath, config, messages, tuiMode, tuiInput.roles);
      if (result.quit) return "quit";
      tuiNotice = result.notice;
      return "continue";
    }

    if (tuiInput.kind === "agents") {
      const result = await runTuiAgentsWizard(configPath, config, messages, tuiMode, tuiInput.agents);
      if (result.quit) return "quit";
      tuiNotice = result.notice;
      resetTuiRunOverridesOnNextTopic ||= Boolean(result.changedRunDefaults);
      return "continue";
    }

    if (tuiInput.kind === "mode") {
      tuiMode = tuiInput.mode;
      return "continue";
    }

    if (tuiInput.kind === "config") {
      const result = await runTuiConfigLoop(configPath, config, messages, tuiMode);
      if (result.quit) return "quit";
      tuiMode = result.mode;
      resetTuiRunOverridesOnNextTopic ||= result.changedRunDefaults;
      language = resolveLanguage({ explicitLanguage: optionalString(parsed.flags.language), configLanguage: config.language });
      messages = createTranslator(language);
      return "continue";
    }

    if (tuiInput.kind === "new") {
      parsed.command = "new";
      parsed.commandExplicit = true;
      delete parsed.flags.topic;
      return "run";
    }

    if (tuiInput.kind === "retry") {
      if (!optionalString(parsed.flags.topic)) {
        tuiNotice = messages.tui.retryUnavailable;
        return "continue";
      }
      return "retry";
    }

    parsed.command = "";
    parsed.commandExplicit = false;
    if (hasCompletedTuiSession || resetTuiRunOverridesOnNextTopic) {
      clearTuiRunOverrides(parsed.flags);
      resetTuiRunOverridesOnNextTopic = false;
    }
    parsed.flags.topic = tuiInput.topic;
    return "run";
  };

  if (shouldOpenTuiHome(parsed)) {
    const syncResult = await syncInteractiveDetectedAgents(configPath, config);
    if (!tuiNotice && syncResult.addedAgents.length > 0) {
      tuiNotice = messages.config.syncAdded(configPath, syncResult.addedAgents.join(", "));
    }

    stayInTuiAfterSession = true;
    tuiVersion = await getPackageVersion();

    for (;;) {
      renderTuiHome(config, configPath, messages, { mode: tuiMode, version: tuiVersion });
      const tuiInput = await promptTuiHomeTopic(tuiMode, messages, { notice: tuiNotice });
      tuiNotice = undefined;
      const action = await handleTuiHomeInput(tuiInput);
      if (action === "quit") return;
      if (action === "continue") continue;

      parsed.flags.mode = tuiMode;
      parsed.flags.renderer = "tui";
      break;
    }
  }

  for (;;) {
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
      parsed.command = "";
      parsed.commandExplicit = false;
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
    const askAgentSeeds = askAgentSeedsForMode(mode, explicitAskAgents, config.defaults?.askAgents);
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
      ollamaUrl: optionalString(parsed.flags["ollama-url"])
        ? normalizeOllamaBaseUrl(optionalString(parsed.flags["ollama-url"])!)
        : undefined,
      pullModels: Boolean(parsed.flags["pull-models"]),
      summaryAgent: resolveSummaryAgentOption(parsed.flags["summary-agent"], config.defaults, mode),
      summaryModel: optionalString(parsed.flags["summary-model"]),
      summaryEnabled: !parsed.flags["no-summary"],
      earlyStopOnAgreement: !parsed.flags["no-early-stop"],
      plainOutput: Boolean(parsed.flags.plain || parsed.flags.terminal),
      signal: debateAbortSignal()
    };

    if (parsed.flags["show-prompt"]) {
      printContextWarnings(context.warnings, messages);
      printPromptPreview(config, options, language, messages);
      return;
    }

    process.exitCode = undefined;
    const renderer = createRendererFromFlags(parsed.flags, options.plainOutput, config.defaults?.interface, messages);
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
    hasCompletedTuiSession = stayInTuiAfterSession;
    if (result.failure) {
      process.exitCode = result.failure.kind === "cancelled" ? 130 : 1;
    }

    if (!stayInTuiAfterSession) {
      return;
    }

    tuiMode = mode;
    for (;;) {
      const nextInput = await promptTuiHomeTopic(tuiMode, messages, { notice: tuiNotice });
      tuiNotice = undefined;
      const action = await handleTuiHomeInput(nextInput);
      if (action === "quit") return;
      if (action === "continue") {
        renderTuiHome(config, configPath, messages, { mode: tuiMode, version: tuiVersion });
        continue;
      }
      if (action === "retry") {
        parsed.flags.renderer = "tui";
        break;
      }

      parsed.flags.mode = tuiMode;
      parsed.flags.renderer = "tui";
      break;
    }
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
  const discovery = await discoverLocalToolsForConfig(config, optionalString(flags["ollama-url"]));
  if (flags.json) {
    const fallbackAskAgents = [config.defaults?.agentA, config.defaults?.agentB]
      .filter((name): name is string => typeof name === "string" && !isRetiredAgentName(name));
    process.stdout.write(JSON.stringify({
      v: 1,
      agents: listAgentsWithAvailability(config, discovery, messages),
      defaults: {
        askAgents: config.defaults?.askAgents?.length
          ? config.defaults.askAgents.filter((name) => !isRetiredAgentName(name))
          : fallbackAskAgents
      }
    }) + "\n");
    return;
  }
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
    const discovery = await discoverLocalToolsForConfig(config, optionalString(flags["ollama-url"]));
    const result = syncDetectedAgentsDetailed(config, discovery);

    if (!result.changed) {
      console.log(messages.config.syncNoMissing(configPath));
      return;
    }

    await writeExampleConfig(configPath, config);
    console.log(result.addedAgents.length > 0
      ? messages.config.syncAdded(configPath, result.addedAgents.join(", "))
      : messages.config.syncRefreshed(configPath));
    return;
  }

  const defaultAgents = getStringListFlag(flags["set-defaults"]);
  const hasTurnsFlag = flags.turns !== undefined;
  const summaryAgentValue = optionalString(flags["summary-agent"]);
  const askSummaryAgentValue = optionalString(flags["ask-summary-agent"]);
  const interfaceValue = optionalString(flags.interface);
  const modeValue = optionalString(flags.mode);
  const askAgentsValue = getStringListFlag(flags["ask-agents"]);
  const languageValue = explicitLanguage;
  const changesDefaults = defaultAgents.length > 0
    || hasTurnsFlag
    || summaryAgentValue !== undefined
    || askSummaryAgentValue !== undefined
    || interfaceValue !== undefined
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

    if (interfaceValue !== undefined) {
      nextDefaults.interface = parseInterfaceFlag(interfaceValue, messages);
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
): Promise<{ mode: PalabreMode; quit: boolean; changedRunDefaults: boolean }> {
  let mode = initialMode;
  let notice: string | undefined;
  let currentMessages = messages;
  let changedRunDefaults = false;

  for (;;) {
    renderTuiConfig(config, configPath, mode, currentMessages, { message: notice });
    notice = undefined;

    const input = await promptTuiConfigCommand(mode, currentMessages);

    if (input.kind === "quit") {
      return { mode, quit: true, changedRunDefaults };
    }

    if (input.kind === "back") {
      return { mode, quit: false, changedRunDefaults };
    }

    if (input.kind === "unknown") {
      notice = input.message;
      continue;
    }

    if (input.kind === "mode") {
      mode = mode === "ask" ? "debate" : "ask";
      config.defaults = { ...(config.defaults ?? {}), mode };
      await writeExampleConfig(configPath, config);
      changedRunDefaults = true;
      notice = mode === "ask" ? currentMessages.tui.askDefaultMode : currentMessages.tui.debateDefaultMode;
      continue;
    }

    if (input.kind === "default-mode") {
      config.defaults = { ...(config.defaults ?? {}), mode };
      await writeExampleConfig(configPath, config);
      changedRunDefaults = true;
      notice = mode === "ask" ? currentMessages.tui.askDefaultMode : currentMessages.tui.debateDefaultMode;
      continue;
    }

    if (input.kind === "interface") {
      config.defaults = { ...(config.defaults ?? {}), interface: input.interfaceName };
      await writeExampleConfig(configPath, config);
      notice = currentMessages.tui.interfaceDefault(input.interfaceName);
      continue;
    }

    if (input.kind === "language") {
      config.language = parseLanguage(input.language, "--language");
      await writeExampleConfig(configPath, config);
      currentMessages = createTranslator(config.language ?? DEFAULT_LANGUAGE);
      notice = currentMessages.tui.languageUpdated(input.language);
      continue;
    }

    if (input.kind === "agents") {
      try {
        const agentsInput = input.agents.length > 0
          ? { kind: "agents" as const, agents: input.agents }
          : await promptTuiAgentsWizard(config, mode, currentMessages);
        if (agentsInput.kind === "quit") {
          return { mode, quit: true, changedRunDefaults };
        }
        if (agentsInput.kind === "back" || agentsInput.agents.length === 0) {
          notice = currentMessages.tui.agentsUnchanged;
          continue;
        }

        if (mode === "ask") {
          const agents = normalizeTuiAskAgents(config, agentsInput.agents, currentMessages);
          config.defaults = { ...(config.defaults ?? {}), askAgents: agents };
          await writeExampleConfig(configPath, config);
          changedRunDefaults = true;
          notice = currentMessages.tui.askAgentsUpdated(agents.join(", "));
        } else {
          const [agentA, agentB] = normalizeTuiDebateAgents(config, agentsInput.agents, currentMessages);
          config.defaults = { ...(config.defaults ?? {}), agentA, agentB };
          await writeExampleConfig(configPath, config);
          changedRunDefaults = true;
          notice = currentMessages.tui.debateAgentsUpdated(`${agentA} <-> ${agentB}`);
        }
      } catch (error) {
        notice = error instanceof Error ? error.message : String(error);
      }
      continue;
    }

    if (input.kind === "roles") {
      try {
        const rolesInput = input.roles.length > 0
          ? { kind: "roles" as const, roles: input.roles }
          : await promptTuiRolesWizard(config, mode, currentMessages);
        if (rolesInput.kind === "quit") {
          return { mode, quit: true, changedRunDefaults };
        }
        if (rolesInput.kind === "back" || rolesInput.roles.length === 0) {
          notice = currentMessages.tui.rolesUnchanged;
          continue;
        }
        notice = applyTuiRoles(config, mode, rolesInput.roles, currentMessages);
        await writeExampleConfig(configPath, config);
      } catch (error) {
        notice = error instanceof Error ? error.message : String(error);
      }
      continue;
    }

    if (input.kind === "turns") {
      if (mode === "ask") {
        notice = currentMessages.tui.askTurnsNotice;
        continue;
      }

      try {
        validateTurns(input.turns, "--turns", currentMessages);
        config.defaults = { ...(config.defaults ?? {}), turns: input.turns };
        await writeExampleConfig(configPath, config);
        changedRunDefaults = true;
        notice = currentMessages.tui.turnsUpdated(input.turns);
      } catch (error) {
        notice = error instanceof Error ? error.message : String(error);
      }
      continue;
    }

    if (input.kind === "summary") {
      try {
        const nextDefaults = { ...(config.defaults ?? {}) };
        if (input.agent !== undefined) {
          assertKnownAgent(config, input.agent, mode === "ask" ? "defaults.askSummaryAgent" : "defaults.summaryAgent", currentMessages);
        }

        if (mode === "ask") {
          if (input.agent === undefined) {
            delete nextDefaults.askSummaryAgent;
            notice = currentMessages.tui.askSummaryFallback;
          } else {
            nextDefaults.askSummaryAgent = input.agent;
            notice = currentMessages.tui.askSummaryAgent(input.agent);
          }
        } else if (input.agent === undefined) {
          delete nextDefaults.summaryAgent;
          notice = currentMessages.tui.debateSummaryFallback;
        } else {
          nextDefaults.summaryAgent = input.agent;
          notice = currentMessages.tui.debateSummaryAgent(input.agent);
        }

        config.defaults = nextDefaults;
        await writeExampleConfig(configPath, config);
        changedRunDefaults = true;
      } catch (error) {
        notice = error instanceof Error ? error.message : String(error);
      }
      continue;
    }

    if (input.kind === "ollama-info") {
      try {
        notice = await formatTuiOllamaInfo(config, currentMessages);
      } catch (error) {
        notice = error instanceof Error ? error.message : String(error);
      }
      continue;
    }

    if (input.kind === "ollama-url") {
      try {
        notice = await setTuiOllamaUrl(configPath, config, input.url, currentMessages);
        changedRunDefaults = true;
      } catch (error) {
        notice = error instanceof Error ? error.message : String(error);
      }
      continue;
    }

    if (input.kind === "ollama-model") {
      try {
        notice = await setTuiOllamaModel(configPath, config, input.model, currentMessages);
        changedRunDefaults = true;
      } catch (error) {
        notice = error instanceof Error ? error.message : String(error);
      }
      continue;
    }

    if (input.kind === "ollama-sync") {
      try {
        notice = await syncTuiOllamaModel(configPath, config, currentMessages);
        changedRunDefaults = true;
      } catch (error) {
        notice = error instanceof Error ? error.message : String(error);
      }
      continue;
    }
  }
}

async function setTuiOllamaUrl(
  configPath: string,
  config: PalabreConfig,
  value: string,
  messages: Messages
): Promise<string> {
  if (!Object.values(config.agents).some((agent) => agent.type === "ollama")) {
    throw new Error(messages.config.ollamaModelNoAgent);
  }

  const normalized = isDefaultOllamaUrl(value)
    ? DEFAULT_OLLAMA_BASE_URL
    : normalizeOllamaBaseUrl(value);
  const effective = resolveOllamaBaseUrl({ configUrl: normalized });
  setOllamaBaseUrl(config, normalized);
  await writeExampleConfig(configPath, config);

  return messages.tui.ollamaUrlUpdated(normalized, effective);
}

function isDefaultOllamaUrl(value: string): boolean {
  return ["default", "defaut", "défaut", "local", "localhost"].includes(value.trim().toLowerCase());
}

async function formatTuiOllamaInfo(config: PalabreConfig, messages: Messages): Promise<string> {
  const discovery = await discoverLocalToolsForConfig(config);
  const agent = config.agents["ollama-local"];

  if (agent?.type !== "ollama") {
    throw new Error(messages.config.ollamaModelNoAgent);
  }

  if (!discovery.ollama.available) {
    return messages.tui.ollamaUnavailable(discovery.ollama.baseUrl);
  }

  const installed = discovery.ollama.models.length > 0
    ? discovery.ollama.models.join(", ")
    : messages.config.ollamaModelNoInstalledModels;
  const api = `${discovery.ollama.baseUrl}`;
  return messages.tui.ollamaInfo(agent.model, installed, api);
}

async function setTuiOllamaModel(configPath: string, config: PalabreConfig, model: string, messages: Messages): Promise<string> {
  const trimmed = model.trim();
  if (!trimmed) {
    throw new Error(messages.tui.ollamaModelUsage);
  }

  const discovery = await discoverLocalToolsForConfig(config);
  const agent = config.agents["ollama-local"];

  if (agent?.type !== "ollama") {
    throw new Error(messages.config.ollamaModelNoAgent);
  }

  if (!discovery.ollama.models.includes(trimmed)) {
    throw new Error(messages.config.ollamaModelUnavailable(trimmed));
  }

  const result = setOllamaModel(config, trimmed);
  await writeExampleConfig(configPath, config);
  return result
    ? messages.config.ollamaModelUpdated(configPath, result.previousModel, result.nextModel)
    : messages.config.ollamaModelNoChange(configPath, agent.model);
}

async function syncTuiOllamaModel(configPath: string, config: PalabreConfig, messages: Messages): Promise<string> {
  const discovery = await discoverLocalToolsForConfig(config);
  const agent = config.agents["ollama-local"];

  if (agent?.type !== "ollama") {
    throw new Error(messages.config.ollamaModelNoAgent);
  }

  if (discovery.ollama.models.length === 0) {
    throw new Error(messages.config.ollamaModelNoInstalledModels);
  }

  const result = syncOllamaModel(config, discovery);

  if (!result) {
    return messages.config.ollamaModelNoChange(configPath, agent.model);
  }

  await writeExampleConfig(configPath, config);
  return messages.config.ollamaModelUpdated(configPath, result.previousModel, result.nextModel);
}

async function syncInteractiveDetectedAgents(configPath: string, config: PalabreConfig): Promise<{ addedAgents: string[] }> {
  const discovery = await discoverLocalToolsForConfig(config);
  const result = syncDetectedAgentsDetailed(config, discovery);

  if (result.changed) {
    await writeExampleConfig(configPath, config);
  }

  return {
    addedAgents: result.addedAgents
  };
}

function normalizeTuiDebateAgents(config: PalabreConfig, agents: string[], messages: Messages): [string, string] {
  const unique = agents.map((agent) => agent.trim()).filter((agent, index, list) => agent && list.indexOf(agent) === index);
  if (unique.length !== 2) {
    throw new Error(messages.tui.debateAgentsUsage);
  }

  assertKnownAgent(config, unique[0]!, "defaults.agentA", messages);
  assertKnownAgent(config, unique[1]!, "defaults.agentB", messages);
  return [unique[0]!, unique[1]!];
}

function normalizeTuiAskAgents(config: PalabreConfig, agents: string[], messages: Messages): string[] {
  const unique = agents.map((agent) => agent.trim()).filter((agent, index, list) => agent && list.indexOf(agent) === index);
  if (unique.length === 0) {
    throw new Error(messages.tui.askAgentsUsage);
  }

  if (unique.length > MAX_ASK_AGENTS) {
    throw new Error(messages.common.tooManyAskAgents(MAX_ASK_AGENTS));
  }

  unique.forEach((agent) => assertKnownAgent(config, agent, "defaults.askAgents", messages));
  return unique;
}

async function runTuiAgentsWizard(
  configPath: string,
  config: PalabreConfig,
  messages: Messages,
  mode: PalabreMode,
  inlineAgents: string[] = []
): Promise<{ notice?: string; quit: boolean; changedRunDefaults: boolean }> {
  try {
    const agentsInput = inlineAgents.length > 0
      ? { kind: "agents" as const, agents: inlineAgents }
      : await promptTuiAgentsWizard(config, mode, messages);
    if (agentsInput.kind === "quit") {
      return { quit: true, changedRunDefaults: false };
    }
    if (agentsInput.kind === "back" || agentsInput.agents.length === 0) {
      return { quit: false, changedRunDefaults: false };
    }

    const notice = applyTuiAgents(config, mode, agentsInput.agents, messages);
    await writeExampleConfig(configPath, config);
    return { notice, quit: false, changedRunDefaults: true };
  } catch (error) {
    return { notice: messages.tui.agentsError(error instanceof Error ? error.message : String(error)), quit: false, changedRunDefaults: false };
  }
}

async function runTuiRolesWizard(
  configPath: string,
  config: PalabreConfig,
  messages: Messages,
  mode: PalabreMode,
  inlineRoles: string[] = []
): Promise<{ notice?: string; quit: boolean }> {
  try {
    const rolesInput = inlineRoles.length > 0
      ? { kind: "roles" as const, roles: inlineRoles }
      : await promptTuiRolesWizard(config, mode, messages);
    if (rolesInput.kind === "quit") {
      return { quit: true };
    }
    if (rolesInput.kind === "back" || rolesInput.roles.length === 0) {
      return { quit: false };
    }
    const notice = applyTuiRoles(config, mode, rolesInput.roles, messages);
    await writeExampleConfig(configPath, config);
    return { notice, quit: false };
  } catch (error) {
    return { notice: messages.tui.rolesError(error instanceof Error ? error.message : String(error)), quit: false };
  }
}

function applyTuiAgents(config: PalabreConfig, mode: PalabreMode, agentNames: string[], messages: Messages): string {
  if (mode === "ask") {
    const agents = normalizeTuiAskAgents(config, agentNames, messages);
    config.defaults = { ...(config.defaults ?? {}), askAgents: agents };
    return messages.tui.askAgentsUpdated(agents.join(", "));
  }

  const [agentA, agentB] = normalizeTuiDebateAgents(config, agentNames, messages);
  config.defaults = { ...(config.defaults ?? {}), agentA, agentB };
  return messages.tui.debateAgentsUpdated(`${agentA} <-> ${agentB}`);
}

function applyTuiRoles(config: PalabreConfig, mode: PalabreMode, roleNames: string[], messages: Messages): string {
  const agents = activeAgentsForMode(config, mode);
  if (agents.length === 0) {
    throw new Error(mode === "ask" ? messages.tui.noAskAgentsConfigured : messages.tui.noDebateAgentsConfigured);
  }

  const roles = normalizeTuiRoles(roleNames, agents, mode, messages);
  agents.forEach((agent, index) => {
    config.agents[agent]!.role = roles[index]!;
  });

  return mode === "ask"
    ? messages.tui.askRolesUpdated(roles.join(", "))
    : messages.tui.debateRolesUpdated(roles.join(" <-> "));
}

function activeAgentsForMode(config: PalabreConfig, mode: PalabreMode): string[] {
  const defaults = config.defaults ?? {};
  if (mode === "ask") {
    if (defaults.askAgents && defaults.askAgents.length > 0) {
      return defaults.askAgents.filter((agent) => Boolean(config.agents[agent]));
    }
    return [defaults.agentA, defaults.agentB].filter((agent): agent is string => Boolean(agent && config.agents[agent]));
  }

  return [defaults.agentA, defaults.agentB].filter((agent): agent is string => Boolean(agent && config.agents[agent]));
}

function normalizeTuiRoles(roleNames: string[], agents: string[], mode: PalabreMode, messages: Messages): AgentRole[] {
  const roles = roleNames.map((role) => role.trim().toLowerCase()).filter(Boolean);
  const expectedCount = agents.length;
  if (roles.length < expectedCount) {
    const agentLabel = mode === "ask"
      ? agents.join(", ")
      : agents.join(" <-> ");
    throw new Error(messages.tui.rolesCountError(roles.length, expectedCount, agentLabel));
  }

  return roles.slice(0, expectedCount).map((role) => {
    if (isAgentRole(role)) {
      return role;
    }
    throw new Error(messages.tui.unknownRole(role, VALID_AGENT_ROLES.join(", ")));
  });
}

function isAgentRole(value: string): value is AgentRole {
  return (VALID_AGENT_ROLES as readonly string[]).includes(value);
}

const VALID_AGENT_ROLES: readonly AgentRole[] = ["implementer", "reviewer", "architect", "scout", "critic", "summarizer"];

async function runOllamaModelsCommand(config: PalabreConfig, json: boolean): Promise<void> {
  const discovery = await discoverLocalToolsForConfig(config);
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

  const discovery = await discoverLocalToolsForConfig(config);
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
  const discovery = await discoverLocalToolsForConfig(config);
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
    defaults.askAgents,
    defaults.interface
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

function parseInterfaceFlag(value: string | undefined, messages: Messages): PalabreInterface {
  if (!value) {
    return "tui";
  }

  if (value === "tui" || value === "terminal") {
    return value;
  }

  throw new Error(messages.common.unknownMode(value, "tui, terminal"));
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
  defaultInterface: PalabreInterface | undefined,
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
        return createAutoRenderer(flags, plainOutputFallback, defaultInterface, messages);
    }
  }
  if (flags.json) {
    return createNdjsonRenderer();
  }
  if (flags.tui) {
    return createTuiRenderer(messages);
  }
  if (flags.terminal || flags.plain || plainOutputFallback || defaultInterface === "terminal") {
    return createConsoleRenderer(true, messages);
  }
  return createAutoRenderer(flags, plainOutputFallback, defaultInterface, messages);
}

function createAutoRenderer(
  flags: Record<string, string | string[] | boolean>,
  plainOutputFallback: boolean,
  defaultInterface: PalabreInterface | undefined,
  messages: Messages
) {
  if (flags.tui) {
    return createTuiRenderer(messages);
  }

  if (flags.terminal || flags.plain || plainOutputFallback || defaultInterface === "terminal") {
    return createConsoleRenderer(true, messages);
  }

  return process.stdout.isTTY ? createTuiRenderer(messages) : createConsoleRenderer(true, messages);
}

function shouldOpenTuiHome(parsed: ParsedArgs): boolean {
  return parsed.command === "run"
    && !parsed.commandExplicit
    && parsed.positionals.length === 0
    && optionalString(parsed.flags.topic) === undefined
    && optionalString(parsed.flags.renderer) === undefined
    && parsed.flags.json !== true
    && parsed.flags.plain !== true
    && parsed.flags.terminal !== true;
}

/** Lance la discovery avec la même adresse Ollama effective que la config et les overrides globaux. */
async function discoverLocalToolsForConfig(
  config: PalabreConfig,
  ollamaUrl?: string
): ReturnType<typeof discoverLocalTools> {
  return discoverLocalTools({
    ollamaUrl,
    ollamaConfigUrl: configuredOllamaBaseUrl(config)
  });
}

/**
 * Exécute la commande `palabre presets` en sortie humaine ou JSON versionné.
 */
async function runPresetsCommand(flags: Record<string, string | string[] | boolean>): Promise<void> {
  const configPath = optionalString(flags.config) ?? await resolveDefaultConfigPath();
  const ollamaUrl = optionalString(flags["ollama-url"]);
  const config = await configExists(configPath)
    ? await loadConfig(configPath)
    : undefined;
  const discovery = config
    ? await discoverLocalToolsForConfig(config, ollamaUrl)
    : await discoverLocalTools({ ollamaUrl });
  const resolvedConfig = config ?? createConfigFromDiscovery(discovery);
  const language = resolveLanguage({
    explicitLanguage: optionalString(flags.language),
    configLanguage: resolvedConfig.language
  });
  const messages = createTranslator(language);
  const presets = listPresetsWithAvailability(resolvedConfig, discovery, messages);

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

async function runHistoryCommand(flags: Record<string, string | string[] | boolean>): Promise<void> {
  const configPath = optionalString(flags.config) ?? await resolveDefaultConfigPath();
  const config = await configExists(configPath)
    ? await loadConfig(configPath)
    : undefined;
  const language = resolveLanguage({
    explicitLanguage: optionalString(flags.language),
    configLanguage: config?.language
  });
  const messages = createTranslator(language);
  const entries = await listHistoryEntries(resolveOutputDir(config?.outputDir));

  if (flags.json) {
    process.stdout.write(JSON.stringify({ v: 1, history: entries }) + "\n");
    return;
  }

  console.log(messages.tui.historyTitle);
  console.log("");

  if (entries.length === 0) {
    console.log(messages.tui.historyEmpty);
    return;
  }

  for (const entry of entries) {
    console.log(`- ${entry.date || entry.fileName} | ${entry.mode} | ${entry.topic}`);
    console.log(`  ${entry.path}`);
  }
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
  const entries = Object.entries(config.agents)
    .filter(([name]) => !isRetiredAgentName(name))
    .sort(([left], [right]) => left.localeCompare(right));

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
  console.log(`- Antigravity CLI: ${formatCommandDetection(discovery.antigravity, messages)}`);
  console.log(`- OpenCode CLI: ${formatCommandDetection(discovery.opencode, messages)}`);
  console.log(`- Mistral Vibe CLI: ${formatCommandDetection(discovery.vibe, messages)}`);
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
