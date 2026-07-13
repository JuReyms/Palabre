/** @file Session de chat TUI : saisie et rendu au-dessus du contrôleur Chat partagé. */
import { ChatSession } from "./chatSession.js";
import { nextTuiInterruptKind, promptTuiChatMessage, promptTuiHomeTopic, type TuiHomeInput } from "./renderers/tui-prompts.js";
import { renderTuiChat, renderTuiChatComplete } from "./renderers/tui-chat.js";
import { createTuiRenderer } from "./renderers/tui-renderer.js";
import type { ChatOptions, PalabreConfig } from "./types.js";
import type { Messages } from "./messages/index.js";

export interface TuiChatSessionResult {
  destination: "home" | "quit";
  nextInput?: TuiHomeInput;
}

export async function runTuiChatSession(
  config: PalabreConfig,
  options: ChatOptions,
  messages: Messages,
  outputDir: string,
  initialMessage?: string,
  initialNotice?: string
): Promise<TuiChatSessionResult> {
  const chat = new ChatSession(config, options, messages);
  const renderer = createTuiRenderer(messages);
  let notice = initialNotice;

  try {
    if (initialMessage) {
      await runChatTurnWithThinking(renderer, chat, () => chat.send(initialMessage));
    }

    for (;;) {
      renderTuiChat(chat.activeAgentName, chat.messages, messages, notice);
      notice = undefined;
      const input = await promptTuiChatMessage(messages);
      if (input.kind !== "answer") return { destination: tuiChatInterruptResult(input.kind) };

      const value = input.value.trim();
      if (!value || value === "/exit" || value === "/quit" || value === "/home" || value === "/back") return { destination: "home" };
      if (value === "/end") {
        if (chat.messages.length === 0) { notice = messages.chat.consultationUnavailable; continue; }
        const outputPath = await chat.export(outputDir);
        renderTuiChatComplete(outputPath, messages);
        const nextInput = await promptTuiHomeTopic("chat", messages, { bare: true });
        return nextInput
          ? { destination: "home", nextInput }
          : { destination: "quit" };
      }

      const [command, agentName] = value.split(/\s+/, 2);
      if (command === "/agents") { notice = messages.chat.availableAgents(chat.availableAgents); continue; }
      if (command === "/use") {
        if (!agentName) { notice = messages.chat.useUsage; continue; }
        try {
          chat.use(agentName);
          notice = messages.chat.switchedTo(agentName);
        } catch {
          notice = messages.chat.unknownAgent(agentName);
        }
        continue;
      }
      if (command === "/consult") {
        if (!agentName) { notice = messages.chat.consultUsage; continue; }
        if (chat.messages.length === 0) { notice = messages.chat.consultationUnavailable; continue; }
        notice = messages.chat.consulting(agentName);
        renderTuiChat(chat.activeAgentName, chat.messages, messages, notice);
        try {
          await runChatTurnWithThinking(renderer, chat, () => chat.consult(agentName));
          notice = trimNotice(chat, messages);
        } catch (error) {
          if (error instanceof Error && error.message === messages.common.unknownAgent(agentName)) {
            notice = messages.chat.unknownAgent(agentName);
            continue;
          }
          throw error;
        }
        continue;
      }

      await runChatTurnWithThinking(renderer, chat, () => chat.send(value));
      notice = trimNotice(chat, messages);
    }
  } catch (error) {
    if (chat.aborted) {
      return { destination: tuiChatInterruptResult(nextTuiInterruptKind()) };
    }
    throw error;
  }
}

/** Traduit la politique d'interruption TUI en destination de session Chat. */
export function tuiChatInterruptResult(kind: "back" | "quit"): "home" | "quit" {
  return kind === "quit" ? "quit" : "home";
}

function trimNotice(chat: ChatSession, messages: Messages): string | undefined {
  return chat.droppedMessageCount > 0 ? messages.chat.contextTrimmed(chat.droppedMessageCount) : undefined;
}

/** Réutilise le spinner TUI standard pendant toute génération Chat. */
async function runChatTurnWithThinking<T>(
  renderer: ReturnType<typeof createTuiRenderer>,
  chat: ChatSession,
  operation: () => Promise<T>
): Promise<T> {
  renderer.thinkingStart(chat.activeAgentName, chat.activeAgentConfig.role);
  try {
    return await operation();
  } finally {
    renderer.thinkingEnd();
  }
}
