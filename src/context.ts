import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { ProjectFileContext } from "./types.js";

const MAX_FILE_BYTES = 64 * 1024;
const MAX_TOTAL_BYTES = 192 * 1024;

export async function loadProjectFiles(paths: string[], cwd = process.cwd()): Promise<ProjectFileContext[]> {
  const uniquePaths = [...new Set(paths.map((item) => item.trim()).filter(Boolean))];
  const files: ProjectFileContext[] = [];
  let totalBytes = 0;

  for (const inputPath of uniquePaths) {
    const absolutePath = path.resolve(cwd, inputPath);
    const fileStat = await stat(absolutePath);

    if (!fileStat.isFile()) {
      throw new Error(`Le contexte fichier doit pointer vers un fichier: ${inputPath}`);
    }

    if (fileStat.size > MAX_FILE_BYTES) {
      throw new Error(
        `Fichier trop gros pour le contexte: ${inputPath} (${fileStat.size} bytes, max ${MAX_FILE_BYTES})`
      );
    }

    totalBytes += fileStat.size;

    if (totalBytes > MAX_TOTAL_BYTES) {
      throw new Error(`Contexte fichiers trop gros (${totalBytes} bytes, max ${MAX_TOTAL_BYTES})`);
    }

    const content = await readFile(absolutePath, "utf8");

    if (content.includes("\u0000")) {
      throw new Error(`Fichier binaire ou non texte refuse: ${inputPath}`);
    }

    files.push({
      path: path.relative(cwd, absolutePath).replace(/\\/g, "/"),
      absolutePath,
      content,
      sizeBytes: fileStat.size
    });
  }

  return files;
}
