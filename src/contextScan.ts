import path from "node:path";
import { loadProjectInputs } from "./context.js";
import { createTranslator } from "./i18n.js";
import type { Messages } from "./messages/index.js";

export interface ContextScanFileItem {
  kind: "file";
  path: string;
  absolutePath: string;
  sizeBytes: number;
}

export interface ContextScanFolderItem {
  kind: "folder";
  path: string;
  absolutePath: string;
  filesCount: number;
}

export type ContextScanItem = ContextScanFolderItem | ContextScanFileItem;

export interface ContextScanResult {
  v: 1;
  root: string;
  scanned: string[];
  items: ContextScanItem[];
  warnings: string[];
}

/**
 * Builds the machine-readable context preview used by integrations.
 *
 * The scan intentionally reuses the same tolerant loader as `--context`, so
 * the returned files are the files Palabre would actually inject into a debate.
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
