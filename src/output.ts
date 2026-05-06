import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { DebateMessage, DebateOptions, DebateSummary } from "./types.js";

/**
 * Écrit le débat au format Markdown dans `outputDir`.
 * Crée le répertoire si absent. Retourne le chemin absolu du fichier créé.
 */
export async function writeDebateMarkdown(
  outputDir: string,
  options: DebateOptions,
  messages: DebateMessage[],
  summary?: DebateSummary,
  stopReason?: string
): Promise<string> {
  const safeDate = new Date().toISOString().replace(/[:.]/g, "-");
  const filePath = path.resolve(outputDir, `palabre-${safeDate}.debate.md`);

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, renderDebateMarkdown(options, messages, summary, stopReason), "utf8");

  return filePath;
}

/**
 * Produit la représentation Markdown complète du débat.
 * Fonction pure : aucun effet de bord sur le filesystem.
 */
export function renderDebateMarkdown(
  options: DebateOptions,
  messages: DebateMessage[],
  summary?: DebateSummary,
  stopReason?: string
): string {
  const lines = [
    "# PALABRE Debate",
    "",
    ...renderSessionHeader(options, messages, stopReason),
    "",
    "## Contexte",
    "",
    ...renderFileList(options.files),
    "",
    "## Echanges",
    ""
  ];

  for (const message of messages) {
    lines.push(
      `### ${message.agent} (${message.role})`,
      "",
      normalizeMarkdownForWindowsPreview(message.content.trim()),
      ""
    );
  }

  lines.push("---", "", "## Synthese finale", "", ...renderSummaryBlock(options, summary));

  return `${lines.join("\n")}\n`;
}

function renderSummaryBlock(options: DebateOptions, summary?: DebateSummary): string[] {
  if (summary) {
    return [
      "| Champ | Valeur |",
      "| --- | --- |",
      `| Agent | ${escapeTableCell(summary.agent)} |`,
      `| Role | ${escapeTableCell(summary.role)} |`,
      `| Date | ${escapeTableCell(summary.createdAt)} |`,
      "",
      normalizeMarkdownForWindowsPreview(summary.content.trim()),
      ""
    ];
  }

  return [
    options.summaryEnabled
      ? "_Synthese finale demandee mais non disponible._"
      : "_Synthese desactivee._",
    ""
  ];
}

function normalizeMarkdownForWindowsPreview(content: string): string {
  return content.replace(/:\*\*/g, "&#58;**");
}

function renderSessionHeader(
  options: DebateOptions,
  messages: DebateMessage[],
  stopReason?: string
): string[] {
  const rows = [
    ["Sujet", options.topic],
    ["Agents", `${options.agentA} <-> ${options.agentB}`],
    ["Modeles", `${options.modelA ?? "default"} <-> ${options.modelB ?? "default"}`],
    ["Auto-pull Ollama", options.pullModels ? "yes" : "no"],
    ["Synthese", options.summaryEnabled ? options.summaryAgent ?? options.agentB : "disabled"],
    ["Tours demandes", String(options.turns)],
    ["Tours joues", String(messages.length)],
    ["Arret anticipe", stopReason ?? "no"],
    ["Date locale", options.session.localDate],
    ["Fuseau horaire", options.session.timeZone],
    ["Dossier courant", options.session.cwd],
    ["Session demarree a", options.session.startedAt]
  ];

  return [
    "| Champ | Valeur |",
    "| --- | --- |",
    ...rows.map(([label, value]) => `| ${escapeTableCell(label)} | ${escapeTableCell(value)} |`)
  ];
}

function escapeTableCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>");
}

function renderFileList(files: DebateOptions["files"]): string[] {
  if (files.length === 0) {
    return ["Aucun contexte fichier injecte."];
  }

  return files.map((file) => `- \`${file.path}\` (${file.sizeBytes} bytes)`);
}
