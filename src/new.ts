/** @file Assistant interactif `palabre new` : compose les mêmes flags qu'un lancement direct, sans second chemin d'exécution. */
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { isAgentDetected } from "./agentRegistry.js";
import { discoverLocalTools, type ToolDiscovery } from "./discovery.js";
import { findPresetNameForPair } from "./presets.js";
import { MAX_TURNS, turnsOrDefault, validateTurns } from "./limits.js";
import type { AgentConfig, PalabreConfig, PalabreMode } from "./types.js";
import type { Messages } from "./messages/index.js";
import { accent, bold, brandHeader, card, clearScreen, dim, padBlock, supportsInteractiveOutput, surfaceWidth } from "./renderers/tui-theme.js";

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
  close(): void;
}

/**
 * Lance le wizard interactif `palabre new`.
 * Détecte les outils locaux, liste les agents de la config et guide la composition du débat.
 * Retourne `undefined` si l'utilisateur annule (q/quit/exit ou Ctrl+C).
 */
export async function runNewWizard(config: PalabreConfig, messages: Messages): Promise<NewCommandSelection | undefined> {
  const discovery = await discoverLocalTools();
  const choices = buildAgentChoices(config, discovery, messages);

  if (choices.length < 2) {
    throw new Error(messages.new.needsTwoAgents);
  }

  const rl = await createQuestioner();

  try {
    renderWizardIntro(messages);

    const mode = await askMode(rl, config.defaults?.mode ?? "debate", messages);
    if (!mode) return undefined;

    if (mode === "ask") {
      const askAgents = await askAgentList(rl, choices, config.defaults?.askAgents ?? defaultAskAgents(config), messages);
      if (!askAgents) return undefined;

      const [agentA, agentB] = [askAgents[0], askAgents[1] ?? askAgents[0]];
      if (!agentA || !agentB) return undefined;

      const topic = await askRequiredText(rl, messages.new.topic, messages);
      if (!topic) return undefined;

      printCommandPreview({ mode, agentA, agentB, askAgents, topic }, messages);
      console.log(messages.new.advancedHint);
      const launchMinimal = await askYesNo(rl, messages.new.launchMinimal, true, messages);
      if (launchMinimal === undefined) return undefined;

      if (launchMinimal) {
        return {
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
      }

      const summaryEnabled = await askYesNo(rl, messages.new.summaryEnabled, true, messages);
      if (summaryEnabled === undefined) return undefined;

      let summaryAgent: string | undefined;
      let summaryModel: string | undefined;
      if (summaryEnabled) {
        summaryAgent = await askAgent(
          rl,
          choices,
          messages.new.summaryAgent,
          config.defaults?.askSummaryAgent ?? config.defaults?.summaryAgent ?? askAgents[askAgents.length - 1],
          messages
        );
        if (!summaryAgent) return undefined;

        summaryModel = await askOptionalText(rl, messages.new.summaryModelFor(summaryAgent));
        if (summaryModel === undefined) return undefined;
      }

      const context = splitPaths(await askOptionalText(rl, messages.new.contextPaths));
      const files = splitPaths(await askOptionalText(rl, messages.new.filesPaths));
      const showPrompt = await askYesNo(rl, messages.new.showPrompt, false, messages);
      if (showPrompt === undefined) return undefined;

      const plainOutput = await askYesNo(rl, messages.new.plainOutput, false, messages);
      if (plainOutput === undefined) return undefined;

      const selection = {
        mode,
        agentA,
        agentB,
        askAgents,
        topic,
        summaryAgent,
        summaryModel,
        summaryEnabled,
        files,
        context,
        showPrompt,
        plainOutput
      };
      printCommandPreview(selection, messages);
      return selection;
    }

    const agentA = await askAgent(rl, choices, messages.new.agentA, config.defaults?.agentA, messages);
    if (!agentA) return undefined;

    const agentB = await askAgent(rl, choices.filter((choice) => choice.name !== agentA), messages.new.agentB, config.defaults?.agentB === agentA ? undefined : config.defaults?.agentB, messages);
    if (!agentB) return undefined;

    const topic = await askRequiredText(rl, messages.new.topic, messages);
    if (!topic) return undefined;

    printCommandPreview({ agentA, agentB, topic, turns: turnsOrDefault(config.defaults?.turns) }, messages);
    console.log(messages.new.advancedHint);
    const launchMinimal = await askYesNo(rl, messages.new.launchMinimal, true, messages);
    if (launchMinimal === undefined) return undefined;

    if (launchMinimal) {
      return {
      agentA,
      agentB,
      topic,
      mode,
      files: [],
      context: [],
        showPrompt: false,
        plainOutput: false
      };
    }

    const turns = await askNumber(rl, messages.new.turns, turnsOrDefault(config.defaults?.turns), messages);
    if (turns === undefined) return undefined;

    const modelA = await askOptionalText(rl, messages.new.modelFor(agentA));
    if (modelA === undefined) return undefined;

    const modelB = await askOptionalText(rl, messages.new.modelFor(agentB));
    if (modelB === undefined) return undefined;

    const summaryEnabled = await askYesNo(rl, messages.new.summaryEnabled, true, messages);
    if (summaryEnabled === undefined) return undefined;

    let summaryAgent: string | undefined;
    let summaryModel: string | undefined;
    if (summaryEnabled) {
      summaryAgent = await askAgent(rl, choices, messages.new.summaryAgent, config.defaults?.summaryAgent ?? agentB, messages);
      if (!summaryAgent) return undefined;

      summaryModel = await askOptionalText(rl, messages.new.summaryModelFor(summaryAgent));
      if (summaryModel === undefined) return undefined;
    }

    const context = splitPaths(await askOptionalText(rl, messages.new.contextPaths));
    const files = splitPaths(await askOptionalText(rl, messages.new.filesPaths));
    const showPrompt = await askYesNo(rl, messages.new.showPrompt, false, messages);
    if (showPrompt === undefined) return undefined;

    const plainOutput = await askYesNo(rl, messages.new.plainOutput, false, messages);
    if (plainOutput === undefined) return undefined;

    const selection = {
      agentA,
      agentB,
      topic,
      mode,
      modelA,
      modelB,
      turns,
      summaryAgent,
      summaryModel,
      summaryEnabled,
      files,
      context,
      showPrompt,
      plainOutput
    };
    printCommandPreview(selection, messages);
    return selection;
  } finally {
    rl.close();
  }
}

async function askMode(
  rl: Questioner,
  defaultMode: PalabreMode,
  messages: Messages
): Promise<PalabreMode | undefined> {
  const choices: Array<{ value: PalabreMode; label: string }> = [
    { value: "debate", label: messages.new.modeDebate },
    { value: "ask", label: messages.new.modeAsk }
  ];
  const fallback = choices.find((choice) => choice.value === defaultMode)?.value ?? "debate";

  if (supportsInteractiveOutput) {
    const lines = choices.map((choice, index) => {
      const marker = choice.value === fallback ? accent("(*)") : "   ";
      return `${bold(`${index + 1})`)} ${marker} ${choice.label}`;
    });
    console.log(padBlock(card(lines, surfaceWidth(), messages.new.mode)).join("\n"));
    console.log("");
  } else {
    console.log(messages.new.mode);
    choices.forEach((choice, index) => {
      const marker = choice.value === fallback ? "(*)" : "   ";
      console.log(`  ${index + 1}) ${marker} ${choice.label}`);
    });
  }

  while (true) {
    const answer = await rl.question(`${messages.new.mode} [${fallback}]: `);
    const value = answer.trim().toLowerCase();

    if (isQuit(value)) return undefined;
    if (!value) return fallback;

    const number = Number(value);
    if (Number.isInteger(number) && number >= 1 && number <= choices.length) {
      return choices[number - 1]?.value;
    }

    if (value === "debate" || value === "débat" || value === "debat") return "debate";
    if (value === "ask" || value === "demande" || value === "question") return "ask";

    console.log(messages.new.invalidModeChoice);
  }
}

async function createQuestioner(): Promise<Questioner> {
  if (input.isTTY) {
    const rl = createInterface({ input, output });
    return {
      question(prompt: string): Promise<string> {
        return new Promise((resolve, reject) => {
          let settled = false;
          const cleanup = () => rl.off("SIGINT", onSigint);
          const settle = (value: string) => {
            if (settled) return;
            settled = true;
            cleanup();
            resolve(value);
          };
          const onSigint = () => settle(interruptedAnswer);
          rl.once("SIGINT", onSigint);
          rl.question(prompt).then(settle, (error) => {
            if (settled) return;
            cleanup();
            reject(error);
          });
        });
      },
      close(): void {
        rl.close();
      }
    };
  }

  const lines = await readPipedLines();
  let index = 0;

  return {
    async question(prompt: string): Promise<string> {
      output.write(prompt);
      const value = lines[index];
      index += 1;
      output.write(`${value ?? "q"}\n`);
      return value ?? "q";
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
  return Object.entries(config.agents)
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

async function askAgent(
  rl: Questioner,
  choices: AgentChoice[],
  label: string,
  defaultName: string | undefined,
  messages: Messages
): Promise<string | undefined> {
  const fallback = choices.find((choice) => choice.name === defaultName)?.name ?? choices[0]?.name;

  console.log(label);
  choices.forEach((choice, index) => {
    const marker = choice.name === fallback ? "(*)" : "   ";
    console.log(`  ${index + 1}) ${marker} ${choice.name} - ${choice.status}`);
  });

  while (true) {
    const answer = await rl.question(`${label} [${fallback}]: `);
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

  while (true) {
    const answer = await rl.question(`${label} [${suffix}]: `);
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
  ]).join("\n"));
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

function buildExplicitCommand(selection: Partial<NewCommandSelection> & Pick<NewCommandSelection, "agentA" | "agentB" | "topic">): string {
  const args = ["palabre"];

  if (selection.mode === "ask") {
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
  if (selection.mode === "ask") {
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
