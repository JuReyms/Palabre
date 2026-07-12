/** @file Rendu plein terminal d'une conversation Palabre et de ses consultations. */
import { sanitizeTerminalText } from "../adapters/terminal.js";
import type { AgentRole, DebateMessage } from "../types.js";
import type { Messages } from "../messages/index.js";
import { accentBar, brandHeader, card, clearScreen, dim, padBlock, surfaceWidth, supportsInteractiveOutput } from "./tui-theme.js";

export function renderTuiChat(agentName: string, role: AgentRole, transcript: DebateMessage[], messages: Messages, notice?: string): void {
  if (supportsInteractiveOutput) clearScreen();
  const width = surfaceWidth();
  const recent = transcript.slice(-6);
  const lines = ["", ...padBlock([brandHeader(messages.chat.intro(agentName, role))]), ""];
  if (notice) lines.push(...padBlock(card([sanitizeTerminalText(notice)], width)), "");
  if (recent.length === 0) {
    lines.push(...padBlock(card([messages.chat.openingPrompt.trim(), dim(messages.chat.endHint)], width, "Conversation")), "");
  } else {
    for (const message of recent) {
      const title = message.agent === "user" ? messages.chat.questionPrompt.trim() : message.agent === agentName ? messages.chat.assistantLabel(message.agent) : messages.chat.consultationLabel(message.agent);
      lines.push(...padBlock([title, ...accentBar([sanitizeTerminalText(message.content)], width, message.agent)]), "");
    }
  }
  lines.push(...padBlock([dim(messages.chat.endHint)]));
  process.stdout.write(lines.join("\n") + "\n");
}
export function renderTuiChatComplete(outputPath: string, messages: Messages): void {
  if (supportsInteractiveOutput) clearScreen();
  const folder = outputPath.slice(0, Math.max(outputPath.lastIndexOf("/"), outputPath.lastIndexOf("\\")));
  process.stdout.write(["", ...padBlock([brandHeader(messages.chat.sessionEnded)]), "", ...padBlock(card([`${messages.chat.exportedFile}: ${outputPath}`, `${messages.chat.exportedFolder}: ${folder}`, "", messages.chat.returnHint], surfaceWidth())), ""].join("\n"));
}