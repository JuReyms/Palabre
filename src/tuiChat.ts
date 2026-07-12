/** @file Session de chat TUI : conversation, consultation explicite et bascule d'agent. */
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { runStatelessChatTurn, runStatelessConsultation } from "./chat.js";
import { nextTuiInterruptKind } from "./renderers/tui-prompts.js";
import { renderTuiChat, renderTuiChatComplete } from "./renderers/tui-chat.js";
import { createTuiRenderer } from "./renderers/tui-renderer.js";
import { writeChatMarkdown } from "./chatOutput.js";
import { createSessionContext } from "./session.js";
import type { AgentRole, ChatAvailableAgent, DebateMessage, Language, PalabreConfig } from "./types.js";
import type { Messages } from "./messages/index.js";

export async function runTuiChatSession(config: PalabreConfig, language: Language, messages: Messages, outputDir: string, initialMessage?: string): Promise<"home" | "quit"> {
  const availableAgents: ChatAvailableAgent[] = Object.entries(config.agents).map(([name, agent]) => ({ name, role: agent.role }));
  let activeAgentName = config.defaults?.agentA;
  if (!activeAgentName || !config.agents[activeAgentName]) throw new Error(messages.common.noAgentDefined("agent de conversation"));
  let activeAgentConfig = config.agents[activeAgentName];
  const transcript: DebateMessage[] = [];
  const renderer = createTuiRenderer(messages);
  const session = createSessionContext();
  let topic = initialMessage ?? "";

  if (initialMessage) {
    const turn = await runChatTurnWithThinking(renderer, activeAgentName, activeAgentConfig.role, () => runStatelessChatTurn({
      agentName: activeAgentName!, agentConfig: activeAgentConfig, topic, userMessage: initialMessage, transcript, availableAgents, language, session, files: []
    }));
    transcript.push(turn.user, turn.assistant);
  }

  let notice: string | undefined;
  const readline = createInterface({ input: stdin, output: stdout });
  let interruptKind: "back" | "quit" | undefined;
  readline.on("SIGINT", () => { interruptKind = nextTuiInterruptKind(); readline.close(); });
  try {
    for (;;) {
      renderTuiChat(activeAgentName, activeAgentConfig.role, transcript, messages, notice);
      notice = undefined;
      let value: string;
      try { value = (await readline.question(`${messages.chat.questionPrompt}`)).trim(); } catch { return interruptKind === "quit" ? "quit" : "home"; }
      if (!value || value === "/exit" || value === "/quit" || value === "/home" || value === "/back") return "home";
      if (value === "/end") {
        if (transcript.length === 0) { notice = messages.chat.consultationUnavailable; continue; }
        const outputPath = await writeChatMarkdown(outputDir, topic, transcript, session, messages);
        renderTuiChatComplete(outputPath, messages);
        await readline.question("");
        return "home";
      }

      const [command, agentName] = value.split(/\s+/, 2);
      if (command === "/agents") { notice = messages.chat.availableAgents(availableAgents); continue; }
      if (command === "/use") {
        if (!agentName) { notice = messages.chat.useUsage; continue; }
        const selected = config.agents[agentName];
        if (!selected) { notice = messages.chat.unknownAgent(agentName); continue; }
        activeAgentName = agentName;
        activeAgentConfig = selected;
        notice = messages.chat.switchedTo(agentName);
        continue;
      }
      if (command === "/consult") {
        if (!agentName) { notice = messages.chat.consultUsage; continue; }
        const consultedName = agentName;
        const consulted = config.agents[consultedName];
        if (!consulted) { notice = messages.chat.unknownAgent(consultedName); continue; }
        if (transcript.length === 0) { notice = messages.chat.consultationUnavailable; continue; }
        notice = messages.chat.consulting(consultedName);
        renderTuiChat(activeAgentName, activeAgentConfig.role, transcript, messages, notice);
        const opinion = await runChatTurnWithThinking(renderer, consultedName, consulted.role, () => runStatelessConsultation({
          agentName: consultedName, agentConfig: consulted, requesterName: activeAgentName!, topic, transcript, availableAgents, language, session, files: []
        }));
        transcript.push(opinion);
        continue;
      }

      if (!topic) topic = value;
      const turn = await runChatTurnWithThinking(renderer, activeAgentName, activeAgentConfig.role, () => runStatelessChatTurn({
        agentName: activeAgentName!, agentConfig: activeAgentConfig, topic, userMessage: value, transcript, availableAgents, language, session, files: []
      }));
      transcript.push(turn.user, turn.assistant);
    }
  } finally {
    readline.close();
  }
}

/** Réutilise le spinner TUI standard pendant toute génération Chat. */
async function runChatTurnWithThinking<T>(renderer: ReturnType<typeof createTuiRenderer>, agentName: string, role: AgentRole, operation: () => Promise<T>): Promise<T> {
  renderer.thinkingStart(agentName, role);
  try {
    return await operation();
  } finally {
    renderer.thinkingEnd();
  }
}