/**
 * @file Entrées interactives du TUI : prompt d'accueil, commandes `/config`,
 * assistants agents/rôles et composer visuel. Toute la lecture readline vit ici,
 * avec la gestion du double Ctrl+C (retour puis quit) partagée par tous les prompts.
 */
import { createInterface } from "node:readline";
import { stdin as input, stdout as output } from "node:process";
import type { Language, PalabreConfig, PalabreInterface, PalabreMode } from "../types.js";
import type { Messages } from "../messages/index.js";
import { canApplyUpdate, type UpdateInfo } from "../update.js";
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
  | { kind: "apply-update" }
  | { kind: "home" }
  | { kind: "config" }
  | { kind: "mode"; mode: TuiHomeMode }
  | { kind: "help" }
  | { kind: "invalid"; message: string }
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
const composerReadlineKeypressHandlers = new WeakMap<
  ReturnType<typeof createInterface>,
  Function[]
>();

export type TuiCommandCompletionContext = "home" | "config" | "chat" | "navigation";
type TuiCompletionMessages = Pick<Messages["tui"], "commandDescription" | "completionNavigationHint">;
export interface TuiCompletionChoice {
  value: string;
  /** Libellé affiché lorsque la valeur technique doit rester courte et saisissable. */
  label?: string;
  description?: string;
}

export interface TuiCompletionPicker {
  choices: readonly TuiCompletionChoice[];
  defaultValue?: string;
  showOnEmpty?: boolean;
}

const TUI_COMMAND_COMPLETIONS: Record<TuiCommandCompletionContext, readonly string[]> = {
  home: [
    // Parcours principaux, ajustements de session, configuration, puis navigation.
    "/chat", "/debat", "/ask", "/agents", "/roles", "/config", "/help",
    "/history", "/retry", "/update", "/new", "/home", "/back", "/quit"
  ],
  config: [
    // Réglages généraux, participants, Ollama, puis navigation.
    "/mode", "/default", "/interface", "/language", "/agents", "/roles", "/turns", "/summary",
    "/ollama", "/ollama-model", "/ollama-url", "/ollama-sync", "/model",
    "/home", "/back", "/quit"
  ],
  chat: ["/consult", "/use", "/agents", "/end", "/home", "/back", "/quit"],
  navigation: ["/home", "/back", "/quit"]
};

const HOME_MODE_COMMANDS: Record<TuiHomeMode, readonly string[]> = {
  chat: ["/chat"],
  ask: ["/ask"],
  debate: ["/debat"]
};

/** Suggestions de commande pour le premier mot d'une commande TUI, filtrées par écran et mode actif. */
export function completeTuiCommand(
  line: string,
  context: TuiCommandCompletionContext,
  activeMode?: TuiHomeMode
): [string[], string] {
  if (!line.startsWith("/") || /\s/.test(line)) return [[], line];

  const prefix = line.toLocaleLowerCase();
  const activeModeCommands = context === "home" && activeMode
    ? HOME_MODE_COMMANDS[activeMode]
    : [];
  const matches = TUI_COMMAND_COMPLETIONS[context].filter((command) => (
    !activeModeCommands.includes(command)
    && command.toLocaleLowerCase().startsWith(prefix)
  ));
  return [matches, line];
}

/**
 * Les composers et assistants TUI partagent le même reader. Sous ConPTY, fermer
 * le reader qui vient de recevoir SIGINT peut rendre stdin muet pour le suivant.
 */
export function getComposerReadline(): ReturnType<typeof createInterface> {
  if (composerReadline) return composerReadline;
  const previousKeypressHandlers = new Set(input.listeners("keypress"));
  const rl = createInterface({
    input,
    output,
    // Notre picker gère Tab ; ce completer vide empêche readline d'insérer
    // littéralement une tabulation après notre sélection.
    completer: () => [[], ""]
  });
  composerReadlineKeypressHandlers.set(
    rl,
    input.listeners("keypress").filter((listener) => !previousKeypressHandlers.has(listener))
  );
  composerReadline = rl;
  rl.once("close", () => {
    if (composerReadline === rl) composerReadline = undefined;
  });
  return rl;
}

export function closeComposerReadline(): void {
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

export function questionWithInterrupt(rl: ReturnType<typeof createInterface>, prompt: string): Promise<TuiQuestionResult> {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
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
      // Annule la question readline active sans fermer le reader partagé. Fermer ici
      // peut laisser le prochain composer sans focus sous ConPTY ; laisser la question
      // active ferait au contraire consommer le prochain Entrée par l'ancien callback.
      controller.abort();
      settle({ kind });
    };

    rl.once("SIGINT", onSigint);
    try {
      rl.question(prompt, { signal: controller.signal }, (value) => settle({ kind: "answer", value }));
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
  const result = await promptTuiChatMessageWithReadline(getComposerReadline(), messages);
  if (result.kind === "quit") closeComposerReadline();
  return result;
}

/** Lit uniquement une commande de navigation après un écran informatif. */
export async function promptTuiNavigation(messages: Messages, label = messages.tui.navigationPrompt): Promise<TuiHomeInput> {
  if (!input.isTTY) return undefined;
  const result = await promptTuiNavigationWithReadline(getComposerReadline(), messages, undefined, label);
  if (!result) closeComposerReadline();
  return result;
}

/** Lit la confirmation explicite de l'écran `/update` avec le même composer et le même Ctrl+C que les autres vues. */
export async function promptTuiUpdate(info: UpdateInfo, messages: Messages): Promise<TuiHomeInput> {
  if (!input.isTTY) return { kind: "home" };

  const rl = getComposerReadline();
  const layout = updateComposerPrompt(messages);
  const choices: TuiCompletionChoice[] = canApplyUpdate(info)
    ? [
        { value: "update", label: info.channel === "source" ? messages.tui.updateSourceActionNow : messages.tui.updateActionNow },
        { value: "later", label: messages.tui.updateLater }
      ]
    : [{ value: "later", label: messages.tui.updateLater }];
  const result = await questionWithBufferedComposer(
    rl,
    layout.prompt,
    layout.linePrompt,
    layout.trailingLines,
    undefined,
    "navigation",
    undefined,
    messages.tui,
    { choices, defaultValue: choices[0]?.value, showOnEmpty: true }
  );

  if (result.kind === "quit") {
    closeComposerReadline();
    return undefined;
  }
  if (result.kind === "back") return { kind: "home" };
  return result.value.trim().toLocaleLowerCase() === "update"
    ? { kind: "apply-update" }
    : { kind: "home" };
}

/** Variante injectable du mini-composer de navigation pour les tests. */
export async function promptTuiNavigationWithReadline(
  rl: ReturnType<typeof createInterface>,
  messages: Messages,
  streams: { input: NodeJS.ReadableStream; output: NodeJS.WritableStream; interactiveOutput?: boolean } = { input, output },
  label = messages.tui.navigationPrompt
): Promise<TuiHomeInput> {
  let notice: string | undefined;
  for (;;) {
    const layout = navigationComposerPrompt(messages, label, notice);
    notice = undefined;
    const result = await questionWithBufferedComposer(
      rl,
      layout.prompt,
      layout.linePrompt,
      layout.trailingLines,
      streams,
      "navigation",
      undefined,
      messages.tui
    );
    if (result.kind === "quit") return undefined;
    if (result.kind === "back") return { kind: "home" };

    const command = result.value.trim().toLowerCase();
    if (["/quit", "/q", "/exit"].includes(command)) return undefined;
    if (!command || ["/home", "/back", "/b"].includes(command)) return { kind: "home" };
    notice = messages.tui.unknownCommand;
  }
}

/** Lit un message Chat sans fermer le reader partagé entre Chat, Home et Config. */
export function promptTuiChatMessageWithReadline(
  rl: ReturnType<typeof createInterface>,
  messages: Messages,
  streams: { input: NodeJS.ReadableStream; output: NodeJS.WritableStream; interactiveOutput?: boolean } = { input, output }
): Promise<TuiQuestionResult> {
  const prompt = renderChatSessionPrompt(messages);
  const linePrompt = `${surfacePadding()}${accent(glyphs().prompt)} `;
  return questionWithBufferedComposer(rl, prompt, linePrompt, 0, streams, "chat", undefined, messages.tui);
}


/** Agrège les lignes reçues dans la même rafale de collage en une seule réponse. */
export function questionWithBufferedComposer(
  rl: ReturnType<typeof createInterface>,
  prompt: string,
  linePrompt: string,
  trailingLines: number,
  streams: { input: NodeJS.ReadableStream; output: NodeJS.WritableStream; interactiveOutput?: boolean } = { input, output },
  completionContext: TuiCommandCompletionContext = "home",
  activeMode?: TuiHomeMode,
  completionMessages?: TuiCompletionMessages,
  completionPicker?: TuiCompletionPicker
): Promise<TuiQuestionResult> {
  return new Promise((resolve) => {
    const composerInput = streams.input;
    const composerOutput = streams.output;
    const interactiveOutput = streams.interactiveOutput ?? supportsInteractiveOutput;
    const readlineKeypressHandlers = composerInput === input
      ? composerReadlineKeypressHandlers.get(rl) ?? []
      : [];
    const controlsReadlineInput = readlineKeypressHandlers.length > 0;
    const lines: string[] = [];
    let timer: ReturnType<typeof setTimeout> | undefined;
    let completionRenderTimer: ReturnType<typeof setTimeout> | undefined;
    let settled = false;
    let completionMenuRows = 0;
    let completionSuffix = "";
    let selectedCommand: string | undefined;
    let completionRenderQueued = false;
    let submissionPending = false;
    const clearPlaceholder = (
      value: string,
      key: { ctrl?: boolean; meta?: boolean; name?: string }
    ) => {
      const navigationKey = key.name && ["backspace", "delete", "left", "right", "up", "down"].includes(key.name);
      if (!value && (key.ctrl || key.meta || navigationKey)) {
        composerInput.prependOnceListener("keypress", clearPlaceholder);
        return;
      }
      if (interactiveOutput) composerOutput.write("\u001b[0K");
    };
    const clearCompletionSuffix = () => {
      if (!completionSuffix || !interactiveOutput) return;
      composerOutput.write("\u001b[0K");
      completionSuffix = "";
    };
    const restoreComposerCursor = (rows: number) => {
      const cursorColumn = visibleLength(linePrompt) + rl.cursor;
      composerOutput.write(`\u001b[${rows}A\r${cursorColumn > 0 ? `\u001b[${cursorColumn}C` : ""}`);
    };
    const clearCompletionMenu = () => {
      if (completionMenuRows === 0 || !interactiveOutput) return;

      composerOutput.write("\r\n");
      for (let index = 0; index < completionMenuRows; index += 1) {
        composerOutput.write("\u001b[2K");
        if (index < completionMenuRows - 1) composerOutput.write("\r\n");
      }
      restoreComposerCursor(completionMenuRows);
      completionMenuRows = 0;
    };
    const matchingCommands = () => {
      if (rl.cursor !== rl.line.length) return [];
      if (completionPicker) {
        if (/\s/.test(rl.line)) return [];
        const prefix = rl.line.toLocaleLowerCase();
        return completionPicker.choices
          .map((choice) => choice.value)
          .filter((value) => value.toLocaleLowerCase().startsWith(prefix));
      }
      const [matches] = completeTuiCommand(rl.line, completionContext, activeMode);
      return matches;
    };
    const selectedCompletion = () => {
      const matches = matchingCommands();
      if (!matches.includes(selectedCommand ?? "")) {
        selectedCommand = completionPicker?.defaultValue && matches.includes(completionPicker.defaultValue)
          ? completionPicker.defaultValue
          : matches[0];
      }
      return { matches, command: selectedCommand };
    };
    const renderCompletion = () => {
      completionRenderQueued = false;
      clearCompletionSuffix();
      clearCompletionMenu();

      if (submissionPending) return;

      const { matches, command } = selectedCompletion();
      if (!command || (!completionPicker && command === rl.line) || !interactiveOutput) return;

      completionSuffix = command.slice(rl.line.length);
      if (completionSuffix) {
        composerOutput.write(`${dim(completionSuffix)}\u001b[${completionSuffix.length}D`);
      }

      const selectedIndex = Math.max(0, matches.indexOf(command));
      const visibleStart = Math.min(
        Math.max(0, selectedIndex - 3),
        Math.max(0, matches.length - 7)
      );
      const visibleMatches = matches.slice(visibleStart, visibleStart + 7);
      const commandWidth = Math.max(...visibleMatches.map((match) => (
        completionPicker?.choices.find((choice) => choice.value === match)?.label ?? match
      ).length));
      const menuLines = [
        "",
        ...visibleMatches.map((match) => {
          const choice = completionPicker?.choices.find((item) => item.value === match);
          const commandCell = (choice?.label ?? match).padEnd(commandWidth);
          const description = choice?.description
            ?? completionMessages?.commandDescription(match)
            ?? "";
          return `${surfacePadding()}${match === command
            ? `${accent(`${glyphs().pointer} ${commandCell}`)}${description ? `   ${description}` : ""}`
            : `  ${commandCell}${description ? `   ${dim(description)}` : ""}`}`;
        }),
        "",
        dim(`${surfacePadding()}${completionMessages?.completionNavigationHint ?? "↑↓ choisir  ·  Tab ou → compléter  ·  Entrée lancer"}`)
      ];
      completionMenuRows = menuLines.length;
      composerOutput.write(`\r\n${menuLines.join("\r\n")}`);
      restoreComposerCursor(completionMenuRows);
    };
    const cancelCompletionRender = () => {
      if (completionRenderTimer) clearTimeout(completionRenderTimer);
      completionRenderTimer = undefined;
      completionRenderQueued = false;
    };
    const queueCompletionRender = (delay = 0, replace = false) => {
      if (replace) cancelCompletionRender();
      if (submissionPending || completionRenderQueued) return;
      completionRenderQueued = true;
      completionRenderTimer = setTimeout(() => {
        completionRenderTimer = undefined;
        completionRenderQueued = false;
        if (settled || submissionPending) return;
        if (interactiveOutput) {
          composerOutput.write(`\r\u001b[2K${linePrompt}${rl.line}`);
        }
        renderCompletion();
      }, delay);
    };
    const acceptSelectedCompletion = () => {
      const { command } = selectedCompletion();
      if (!command) return false;

      clearCompletionSuffix();
      clearCompletionMenu();
      const mutableReadline = rl as typeof rl & { line: string; cursor: number };
      mutableReadline.line = command;
      mutableReadline.cursor = command.length;
      selectedCommand = command;
      return true;
    };
    const completeCommand = (
      value: string,
      key: { ctrl?: boolean; meta?: boolean; name?: string; sequence?: string; shift?: boolean }
    ) => {
      clearCompletionSuffix();
      clearCompletionMenu();

      if (key.name === "tab" || key.name === "right") {
        const accepted = acceptSelectedCompletion();
        if (accepted) {
          queueCompletionRender(25, true);
        } else if (key.name === "right" && controlsReadlineInput) {
          rl.write(value, key);
        }
        return;
      }

      if (key.name === "return") {
        cancelCompletionRender();
        acceptSelectedCompletion();
        if (controlsReadlineInput) rl.write(value, key);
        return;
      }

      if (key.name === "up" || key.name === "down") {
        const { matches, command } = selectedCompletion();
        if (matches.length > 0) {
          const currentIndex = Math.max(0, matches.indexOf(command ?? ""));
          const offset = key.name === "down" ? 1 : -1;
          selectedCommand = matches[(currentIndex + offset + matches.length) % matches.length];
          queueCompletionRender();
          return;
        }
      }

      if (controlsReadlineInput) rl.write(value, key);
      queueCompletionRender();
    };
    const finishLayout = () => {
      if (!interactiveOutput) return;
      const down = Math.max(0, trailingLines - 1);
      composerOutput.write(`${down > 0 ? `\u001b[${down}B` : ""}\r\n\u001b[?2004l`);
    };
    const cleanup = () => {
      if (timer) clearTimeout(timer);
      cancelCompletionRender();
      rl.off("line", onLine);
      rl.off("SIGINT", onSigint);
      rl.off("close", onClose);
      composerInput.off("keypress", clearPlaceholder);
      composerInput.off("keypress", completeCommand);
      for (const handler of readlineKeypressHandlers) composerInput.on("keypress", handler as (...args: any[]) => void);
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
      submissionPending = true;
      cancelCompletionRender();
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
    (rl as typeof rl & { history: string[] }).history = [];
    rl.setPrompt(linePrompt);
    for (const handler of readlineKeypressHandlers) composerInput.off("keypress", handler as (...args: any[]) => void);
    composerInput.prependListener("keypress", completeCommand);
    composerInput.prependOnceListener("keypress", clearPlaceholder);
    composerInput.resume();
    if (interactiveOutput) composerOutput.write("\u001b[?2004h");
    composerOutput.write(prompt);
    if (completionPicker?.showOnEmpty) queueCompletionRender();
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
    const result = await questionWithBufferedComposer(rl, layout.prompt, layout.linePrompt, layout.trailingLines, undefined, "home", mode, messages.tui);
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
      keepReader = true;
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
      keepReader = true;
      return { kind: "roles", roles: parts.slice(1) };
    }

    if (value.startsWith("/")) {
      return { kind: "invalid", message: messages.tui.unknownCommand };
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
    const result = await questionWithBufferedComposer(rl, layout.prompt, layout.linePrompt, layout.trailingLines, undefined, "config", undefined, messages.tui);
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
      return { kind: "unknown", message: messages.tui.interfaceUsage };
    }

    if (command === "/language" || command === "/langue" || command === "/lang") {
      const value = parts[1];
      if (value === "fr" || value === "en") {
        return { kind: "language", language: value };
      }
      return { kind: "unknown", message: messages.tui.languageUsage };
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
    if (!keepReader) closeComposerReadline();
  }
}

/** Assistant minimal pour modifier les agents du mode courant. */
export async function promptTuiAgentsWizard(config: PalabreConfig, mode: PalabreMode, messages: Messages): Promise<TuiAgentsWizardInput> {
  if (!input.isTTY) {
    return { kind: "back" };
  }

  renderTuiAgentsHelp(config, mode, messages);
  const rl = getComposerReadline();
  let keepReader = false;
  try {
    const linePrompt = `${surfacePadding()}${accent(glyphs().prompt)} `;
    const result = await questionWithBufferedComposer(
      rl,
      tuiPrompt(mode, messages.tui.agentsPrompt, messages),
      linePrompt,
      0,
      undefined,
      "navigation",
      undefined,
      messages.tui
    );
    if (result.kind === "quit") {
      return { kind: "quit" };
    }
    if (result.kind === "back") {
      keepReader = true;
      return { kind: "back" };
    }
    const value = result.value.trim();
    if (!value || value === "/home" || value === "/back") {
      keepReader = true;
      return { kind: "back" };
    }
    if (value === "/quit" || value === "/q") {
      return { kind: "quit" };
    }
    keepReader = true;
    return { kind: "agents", agents: value.split(/\s+/).filter(Boolean) };
  } finally {
    if (!keepReader) closeComposerReadline();
  }
}

/** Assistant minimal pour modifier les roles du mode courant. */
export async function promptTuiRolesWizard(config: PalabreConfig, mode: PalabreMode, messages: Messages): Promise<TuiRolesWizardInput> {
  if (!input.isTTY) {
    return { kind: "back" };
  }

  renderTuiRolesHelp(mode, messages, config);
  const rl = getComposerReadline();
  let keepReader = false;
  try {
    const linePrompt = `${surfacePadding()}${accent(glyphs().prompt)} `;
    const result = await questionWithBufferedComposer(
      rl,
      tuiPrompt(mode, messages.tui.rolesPrompt, messages),
      linePrompt,
      0,
      undefined,
      "navigation",
      undefined,
      messages.tui
    );
    if (result.kind === "quit") {
      return { kind: "quit" };
    }
    if (result.kind === "back") {
      keepReader = true;
      return { kind: "back" };
    }
    const answer = result.value;
    const value = answer.trim();
    if (!value || value === "/home" || value === "/back") {
      keepReader = true;
      return { kind: "back" };
    }
    if (value === "/quit" || value === "/q") {
      return { kind: "quit" };
    }
    keepReader = true;
    return { kind: "roles", roles: value.split(/\s+/).filter(Boolean) };
  } finally {
    if (!keepReader) closeComposerReadline();
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
    promptTrail(mode, messages.tui.subject, messages),
    messages.tui.composerPlaceholder(mode),
    undefined,
    notice,
    bare
  );
}

/** Variante Config du composer partagé. */
function configComposerPrompt(_mode: TuiHomeMode, messages: Messages): ComposerPromptLayout {
  return framedComposerPrompt(
    sectionTrail(messages.tui.configScreen),
    messages.tui.configComposerPlaceholder,
    undefined
  );
}

/** Variante partagée des écrans informatifs : même règle, même curseur, retour explicite. */
function navigationComposerPrompt(messages: Messages, label: string, notice?: string): ComposerPromptLayout {
  return framedComposerPrompt(
    sectionTrail(label),
    messages.tui.navigationComposerPlaceholder,
    undefined,
    notice
  );
}

/** Variante de l'écran update : un choix actionnable, sans introduire un second système de saisie. */
function updateComposerPrompt(messages: Messages): ComposerPromptLayout {
  return framedComposerPrompt(
    sectionTrail(messages.tui.updateScreen),
    messages.tui.updateComposerPlaceholder,
    undefined
  );
}

interface ComposerPromptLayout {
  prompt: string;
  linePrompt: string;
  trailingLines: number;
}

/** Primitive commune aux composers Accueil et Config. */
function framedComposerPrompt(
  trail: string,
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
    `${padding}${labeledRule(trail, violet)}`,
    ...(notice ? promptNoticeLines(notice) : []),
    ...tipLines,
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
    `${padding}${labeledRule(sectionTrail(messages.tui.modeValue("chat")), violet)}`,
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

function promptTrail(mode: TuiHomeMode, labelPrefix: string, messages: Messages): string {
  const parts = [bold("Palabre"), accent(messages.tui.modeValue(mode))];
  if (labelPrefix !== messages.tui.subject) {
    parts.push(bold(labelPrefix));
  }
  return parts.join(` ${dim(glyphs().pointer)} `);
}

function sectionTrail(label: string): string {
  return [bold("Palabre"), accent(label)].join(` ${dim(glyphs().pointer)} `);
}

function composerInputBox(mode: PalabreMode, labelPrefix: string, width: number, messages: Messages): string[] {
  return composerCard([
    `${promptTrail(mode, labelPrefix, messages)} ${accent(glyphs().prompt)}`
  ], width);
}

function isNoneValue(value: string): boolean {
  return ["none", "aucun", "off", "non", "0", "disabled"].includes(value.toLowerCase());
}
