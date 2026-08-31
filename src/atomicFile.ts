/** @file Écriture atomique de petits fichiers texte de configuration. */
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";

export interface AtomicTextWriteOptions {
  directoryMode?: number;
  fileMode?: number;
}

/**
 * Remplace un fichier texte par renommage depuis un voisin temporaire.
 * Une interruption ne peut donc pas laisser le fichier cible partiellement écrit.
 */
export async function writeTextFileAtomically(
  target: string,
  content: string,
  options: AtomicTextWriteOptions = {}
): Promise<void> {
  const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;
  await mkdir(path.dirname(target), {
    recursive: true,
    ...(options.directoryMode === undefined ? {} : { mode: options.directoryMode })
  });

  try {
    await writeFile(temporary, content, {
      encoding: "utf8",
      ...(options.fileMode === undefined ? {} : { mode: options.fileMode })
    });
    await rename(temporary, target);
  } finally {
    await rm(temporary, { force: true }).catch(() => undefined);
  }
}
