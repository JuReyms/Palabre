/** @file Assistant interactif `palabre new` : compose les mêmes flags qu'un lancement direct, sans second chemin d'exécution. */
import { stdin as input, stdout as output } from "node:process";
import { activeConfiguredAgentEntries, isAgentDetected, normalizeCommandName } from "./agentRegistry.js";
import { discoverLocalTools, type ToolDiscovery } from "./discovery.js";
import { findPresetNameForPair } from "./presets.js";
import { MAX_TURNS, turnsOrDefault, validateTurns } from "./limits.js";
import type { AgentConfig, PalabreConfig, PalabreMode } from "./types.js";
import type { Messages } from "./messages/index.js";
import { bold, brandHeader, clearScreen, dim, glyphs, padBlock, supportsInteractiveOutput, surfacePadding } from "./renderers/tui-theme.js";
import { closeComposerReadline, getComposerReadline, questionWithBufferedComposer, type TuiCompletionChoice } from "./renderers/tui-prompts.js";
import { sanitizeTerminalText } from "./adapters/terminal.js";

const interruptedAnswer = "\u0000palabre-interrupted";

/**
 * Paramètres collectés par le wizard `palabre new`.
 * Structurellement identique aux flags CLI : le wizard ne crée pas un second chemin d'exécution.
 */
export interface NewCommandSelection {
  mode?: PalabreMode;
  agentA: string;
  agentB: string;
  askAgents?: string[];
  topic: string;
  modelA?: string;
  modelB?: string;
  turns?: number;
  summaryAgent?: string;
  summaryModel?: string;
  summaryEnabled?: boolean;
  files: string[];
  context: string[];
  showPrompt: boolean;
  plainOutput: boolean;
}

interface AgentChoice {
  name: string;
  config: AgentConfig;
  detected: boolean;
  status: string;
}

interface Questioner {
  question(prompt: string): Promise<string>;
  choose(prompt: string, choices: readonly TuiCompletionChoice[], defaultValue?: string): Promise<string>;
  close(): void;
}

/**
 * Lance le wizard interactif `palabre new`.
 * Détecte les outils locaux, liste les agents de la config et guide la composition du débat.
 * Retourne `undefined` si l'utilisateur annule (q/quit/exit ou Ctrl+C).
 */
export async function runNewWizard(
  config: PalabreConfig,
  messages: Messages,
  options: { keepReaderOnInterrupt?: boolean } = {}
): Promise<NewCommandSelection | undefined> {
  const discovery = await discoverLocalTools();
  const choices = buildAgentChoices(config, discovery, messages);

  if (choices.length < 1) {
    throw new Error(messages.new.needsOneAgent);
  }

  const rl = await createQuestioner(messages, options.keepReaderOnInterrupt ?? false);

  try {
    renderWizardIntro(messages);

    const mode = await askMode(rl, config.defaults?.mode ?? "debate", messages);
    if (!mode) return undefined;

    let selection: NewCommandSelection;

    if (mode === "chat") {
      const agentA = await askAgent(rl, choices, messages.new.agentA, config.defaults?.agentA, messages);
      if (!agentA) return undefined;

      const topic = await askRequiredText(rl, messages.new.topic, messages);
      if (!topic) return undefined;

      selection = {
        mode,
        agentA,
        agentB: agentA,
        topic,
        files: [],
        context: [],
        showPrompt: false,
        plainOutput: false
      };
    } else if (mode === "ask") {
      const askAgents = await askAgentList(rl, choices, config.defaults?.askAgents ?? defaultAskAgents(config), messages);
      if (!askAgents) return undefined;

      const [agentA, agentB] = [askAgents[0], askAgents[1] ?? askAgents[0]];
      if (!agentA || !agentB) return undefined;

      const topic = await askRequiredText(rl, messages.new.topic, messages);
      if (!topic) return undefined;

      selection = {
        mode,
        agentA,
        agentB,
        askAgents,
        topic,
        files: [],
        context: [],
        showPrompt: false,
        plainOutput: false
      };
    } else {
      if (choices.length < 2) {
        throw new Error(messages.new.needsTwoAgents);
      }

      const agentA = await askAgent(rl, choices, messages.new.agentA, config.defaults?.agentA, messages);
      if (!agentA) return undefined;

      const agentB = await askAgent(rl, choices.filter((choice) => choice.name !== agentA), messages.new.agentB, config.defaults?.agentB === agentA ? undefined : config.defaults?.agentB, messages);
      if (!agentB) return undefined;

      const topic = await askRequiredText(rl, messages.new.topic, messages);
      if (!topic) return undefined;

      selection = {
        mode,
        agentA,
        agentB,
        topic,
        turns: turnsOrDefault(config.defaults?.turns),
        files: [],
        context: [],
        showPrompt: false,
        plainOutput: false
      };
    }

    for (;;) {
      renderSessionSummary(selection, config, messages);
      const action = await askSessionAction(rl, mode, messages);
      if (!action || action === "cancel") return undefined;
      if (action === "launch") {
        printCommandPreview(selection, messages);
        return selection;
      }

      const customized = await personalizeSelection(rl, selection, choices, config, messages);
      if (!customized) return undefined;
      selection = customized;
    }
  } finally {
    rl.close();
  }
}

type SessionAction = "launch" | "customize" | "cancel";

async function askSessionAction(
  rl: Questioner,
  mode: PalabreMode,
  messages: Messages
): Promise<SessionAction | undefined> {
  const choices = [
    { value: messages.new.launchSession(mode), action: "launch" as const },
    { value: messages.new.customize, action: "customize" as const },
    { value: messages.new.cancel, action: "cancel" as const }
  ];

  while (true) {
    const answer = await rl.choose(messages.new.sessionAction, choices, choices[0]!.value);
    const value = answer.trim();
    if (isQuit(value)) return undefined;
    if (!value) return "launch";

    const number = Number(value);
    if (Number.isInteger(number) && number >= 1 && number <= choices.length) {
      return choices[number - 1]?.action;
    }

    const selected = choices.find((choice) => choice.value.toLowerCase() === value.toLowerCase());
    if (selected) return selected.action;
    console.log(messages.new.invalidSessionAction);
  }
}

async function personalizeSelection(
  rl: Questioner,
  selection: NewCommandSelection,
  choices: AgentChoice[],
  config: PalabreConfig,
  messages: Messages
): Promise<NewCommandSelection | undefined> {
  const mode = selection.mode ?? "debate";
  let turns = selection.turns;
  let modelA: string | undefined;
  let modelB: string | undefined;
  let summaryEnabled = selection.summaryEnabled;
  let summaryAgent = selection.summaryAgent;
  let summaryModel: string | undefined;

  if (mode === "debate") {
    turns = await askNumber(rl, messages.new.turns(MAX_TURNS), selection.turns ?? turnsOrDefault(config.defaults?.turns), messages);
    if (turns === undefined) return undefined;
  }

  if (mode === "chat" || mode === "debate") {
    const changeModels = await askYesNo(
      rl,
      mode === "chat" ? messages.new.changeModel : messages.new.changeModels,
      Boolean(selection.modelA || selection.modelB),
      messages
    );
    if (changeModels === undefined) return undefined;
    if (changeModels) {
      modelA = await askOptionalText(rl, modelPrompt(messages, selection.agentA, config));
      if (modelA === undefined) return undefined;
      if (mode === "debate") {
        modelB = await askOptionalText(rl, modelPrompt(messages, selection.agentB, config));
        if (modelB === undefined) return undefined;
      }
    }
  }

  if (mode !== "chat") {
    summaryEnabled = await askYesNo(rl, messages.new.summaryEnabled, selection.summaryEnabled ?? true, messages);
    if (summaryEnabled === undefined) return undefined;
    if (summaryEnabled) {
      const defaultSummaryAgent = selection.summaryAgent ?? resolveDefaultSummaryAgent(selection, config);
      summaryAgent = await askAgent(rl, choices, messages.new.summaryAgent, defaultSummaryAgent, messages);
      if (!summaryAgent) return undefined;

      const changeSummaryModel = await askYesNo(
        rl,
        messages.new.changeSummaryModel,
        Boolean(selection.summaryModel),
        messages
      );
      if (changeSummaryModel === undefined) return undefined;
      if (changeSummaryModel) {
        summaryModel = await askOptionalText(rl, summaryModelPrompt(messages, summaryAgent, config));
        if (summaryModel === undefined) return undefined;
      }
    } else {
      summaryAgent = undefined;
    }
  }

  const contextSelection = await askContextSelection(rl, selection, messages);
  if (!contextSelection) return undefined;

  let showPrompt = selection.showPrompt;
  if (mode !== "chat") {
    const previewPrompt = await askYesNo(rl, messages.new.showPrompt, selection.showPrompt, messages);
    if (previewPrompt === undefined) return undefined;
    showPrompt = previewPrompt;
  }

  return {
    ...selection,
    turns,
    modelA,
    modelB,
    summaryEnabled,
    summaryAgent,
    summaryModel,
    context: contextSelection.context,
    files: contextSelection.files,
    showPrompt,
    plainOutput: false
  };
}

async function askContextSelection(
  rl: Questioner,
  selection: NewCommandSelection,
  messages: Messages
): Promise<{ context: string[]; files: string[] } | undefined> {
  const choices = [
    { value: messages.new.contextNone, kind: "none" as const },
    { value: messages.new.contextFlexible, kind: "context" as const },
    { value: messages.new.contextStrict, kind: "files" as const }
  ];
  const defaultKind = selection.files.length > 0 ? "files" : selection.context.length > 0 ? "context" : "none";
  const defaultValue = choices.find((choice) => choice.kind === defaultKind)!.value;

  while (true) {
    const answer = await rl.choose(messages.new.contextChoice, choices, defaultValue);
    const value = answer.trim();
    if (isQuit(value)) return undefined;

    const number = Number(value);
    const selected = !value
      ? choices.find((choice) => choice.kind === defaultKind)
      : Number.isInteger(number) && number >= 1 && number <= choices.length
        ? choices[number - 1]
        : choices.find((choice) => choice.value.toLowerCase() === value.toLowerCase());

    if (!selected) {
      console.log(messages.new.invalidContextChoice);
      continue;
    }
    if (selected.kind === "none") return { context: [], files: [] };

    const label = selected.kind === "context" ? messages.new.contextPaths : messages.new.filesPaths;
    const rawPaths = await askOptionalText(rl, label);
    if (rawPaths === undefined) return undefined;
    const paths = splitPaths(rawPaths);
    return selected.kind === "context" ? { context: paths, files: [] } : { context: [], files: paths };
  }
}

function renderSessionSummary(selection: NewCommandSelection, config: PalabreConfig, messages: Messages): void {
  const mode = selection.mode ?? "debate";
  const agents = mode === "chat"
    ? selection.agentA
    : mode === "ask"
      ? (selection.askAgents ?? [selection.agentA, selection.agentB]).join(", ")
      : `${selection.agentA} ↔ ${selection.agentB}`;
  const summaryAgent = resolveDisplayedSummaryAgent(selection, config, messages);
  const modelValues = [
    selection.modelA ? `${selection.agentA}: ${selection.modelA}` : undefined,
    mode === "debate" && selection.modelB ? `${selection.agentB}: ${selection.modelB}` : undefined
  ].filter(Boolean).join(" · ") || messages.new.sessionDefaultModels;
  const contextValue = selection.context.length > 0
    ? selection.context.join(", ")
    : selection.files.length > 0
      ? selection.files.join(", ")
      : messages.new.contextNone;
  const rows = [
    summaryRow(messages.new.sessionMode, mode === "chat" ? "Chat" : mode === "ask" ? "Ask" : "Débat"),
    summaryRow(messages.new.sessionAgents, agents),
    summaryRow(messages.new.sessionTopic, selection.topic),
    ...(mode === "debate" ? [summaryRow(messages.new.sessionResponses, String(selection.turns ?? turnsOrDefault(config.defaults?.turns)))] : []),
    summaryRow(messages.new.sessionModels, modelValues),
    ...(mode === "chat" ? [] : [summaryRow(messages.new.sessionSummary, summaryAgent)]),
    summaryRow(messages.new.sessionContext, contextValue)
  ];

  console.log("");
  console.log(padBlock([bold(messages.new.session), ...rows]).join("\n"));
  console.log("");
}

function summaryRow(label: string, value: string): string {
  return `  ${label.padEnd(11)}${sanitizeTerminalText(value)}`;
}

function resolveDisplayedSummaryAgent(selection: NewCommandSelection, config: PalabreConfig, messages: Messages): string {
  if (selection.summaryEnabled === false) return messages.new.sessionNoSummary;
  return selection.summaryAgent ?? resolveDefaultSummaryAgent(selection, config) ?? messages.new.sessionNoSummary;
}

function resolveDefaultSummaryAgent(selection: NewCommandSelection, config: PalabreConfig): string | undefined {
  if (selection.mode === "ask") {
    return config.defaults?.askSummaryAgent
      ?? config.defaults?.summaryAgent
      ?? selection.askAgents?.[selection.askAgents.length - 1]
      ?? selection.agentB;
  }
  return config.defaults?.summaryAgent ?? selection.agentB;
}

async function askMode(
  rl: Questioner,
  defaultMode: PalabreMode,
  messages: Messages
): Promise<PalabreMode | undefined> {
  const choices: Array<TuiCompletionChoice & { value: PalabreMode }> = [
    { value: "chat", description: messages.new.modeChat },
    { value: "debate", description: messages.new.modeDebate },
    { value: "ask", description: messages.new.modeAsk }
  ];
  const fallback = choices.find((choice) => choice.value === defaultMode)?.value ?? "debate";

  while (true) {
    const answer = await rl.choose(messages.new.mode, choices, fallback);
    const value = answer.trim().toLowerCase();

    if (isQuit(value)) return undefined;
    if (!value) return fallback;

    const number = Number(value);
    if (Number.isInteger(number) && number >= 1 && number <= choices.length) {
      return choices[number - 1]?.value;
    }

    if (value === "chat" || value === "conversation") return "chat";
    if (value === "debate" || value === "débat" || value === "debat") return "debate";
    if (value === "ask" || value === "demande" || value === "question") return "ask";

    console.log(messages.new.invalidModeChoice);
  }
}

async function createQuestioner(messages: Messages, keepReaderOnInterrupt: boolean): Promise<Questioner> {
  if (input.isTTY) {
    const rl = getComposerReadline();
    let interrupted = false;
    const ask = async (
      prompt: string,
      choices?: readonly TuiCompletionChoice[],
      defaultValue?: string
    ): Promise<string> => {
      const linePrompt = `${surfacePadding()}${glyphs().prompt} `;
      const result = await questionWithBufferedComposer(
        rl,
        `\n${surfacePadding()}${bold(prompt)}\n${linePrompt}`,
        linePrompt,
        0,
        { input, output },
        "navigation",
        undefined,
        messages.tui,
        choices ? { choices, defaultValue, showOnEmpty: true } : undefined
      );
      interrupted = result.kind !== "answer";
      return result.kind === "answer" ? result.value : interruptedAnswer;
    };
    return {
      question: (prompt) => ask(prompt),
      choose: (prompt, choices, defaultValue) => ask(prompt, choices, defaultValue),
      close(): void {
        if (!interrupted || !keepReaderOnInterrupt) closeComposerReadline();
      }
    };
  }

  const lines = await readPipedLines();
  let index = 0;
  const question = async (prompt: string): Promise<string> => {
    output.write(prompt);
    const value = lines[index];
    index += 1;
    output.write(`${value ?? "q"}\n`);
    return value ?? "q";
  };

  return {
    question,
    async choose(prompt: string, choices: readonly TuiCompletionChoice[], defaultValue?: string): Promise<string> {
      output.write(`${prompt}\n`);
      choices.forEach((choice, choiceIndex) => {
        const marker = choice.value === defaultValue ? "(*)" : "   ";
        output.write(`  ${choiceIndex + 1}) ${marker} ${choice.value}${choice.description ? ` - ${choice.description}` : ""}\n`);
      });
      return question(`${prompt}${defaultValue ? ` [${defaultValue}]` : ""}: `);
    },
    close(): void {
      // Nothing to close for scripted stdin.
    }
  };
}

async function readPipedLines(): Promise<string[]> {
  let raw = "";

  for await (const chunk of input) {
    raw += Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk);
  }

  return raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
}

function buildAgentChoices(config: PalabreConfig, discovery: ToolDiscovery, messages: Messages): AgentChoice[] {
  return activeConfiguredAgentEntries(config)
    .map(([name, agentConfig]) => {
      const detected = isAgentDetected(name, agentConfig, discovery);
      return {
        name,
        config: agentConfig,
        detected,
        status: agentStatus(name, agentConfig, discovery, detected, messages)
      };
    })
    .sort((left, right) => Number(right.detected) - Number(left.detected) || left.name.localeCompare(right.name));
}

function agentStatus(_name: string, config: AgentConfig, discovery: ToolDiscovery, detected: boolean, messages: Messages): string {
  if (config.type === "ollama") {
    return detected
      ? messages.new.detectedOllama(config.role, discovery.ollama.models.length)
      : messages.new.ollamaUnreachable(config.role);
  }

  return detected
    ? messages.new.detectedCli(config.role)
    : messages.new.missingCli(config.role);
}

function modelPrompt(messages: Messages, agentName: string, config: PalabreConfig): string {
  return messages.new.modelFor(agentName, modelIdentifierFormat(config.agents[agentName]));
}

function summaryModelPrompt(messages: Messages, agentName: string, config: PalabreConfig): string {
  return messages.new.summaryModelFor(agentName, modelIdentifierFormat(config.agents[agentName]));
}

function modelIdentifierFormat(config: AgentConfig | undefined): string | undefined {
  if ((config?.type === "cli" || config?.type === "cli-pty") && normalizeCommandName(config.command) === "opencode") {
    return "provider/model";
  }
  return undefined;
}

async function askAgent(
  rl: Questioner,
  choices: AgentChoice[],
  label: string,
  defaultName: string | undefined,
  messages: Messages
): Promise<string | undefined> {
  const fallback = choices.find((choice) => choice.name === defaultName)?.name ?? choices[0]?.name;
  const completionChoices = choices.map((choice) => ({ value: choice.name, description: choice.status }));

  while (true) {
    const answer = await rl.choose(label, completionChoices, fallback);
    const value = answer.trim();

    if (isQuit(value)) return undefined;
    if (!value) return fallback;

    const number = Number(value);
    if (Number.isInteger(number) && number >= 1 && number <= choices.length) {
      return choices[number - 1]?.name;
    }

    if (choices.some((choice) => choice.name === value)) {
      return value;
    }

    console.log(messages.new.invalidAgentChoice);
  }
}

async function askAgentList(
  rl: Questioner,
  choices: AgentChoice[],
  defaultNames: string[],
  messages: Messages
): Promise<string[] | undefined> {
  const availableNames = choices.map((choice) => choice.name);
  const fallback = uniqueNames(defaultNames.filter((name) => availableNames.includes(name))).slice(0, 4);
  const defaultSelection = fallback.length > 0 ? fallback : availableNames.slice(0, Math.min(2, availableNames.length));

  console.log(messages.new.askAgents);
  choices.forEach((choice, index) => {
    const marker = defaultSelection.includes(choice.name) ? "(*)" : "   ";
    console.log(`  ${index + 1}) ${marker} ${choice.name} - ${choice.status}`);
  });

  while (true) {
    const answer = await rl.question(`${messages.new.askAgentsPrompt(defaultSelection.join(" "))}: `);
    const value = answer.trim();

    if (isQuit(value)) return undefined;
    if (!value) return defaultSelection;

    const tokens = value.split(/[,\s]+/).map((token) => token.trim()).filter(Boolean);
    const resolved = uniqueNames(tokens.map((token) => {
      const number = Number(token);
      if (Number.isInteger(number) && number >= 1 && number <= choices.length) {
        return choices[number - 1]?.name;
      }
      return token;
    }).filter((name): name is string => Boolean(name)));

    if (resolved.length === 0) {
      console.log(messages.new.invalidAskAgentsChoice);
      continue;
    }

    if (resolved.length > 4) {
      console.log(messages.common.tooManyAskAgents(4));
      continue;
    }

    if (resolved.every((name) => availableNames.includes(name))) {
      return resolved;
    }

    console.log(messages.new.invalidAskAgentsChoice);
  }
}

async function askRequiredText(rl: Questioner, label: string, messages: Messages): Promise<string | undefined> {
  while (true) {
    const answer = await rl.question(`${label}: `);
    const value = answer.trim();

    if (isQuit(value)) return undefined;
    if (value) return value;

    console.log(messages.new.requiredField);
  }
}

async function askOptionalText(rl: Questioner, label: string): Promise<string | undefined> {
  const answer = await rl.question(`${label}: `);
  const value = answer.trim();
  return isQuit(value) ? undefined : value;
}

async function askNumber(
  rl: Questioner,
  label: string,
  defaultValue: number,
  messages: Messages
): Promise<number | undefined> {
  while (true) {
    const answer = await rl.question(`${label} [${defaultValue}]: `);
    const value = answer.trim();

    if (isQuit(value)) return undefined;
    if (!value) return defaultValue;

    const parsed = Number(value);
    if (Number.isInteger(parsed)) {
      try {
        validateTurns(parsed, messages.new.turnsValidationLabel, messages);
        return parsed;
      } catch {
        // Show the user-facing wizard hint below.
      }
    }

    console.log(messages.new.invalidTurns(MAX_TURNS));
  }
}

async function askYesNo(
  rl: Questioner,
  label: string,
  defaultValue: boolean,
  messages: Messages
): Promise<boolean | undefined> {
  const suffix = messages.new.yesNoSuffix(defaultValue);
  const choices = [
    { value: messages.new.choiceYes },
    { value: messages.new.choiceNo }
  ];
  const defaultChoice = defaultValue ? messages.new.choiceYes : messages.new.choiceNo;

  while (true) {
    const answer = supportsInteractiveOutput
      ? await rl.choose(label, choices, defaultChoice)
      : await rl.question(`${label} [${suffix}]: `);
    const value = answer.trim().toLowerCase();

    if (isQuit(value)) return undefined;
    if (!value) return defaultValue;
    if (["y", "yes", "o", "oui"].includes(value)) return true;
    if (["n", "no", "non"].includes(value)) return false;

    console.log(messages.new.invalidYesNo);
  }
}

function splitPaths(value: string | undefined): string[] {
  return value
    ?.split(/\s+/)
    .map((entry) => entry.trim())
    .filter(Boolean) ?? [];
}

function defaultAskAgents(config: PalabreConfig): string[] {
  return [config.defaults?.agentA, config.defaults?.agentB].filter((agent): agent is string => Boolean(agent));
}

function uniqueNames(names: string[]): string[] {
  return names.filter((name, index) => names.indexOf(name) === index);
}

function isQuit(value: string): boolean {
  return value === interruptedAnswer || ["q", "quit", "exit"].includes(value.toLowerCase());
}

function renderWizardIntro(messages: Messages): void {
  if (!supportsInteractiveOutput) {
    console.log(messages.new.title);
    console.log(messages.new.quitHint);
    console.log(messages.new.defaultHint);
    console.log("");
    return;
  }

  clearScreen();
  console.log("");
  console.log(padBlock([brandHeader(messages.new.title)]).join("\n"));
  console.log("");
  console.log(padBlock([
    dim(messages.new.quitHint),
    dim(messages.new.defaultHint)
  ].filter(Boolean)).join("\n"));
  console.log("");
}

function printCommandPreview(selection: Partial<NewCommandSelection> & Pick<NewCommandSelection, "agentA" | "agentB" | "topic">, messages: Messages): void {
  const explicitCommand = buildExplicitCommand(selection);
  const shortCommand = buildShortCommand(selection);

  console.log("");
  console.log(messages.new.equivalentCommands);
  console.log(`  ${explicitCommand}`);

  if (shortCommand) {
    console.log(`  ${shortCommand}`);
  }

  console.log("");
}

export function buildExplicitCommand(selection: Partial<NewCommandSelection> & Pick<NewCommandSelection, "agentA" | "agentB" | "topic">): string {
  const args = ["palabre"];

  if (selection.mode === "chat") {
    args.push("chat", quoteShellArg(selection.topic), "--agent-a", selection.agentA);
  } else if (selection.mode === "ask") {
    args.push("ask", quoteShellArg(selection.topic));
    const askAgents = selection.askAgents && selection.askAgents.length > 0 ? selection.askAgents : [selection.agentA, selection.agentB];
    args.push("--agents", ...askAgents);
  } else {
    args.push("--agent-a", selection.agentA);
    args.push("--agent-b", selection.agentB);
    args.push(quoteShellArg(selection.topic));
  }

  appendOptionalArgs(args, selection);

  return args.join(" ");
}

function buildShortCommand(selection: Partial<NewCommandSelection> & Pick<NewCommandSelection, "agentA" | "agentB" | "topic">): string | undefined {
  if (selection.mode === "ask" || selection.mode === "chat") {
    return undefined;
  }

  const presetName = findPresetNameForPair(selection.agentA, selection.agentB);

  if (!presetName) {
    return undefined;
  }

  const args = ["palabre", presetName, quoteShellArg(selection.topic)];
  appendOptionalArgs(args, selection);
  return args.join(" ");
}

function appendOptionalArgs(args: string[], selection: Partial<NewCommandSelection>): void {
  if (selection.turns) args.push("-t", String(selection.turns));
  if (selection.modelA) args.push("--model-a", quoteShellArg(selection.modelA));
  if (selection.modelB) args.push("--model-b", quoteShellArg(selection.modelB));
  if (selection.summaryEnabled === false) args.push("--no-summary");
  if (selection.summaryAgent) args.push("--summary-agent", selection.summaryAgent);
  if (selection.summaryModel) args.push("--summary-model", quoteShellArg(selection.summaryModel));
  if (selection.context && selection.context.length > 0) args.push("--context", ...selection.context.map(quoteShellArg));
  if (selection.files && selection.files.length > 0) args.push("--files", ...selection.files.map(quoteShellArg));
  if (selection.showPrompt) args.push("--show-prompt");
  if (selection.plainOutput) args.push("--terminal");
}

function quoteShellArg(value: string): string {
  if (/^[A-Za-z0-9._/:\\-]+$/.test(value)) {
    return value;
  }

  return `"${value.replace(/(["`$\\])/g, "\\$1")}"`;
}
