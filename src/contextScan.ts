/** @file Contrat JSON v1 de `palabre context scan --json`, consommé par les intégrations. */
import path from "node:path";
import { loadProjectInputs } from "./context.js";
import { createTranslator } from "./i18n.js";
import type { Messages } from "./messages/index.js";

/** Entrée de fichier du scan, avec sa taille en octets côté disque. */
export interface ContextScanFileItem {
  kind: "file";
  path: string;
  absolutePath: string;
  sizeBytes: number;
}

/** Entrée de dossier du scan, agrégeant le nombre de fichiers texte retenus en dessous. */
export interface ContextScanFolderItem {
  kind: "folder";
  path: string;
  absolutePath: string;
  filesCount: number;
}

/** Union discriminée par `kind`, utilisée telle quelle dans `items[]`. */
export type ContextScanItem = ContextScanFolderItem | ContextScanFileItem;

/** Contrat JSON v1 renvoyé par `palabre context scan --json` (voir AGENTS.md, section "Contexte projet"). */
export interface ContextScanResult {
  v: 1;
  root: string;
  scanned: string[];
  items: ContextScanItem[];
  warnings: string[];
}

/**
 * Construit l'aperçu de contexte lisible par une machine, utilisé par les intégrations.
 *
 * Le scan réutilise volontairement le même chargeur tolérant que `--context`, afin que
 * les fichiers renvoyés soient exactement ceux que Palabre injecterait dans un débat.
 */
export async function buildContextScan(
  scanPaths: string[],
  cwd = process.cwd(),
  messages: Messages = createTranslator("fr")
): Promise<ContextScanResult> {
  const effectiveScanPaths = scanPaths.length > 0 ? scanPaths : ["."];
  const result = await loadProjectInputs([], effectiveScanPaths, cwd, messages);
  const files = result.files.map((file): ContextScanFileItem => ({
    kind: "file",
    path: file.path,
    absolutePath: file.absolutePath,
    sizeBytes: file.sizeBytes
  }));
  const folders = collectContextFolders(files.map((file) => file.path), cwd);

  return {
    v: 1,
    root: cwd,
    scanned: effectiveScanPaths,
    items: [...folders, ...files],
    warnings: result.warnings
  };
}

function collectContextFolders(filePaths: string[], cwd: string): ContextScanFolderItem[] {
  const counts = new Map<string, number>();
  if (filePaths.length > 0) {
    counts.set(".", filePaths.length);
  }

  for (const filePath of filePaths) {
    const parts = filePath.split("/").filter(Boolean);
    for (let index = 1; index < parts.length; index += 1) {
      const folder = parts.slice(0, index).join("/");
      counts.set(folder, (counts.get(folder) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort(([left], [right]) => left === "." ? -1 : right === "." ? 1 : left.localeCompare(right))
    .map(([folder, filesCount]) => ({
      kind: "folder",
      path: folder,
      absolutePath: path.resolve(cwd, folder),
      filesCount
    }));
}
