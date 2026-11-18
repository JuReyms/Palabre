/** @file Écritures atomiques de fichiers texte, avec remplacement ou publication exclusive. */
import { link, mkdir, open, rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";

export interface AtomicTextWriteOptions {
  directoryMode?: number;
  fileMode?: number;
}

/**
 * Publie un fichier terminé via un lien exclusif vers un temporaire privé du même dossier.
 * Le lien échoue si la destination existe déjà, y compris si c'est un lien symbolique.
 */
export async function createTextFileAtomically(target: string, content: string): Promise<void> {
  const temporary = `${target}.${randomUUID()}.tmp`;
  await mkdir(path.dirname(target), { recursive: true });
  const file = await open(temporary, "wx", 0o600);
  try {
    try {
      await file.writeFile(content, "utf8");
    } finally {
      await file.close();
    }
    await link(temporary, target);
  } finally {
    await rm(temporary, { force: true }).catch(() => undefined);
  }
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
