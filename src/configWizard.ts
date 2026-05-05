import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { writeExampleConfig } from "./config.js";
import type { AgentConfig, PalabreConfig } from "./types.js";

interface ConfigQuestioner {
  question(prompt: string): Promise<string>;
  close(): void;
}

interface AgentChoice {
  name: string;
  config: AgentConfig;
}

export async function runConfigWizard(configPath: string, config: PalabreConfig): Promise<void> {
  const choices = Object.entries(config.agents).map(([name, agentConfig]) => ({ name, config: agentConfig }));

  if (choices.length < 2) {
    throw new Error("La config doit contenir au moins deux agents pour définir des paramètres par défaut.");
  }

  const rl = await createQuestioner();

  try {
    console.log("PALABRE - Configuration");
    console.log("À tout moment: Ctrl+C pour interrompre, ou tape q, quit ou exit dans un prompt pour quitter.");
    console.log("");
    console.log("Fichier de configuration :");
    console.log(`  ${configPath}`);
    console.log("");
    console.log("Paramètres par défaut actuels :");
    console.log(`  ${config.defaults ? formatDefaults(config.defaults) : "Aucun"}`);
    console.log("");
    console.log("Que veux-tu faire ?");
    console.log("  1) Définir des paramètres par défaut");
    console.log("  2) Supprimer les paramètres par défaut");
    console.log("  3) Quitter sans modifier");

    const action = await askChoice(rl, "Tape le numéro de ton choix", "1", ["1", "2", "3"]);

    if (!action || action === "3") {
      console.log("Config inchangée.");
      return;
    }

    if (action === "2") {
      delete config.defaults;
      await writeExampleConfig(configPath, config);
      console.log(`Paramètres par défaut supprimés dans ${configPath}.`);
      return;
    }

    const agentA = await askAgent(
      rl,
      choices,
      "Agent A",
      "Choisis l'agent A, celui qui répondra en premier.",
      config.defaults?.agentA
    );
    if (!agentA) return;

    const agentB = await askAgent(
      rl,
      choices.filter((choice) => choice.name !== agentA),
      "Agent B",
      "Choisis l'agent B, celui qui répondra en second.",
      config.defaults?.agentB === agentA ? undefined : config.defaults?.agentB
    );
    if (!agentB) return;

    const turns = await askNumber(rl, "Nombre de réponses par défaut", config.defaults?.turns ?? 4, Boolean(config.defaults?.turns));
    if (turns === undefined) return;

    const summaryAgent = await askSummaryAgent(rl, choices, config.defaults?.summaryAgent ?? agentB, Boolean(config.defaults?.summaryAgent), agentB);
    if (summaryAgent === undefined) return;

    config.defaults = {
      agentA,
      agentB,
      ...(summaryAgent ? { summaryAgent } : {}),
      turns
    };

    await writeExampleConfig(configPath, config);
    console.log(`Paramètres par défaut définis dans ${configPath}: ${formatDefaults(config.defaults)}.`);
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
  label: string,
  description: string,
  defaultName: string | undefined
): Promise<string | undefined> {
  const fallback = choices.find((choice) => choice.name === defaultName)?.name ?? choices[0]?.name;
  const fallbackLabel = defaultName ? "Actuel" : "Suggestion";

  console.log("");
  console.log(description);
  console.log(`${fallbackLabel} : ${fallback}`);
  console.log("");

  choices.forEach((choice, index) => {
    console.log(`  ${index + 1}) ${formatAgentLine(choice)}`);
  });

  while (true) {
    const answer = await rl.question(`Tape un numéro ou un nom d'agent (Entrée = ${fallback}) : `);
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

async function askSummaryAgent(
  rl: ConfigQuestioner,
  choices: AgentChoice[],
  defaultName: string,
  hasCurrentDefault: boolean,
  agentB: string
): Promise<string | undefined> {
  const fallback = choices.some((choice) => choice.name === defaultName) ? defaultName : choices[0]?.name;
  const fallbackLabel = hasCurrentDefault ? "Actuel" : "Suggestion";

  console.log("");
  console.log("Agent de synthèse par défaut");
  console.log(`${fallbackLabel} : ${fallback}${!hasCurrentDefault && fallback === agentB ? " (agent B)" : ""}`);
  console.log("");
  console.log("  0) Aucun agent de synthèse par défaut");
  choices.forEach((choice, index) => {
    console.log(`  ${index + 1}) ${formatAgentLine(choice)}`);
  });

  while (true) {
    const answer = await rl.question(`Tape un numéro, un nom d'agent, ou 0 pour aucun (Entrée = ${fallback}) : `);
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

    console.log("Choix invalide. Tape un numéro, un nom d'agent, 0, Entrée ou q.");
  }
}

async function askChoice(
  rl: ConfigQuestioner,
  label: string,
  defaultValue: string,
  allowed: string[]
): Promise<string | undefined> {
  while (true) {
    const answer = await rl.question(`${label} (Entrée = ${defaultValue}) : `);
    const value = answer.trim();

    if (isQuit(value)) return undefined;
    if (!value) return defaultValue;
    if (allowed.includes(value)) return value;

    console.log(`Choix invalide. Valeurs: ${allowed.join(", ")}, Entrée ou q.`);
  }
}

async function askNumber(
  rl: ConfigQuestioner,
  label: string,
  defaultValue: number,
  hasCurrentDefault: boolean
): Promise<number | undefined> {
  const fallbackLabel = hasCurrentDefault ? "Actuel" : "Suggestion";

  console.log("");
  console.log(label);
  console.log(`${fallbackLabel} : ${defaultValue}`);
  console.log("");

  while (true) {
    const answer = await rl.question(`Tape le nombre total de réponses du débat (Entrée = ${defaultValue}) : `);
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

function formatAgentLine(choice: AgentChoice): string {
  return `${choice.name.padEnd(12)} ${choice.config.type} / ${choice.config.role}`;
}

function formatDefaults(defaults: NonNullable<PalabreConfig["defaults"]>): string {
  return `${defaults.agentA ?? "?"} <-> ${defaults.agentB ?? "?"}, réponses: ${defaults.turns ?? 4}${defaults.summaryAgent ? `, synthèse: ${defaults.summaryAgent}` : ""}`;
}

function isQuit(value: string): boolean {
  return ["q", "quit", "exit"].includes(value.toLowerCase());
}
