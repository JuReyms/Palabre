/** @file Rendu plein terminal d'une conversation Palabre avec les primitives visuelles Debate. */
import path from "node:path";
import { sanitizeTerminalText } from "../adapters/terminal.js";
import type { DebateMessage } from "../types.js";
import type { Messages } from "../messages/index.js";
import {
  accent,
  accentBar,
  agentLabel,
  bold,
  brandHeader,
  card,
  clearScreen,
  compactFileName,
  compactPath,
  dim,
  glyphs,
  padBlock,
  panel,
  row,
  success,
  surfaceWidth,
  supportsInteractiveOutput,
  terminalLink,
  underlineFor
} from "./tui-theme.js";

export function renderTuiChat(agentName: string, transcript: DebateMessage[], messages: Messages, notice?: string): void {
  if (supportsInteractiveOutput) clearScreen();
  const width = surfaceWidth();
  const recent = transcript.slice(-6);
  const lines = [
    "",
    ...padBlock([brandHeader()]),
    ""
  ];

  if (notice) lines.push(...padBlock(card([sanitizeTerminalText(notice)], width)), "");
  if (recent.length === 0) {
    const openingQuestion = messages.chat.openingPrompt.split(/\r?\n/, 1)[0] ?? messages.chat.openingPrompt.trim();
    lines.push(...padBlock(card([openingQuestion], width, "Conversation")), "");
  } else {
    for (const message of recent) {
      const title = messageTitle(message, agentName, messages);
      lines.push(...padBlock(accentBar([
        bold(title),
        underlineFor(title, width, message.agent),
        "",
        ...sanitizeTerminalText(message.content).split(/\r?\n/)
      ], width, message.agent)), "");
    }
  }

  process.stdout.write(lines.join("\n") + "\n");
}

function messageTitle(message: DebateMessage, activeAgent: string, messages: Messages): string {
  if (message.agent === "user") {
    return messages.chat.questionPrompt.trim().replace(/:$/, "");
  }
  if (message.agent === activeAgent) {
    return `${agentLabel(message.agent)} (${message.role})`;
  }
  return `${messages.chat.consultationLabel(message.agent).replace(/:$/, "")} (${message.role})`;
}

/** Ajoute le footer de fin sous la conversation, sans effacer la surface courante. */
export function renderTuiChatComplete(outputPath: string, messages: Messages): void {
  const width = surfaceWidth();
  const folderPath = path.dirname(outputPath);
  const fileName = path.basename(outputPath);
  process.stdout.write(`\n${padBlock(panel([
    `${success(glyphs().check)} ${bold(messages.tui.sessionDone)}`,
    "",
    row(messages.tui.exportedFile, terminalLink(outputPath, compactFileName(fileName, width - 24))),
    row(messages.tui.exportedFolder, terminalLink(folderPath, compactPath(folderPath, width - 24))),
    "",
    `${accent("/new")} ${dim(messages.tui.helpNew)}   ${accent("/debat")} ${dim(messages.tui.changeMode)}   ${accent("/ask")} ${dim(messages.tui.changeMode)}`,
    `${accent("/history")} ${dim(messages.tui.helpHistory)}   ${accent("/config")} ${dim(messages.tui.helpConfig)}   ${accent("/help")} ${dim(messages.tui.helpHelp)}`
  ], width)).join("\n")}\n`);
}
