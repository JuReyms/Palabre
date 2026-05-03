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
  const filePath = path.resolve(outputDir, `chicane-${safeDate}.debate.md`);

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
    "# Chicane Debate",
    "",
    `**Sujet:** ${options.topic}`,
    `**Agents:** ${options.agentA} <-> ${options.agentB}`,
    `**Modeles:** ${options.modelA ?? "default"} <-> ${options.modelB ?? "default"}`,
    `**Auto-pull Ollama:** ${options.pullModels ? "yes" : "no"}`,
    `**Synthese:** ${options.summaryEnabled ? options.summaryAgent ?? options.agentB : "disabled"}`,
    `**Tours:** ${options.turns}`,
    `**Tours joues:** ${messages.length}`,
    `**Arret anticipe:** ${stopReason ?? "no"}`,
    `**Date locale:** ${options.session.localDate}`,
    `**Fuseau horaire:** ${options.session.timeZone}`,
    `**Dossier courant:** ${options.session.cwd}`,
    `**Session demarree a:** ${options.session.startedAt}`,
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
      message.content.trim(),
      ""
    );
  }

  lines.push("## Synthese", "");

  if (summary) {
    lines.push(`_Produite par ${summary.agent} (${summary.role}) le ${summary.createdAt}._`, "", summary.content.trim(), "");
  } else if (options.summaryEnabled) {
    lines.push("_Synthese finale demandee mais non disponible._", "");
  } else {
    lines.push("_Synthese desactivee._", "");
  }

  return `${lines.join("\n")}\n`;
}

function renderFileList(files: DebateOptions["files"]): string[] {
  if (files.length === 0) {
    return ["Aucun contexte fichier injecte."];
  }

  return files.map((file) => `- \`${file.path}\` (${file.sizeBytes} bytes)`);
}
