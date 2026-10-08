/**
 * @file Collecteur B1 expérimental, en lecture seule sur un fichier explicitement fourni.
 * Lit la première ligne, un témoin borné et l'ajout depuis l'offset ; aucun agent ni transport.
 * Il n'est pas importé par le produit et ne découvre aucune conversation de l'utilisateur.
 */
import { open, type FileHandle } from "node:fs/promises";
import { captureOpenBaseline, OPEN_READ_LIMITS, type OpenBaseline, type OpenSnapshot } from "./open-response.js";

/** Lecture positionnelle exacte ; une troncature concurrente n'est jamais traitée comme du vide. */
async function readRange(file: FileHandle, position: number, length: number): Promise<Buffer> {
  const bytes = Buffer.alloc(length);
  let read = 0;
  while (read < length) {
    const result = await file.read(bytes, read, length - read, position + read);
    if (result.bytesRead === 0) throw new Error("history-replaced");
    read += result.bytesRead;
  }
  return bytes;
}

/** Première ligne terminée et UTF-8 valide, plafonnée sans charger le reste du fichier. */
async function readIdentity(file: FileHandle, size: number): Promise<string> {
  const parts: Buffer[] = [];
  let position = 0;
  while (position < Math.min(size, OPEN_READ_LIMITS.firstLineBytes)) {
    const chunk = await readRange(file, position, Math.min(4096, size - position, OPEN_READ_LIMITS.firstLineBytes - position));
    const end = chunk.indexOf(10);
    parts.push(end >= 0 ? chunk.subarray(0, end + 1) : chunk);
    if (end >= 0) return new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(parts));
    position += chunk.length;
  }
  throw new Error(size >= OPEN_READ_LIMITS.firstLineBytes ? "identity-too-large" : "identity-incomplete");
}

/**
 * Capture une référence de fin de ligne, quelle que soit la taille historique du fichier.
 * Une fin encore partielle est refusée ; le futur appelant devra attendre avant tout dépôt.
 * Les erreurs de lecture restent des erreurs : aucune tentative de transport n'est faite.
 */
export async function captureOpenRollout(filename: string): Promise<OpenBaseline> {
  const file = await open(filename, "r");
  try {
    const stat = await file.stat();
    if (!stat.isFile() || !Number.isSafeInteger(stat.size)) throw new Error("invalid-rollout");
    const firstLine = await readIdentity(file, stat.size);
    const length = Math.min(stat.size, OPEN_READ_LIMITS.witnessBytes);
    const witness = await readRange(file, stat.size - length, length);
    return captureOpenBaseline({ bytes: stat.size, firstLine, witness });
  } finally { await file.close(); }
}

/**
 * Lit un snapshot borné après l'offset initial, sans relire ni parser le préfixe historique.
 * Chaque snapshot fournit l'ajout cumulé depuis cette référence, plafonné à 50 Mio ; le plafond
 * ne concerne pas le fichier. Le témoin est relu après l'ajout pour repérer une dérive concurrente.
 * Une réécriture hors première ligne/témoin reste indétectable : aucun verrou exclusif promis.
 */
export async function readOpenRollout(filename: string, baseline: OpenBaseline): Promise<OpenSnapshot> {
  if (!Number.isSafeInteger(baseline.bytes) || baseline.bytes <= 0) throw new Error("invalid-baseline");
  const file = await open(filename, "r");
  try {
    const stat = await file.stat();
    if (!stat.isFile() || !Number.isSafeInteger(stat.size)) throw new Error("invalid-rollout");
    if (stat.size < baseline.bytes) throw new Error("history-replaced");
    if (stat.size - baseline.bytes > OPEN_READ_LIMITS.addedBytes) throw new Error("added-too-large");
    const firstLine = await readIdentity(file, stat.size);
    const length = Math.min(baseline.bytes, OPEN_READ_LIMITS.witnessBytes);
    const witness = await readRange(file, baseline.bytes - length, length);
    const added = await readRange(file, baseline.bytes, stat.size - baseline.bytes);
    const after = await file.stat();
    if (after.size < stat.size || !witness.equals(await readRange(file, baseline.bytes - length, length))
      || firstLine !== await readIdentity(file, after.size)) throw new Error("history-replaced");
    return { bytes: stat.size, firstLine, witness, added };
  } finally { await file.close(); }
}
