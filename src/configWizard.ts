import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { syncDetectedAgents, writeExampleConfig } from "./config.js";
import { discoverLocalTools } from "./discovery.js";
import { DEFAULT_TURNS, MAX_TURNS, turnsOrDefault, validateTurns } from "./limits.js";
import type { AgentConfig, PalabreConfig } from "./types.js";
import type { Messages } from "./messages/index.js";

interface ConfigQuestioner {
  question(prompt: string): Promise<string>;
  close(): void;
}

interface AgentChoice {
  name: string;
  config: AgentConfig;
}

/**
 * Lance le wizard interactif de configuration des defaults.
 * Fonctionne en mode TTY (readline) et en mode piped (stdin lu en avance).
 * Écrit la config sur disque si l'utilisateur confirme ; sort sans modifier si l'utilisateur quitte.
 */
export async function runConfigWizard(configPath: string, config: PalabreConfig, messages: Messages): Promise<void> {
  const choices = Object.entries(config.agents).map(([name, agentConfig]) => ({ name, config: agentConfig }));

  if (choices.length < 2) {
    throw new Error(messages.config.wizardNeedsTwoAgents);
  }

  const rl = await createQuestioner();

  try {
    console.log(messages.config.wizardTitle);
    console.log(messages.config.wizardQuitHint);
    console.log("");
    console.log(messages.config.wizardConfigFile);
    console.log(`  ${configPath}`);
    console.log("");
    console.log(messages.config.wizardCurrentDefaults);
    console.log(`  ${config.defaults ? formatDefaults(config.defaults, messages) : messages.config.wizardNoDefaults}`);
    console.log("");
    console.log(messages.config.wizardActionQuestion);
    console.log(`  1) ${messages.config.wizardActionSetDefaults}`);
    console.log(`  2) ${messages.config.wizardActionClearDefaults}`);
    console.log(`  3) ${messages.config.wizardActionSyncAgents}`);
    console.log(`  4) ${messages.config.wizardActionExit}`);

    const action = await askChoice(rl, messages.config.wizardChoicePrompt, "1", ["1", "2", "3", "4"], messages);

    if (!action || action === "4") {
      console.log(messages.config.wizardUnchanged);
      return;
    }

    if (action === "2") {
      delete config.defaults;
      await writeExampleConfig(configPath, config);
      console.log(messages.config.wizardCleared(configPath));
      return;
    }

    if (action === "3") {
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

    const agentA = await askAgent(
      rl,
      choices,
      messages.config.wizardAgentADescription,
      config.defaults?.agentA,
      messages
    );
    if (!agentA) return;

    const agentB = await askAgent(
      rl,
      choices.filter((choice) => choice.name !== agentA),
      messages.config.wizardAgentBDescription,
      config.defaults?.agentB === agentA ? undefined : config.defaults?.agentB,
      messages
    );
    if (!agentB) return;

    const turns = await askNumber(rl, messages.config.wizardTurnsLabel, turnsOrDefault(config.defaults?.turns), Boolean(config.defaults?.turns), messages);
    if (turns === undefined) return;

    const summaryAgent = await askSummaryAgent(rl, choices, config.defaults?.summaryAgent ?? agentB, Boolean(config.defaults?.summaryAgent), agentB, messages);
    if (summaryAgent === undefined) return;

    config.defaults = {
      agentA,
      agentB,
      ...(summaryAgent ? { summaryAgent } : {}),
      turns
    };

    await writeExampleConfig(configPath, config);
    console.log(messages.config.wizardDefaultsSet(configPath, formatDefaults(config.defaults, messages)));
  } finally {
    rl.close();
  }
}

async function createQuestioner(): Promise<ConfigQuestioner> {
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
      output.write(`${value ?? "3"}\n`);
      return value ?? "3";
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

  return raw ? raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n") : [];
}

async function askAgent(
  rl: ConfigQuestioner,
  choices: AgentChoice[],
  description: string,
  defaultName: string | undefined,
  messages: Messages
): Promise<string | undefined> {
  const fallback = choices.find((choice) => choice.name === defaultName)?.name ?? choices[0]?.name;
  const fallbackLabel = defaultName ? messages.config.wizardCurrent : messages.config.wizardSuggestion;

  console.log("");
  console.log(description);
  console.log(`${fallbackLabel} : ${fallback}`);
  console.log("");

  choices.forEach((choice, index) => {
    console.log(`  ${index + 1}) ${formatAgentLine(choice)}`);
  });

  while (true) {
    const answer = await rl.question(messages.config.wizardAgentPrompt(fallback));
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

    console.log(messages.config.wizardInvalidAgentChoice);
  }
}

async function askSummaryAgent(
  rl: ConfigQuestioner,
  choices: AgentChoice[],
  defaultName: string,
  hasCurrentDefault: boolean,
  agentB: string,
  messages: Messages
): Promise<string | undefined> {
  const fallback = choices.some((choice) => choice.name === defaultName) ? defaultName : choices[0]?.name;
  const fallbackLabel = hasCurrentDefault ? messages.config.wizardCurrent : messages.config.wizardSuggestion;

  console.log("");
  console.log(messages.config.wizardSummaryTitle);
  console.log(`${fallbackLabel} : ${fallback}${!hasCurrentDefault && fallback === agentB ? ` (${messages.config.wizardAgentBHint})` : ""}`);
  console.log("");
  console.log(`  0) ${messages.config.wizardNoSummary}`);
  choices.forEach((choice, index) => {
    console.log(`  ${index + 1}) ${formatAgentLine(choice)}`);
  });

  while (true) {
    const answer = await rl.question(messages.config.wizardSummaryPrompt(fallback));
    const value = answer.trim();

    if (isQuit(value)) return undefined;
    if (!value) return fallback;
    if (value === "0" || value.toLowerCase() === "none" || value.toLowerCase() === "aucun") return "";

    const number = Number(value);
    if (Number.isInteger(number) && number >= 1 && number <= choices.length) {
      return choices[number - 1]?.name;
    }

    if (choices.some((choice) => choice.name === value)) {
      return value;
    }

    console.log(messages.config.wizardInvalidSummaryChoice);
  }
}

async function askChoice(
  rl: ConfigQuestioner,
  label: string,
  defaultValue: string,
  allowed: string[],
  messages: Messages
): Promise<string | undefined> {
  while (true) {
    const answer = await rl.question(messages.config.wizardChoiceQuestion(label, defaultValue));
    const value = answer.trim();

    if (isQuit(value)) return undefined;
    if (!value) return defaultValue;
    if (allowed.includes(value)) return value;

    console.log(messages.config.wizardInvalidChoice(allowed.join(", ")));
  }
}

async function askNumber(
  rl: ConfigQuestioner,
  label: string,
  defaultValue: number,
  hasCurrentDefault: boolean,
  messages: Messages
): Promise<number | undefined> {
  const fallbackLabel = hasCurrentDefault ? messages.config.wizardCurrent : messages.config.wizardSuggestion;

  console.log("");
  console.log(label);
  console.log(`${fallbackLabel} : ${defaultValue}`);
  console.log("");

  while (true) {
    const answer = await rl.question(messages.config.wizardTurnsPrompt(defaultValue));
    const value = answer.trim();

    if (isQuit(value)) return undefined;
    if (!value) return defaultValue;

    const parsed = Number(value);
    if (Number.isInteger(parsed)) {
      try {
        validateTurns(parsed, messages.config.wizardTurnsLabel, messages);
        return parsed;
      } catch {
        // Show the user-facing wizard hint below.
      }
    }

    console.log(messages.config.wizardTurnsInvalid(MAX_TURNS));
  }
}

function formatAgentLine(choice: AgentChoice): string {
  return `${choice.name.padEnd(12)} ${choice.config.type} / ${choice.config.role}`;
}

function formatDefaults(defaults: NonNullable<PalabreConfig["defaults"]>, messages: Messages): string {
  return messages.config.wizardDefaults({
    agentA: defaults.agentA,
    agentB: defaults.agentB,
    turns: turnsOrDefault(defaults.turns ?? DEFAULT_TURNS),
    summaryAgent: defaults.summaryAgent
  });
}

function isQuit(value: string): boolean {
  return ["q", "quit", "exit"].includes(value.toLowerCase());
}
