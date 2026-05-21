import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { discoverLocalTools, type ToolDiscovery } from "./discovery.js";
import { findPresetNameForPair } from "./presets.js";
import { MAX_TURNS, turnsOrDefault, validateTurns } from "./limits.js";
import type { AgentConfig, PalabreConfig } from "./types.js";
import type { Messages } from "./messages/index.js";

/**
 * Paramètres collectés par le wizard `palabre new`.
 * Structurellement identique aux flags CLI : le wizard ne crée pas un second chemin d'exécution.
 */
export interface NewCommandSelection {
  agentA: string;
  agentB: string;
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
    console.log(messages.new.title);
    console.log(messages.new.quitHint);
    console.log(messages.new.defaultHint);
    console.log("");

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

async function createQuestioner(): Promise<Questioner> {
  if (input.isTTY) {
    return createInterface({ input, output });
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

function isAgentDetected(name: string, config: AgentConfig, discovery: ToolDiscovery): boolean {
  if (config.type === "ollama") {
    return discovery.ollama.available;
  }

  const normalized = normalizeCommandName(config.command || name);
  if (normalized === "codex") return discovery.codex.available;
  if (normalized === "claude") return discovery.claude.available;
  if (normalized === "gemini") return discovery.gemini.available;
  if (normalized === "agy") return discovery.antigravity.available;
  if (normalized === "antigravity") return discovery.antigravity.available;
  if (normalized === "opencode") return discovery.opencode.available;

  return true;
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

function normalizeCommandName(command: string): string {
  return command
    .split(/[\\/]/)
    .pop()
    ?.toLowerCase()
    .replace(/\.(exe|cmd|bat|ps1)$/i, "") ?? command.toLowerCase();
}

function isQuit(value: string): boolean {
  return ["q", "quit", "exit"].includes(value.toLowerCase());
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

  args.push("--agent-a", selection.agentA);
  args.push("--agent-b", selection.agentB);
  args.push(quoteShellArg(selection.topic));
  appendOptionalArgs(args, selection);

  return args.join(" ");
}

function buildShortCommand(selection: Partial<NewCommandSelection> & Pick<NewCommandSelection, "agentA" | "agentB" | "topic">): string | undefined {
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
  if (selection.plainOutput) args.push("--plain");
}

function quoteShellArg(value: string): string {
  if (/^[A-Za-z0-9._/:\\-]+$/.test(value)) {
    return value;
  }

  return `"${value.replace(/(["`$\\])/g, "\\$1")}"`;
}
