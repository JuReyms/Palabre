/**
 * @file Relay B1 (`palabre relay --open`) : accès disque bornés au rollout Codex de la cible.
 * `locateOpenRollout` retrouve le rollout par UUID et ne lit que sa première ligne ;
 * `captureOpenRollout` et `readOpenRollout` lisent la première ligne, un témoin borné et l'ajout
 * depuis l'offset. Aucun historique complet n'est chargé, quelle que soit sa taille. Lecture seule,
 * aucun agent ni transport.
 */
import { open, type FileHandle } from "node:fs/promises";
import { findCodexRollouts } from "./codex.js";
import { isUsableDirectory } from "./process.js";
import { captureOpenBaseline, OPEN_READ_LIMITS, type OpenBaseline, type OpenSnapshot } from "./openReader.js";

/** Ouverture en lecture seule ; injectable pour mesurer les lectures dans les tests. */
export type OpenFile = (filename: string, flags: "r") => Promise<FileHandle>;

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
 * Première ligne terminée d'un historique, plafonnée à 1 Mio, sans lire le reste du fichier.
 * Partagée avec la localisation du transcript Claude de B2.
 */
export async function readOpenFirstLine(filename: string, openFile: OpenFile = open): Promise<string> {
  const file = await openFile(filename, "r");
  try {
    const stat = await file.stat();
    if (!stat.isFile() || !Number.isSafeInteger(stat.size)) throw new Error("invalid-history");
    return await readIdentity(file, stat.size);
  } finally { await file.close(); }
}

/** Rollout localisé pour B1 : chemin et dossier de travail, lus dans la seule première ligne. */
export type OpenLocateResult =
  | { status: "found"; historyPath: string; cwd: string }
  | { status: "session-not-found" | "invalid-working-directory"; detail: string };

/**
 * Localisation bornée de B1 : recherche stricte du rollout par UUID, refus des doublons, lecture de
 * la première ligne sous plafond (1 Mio), validation de `session_meta.id` et du dossier de travail.
 * Contrairement à `CodexSessionAdapter.locate` (Relay A), elle ne charge pas l'historique et ne
 * cherche pas le dernier modèle : B1 ne lance aucune reprise.
 */
export async function locateOpenRollout(home: string, sessionId: string, openFile: OpenFile = open): Promise<OpenLocateResult> {
  const found = findCodexRollouts(home, sessionId);
  if (found.length === 0) return { status: "session-not-found", detail: "aucun rollout Codex pour cette session" };
  if (found.length > 1) return { status: "session-not-found", detail: `${found.length} rollouts pour cette session : cible ambiguë` };
  const historyPath = found[0]!;
  let firstLine: string;
  try {
    const file = await openFile(historyPath, "r");
    try {
      const stat = await file.stat();
      if (!stat.isFile() || !Number.isSafeInteger(stat.size)) return { status: "session-not-found", detail: "rollout Codex illisible" };
      firstLine = await readIdentity(file, stat.size);
    } finally { await file.close(); }
  } catch {
    return { status: "session-not-found", detail: "première ligne du rollout absente, trop grande ou illisible" };
  }
  let meta: Record<string, unknown> | undefined;
  try {
    const entry: unknown = JSON.parse(firstLine);
    const record = entry !== null && typeof entry === "object" && !Array.isArray(entry) ? entry as Record<string, unknown> : undefined;
    const payload = record?.type === "session_meta" ? record.payload : undefined;
    meta = payload !== null && typeof payload === "object" && !Array.isArray(payload) ? payload as Record<string, unknown> : undefined;
  } catch {
    meta = undefined;
  }
  if (typeof meta?.id !== "string" || meta.id.toLowerCase() !== sessionId.toLowerCase()) {
    return { status: "session-not-found", detail: "rollout incohérent : session_meta absent ou d'une autre session" };
  }
  const cwd = typeof meta.cwd === "string" ? meta.cwd : undefined;
  if (!cwd) return { status: "invalid-working-directory", detail: "aucun dossier de travail dans session_meta" };
  if (!isUsableDirectory(cwd)) return { status: "invalid-working-directory", detail: "dossier de travail de la session introuvable" };
  return { status: "found", historyPath, cwd };
}

/**
 * Capture une référence de fin de ligne, quelle que soit la taille historique du fichier.
 * Une fin encore partielle est refusée (`baseline-incomplete`) : `runOpenRelay` réessaie brièvement
 * avant tout dépôt. Les erreurs de lecture restent des erreurs, traduites par l'appelant.
 */
export async function captureOpenRollout(filename: string, openFile: OpenFile = open): Promise<OpenBaseline> {
  const file = await openFile(filename, "r");
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
export async function readOpenRollout(filename: string, baseline: OpenBaseline, openFile: OpenFile = open): Promise<OpenSnapshot> {
  if (!Number.isSafeInteger(baseline.bytes) || baseline.bytes <= 0) throw new Error("invalid-baseline");
  const file = await openFile(filename, "r");
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
