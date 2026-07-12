/** @file Session de chat TUI : conversation, consultation explicite et bascule d'agent. */
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { runStatelessChatTurn, runStatelessConsultation } from "./chat.js";
import { renderTuiChat } from "./renderers/tui-chat.js";
import { createSessionContext } from "./session.js";
import type { ChatAvailableAgent, DebateMessage, Language, PalabreConfig } from "./types.js";
import type { Messages } from "./messages/index.js";

export async function runTuiChatSession(config: PalabreConfig, language: Language, messages: Messages): Promise<void> {
  const availableAgents: ChatAvailableAgent[] = Object.entries(config.agents).map(([name, agent]) => ({ name, role: agent.role }));
  let activeAgentName = config.defaults?.agentA;
  if (!activeAgentName || !config.agents[activeAgentName]) throw new Error(messages.common.noAgentDefined("agent de conversation"));
  let activeAgentConfig = config.agents[activeAgentName];
  const transcript: DebateMessage[] = [];
  const session = createSessionContext();
  let topic = "";
  let notice: string | undefined;
  const readline = createInterface({ input: stdin, output: stdout });
  try {
    for (;;) {
      renderTuiChat(activeAgentName, activeAgentConfig.role, transcript, messages, notice);
      notice = undefined;
      const value = (await readline.question(`${messages.chat.questionPrompt}`)).trim();
      if (!value || value === "/exit" || value === "/quit" || value === "/home" || value === "/back") return;
      const [command, agentName] = value.split(/\s+/, 2);
      if (command === "/agents") { notice = messages.chat.availableAgents(availableAgents); continue; }
      if (command === "/use") {
        if (!agentName) { notice = messages.chat.useUsage; continue; }
        const selected = config.agents[agentName];
        if (!selected) { notice = messages.chat.unknownAgent(agentName); continue; }
        activeAgentName = agentName; activeAgentConfig = selected; notice = messages.chat.switchedTo(agentName); continue;
      }
      if (command === "/consult") {
        if (!agentName) { notice = messages.chat.consultUsage; continue; }
        const consulted = config.agents[agentName];
        if (!consulted) { notice = messages.chat.unknownAgent(agentName); continue; }
        if (transcript.length === 0) { notice = messages.chat.consultationUnavailable; continue; }
        notice = messages.chat.consulting(agentName);
        renderTuiChat(activeAgentName, activeAgentConfig.role, transcript, messages, notice);
        const opinion = await runStatelessConsultation({ agentName, agentConfig: consulted, requesterName: activeAgentName, topic, transcript, availableAgents, language, session, files: [] });
        transcript.push(opinion); continue;
      }
      if (!topic) topic = value;
      const turn = await runStatelessChatTurn({ agentName: activeAgentName, agentConfig: activeAgentConfig, topic, userMessage: value, transcript, availableAgents, language, session, files: [] });
      transcript.push(turn.user, turn.assistant);
    }
  } finally { readline.close(); }
}