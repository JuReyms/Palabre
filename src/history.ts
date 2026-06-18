import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

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

const maxHeaderBytes = 12_000;

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

function topicFromFileName(fileName: string): string {
  return fileName
    .replace(/^palabre-/, "")
    .replace(/\.(debate|ask)\.md$/i, "")
    .replace(/-\d{4}-\d{2}-\d{2}t.*$/i, "")
    .replace(/-/g, " ")
    .trim() || fileName;
}
