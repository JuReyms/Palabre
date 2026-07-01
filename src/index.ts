#!/usr/bin/env node
/**
 * @file Point d'entrée CLI de Palabre : parsing des arguments, dispatch vers les
 * commandes leaf (`agents`, `presets`, `history`, `context`, `update`, `init`, `config`),
 * résolution de la config/langue, boucle TUI d'accueil et lancement d'un débat ou d'une
 * requête `ask` via l'orchestrateur.
 */
import { assertRunnableConfig, configExists, createConfigFromDiscovery, loadConfig, resolveDefaultConfigPath, resolveOutputDir, setOllamaModel, syncDetectedAgentsDetailed, syncOllamaModel, writeExampleConfig } from "./config.js";
import { loadProjectInputs } from "./context.js";
import { discoverLocalTools, discoverLocalToolsForConfig } from "./discovery.js";
import { runDoctor } from "./doctor.js";
import { AdapterError, formatAdapterError } from "./errors.js";
import { runConfigWizard } from "./configWizard.js";
import { createTranslator, DEFAULT_LANGUAGE, parseLanguage, resolveLanguage } from "./i18n.js";
import { DEFAULT_TURNS, parseTurnsFlag, turnsOrDefault } from "./limits.js";
import { formatAgentPrompt } from "./prompt.js";
import { runNewWizard } from "./new.js";
import { listPresetNames, resolvePreset } from "./presets.js";
import { listHistoryEntries } from "./history.js";
import { createConsoleRenderer } from "./renderers/console.js";
import { createNdjsonRenderer } from "./renderers/ndjson.js";
import { createTuiRenderer, promptTuiHomeTopic, renderTuiHelp, renderTuiHistory, renderTuiHome, renderTuiUpdate, type TuiHomeInput } from "./renderers/tui.js";
import { MAX_ASK_AGENTS, runAsk, runDebate } from "./orchestrator.js";
import { writeDebateMarkdown } from "./output.js";
import { formatUpdateInstructions, getUpdateInfo } from "./update.js";
import { getStringListFlag, parseArgs, type ParsedArgs } from "./args.js";
import { clearTuiRunOverrides } from "./tuiState.js";
import { formatOllamaUrlError, OllamaUrlError } from "./ollamaUrl.js";
import { compareSemver, getLatestPackageVersion, getPackageVersion } from "./version.js";
import type { DebateOptions, PalabreConfig, PalabreInterface } from "./types.js";
import type { Messages } from "./messages/index.js";
import { runAgentsCommand } from "./commands/agents.js";
import { runContextCommand } from "./commands/context.js";
import { runHistoryCommand } from "./commands/history.js";
import { runInitCommand } from "./commands/init.js";
import { runPresetsCommand } from "./commands/presets.js";
import { runUpdateCommand } from "./commands/update.js";
import { optionalString } from "./commands/shared.js";
import { runTuiAgentsWizard, runTuiConfigLoop, runTuiRolesWizard, syncInteractiveDetectedAgents } from "./tuiController.js";
import { parseInterfaceFlag, parseModeFlag, resolveRunOptions } from "./runOptions.js";

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
    await runUpdateCommand(parsed.flags);
    return;
  }

  if (parsed.command === "init" || parsed.command === "setup") {
    await runInitCommand(parsed.flags);
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
  let tuiLatestVersion: string | undefined;

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

    if (tuiInput.kind === "update") {
      const info = await getUpdateInfo(tuiVersion);
      renderTuiUpdate(formatUpdateInstructions(info, messages), messages);
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
    const [syncResult, currentVersion, latestVersion] = await Promise.all([
      syncInteractiveDetectedAgents(configPath, config),
      getPackageVersion(),
      getLatestPackageVersion()
    ]);
    if (!tuiNotice && syncResult.addedAgents.length > 0) {
      tuiNotice = messages.config.syncAdded(configPath, syncResult.addedAgents.join(", "));
    }

    stayInTuiAfterSession = true;
    tuiVersion = currentVersion;
    tuiLatestVersion = latestVersion && compareSemver(currentVersion, latestVersion) < 0
      ? latestVersion
      : undefined;

    for (;;) {
      renderTuiHome(config, configPath, messages, { mode: tuiMode, version: tuiVersion, latestVersion: tuiLatestVersion });
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

    const options = resolveRunOptions({
      flags: parsed.flags,
      config,
      language,
      topic,
      files: context.files,
      preset,
      signal: debateAbortSignal()
    }, messages);
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

    tuiMode = options.mode;
    for (;;) {
      const nextInput = await promptTuiHomeTopic(tuiMode, messages, { notice: tuiNotice });
      tuiNotice = undefined;
      const action = await handleTuiHomeInput(nextInput);
      if (action === "quit") return;
      if (action === "continue") {
        renderTuiHome(config, configPath, messages, { mode: tuiMode, version: tuiVersion, latestVersion: tuiLatestVersion });
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

/** Construit un signal d'annulation déclenché sur `SIGINT`/`SIGTERM` pour interrompre un débat en cours. */
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

/**
 * Affiche l'état de l'agent Ollama local (modèle courant, disponibilité de l'API, modèles installés).
 * @param config - Config chargée.
 * @param json - Si `true`, affiche le résultat en JSON plutôt qu'en texte lisible.
 */
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

/**
 * Change le modèle configuré pour l'agent `ollama-local` après vérification qu'il est bien installé.
 * @param configPath - Chemin du fichier de config à mettre à jour.
 * @param config - Config chargée.
 * @param model - Nom du modèle Ollama à définir.
 */
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

/**
 * Aligne automatiquement le modèle de l'agent `ollama-local` sur un modèle réellement installé.
 * @param configPath - Chemin du fichier de config à mettre à jour.
 * @param config - Config chargée.
 */
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

/**
 * Déduplique et valide une liste d'agents `ask` fournie via `--ask-agents`.
 * @param agents - Noms d'agents bruts, éventuellement en doublon.
 * @throws Si la liste dépasse `MAX_ASK_AGENTS` ou référence un agent inconnu de la config.
 */
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
  console.log(messages.preview.summary(options.summaryEnabled ? options.summaryAgent : messages.preview.disabled));
  console.log(messages.preview.interfaceLanguage(language));
  console.log("");
  console.log(prompt);
  console.log("");
  console.log(options.mode === "ask" ? messages.preview.askNote : messages.preview.note);
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
  return createAutoRenderer(flags, plainOutputFallback, defaultInterface, messages);
}

/**
 * Choix du renderer par défaut (`--renderer auto`) : TUI si les flags/config le demandent
 * ou si stdout est un TTY, rendu console plain sinon.
 */
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

/**
 * Détermine si l'accueil TUI doit s'ouvrir : commande `run` implicite, sans sujet, preset
 * ni flag de rendu déjà fourni. Toute intention explicite de lancer directement un débat
 * (topic, `--renderer`, `--json`, `--plain`, `--terminal`) désactive l'accueil.
 */
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

/**
 * Écrit les avertissements de contexte sur `stderr`.
 * @param warnings - Messages d'avertissement issus du chargement des fichiers de contexte.
 */
function printContextWarnings(warnings: string[], messages: Messages): void {
  for (const warning of warnings) {
    process.stderr.write(`${messages.renderers.warningPrefix} ${warning}\n`);
  }
}


/** Affiche le texte d'aide complet sur `stdout`. */
function printHelp(messages: Messages, command?: string): void {
  const commandHelp = command ? messages.help.renderCommand(command) : undefined;
  console.log(commandHelp ?? messages.help.render(listPresetNames().join(", ")));
}

/**
 * Résout la commande cible pour l'aide contextuelle (`palabre <cmd> --help`), en normalisant
 * les alias (`agent` -> `agents`, `preset` -> `presets`, `setup` -> `init`).
 * @returns `undefined` pour `help`/`run`, qui utilisent l'aide générale.
 */
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

/**
 * Formate une erreur non gérée remontée jusqu'au point d'entrée en message lisible,
 * en spécialisant `AdapterError` et `OllamaUrlError` pour rester actionnable.
 */
function formatRuntimeError(error: unknown, messages: Messages): string {
  if (error instanceof AdapterError) {
    return formatAdapterError(error, messages);
  }
  if (error instanceof OllamaUrlError) {
    return formatOllamaUrlError(error, messages);
  }
  return error instanceof Error ? error.message : String(error);
}

main().catch((error: unknown) => {
  const language = safeStartupLanguage(process.argv.slice(2));
  const messages = createTranslator(language);
  const message = formatRuntimeError(error, messages);
  console.error(`${messages.common.errorPrefix}: ${message}`);
  process.exitCode = 1;
});

/**
 * Variante de `findRawLanguageFlag` + `resolveLanguage` qui ne peut pas lever, utilisée dans
 * le gestionnaire d'erreur global où la config n'est pas forcément chargée.
 */
function safeStartupLanguage(args: string[]) {
  try {
    return resolveLanguage({ explicitLanguage: findRawLanguageFlag(args) });
  } catch {
    return DEFAULT_LANGUAGE;
  }
}
