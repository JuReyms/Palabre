/** @file Export Markdown d'une conversation chat Palabre. */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { DebateMessage, SessionContext } from "./types.js";
import type { Messages } from "./messages/index.js";

export async function writeChatMarkdown(outputDir: string, topic: string, transcript: DebateMessage[], session: SessionContext, messages: Messages): Promise<string> {
  const safeDate = new Date().toISOString().replace(/[:.]/g, "-");
  const slug = (topic || "conversation").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64) || "conversation";
  const filePath = path.resolve(outputDir, `palabre-${slug}-${safeDate}.chat.md`);
  const agents = [...new Set(transcript.filter((message) => message.agent !== "user").map((message) => message.agent))].join(", ");
  const lines = [messages.chat.exportTitle, "", `| ${messages.chat.exportSubject} | ${topic || messages.chat.openingPrompt.trim()} |`, `| ${messages.chat.exportAgents} | ${agents} |`, `| ${messages.chat.exportStartedAt} | ${session.startedAt} |`, `| ${messages.chat.exportMessages} | ${transcript.length} |`, "", `## ${messages.chat.exportMessages}`, ""];
  for (const message of transcript) lines.push(`### ${message.agent} (${message.role})`, "", message.content.trim(), "");
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${lines.join("\n")}\n`, "utf8");
  return filePath;
}