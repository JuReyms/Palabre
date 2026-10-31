/** @file Réservation locale exclusive avant publication : aucune suppression ou relance après incertitude. */
import { constants } from "node:fs";
import { createHash } from "node:crypto";
import { lstat, mkdir, open } from "node:fs/promises";
import path from "node:path";
import { writeTextFileAtomically } from "./atomicFile.js";

/** Trace privée d'une tentative, indépendante de la délivrance Relay et sans historique fournisseur. */
export interface PublicationReceipt {
  v: 1;
  key: string;
  target: string;
  publisher: string;
  repositoryId: number;
  targetId: number;
  publisherId: number;
  bodyHash: string;
  /** Commentaire exact approuvé, sans chemin source ni transcript fournisseur. */
  body: string;
  createdAt: string;
  status: "reserved" | "published" | "unknown";
  commentUrl?: string;
}

/**
 * Lecture régulière bornée et UTF-8 strict ; les liens, FIFO, tailles hors borne ou changements
 * pendant la lecture sont refusés. Le fichier est toujours refermé, y compris sur erreur.
 */
export async function readPublicationText(file: string, limit: number): Promise<string> {
  const before = await lstat(file);
  if (!before.isFile() || before.isSymbolicLink() || before.size > limit) throw new Error("invalid-file");
  const handle = await open(file, constants.O_RDONLY | constants.O_NONBLOCK | (constants.O_NOFOLLOW ?? 0));
  try {
    const opened = await handle.stat();
    if (!opened.isFile() || opened.dev !== before.dev || opened.ino !== before.ino || opened.size > limit) throw new Error("invalid-file");
    const buffer = Buffer.alloc(limit + 1);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    const after = await handle.stat();
    if (bytesRead > limit || bytesRead !== opened.size || opened.size !== after.size || opened.mtimeMs !== after.mtimeMs || opened.ctimeMs !== after.ctimeMs) throw new Error("changed-file");
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(buffer.subarray(0, bytesRead));
  } finally { await handle.close(); }
}

/**
 * Réserve un seul nom dérivé du digest. fsync précède tout POST ; une interruption laisse une
 * réservation bloquante. Aucune suppression, même après une erreur d'écriture partielle.
 */
export async function reservePublication(file: string, receipt: PublicationReceipt): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const handle = await open(file, "wx", 0o600);
  try { await handle.writeFile(`${JSON.stringify(receipt)}\n`, "utf8"); await handle.sync(); }
  finally { await handle.close(); }
}

/** Mise à jour atomique d'une réservation existante ; jamais utilisée pour autoriser un nouvel envoi. */
export async function settlePublication(file: string, receipt: PublicationReceipt, reservation: PublicationReceipt): Promise<void> {
  if (await readPublicationText(file, 256 * 1024) !== `${JSON.stringify(reservation)}\n`) throw new Error("receipt-changed");
  await writeTextFileAtomically(file, `${JSON.stringify(receipt)}\n`, { directoryMode: 0o700, fileMode: 0o600 });
}

/** Absence certaine seulement sur ENOENT ; un fichier illisible ou incohérent bloque la suite. */
export async function readPublicationReceipt(file: string): Promise<PublicationReceipt | undefined> {
  let text: string;
  try { text = await readPublicationText(file, 256 * 1024); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined; throw error; }
  const value = JSON.parse(text) as PublicationReceipt;
  if (!value || value.v !== 1 || !/^[0-9a-f]{64}$/.test(value.key) || !/^[0-9a-f]{64}$/.test(value.bodyHash)
    || typeof value.target !== "string" || typeof value.publisher !== "string" || typeof value.createdAt !== "string"
    || typeof value.body !== "string" || createHash("sha256").update(value.body).digest("hex") !== value.bodyHash
    || [value.repositoryId, value.targetId, value.publisherId].some(id => !Number.isSafeInteger(id) || id <= 0)
    || !["reserved", "published", "unknown"].includes(value.status)) throw new Error("invalid-receipt");
  return value;
}
