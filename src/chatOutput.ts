/** @file Export Markdown d'une conversation chat Palabre. */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ChatTermination, DebateMessage, SessionContext } from "./types.js";
import type { Messages } from "./messages/index.js";
import { getPackageVersion } from "./version.js";

export async function writeChatMarkdown(outputDir: string, topic: string, transcript: DebateMessage[], session: SessionContext, termination: ChatTermination, messages: Messages): Promise<string> {
  const safeDate = new Date().toISOString().replace(/[:.]/g, "-");
  const slug = (topic || "conversation").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64) || "conversation";
  const filePath = path.resolve(outputDir, `palabre-${slug}-${safeDate}.chat.md`);
  const agents = [...new Set(transcript.filter((message) => message.agent !== "user").map((message) => message.agent))].join(", ");
  const palabreVersion = await getPackageVersion();
  const rows = [
    [messages.output.fields.palabreVersion, palabreVersion],
    [messages.output.fields.invocationSource, session.invocation?.client ?? "direct-cli"],
    ...(session.invocation?.clientVersion
      ? [[messages.output.fields.clientVersion, session.invocation.clientVersion]]
      : []),
    [messages.chat.exportSubject, topic || messages.chat.openingPrompt.trim()],
    [messages.chat.exportAgents, agents],
    [messages.chat.exportStartedAt, session.startedAt],
    [messages.chat.exportEndedAt, termination.endedAt],
    [messages.chat.exportStopReason, messages.chat.exportStopReasonValue(termination.reason)],
    ...(termination.errorMessage ? [[messages.chat.exportError, termination.errorMessage]] : []),
    [messages.chat.exportMessages, String(transcript.length)]
  ];
  const lines = [
    messages.chat.exportTitle,
    "",
    "| | |",
    "| --- | --- |",
    ...rows.map(([label, value]) => `| ${escapeTableCell(label!)} | ${escapeTableCell(value!)} |`),
    "",
    `## ${messages.chat.exportMessages}`,
    ""
  ];
  for (const message of transcript) {
    lines.push(`### ${escapeHeading(message.agent)} (${escapeHeading(message.role)})`, "", normalizeMarkdownForWindowsPreview(message.content.trim()), "");
  }
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${lines.join("\n")}\n`, "utf8");
  return filePath;
}

function escapeTableCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim();
}

function escapeHeading(value: string): string {
  return value.replace(/[\r\n]+/g, " ").replace(/#/g, "\\#").trim();
}

function normalizeMarkdownForWindowsPreview(content: string): string {
  return content.replace(/:\*\*/g, "&#58;**");
}
