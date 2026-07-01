/** @file Liste les exports Markdown récents en reparsant leur table de métadonnées, pour `palabre history` et la TUI. */
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

/** Entrée d'historique reconstruite à partir d'un fichier `.debate.md`/`.ask.md`. */
export interface HistoryEntry {
  fileName: string;
  path: string;
  mode: "debate" | "ask";
  topic: string;
  agents: string;
  date: string;
  count: string;
  mtimeMs: number;
}

/** Limite de lecture par fichier : la table de métadonnées est toujours en tête de l'export. */
const maxHeaderBytes = 12_000;

/**
 * Liste les exports les plus récents d'un dossier de sortie, triés par date de modification.
 * Silencieux si `outputDir` est absent ou inaccessible : retourne `[]` sans lever.
 */
export async function listHistoryEntries(outputDir: string, limit = 10): Promise<HistoryEntry[]> {
  const resolved = path.resolve(outputDir);
  let entries;

  try {
    entries = await readdir(resolved, { withFileTypes: true });
  } catch {
    return [];
  }

  const markdownFiles = entries
    .filter((entry) => entry.isFile() && /\.(debate|ask)\.md$/i.test(entry.name))
    .map((entry) => path.join(resolved, entry.name));

  const history = await Promise.all(markdownFiles.map(readHistoryFile));
  return history
    .filter((entry): entry is HistoryEntry => Boolean(entry))
    .sort((left, right) => right.mtimeMs - left.mtimeMs)
    .slice(0, limit);
}

/** Lit et parse un fichier d'export. Retourne `undefined` sur toute erreur filesystem/parsing plutôt que de lever. */
async function readHistoryFile(filePath: string): Promise<HistoryEntry | undefined> {
  try {
    const [metadata, raw] = await Promise.all([
      stat(filePath),
      readFile(filePath, "utf8")
    ]);
    const header = raw.slice(0, maxHeaderBytes);
    const table = parseMetadataTable(header);
    const fileName = path.basename(filePath);
    const mode = fileName.endsWith(".ask.md") ? "ask" : "debate";

    return {
      fileName,
      path: filePath,
      mode,
      topic: table.Sujet ?? table.Subject ?? topicFromFileName(fileName),
      agents: table.Agents ?? "",
      date: table["Date locale"] ?? table["Local date"] ?? table["Session demarree a"] ?? table["Session started at"] ?? "",
      count: countFromTable(mode, table),
      mtimeMs: metadata.mtimeMs
    };
  } catch {
    return undefined;
  }
}

/** Formate le compteur `x/y` adapté au mode, en tolérant les clés FR/EN de la table de métadonnées. */
function countFromTable(mode: HistoryEntry["mode"], table: Record<string, string>): string {
  if (mode === "ask") {
    const received = table["Reponses recues"] ?? table["Received responses"];
    const requested = table["Reponses attendues"] ?? table["Expected responses"];
    return received && requested ? `${received}/${requested}` : received ?? requested ?? "";
  }

  const played = table["Tours joues"] ?? table["Played turns"];
  const requested = table["Tours demandes"] ?? table["Requested turns"];
  return played && requested ? `${played}/${requested}` : played ?? requested ?? "";
}

/** Extrait les paires clé/valeur de la table Markdown `| Champ | Valeur |` générée par l'export. */
function parseMetadataTable(markdown: string): Record<string, string> {
  const fields: Record<string, string> = {};
  const lines = markdown.split(/\r?\n/);

  for (const line of lines) {
    const match = line.match(/^\|\s*([^|]+?)\s*\|\s*([^|]*?)\s*\|$/);
    if (!match) continue;

    const key = stripMarkdown(match[1] ?? "");
    const value = stripMarkdown(match[2] ?? "");
    if (!key || key === "Champ" || key === "Field" || /^-+$/.test(key)) continue;
    fields[key] = value;
  }

  return fields;
}

function stripMarkdown(value: string): string {
  return value
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .trim();
}

/** Reconstruit un sujet lisible depuis le nom de fichier quand la table de métadonnées ne l'indique pas. */
function topicFromFileName(fileName: string): string {
  return fileName
    .replace(/^palabre-/, "")
    .replace(/\.(debate|ask)\.md$/i, "")
    .replace(/-\d{4}-\d{2}-\d{2}t.*$/i, "")
    .replace(/-/g, " ")
    .trim() || fileName;
}
