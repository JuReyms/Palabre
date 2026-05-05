import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { discoverLocalTools, type ToolDiscovery } from "./discovery.js";
import { findPresetNameForPair } from "./presets.js";
import type { AgentConfig, PalabreConfig } from "./types.js";

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

export async function runNewWizard(config: PalabreConfig): Promise<NewCommandSelection | undefined> {
  const discovery = await discoverLocalTools();
  const choices = buildAgentChoices(config, discovery);

  if (choices.length < 2) {
    throw new Error("palabre new a besoin d'au moins deux agents dans la config. Lance `palabre init` ou edite ta config.");
  }

  const rl = await createQuestioner();

  try {
    console.log("PALABRE - ASSISTANT DE CONFIGURATION");
    console.log("À tout moment: Ctrl+C pour interrompre, ou tape q, quit ou exit dans un prompt pour quitter.");
    console.log("Appuie sur Entrée pour accepter un choix par défaut (*).");
    console.log("");

    const agentA = await askAgent(rl, choices, "Agent A", config.defaults?.agentA);
    if (!agentA) return undefined;

    const agentB = await askAgent(rl, choices.filter((choice) => choice.name !== agentA), "Agent B", config.defaults?.agentB === agentA ? undefined : config.defaults?.agentB);
    if (!agentB) return undefined;

    const topic = await askRequiredText(rl, "Sujet");
    if (!topic) return undefined;

    printCommandPreview({ agentA, agentB, topic, turns: config.defaults?.turns });
    console.log("Réponds non pour choisir le nombre de tours, les modèles, la synthèse et le contexte.");
    const launchMinimal = await askYesNo(rl, "Lancer maintenant avec les options par défaut ?", true);
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

    const turns = await askNumber(rl, "Nombre de tours", config.defaults?.turns ?? 4);
    if (turns === undefined) return undefined;

    const modelA = await askOptionalText(rl, `Modèle pour ${agentA} (optionnel)`);
    if (modelA === undefined) return undefined;

    const modelB = await askOptionalText(rl, `Modèle pour ${agentB} (optionnel)`);
    if (modelB === undefined) return undefined;

    const summaryEnabled = await askYesNo(rl, "Synthèse finale ?", true);
    if (summaryEnabled === undefined) return undefined;

    let summaryAgent: string | undefined;
    let summaryModel: string | undefined;
    if (summaryEnabled) {
      summaryAgent = await askAgent(rl, choices, "Agent de synthèse", config.defaults?.summaryAgent ?? agentB);
      if (!summaryAgent) return undefined;

      summaryModel = await askOptionalText(rl, `Modèle de synthèse pour ${summaryAgent} (optionnel)`);
      if (summaryModel === undefined) return undefined;
    }

    const context = splitPaths(await askOptionalText(rl, "Contexte dossier/fichier via --context (optionnel)"));
    const files = splitPaths(await askOptionalText(rl, "Fichiers stricts via --files (optionnel)"));
    const showPrompt = await askYesNo(rl, "Afficher seulement le prompt ?", false);
    if (showPrompt === undefined) return undefined;

    const plainOutput = await askYesNo(rl, "Rendu plain ?", false);
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
    printCommandPreview(selection);
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

function buildAgentChoices(config: PalabreConfig, discovery: ToolDiscovery): AgentChoice[] {
  return Object.entries(config.agents)
    .map(([name, agentConfig]) => {
      const detected = isAgentDetected(name, agentConfig, discovery);
      return {
        name,
        config: agentConfig,
        detected,
        status: agentStatus(name, agentConfig, discovery, detected)
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
  if (normalized === "opencode") return discovery.opencode.available;

  return true;
}

function agentStatus(name: string, config: AgentConfig, discovery: ToolDiscovery, detected: boolean): string {
  if (config.type === "ollama") {
    return detected
      ? `ollama/${config.role} détecté (${discovery.ollama.models.length} modèle(s))`
      : `ollama/${config.role} non joignable`;
  }

  return detected
    ? `cli/${config.role} détecté`
    : `cli/${config.role} non détecté`;
}

async function askAgent(
  rl: Questioner,
  choices: AgentChoice[],
  label: string,
  defaultName: string | undefined
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

    console.log("Choix invalide. Tape un numéro, un nom d'agent, Entrée ou q.");
  }
}

async function askRequiredText(rl: Questioner, label: string): Promise<string | undefined> {
  while (true) {
    const answer = await rl.question(`${label}: `);
    const value = answer.trim();

    if (isQuit(value)) return undefined;
    if (value) return value;

    console.log("Ce champ est requis pour lancer un débat.");
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
  defaultValue: number
): Promise<number | undefined> {
  while (true) {
    const answer = await rl.question(`${label} [${defaultValue}]: `);
    const value = answer.trim();

    if (isQuit(value)) return undefined;
    if (!value) return defaultValue;

    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }

    console.log("Entre un nombre entier positif, Entrée ou q.");
  }
}

async function askYesNo(
  rl: Questioner,
  label: string,
  defaultValue: boolean
): Promise<boolean | undefined> {
  const suffix = defaultValue ? "Y/n" : "y/N";

  while (true) {
    const answer = await rl.question(`${label} [${suffix}]: `);
    const value = answer.trim().toLowerCase();

    if (isQuit(value)) return undefined;
    if (!value) return defaultValue;
    if (["y", "yes", "o", "oui"].includes(value)) return true;
    if (["n", "no", "non"].includes(value)) return false;

    console.log("Réponds par oui, non, Entrée ou q.");
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

function printCommandPreview(selection: Partial<NewCommandSelection> & Pick<NewCommandSelection, "agentA" | "agentB" | "topic">): void {
  const explicitCommand = buildExplicitCommand(selection);
  const shortCommand = buildShortCommand(selection);

  console.log("");
  console.log("Commandes équivalentes:");
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
