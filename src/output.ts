import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createTranslator } from "./i18n.js";
import type { Messages } from "./messages/index.js";
import type { DebateMessage, DebateOptions, DebateSummary } from "./types.js";

/**
 * Écrit le débat au format Markdown dans `outputDir`.
 * Crée le répertoire si absent. Retourne le chemin absolu du fichier créé.
 */
export async function writeDebateMarkdown(
  outputDir: string,
  options: DebateOptions,
  debateMessages: DebateMessage[],
  summary?: DebateSummary,
  stopReason?: string,
  messages: Messages = createTranslator("fr")
): Promise<string> {
  const safeDate = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `palabre-${slugifyTopic(options.topic)}-${safeDate}.debate.md`;
  const filePath = path.resolve(outputDir, fileName);

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, renderDebateMarkdown(options, debateMessages, summary, stopReason, messages), "utf8");

  return filePath;
}

function slugifyTopic(topic: string): string {
  const slug = topic
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
    .replace(/-+$/g, "");

  return slug || "debat";
}

/**
 * Produit la représentation Markdown complète du débat.
 * Fonction pure : aucun effet de bord sur le filesystem.
 */
export function renderDebateMarkdown(
  options: DebateOptions,
  debateMessages: DebateMessage[],
  summary?: DebateSummary,
  stopReason?: string,
  messages: Messages = createTranslator("fr")
): string {
  const lines = [
    messages.output.title,
    "",
    ...renderSessionHeader(options, debateMessages, stopReason, messages),
    "",
    messages.output.contextTitle,
    "",
    ...renderFileList(options.files, messages),
    "",
    messages.output.exchangesTitle,
    ""
  ];

  for (const message of debateMessages) {
    lines.push(
      `### ${message.agent} (${message.role})`,
      "",
      normalizeMarkdownForWindowsPreview(message.content.trim()),
      ""
    );
  }

  lines.push("---", "", messages.output.finalSummaryTitle, "", ...renderSummaryBlock(options, summary, messages));

  return `${lines.join("\n")}\n`;
}

function renderSummaryBlock(options: DebateOptions, summary: DebateSummary | undefined, messages: Messages): string[] {
  if (summary) {
    return [
      `| ${messages.output.tableField} | ${messages.output.tableValue} |`,
      "| --- | --- |",
      `| ${messages.output.fields.agent} | ${escapeTableCell(summary.agent)} |`,
      `| ${messages.output.fields.role} | ${escapeTableCell(summary.role)} |`,
      `| ${messages.output.fields.date} | ${escapeTableCell(summary.createdAt)} |`,
      "",
      normalizeMarkdownForWindowsPreview(summary.content.trim()),
      ""
    ];
  }

  return [
    options.summaryEnabled
      ? messages.output.summaryMissing
      : messages.output.summaryDisabled,
    ""
  ];
}

function normalizeMarkdownForWindowsPreview(content: string): string {
  return content.replace(/:\*\*/g, "&#58;**");
}

function renderSessionHeader(
  options: DebateOptions,
  debateMessages: DebateMessage[],
  stopReason: string | undefined,
  messages: Messages
): string[] {
  const rows = [
    [messages.output.fields.subject, options.topic],
    [messages.output.fields.agents, `${options.agentA} <-> ${options.agentB}`],
    [messages.output.fields.autoPullOllama, options.pullModels ? messages.output.yes : messages.output.no],
    [messages.output.fields.summary, options.summaryEnabled ? options.summaryAgent ?? options.agentB : messages.output.disabled],
    [messages.output.fields.requestedTurns, String(options.turns)],
    [messages.output.fields.playedTurns, String(debateMessages.length)],
    [messages.output.fields.earlyStop, stopReason ?? messages.output.no],
    [messages.output.fields.localDate, options.session.localDate],
    [messages.output.fields.timeZone, options.session.timeZone],
    [messages.output.fields.cwd, options.session.cwd],
    [messages.output.fields.sessionStartedAt, options.session.startedAt]
  ];

  return [
    `| ${messages.output.tableField} | ${messages.output.tableValue} |`,
    "| --- | --- |",
    ...rows.map(([label, value]) => `| ${escapeTableCell(label)} | ${escapeTableCell(value)} |`)
  ];
}

function escapeTableCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>");
}

function renderFileList(files: DebateOptions["files"], messages: Messages): string[] {
  if (files.length === 0) {
    return [messages.output.noFileContext];
  }

  return files.map((file) => `- \`${file.path}\` (${file.sizeBytes} ${messages.output.fileSizeUnit})`);
}
