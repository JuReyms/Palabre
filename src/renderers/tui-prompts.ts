/**
 * @file Entrées interactives du TUI : prompt d'accueil, commandes `/config`,
 * assistants agents/rôles et composer visuel. Toute la lecture readline vit ici,
 * avec la gestion du double Ctrl+C (retour puis quit) partagée par tous les prompts.
 */
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import type { Language, PalabreConfig, PalabreInterface, PalabreMode } from "../types.js";
import type { Messages } from "../messages/index.js";
import { renderTuiAgentsHelp, renderTuiRolesHelp } from "./tui-screens.js";
import {
  accent,
  bold,
  centerBlock,
  composerCard,
  dim,
  surfacePadding,
  surfaceWidth,
  viewportWidth,
  violet,
  wrapLine
} from "./tui-theme.js";

/** Résultat de `promptTuiHomeTopic` : action choisie depuis l'accueil, `undefined` si l'utilisateur quitte. */
export type TuiHomeInput =
  | { kind: "topic"; topic: string }
  | { kind: "new" }
  | { kind: "retry" }
  | { kind: "history" }
  | { kind: "update" }
  | { kind: "home" }
  | { kind: "config" }
  | { kind: "mode"; mode: PalabreMode }
  | { kind: "help" }
  | { kind: "agents"; agents: string[] }
  | { kind: "roles"; roles: string[] }
  | undefined;

/** Résultat de `promptTuiConfigCommand` : commande `/config` reconnue, ou `unknown` avec un message d'erreur. */
export type TuiConfigInput =
  | { kind: "back" }
  | { kind: "quit" }
  | { kind: "mode" }
  | { kind: "default-mode" }
  | { kind: "interface"; interfaceName: PalabreInterface }
  | { kind: "language"; language: Language }
  | { kind: "agents"; agents: string[] }
  | { kind: "roles"; roles: string[] }
  | { kind: "turns"; turns: number }
  | { kind: "summary"; agent: string | undefined }
  | { kind: "ollama-info" }
  | { kind: "ollama-model"; model: string }
  | { kind: "ollama-url"; url: string }
  | { kind: "ollama-sync" }
  | { kind: "unknown"; message: string };

/** Résultat de `promptTuiRolesWizard` : rôles saisis, retour à l'accueil, ou fermeture de la TUI. */
export type TuiRolesWizardInput =
  | { kind: "roles"; roles: string[] }
  | { kind: "back" }
  | { kind: "quit" };

/** Résultat de `promptTuiAgentsWizard` : agents saisis, retour à l'accueil, ou fermeture de la TUI. */
export type TuiAgentsWizardInput =
  | { kind: "agents"; agents: string[] }
  | { kind: "back" }
  | { kind: "quit" };

/** Parse `/ollama-url <url>` : renvoie `unknown` avec le message d'usage si l'argument est absent. */
export function parseTuiOllamaUrlCommand(parts: string[], messages: Messages): TuiConfigInput {
  const value = parts[1];
  return value ? { kind: "ollama-url", url: value } : { kind: "unknown", message: messages.tui.ollamaUrlUsage };
}

type TuiQuestionResult =
  | { kind: "answer"; value: string }
  | { kind: "back" }
  | { kind: "quit" };

let lastTuiInterruptAt = 0;
const doubleInterruptMs = 1200;

function nextInterruptKind(): "back" | "quit" {
  const now = Date.now();
  const kind = now - lastTuiInterruptAt <= doubleInterruptMs ? "quit" : "back";
  lastTuiInterruptAt = now;
  return kind;
}

function questionWithInterrupt(rl: ReturnType<typeof createInterface>, prompt: string): Promise<TuiQuestionResult> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => rl.off("SIGINT", onSigint);
    const settle = (result: TuiQuestionResult) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };
    const onSigint = () => {
      const kind = nextInterruptKind();
      rl.close();
      settle({ kind });
    };

    rl.once("SIGINT", onSigint);
    rl.question(prompt).then(
      (value) => settle({ kind: "answer", value }),
      (error) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      }
    );
  });
}

/** Lit une demande depuis l'accueil TUI. Retourne undefined si l'utilisateur quitte. */
export async function promptTuiHomeTopic(mode: PalabreMode = "debate", messages: Messages, options: { showComposer?: boolean; notice?: string } = {}): Promise<TuiHomeInput> {
  if (!input.isTTY) {
    return undefined;
  }

  const rl = createInterface({ input, output });
  try {
    const result = await questionWithInterrupt(rl, tuiPrompt(mode, messages.tui.subject, messages, options.notice));
    if (result.kind !== "answer") {
      return undefined;
    }
    const answer = result.value;
    const value = answer.trim();
    const parts = value.split(/\s+/).filter(Boolean);
    const command = parts[0]?.toLowerCase() ?? "";
    if (!value || command === "/quit" || command === "/q" || command === "/exit") {
      return undefined;
    }

    if (command === "/new") {
      return { kind: "new" };
    }

    if (command === "/retry") {
      return { kind: "retry" };
    }

    if (command === "/update") {
      return { kind: "update" };
    }

    if (command === "/historique" || command === "/history") {
      return { kind: "history" };
    }

    if (command === "/home" || command === "/back" || command === "/b") {
      return { kind: "home" };
    }

    if (command === "/config") {
      return { kind: "config" };
    }

    if (command === "/agents") {
      return { kind: "agents", agents: parts.slice(1) };
    }

    if (command === "/ask") {
      return { kind: "mode", mode: "ask" };
    }

    if (command === "/debat" || command === "/débat" || command === "/debate") {
      return { kind: "mode", mode: "debate" };
    }

    if (command === "/help" || command === "/h" || command === "/?") {
      return { kind: "help" };
    }

    if (command === "/roles" || command === "/role") {
      return { kind: "roles", roles: parts.slice(1) };
    }

    if (value.startsWith("/")) {
      return { kind: "help" };
    }

    return { kind: "topic", topic: value };
  } finally {
    rl.close();
  }
}

/** Lit une commande depuis l'ecran de config TUI. */
export async function promptTuiConfigCommand(mode: PalabreMode, messages: Messages): Promise<TuiConfigInput> {
  if (!input.isTTY) {
    return { kind: "back" };
  }

  const rl = createInterface({ input, output });
  try {
    const result = await questionWithInterrupt(rl, tuiPrompt(mode, messages.tui.configPrompt, messages));
    if (result.kind === "quit") {
      return { kind: "quit" };
    }
    if (result.kind === "back") {
      return { kind: "back" };
    }
    const answer = result.value;
    const parts = answer.trim().split(/\s+/).filter(Boolean);
    const command = parts[0]?.toLowerCase();

    if (!command || command === "/home" || command === "/back" || command === "/b") {
      return { kind: "back" };
    }

    if (command === "/quit" || command === "/q" || command === "/exit") {
      return { kind: "quit" };
    }

    if (command === "/mode") {
      return { kind: "mode" };
    }

    if (command === "/default") {
      return { kind: "default-mode" };
    }

    if (command === "/interface") {
      const value = parts[1];
      if (value === "tui" || value === "terminal") {
        return { kind: "interface", interfaceName: value };
      }
      return { kind: "unknown", message: "Usage: /interface <tui|terminal>" };
    }

    if (command === "/language" || command === "/langue" || command === "/lang") {
      const value = parts[1];
      if (value === "fr" || value === "en") {
        return { kind: "language", language: value };
      }
      return { kind: "unknown", message: "Usage: /language <fr|en>" };
    }

    if (command === "/agents") {
      return parts.length > 1
        ? { kind: "agents", agents: parts.slice(1) }
        : { kind: "agents", agents: [] };
    }

    if (command === "/roles" || command === "/role") {
      return { kind: "roles", roles: parts.slice(1) };
    }

    if (command === "/turns") {
      const turns = Number(parts[1]);
      return Number.isInteger(turns)
        ? { kind: "turns", turns }
        : { kind: "unknown", message: messages.tui.turnsUsage };
    }

    if (command === "/summary") {
      const value = parts[1];
      if (!value) {
        return { kind: "unknown", message: messages.tui.summaryUsage };
      }
      return { kind: "summary", agent: isNoneValue(value) ? undefined : value };
    }

    if (command === "/ollama") {
      const value = parts[1];
      return value ? { kind: "ollama-model", model: value } : { kind: "ollama-info" };
    }

    if (command === "/ollama-url" || command === "/ollama-host") {
      return parseTuiOllamaUrlCommand(parts, messages);
    }

    if (command === "/ollama-model") {
      const value = parts[1];
      return value ? { kind: "ollama-model", model: value } : { kind: "unknown", message: messages.tui.ollamaModelUsage };
    }

    if (command === "/model") {
      const [first, second] = parts.slice(1);
      const value = first === "ollama-local" ? second : first;
      return value ? { kind: "ollama-model", model: value } : { kind: "unknown", message: messages.tui.ollamaModelUsage };
    }

    if (command === "/ollama-sync") {
      return { kind: "ollama-sync" };
    }

    return { kind: "unknown", message: messages.tui.unknownCommand };
  } finally {
    rl.close();
  }
}

/** Assistant minimal pour modifier les agents du mode courant. */
export async function promptTuiAgentsWizard(config: PalabreConfig, mode: PalabreMode, messages: Messages): Promise<TuiAgentsWizardInput> {
  if (!input.isTTY) {
    return { kind: "back" };
  }

  renderTuiAgentsHelp(config, mode, messages);
  const rl = createInterface({ input, output });
  try {
    const result = await questionWithInterrupt(rl, tuiPrompt(mode, messages.tui.agentsPrompt, messages));
    if (result.kind === "quit") {
      return { kind: "quit" };
    }
    if (result.kind === "back") {
      return { kind: "back" };
    }
    const value = result.value.trim();
    if (!value || value === "/home" || value === "/back") {
      return { kind: "back" };
    }
    if (value === "/quit" || value === "/q") {
      return { kind: "quit" };
    }
    return { kind: "agents", agents: value.split(/\s+/).filter(Boolean) };
  } finally {
    rl.close();
  }
}

/** Assistant minimal pour modifier les roles du mode courant. */
export async function promptTuiRolesWizard(config: PalabreConfig, mode: PalabreMode, messages: Messages): Promise<TuiRolesWizardInput> {
  if (!input.isTTY) {
    return { kind: "back" };
  }

  renderTuiRolesHelp(mode, messages, config);
  const rl = createInterface({ input, output });
  try {
    const result = await questionWithInterrupt(rl, tuiPrompt(mode, messages.tui.rolesPrompt, messages));
    if (result.kind === "quit") {
      return { kind: "quit" };
    }
    if (result.kind === "back") {
      return { kind: "back" };
    }
    const answer = result.value;
    const value = answer.trim();
    if (!value || value === "/home" || value === "/back") {
      return { kind: "back" };
    }
    if (value === "/quit" || value === "/q") {
      return { kind: "quit" };
    }
    return { kind: "roles", roles: value.split(/\s+/).filter(Boolean) };
  } finally {
    rl.close();
  }
}

/** Affiche un composer visuel juste avant la vraie ligne readline. */
export function renderTuiComposer(mode: PalabreMode, messages: Messages, labelPrefix = messages.tui.subject, options: { force?: boolean } = {}): void {
  if (!options.force && !input.isTTY) {
    return;
  }

  const viewport = viewportWidth();
  const width = surfaceWidth();
  process.stdout.write([
    "",
    ...centerBlock(composerInputBox(mode, labelPrefix, width, messages), viewport),
    ""
  ].join("\n"));
}

function tuiPrompt(mode: PalabreMode, labelPrefix: string, messages: Messages, notice?: string): string {
  const label = promptTrail(mode, labelPrefix, messages);
  const padding = surfacePadding();
  const promptLine = `${padding}${label} ${dim(">")} `;
  return [
    "",
    promptRuleLine(),
    ...(notice ? [
      `${padding}${label} ${dim(">")}`,
      ...promptNoticeLines(notice),
      ""
    ] : []),
    promptLine,
  ].join("\n");
}

function promptRuleLine(): string {
  return `${surfacePadding()}${violet("-".repeat(surfaceWidth()))}`;
}

function promptNoticeLines(notice: string): string[] {
  const padding = surfacePadding();
  const contentWidth = surfaceWidth();
  return [
    `${padding}${dim("-".repeat(contentWidth))}`,
    ...wrapLine(notice, contentWidth).map((line) => `${padding}${line}`)
  ];
}

function promptModeLabel(mode: PalabreMode, messages: Messages): string {
  return `Mode ${messages.tui.modeValue(mode).toLowerCase()}`;
}

function promptTrail(mode: PalabreMode, labelPrefix: string, messages: Messages): string {
  const parts = [bold("Palabre"), accent(promptModeLabel(mode, messages))];
  if (labelPrefix !== messages.tui.subject) {
    parts.push(bold(labelPrefix));
  }
  return parts.join(` ${dim(">")} `);
}

function composerInputBox(mode: PalabreMode, labelPrefix: string, width: number, messages: Messages): string[] {
  return composerCard([
    `${promptTrail(mode, labelPrefix, messages)} ${dim(">")}`
  ], width, "center");
}

function isNoneValue(value: string): boolean {
  return ["none", "aucun", "off", "non", "0", "disabled"].includes(value.toLowerCase());
}
