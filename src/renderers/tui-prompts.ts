/**
 * @file Entrées interactives du TUI : prompt d'accueil, commandes `/config`,
 * assistants agents/rôles et composer visuel. Toute la lecture readline vit ici,
 * avec la gestion du double Ctrl+C (retour puis quit) partagée par tous les prompts.
 */
import { createInterface } from "node:readline";
import { stdin as input, stdout as output } from "node:process";
import type { Language, PalabreConfig, PalabreInterface, PalabreMode } from "../types.js";
import type { Messages } from "../messages/index.js";
import { renderTuiAgentsHelp, renderTuiRolesHelp } from "./tui-screens.js";
import {
  accent,
  bold,
  composerCard,
  dim,
  glyphs,
  labeledRule,
  padBlock,
  surfacePadding,
  surfaceWidth,
  supportsInteractiveOutput,
  visibleLength,
  violet,
  wrapLine
} from "./tui-theme.js";

/** Résultat de `promptTuiHomeTopic` : action choisie depuis l'accueil, `undefined` si l'utilisateur quitte. */
export type TuiHomeMode = PalabreMode;

export type TuiHomeInput =
  | { kind: "topic"; topic: string; files?: string[]; context?: string[] }
  | { kind: "new" }
  | { kind: "retry" }
  | { kind: "history" }
  | { kind: "update" }
  | { kind: "home" }
  | { kind: "config" }
  | { kind: "mode"; mode: TuiHomeMode }
  | { kind: "help" }
  | { kind: "agents"; agents: string[] }
  | { kind: "roles"; roles: string[] }
  | undefined;

/** Traduit une interruption du composer : premier Ctrl+C = accueil, second = fermeture. */
export function tuiHomeInterruptInput(kind: "back" | "quit"): TuiHomeInput {
  return kind === "back" ? { kind: "home" } : undefined;
}

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

/**
 * Extrait les options de contexte inline (`--context <chemins...>`, `--files <chemins...>`)
 * d'un sujet tapé dans le composer, comme le suggère le tip de l'accueil. Les chemins
 * suivent leur flag jusqu'au prochain token commençant par `--`. Limite assumée du MVP :
 * les chemins contenant des espaces ne sont pas supportés dans cette syntaxe inline.
 */
export function parseComposerTopic(value: string): { topic: string; files: string[]; context: string[] } {
  if (!/(^|\s)--(?:context|files?|file)(?=\s|$)/.test(value)) {
    return { topic: value.trim(), files: [], context: [] };
  }

  const topicTokens: string[] = [];
  const files: string[] = [];
  const context: string[] = [];
  let collector: string[] | undefined;

  for (const token of value.split(/\s+/).filter(Boolean)) {
    if (token === "--context") {
      collector = context;
      continue;
    }

    if (token === "--files" || token === "--file") {
      collector = files;
      continue;
    }

    if (token.startsWith("--")) {
      // Flag inconnu : rendu au sujet tel quel pour rester visible et sans surprise.
      collector = undefined;
      topicTokens.push(token);
      continue;
    }

    (collector ?? topicTokens).push(token);
  }

  return { topic: topicTokens.join(" "), files, context };
}

export type TuiQuestionResult =
  | { kind: "answer"; value: string }
  | { kind: "back" }
  | { kind: "quit" };

let lastTuiInterruptAt = 0;
const doubleInterruptMs = 1200;
let composerReadline: ReturnType<typeof createInterface> | undefined;

/**
 * Accueil et Config partagent le même reader. Sous ConPTY, fermer le reader qui
 * vient de recevoir SIGINT peut rendre stdin muet pour le reader suivant.
 */
function getComposerReadline(): ReturnType<typeof createInterface> {
  if (composerReadline) return composerReadline;
  const rl = createInterface({ input, output });
  composerReadline = rl;
  rl.once("close", () => {
    if (composerReadline === rl) composerReadline = undefined;
  });
  return rl;
}

function closeComposerReadline(): void {
  const rl = composerReadline;
  composerReadline = undefined;
  rl?.close();
}

export function nextTuiInterruptKind(): "back" | "quit" {
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
      const kind = nextTuiInterruptKind();
      settle({ kind });
    };

    rl.once("SIGINT", onSigint);
    try {
      rl.question(prompt, (value) => settle({ kind: "answer", value }));
    } catch (error) {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    }
  });
}

/** Lit un message Chat avec le même composer visuel et la même politique Ctrl+C que l'accueil. */
export async function promptTuiChatMessage(messages: Messages): Promise<TuiQuestionResult> {
  if (!input.isTTY) return { kind: "quit" };
  const rl = createInterface({ input, output });
  try {
    return await questionWithInterrupt(rl, renderChatSessionPrompt(messages));
  } finally {
    rl.close();
  }
}


/** Agrège les lignes reçues dans la même rafale de collage en une seule réponse. */
export function questionWithBufferedComposer(
  rl: ReturnType<typeof createInterface>,
  prompt: string,
  linePrompt: string,
  trailingLines: number,
  streams: { input: NodeJS.ReadableStream; output: NodeJS.WritableStream } = { input, output }
): Promise<TuiQuestionResult> {
  return new Promise((resolve) => {
    const composerInput = streams.input;
    const composerOutput = streams.output;
    const lines: string[] = [];
    let timer: ReturnType<typeof setTimeout> | undefined;
    let settled = false;
    const clearPlaceholder = (
      value: string,
      key: { ctrl?: boolean; meta?: boolean; name?: string }
    ) => {
      const navigationKey = key.name && ["backspace", "delete", "left", "right", "up", "down"].includes(key.name);
      if (!value && (key.ctrl || key.meta || navigationKey)) {
        composerInput.prependOnceListener("keypress", clearPlaceholder);
        return;
      }
      if (supportsInteractiveOutput) composerOutput.write("\u001b[0K");
    };
    const finishLayout = () => {
      if (!supportsInteractiveOutput) return;
      const down = Math.max(0, trailingLines - 1);
      composerOutput.write(`${down > 0 ? `\u001b[${down}B` : ""}\r\n\u001b[?2004l`);
    };
    const cleanup = () => {
      if (timer) clearTimeout(timer);
      rl.off("line", onLine);
      rl.off("SIGINT", onSigint);
      rl.off("close", onClose);
      composerInput.off("keypress", clearPlaceholder);
    };
    const settle = (result: TuiQuestionResult) => {
      if (settled) return;
      settled = true;
      cleanup();
      finishLayout();
      resolve(result);
    };
    const flush = () => settle({
      kind: "answer",
      value: normalizeBufferedComposerLines(lines)
    });
    const onLine = (line: string) => {
      lines.push(line);
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, 50);
    };
    const onClose = () => {
      settle(lines.length > 0 ? { kind: "answer", value: normalizeBufferedComposerLines(lines) } : { kind: "quit" });
    };
    const onSigint = () => {
      settle({ kind: nextTuiInterruptKind() });
    };

    rl.on("line", onLine);
    rl.once("SIGINT", onSigint);
    rl.once("close", onClose);
    rl.setPrompt(linePrompt);
    composerInput.prependOnceListener("keypress", clearPlaceholder);
    composerInput.resume();
    if (supportsInteractiveOutput) composerOutput.write("\u001b[?2004h");
    composerOutput.write(prompt);
  });
}

/** Nettoie les marqueurs bracketed-paste et conserve les sauts de ligne du bloc collé. */
export function normalizeBufferedComposerLines(lines: string[]): string {
  return lines
    .join("\n")
    .replace(/\u001b\[200~/g, "")
    .replace(/\u001b\[201~/g, "")
    .replace(/\r\n?/g, "\n");
}

/** Lit une demande depuis l'accueil TUI. Retourne undefined si l'utilisateur quitte. */
export async function promptTuiHomeTopic(mode: TuiHomeMode = "debate", messages: Messages, options: { showComposer?: boolean; notice?: string; bare?: boolean } = {}): Promise<TuiHomeInput> {
  if (!input.isTTY) {
    return undefined;
  }

  const rl = getComposerReadline();
  let keepReader = false;
  try {
    const layout = homeComposerPrompt(mode, messages, options.notice, options.bare);
    const result = await questionWithBufferedComposer(rl, layout.prompt, layout.linePrompt, layout.trailingLines);
    if (result.kind !== "answer") {
      keepReader = result.kind === "back";
      return tuiHomeInterruptInput(result.kind);
    }
    const answer = result.value;
    const value = answer.trim();
    const parts = value.split(/\s+/).filter(Boolean);
    const command = parts[0]?.toLowerCase() ?? "";
    if (!value) return { kind: "home" };
    if (command === "/quit" || command === "/q" || command === "/exit") {
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
      keepReader = true;
      return { kind: "config" };
    }

    if (command === "/agents") {
      return { kind: "agents", agents: parts.slice(1) };
    }

    if (command === "/chat") {
      return { kind: "mode", mode: "chat" };
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

    const composerInput = parseComposerTopic(value);
    return {
      kind: "topic",
      topic: composerInput.topic,
      ...(composerInput.files.length > 0 ? { files: composerInput.files } : {}),
      ...(composerInput.context.length > 0 ? { context: composerInput.context } : {})
    };
  } finally {
    if (!keepReader) closeComposerReadline();
  }
}

/** Lit une commande depuis l'ecran de config TUI. */
export async function promptTuiConfigCommand(mode: PalabreMode, messages: Messages): Promise<TuiConfigInput> {
  if (!input.isTTY) {
    return { kind: "back" };
  }

  const rl = getComposerReadline();
  let keepReader = true;
  try {
    const layout = configComposerPrompt(mode, messages);
    const result = await questionWithBufferedComposer(rl, layout.prompt, layout.linePrompt, layout.trailingLines);
    if (result.kind === "quit") {
      keepReader = false;
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
      keepReader = false;
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
      keepReader = false;
      return parts.length > 1
        ? { kind: "agents", agents: parts.slice(1) }
        : { kind: "agents", agents: [] };
    }

    if (command === "/roles" || command === "/role") {
      keepReader = false;
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
    if (!keepReader) closeComposerReadline();
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

/** Construit le composer d'accueil minimal : titre et ligne de saisie uniquement. */
function homeComposerPrompt(
  mode: TuiHomeMode,
  messages: Messages,
  notice?: string,
  bare = false
): { prompt: string; linePrompt: string; trailingLines: number } {
  return framedComposerPrompt(
    mode,
    messages,
    messages.tui.subject,
    messages.tui.composerPlaceholder(mode),
    undefined,
    notice,
    bare
  );
}

/** Variante Config du composer partagé. */
function configComposerPrompt(mode: TuiHomeMode, messages: Messages): ComposerPromptLayout {
  return framedComposerPrompt(
    mode,
    messages,
    messages.tui.configPrompt,
    messages.tui.configComposerPlaceholder,
    messages.tui.configComposerTip
  );
}

interface ComposerPromptLayout {
  prompt: string;
  linePrompt: string;
  trailingLines: number;
}

/** Primitive commune aux composers Accueil et Config. */
function framedComposerPrompt(
  mode: TuiHomeMode,
  messages: Messages,
  labelPrefix: string,
  placeholder: string,
  tip: string | undefined,
  notice?: string,
  bare = false
): ComposerPromptLayout {
  const padding = surfacePadding();
  const promptPrefix = `${padding}${accent(glyphs().prompt)} `;
  if (bare) return { prompt: `\n${promptPrefix}`, linePrompt: promptPrefix, trailingLines: 0 };

  const tipLines = tip
    ? wrapLine(tip, surfaceWidth()).map((line) => `${padding}${dim(line)}`)
    : [];
  const lines = [
    "",
    `${padding}${labeledRule(promptTrail(mode, labelPrefix, messages), violet)}`,
    ...(notice ? promptNoticeLines(notice) : []),
    ...tipLines,
    ...(tip ? [`${padding}${violet(glyphs().h.repeat(surfaceWidth()))}`] : []),
    `${promptPrefix}${dim(placeholder)}`
  ];
  const prompt = lines.join("\n");
  if (!supportsInteractiveOutput) return { prompt, linePrompt: promptPrefix, trailingLines: 0 };

  return {
    prompt: `${prompt}\r\u001b[${visibleLength(promptPrefix)}C`,
    linePrompt: promptPrefix,
    trailingLines: 0
  };
}

/** Affiche un composer visuel juste avant la vraie ligne readline. */
export function renderTuiComposer(mode: PalabreMode, messages: Messages, labelPrefix = messages.tui.subject, options: { force?: boolean } = {}): void {
  if (!options.force && !input.isTTY) {
    return;
  }

  if (labelPrefix === messages.tui.subject) {
    const layout = homeComposerPrompt(mode, messages);
    process.stdout.write(`${layout.prompt}\n`);
    return;
  }

  if (labelPrefix === messages.tui.configPrompt) {
    const layout = configComposerPrompt(mode, messages);
    process.stdout.write(`${layout.prompt}\n`);
    return;
  }

  process.stdout.write([
    "",
    ...padBlock(composerInputBox(mode, labelPrefix, surfaceWidth(), messages)),
    ""
  ].join("\n"));
}

/**
 * Zone de saisie : fil d'Ariane intégré à la règle violette, puis ligne de saisie
 * réduite au marqueur `❯` — le contexte vit dans la règle, pas devant le curseur.
 */
function tuiPrompt(mode: TuiHomeMode, labelPrefix: string, messages: Messages, notice?: string, bare = false): string {
  const padding = surfacePadding();
  const promptLine = `${padding}${accent(glyphs().prompt)} `;
  if (bare) return ["", promptLine].join("\n");
  return [
    "",
    `${padding}${labeledRule(promptTrail(mode, labelPrefix, messages), violet)}`,
    ...promptModeTipLines(mode, messages),
    ...(notice ? promptNoticeLines(notice) : []),
    promptLine,
  ].join("\n");
}

/** Composer minimal d'une session Chat : commandes utiles et curseur, sans rappel du mode. */
export function renderChatSessionPrompt(messages: Messages): string {
  const padding = surfacePadding();
  return [
    "",
    ...wrapLine(messages.tui.chatComposerCommands, surfaceWidth()).map((line) => `${padding}${dim(line)}`),
    "",
    `${padding}${accent(glyphs().prompt)} `
  ].join("\n");
}
function promptModeTipLines(mode: TuiHomeMode, messages: Messages): string[] {
  const tips = mode === "chat"
    ? [messages.tui.chatTip, messages.tui.chatComposerCommands]
    : [mode === "ask" ? messages.tui.askTip : messages.tui.debateTip];
  return ["", ...tips.flatMap((tip) => wrapLine(tip, surfaceWidth()).map((line) => `${surfacePadding()}${dim(line)}`)), ""];
}

function promptNoticeLines(notice: string): string[] {
  const padding = surfacePadding();
  const contentWidth = surfaceWidth();
  return wrapLine(notice, contentWidth).map((line) => `${padding}${line}`);
}

function promptModeLabel(mode: TuiHomeMode, messages: Messages): string {
  return mode === "chat" ? "Mode chat" : `Mode ${messages.tui.modeValue(mode).toLowerCase()}`;
}

function promptTrail(mode: TuiHomeMode, labelPrefix: string, messages: Messages): string {
  const parts = [bold("Palabre"), accent(promptModeLabel(mode, messages))];
  if (labelPrefix !== messages.tui.subject) {
    parts.push(bold(labelPrefix));
  }
  return parts.join(` ${dim(glyphs().pointer)} `);
}

function composerInputBox(mode: PalabreMode, labelPrefix: string, width: number, messages: Messages): string[] {
  return composerCard([
    `${promptTrail(mode, labelPrefix, messages)} ${accent(glyphs().prompt)}`
  ], width);
}

function isNoneValue(value: string): boolean {
  return ["none", "aucun", "off", "non", "0", "disabled"].includes(value.toLowerCase());
}
