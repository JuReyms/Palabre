/** @file Session de chat TUI : saisie et rendu au-dessus du contrôleur Chat partagé. */
import { ChatSession } from "./chatSession.js";
import { nextTuiInterruptKind, promptTuiChatMessage, promptTuiHomeTopic, type TuiHomeInput, type TuiQuestionResult } from "./renderers/tui-prompts.js";
import { renderTuiChat, renderTuiChatComplete } from "./renderers/tui-chat.js";
import { createTuiRenderer } from "./renderers/tui-renderer.js";
import type { AgentRole, ChatOptions, DebateMessage, DebateRenderer, PalabreConfig } from "./types.js";
import type { Messages } from "./messages/index.js";

export interface TuiChatSessionResult {
  destination: "home" | "quit";
  nextInput?: TuiHomeInput;
}

/**
 * Entrées et sorties terminal de la session Chat TUI. Les valeurs par défaut pilotent le vrai
 * terminal ; les tests fournissent une saisie scriptée et un rendu capturé, sans TTY.
 */
export interface TuiChatIo {
  promptMessage(messages: Messages): Promise<TuiQuestionResult>;
  promptHomeTopic(messages: Messages): Promise<TuiHomeInput>;
  render(agentName: string, transcript: DebateMessage[], messages: Messages, notice?: string): void;
  renderComplete(outputPath: string, messages: Messages): void;
  thinking: Pick<DebateRenderer, "thinkingStart" | "thinkingEnd">;
}

function defaultTuiChatIo(messages: Messages): TuiChatIo {
  return {
    promptMessage: promptTuiChatMessage,
    promptHomeTopic: (translations) => promptTuiHomeTopic("chat", translations, { bare: true }),
    render: renderTuiChat,
    renderComplete: renderTuiChatComplete,
    thinking: createTuiRenderer(messages)
  };
}

/**
 * Boucle de la conversation Chat dans la TUI.
 *
 * Une saisie vide ou composée d'espaces reste dans la conversation et redemande une entrée, sans
 * appel agent ni export (#103). `/home`, `/back`, `/exit` et `/quit` reviennent à l'accueil sans
 * export ; `/end` exporte. Le rôle affiché pendant une génération est le rôle effectif de l'agent,
 * overrides runtime compris (`ChatSession.agentConfig`).
 */
export async function runTuiChatSession(
  config: PalabreConfig,
  options: ChatOptions,
  messages: Messages,
  outputDir: string,
  initialMessage?: string,
  initialNotice?: string,
  io: TuiChatIo = defaultTuiChatIo(messages)
): Promise<TuiChatSessionResult> {
  const chat = new ChatSession(config, options, messages);
  const renderer = io.thinking;
  let notice = initialNotice;

  try {
    if (initialMessage) {
      await runChatTurnWithThinking(renderer, chat.activeAgentName, chat.activeAgentConfig.role, () => chat.send(initialMessage));
    }

    for (;;) {
      io.render(chat.activeAgentName, chat.messages, messages, notice);
      notice = undefined;
      const input = await io.promptMessage(messages);
      if (input.kind !== "answer") return { destination: tuiChatInterruptResult(input.kind) };

      const value = input.value.trim();
      // Une saisie vide ne quitte jamais la conversation : seules les commandes explicites le font.
      if (!value) continue;
      if (value === "/exit" || value === "/quit" || value === "/home" || value === "/back") return { destination: "home" };
      if (value === "/end") {
        if (chat.messages.length === 0) { notice = messages.chat.consultationUnavailable; continue; }
        const outputPath = await chat.export(outputDir, userEndedChat());
        io.renderComplete(outputPath, messages);
        const nextInput = await io.promptHomeTopic(messages);
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
        const consultedAgent = chat.availableAgents.find((agent) => agent.name === agentName);
        if (!consultedAgent) { notice = messages.chat.unknownAgent(agentName); continue; }
        notice = messages.chat.consulting(agentName);
        io.render(chat.activeAgentName, chat.messages, messages, notice);
        // Rôle effectif de la consultation (overrides runtime inclus), pas le rôle brut de la config.
        const consultedRole = chat.agentConfig(consultedAgent.name).role;
        try {
          await runChatTurnWithThinking(renderer, agentName, consultedRole, () => chat.consult(agentName));
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

      await runChatTurnWithThinking(renderer, chat.activeAgentName, chat.activeAgentConfig.role, () => chat.send(value));
      notice = trimNotice(chat, messages);
    }
  } catch (error) {
    if (chat.aborted) {
      return { destination: tuiChatInterruptResult(nextTuiInterruptKind()) };
    }
    const outputPath = await exportFailedChat(chat, outputDir, error);
    if (outputPath) process.stderr.write(`${messages.chat.failureExported(outputPath)}\n`);
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
export async function runChatTurnWithThinking<T>(
  renderer: Pick<DebateRenderer, "thinkingStart" | "thinkingEnd">,
  agentName: string,
  role: AgentRole,
  operation: () => Promise<T>
): Promise<T> {
  renderer.thinkingStart(agentName, role);
  try {
    return await operation();
  } finally {
    renderer.thinkingEnd();
  }
}

function userEndedChat(): import("./types.js").ChatTermination {
  return { reason: "user-end", endedAt: new Date().toISOString() };
}

async function exportFailedChat(chat: ChatSession, outputDir: string, error: unknown): Promise<string | undefined> {
  try {
    return await chat.export(outputDir, {
      reason: "error",
      endedAt: new Date().toISOString(),
      errorMessage: error instanceof Error ? error.message : String(error)
    });
  } catch {
    return undefined;
  }
}
