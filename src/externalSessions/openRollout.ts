/**
 * @file Relay B1 (`palabre relay --open`) : accès disque bornés au rollout Codex de la cible.
 * `locateOpenRollout` résout la chaîne de segments (`codexHistory.ts`) et ne lit que des premières
 * lignes ; `captureOpenRollout` et `readOpenRollout` lisent la première ligne, un témoin borné et
 * l'ajout depuis l'offset ; `readLastTurnContext` lit seulement la fin de l'historique actif
 * (`relay --check`, #203). `readLastCodexQuota` relève de la même lecture bornée, mais exige un
 * quota daté reconnu (#205). Aucun historique complet n'est chargé, quelle que soit sa taille.
 * Lecture seule, aucun agent ni transport.
 *
 * Avec une portée (`CodexHistoryScope`), la chaîne est résolue de nouveau à chaque lecture : un
 * segment créé pendant l'attente est suivi par ses liens validés, la fin abandonnée d'un fichier
 * est ignorée, et une reprise de l'historique avant la référence est refusée (`history-rewound`).
 * Sans portée, seul le fichier donné est lu (forme antérieure, tests unitaires).
 */
import { createHash } from "node:crypto";
import { open, type FileHandle } from "node:fs/promises";
import path from "node:path";
import { historyParts, historyRefusalDetail, resolveCodexHistory, type CodexHistoryRefusal, type HistoryPart } from "./codexHistory.js";
import { isUsableDirectory } from "./process.js";
import { captureOpenBaseline, lastTurnContext, OPEN_READ_LIMITS, type LastTurnContext, type OpenBaseline, type OpenSnapshot } from "./openReader.js";
import { lastCodexQuota, type CodexQuota } from "./quota.js";

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

/** Conversation Codex désignée : sa chaîne de segments est résolue à chaque lecture. */
export interface CodexHistoryScope {
  /** Racine `~/.codex`. */
  home: string;
  sessionId: string;
}

/**
 * Rollout localisé pour B1 : chemin de la tête de chaîne et dossier de travail, lus dans sa seule
 * première ligne. `history` nomme le refus d'une chaîne de segments cassée ou ambiguë.
 */
export type OpenLocateResult =
  | { status: "found"; historyPath: string; cwd: string }
  | { status: "session-not-found" | "invalid-working-directory"; detail: string; history?: CodexHistoryRefusal };

/**
 * Localisation bornée de B1 : résolution stricte de la chaîne de segments par UUID (racine unique,
 * liens validés, jamais le fichier le plus récent), lecture de la première ligne de la tête sous
 * plafond (1 Mio), validation de `session_meta.id` et du dossier de travail. Contrairement à
 * `CodexSessionAdapter.locate` (Relay A), elle ne charge pas l'historique et ne cherche pas le
 * dernier modèle : B1 ne lance aucune reprise.
 */
export async function locateOpenRollout(home: string, sessionId: string, openFile: OpenFile = open): Promise<OpenLocateResult> {
  const resolved = resolveCodexHistory(home, sessionId);
  if (resolved.status === "not-found") return { status: "session-not-found", detail: "aucun rollout Codex pour cette session" };
  if (resolved.status === "refused") return { status: "session-not-found", detail: historyRefusalDetail(resolved.reason), history: resolved.reason };
  const historyPath = resolved.segments[resolved.segments.length - 1]!.path;
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
 * Chaîne actuelle de la portée. Un refus devient une erreur de code court (`history-<raison>`), sans
 * chemin. `pending` signale un segment en cours de création : sa première ligne est encore partielle.
 */
function currentChain(scope: CodexHistoryScope) {
  const resolved = resolveCodexHistory(scope.home, scope.sessionId);
  if (resolved.status === "not-found") throw new Error("history-missing");
  if (resolved.status === "refused") throw new Error(`history-${resolved.reason}`);
  return resolved;
}

const samePath = (a: string, b: string) => path.resolve(a) === path.resolve(b);

/**
 * Lit `[from, to)` du flux logique décrit par `parts` (`historyParts`). La dernière partie peut
 * dépasser la taille résolue si la tête a grandi ; une partie plus courte qu'annoncé est une
 * troncature (`history-replaced`).
 */
async function readLogical(parts: readonly HistoryPart[], from: number, to: number, openFile: OpenFile): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for (const part of parts) {
    const partEnd = part.logicalStart + (part.end - part.start);
    const start = Math.max(from, part.logicalStart);
    const end = Math.min(to, partEnd);
    if (start >= end) continue;
    const file = await openFile(part.path, "r");
    try {
      chunks.push(await readRange(file, part.start + start - part.logicalStart, end - start));
    } finally { await file.close(); }
  }
  return Buffer.concat(chunks);
}

/** Parties depuis l'ancrage, la tête prolongée jusqu'à sa taille actuelle. */
async function partsFrom(scope: CodexHistoryScope, anchor: string, openFile: OpenFile): Promise<HistoryPart[]> {
  const chain = currentChain(scope);
  const index = chain.segments.findIndex((segment) => samePath(segment.path, anchor));
  if (index < 0) throw new Error("history-chain-changed");
  const parts = historyParts(chain.segments, index);
  const head = parts[parts.length - 1]!;
  const file = await openFile(head.path, "r");
  try {
    const stat = await file.stat();
    if (!stat.isFile() || !Number.isSafeInteger(stat.size)) throw new Error("invalid-rollout");
    if (stat.size < head.end) throw new Error("history-replaced");
    head.end = stat.size;
  } finally { await file.close(); }
  return parts;
}

const logicalLength = (parts: readonly HistoryPart[]) => {
  const last = parts[parts.length - 1]!;
  return last.logicalStart + last.end - last.start;
};

/**
 * Capture une référence de fin de ligne, quelle que soit la taille historique du fichier.
 * Une fin encore partielle est refusée (`baseline-incomplete`) : `runOpenRelay` réessaie brièvement
 * avant tout dépôt. Les erreurs de lecture restent des erreurs, traduites par l'appelant.
 *
 * Avec une portée, le fichier doit être la tête actuelle de la chaîne : un segment en cours de
 * création donne `history-rotating` (réessayé comme une fin partielle), un fichier qui n'est plus
 * la tête donne `history-rotated`. Aucune référence n'est prise sur une partie abandonnée.
 */
export async function captureOpenRollout(filename: string, openFile: OpenFile = open, scope?: CodexHistoryScope): Promise<OpenBaseline> {
  if (scope) {
    const chain = currentChain(scope);
    if (chain.pending > 0) throw new Error("history-rotating");
    if (!samePath(chain.segments[chain.segments.length - 1]!.path, filename)) throw new Error("history-rotated");
  }
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
 *
 * Avec une portée, l'offset est celui du flux logique ancré sur `filename` (`historyParts`) :
 * l'ajout enchaîne la partie active de l'ancrage puis celle des segments créés ensuite, sans leur
 * première ligne. Une coupure annoncée avant la référence donne `history-rewound` : le tour attendu
 * a pu être abandonné, rien n'est deviné. Un segment encore partiel est ignoré jusqu'à la lecture
 * suivante ; la fin abandonnée de l'ancrage reste lue en attendant, ce qui ne peut donner qu'un
 * tour interrompu, jamais une réponse d'un autre tour.
 */
export async function readOpenRollout(filename: string, baseline: OpenBaseline, openFile: OpenFile = open, scope?: CodexHistoryScope): Promise<OpenSnapshot> {
  if (!Number.isSafeInteger(baseline.bytes) || baseline.bytes <= 0) throw new Error("invalid-baseline");
  if (!scope) return readSingleRollout(filename, baseline, openFile);
  const parts = await partsFrom(scope, filename, openFile);
  const total = logicalLength(parts);
  if (total < baseline.bytes) throw new Error(parts.length > 1 ? "history-rewound" : "history-replaced");
  if (total - baseline.bytes > OPEN_READ_LIMITS.addedBytes) throw new Error("added-too-large");
  const anchor = await openFile(filename, "r");
  let firstLine: string;
  try {
    const stat = await anchor.stat();
    if (!stat.isFile() || !Number.isSafeInteger(stat.size)) throw new Error("invalid-rollout");
    firstLine = await readIdentity(anchor, stat.size);
  } finally { await anchor.close(); }
  const length = Math.min(baseline.bytes, OPEN_READ_LIMITS.witnessBytes);
  const witness = await readLogical(parts, baseline.bytes - length, baseline.bytes, openFile);
  // Témoin changé alors qu'un segment suit l'ancrage : la coupure est passée avant la référence.
  if (parts.length > 1 && createHash("sha256").update(witness).digest("hex") !== baseline.sha256) throw new Error("history-rewound");
  const added = await readLogical(parts, baseline.bytes, total, openFile);
  const check = await openFile(filename, "r");
  try {
    const after = await check.stat();
    if (!witness.equals(await readLogical(parts, baseline.bytes - length, baseline.bytes, openFile))
      || firstLine !== await readIdentity(check, after.size)) throw new Error("history-replaced");
  } finally { await check.close(); }
  return { bytes: total, firstLine, witness, added };
}

/** Forme d'un seul fichier, inchangée : l'ajout est la suite du fichier depuis la référence. */
async function readSingleRollout(filename: string, baseline: OpenBaseline, openFile: OpenFile): Promise<OpenSnapshot> {
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

/** Fin d'historique lue par `readLastTurnContext` : au plus 1 Mio. */
export const LAST_CONTEXT_TAIL_BYTES = 1024 * 1024;

/**
 * Au plus `LAST_CONTEXT_TAIL_BYTES` de la fin de l'historique actif, plus l'octet qui les précède
 * (`before`) pour savoir si la première ligne est complète. Fichier seul : sa fin. Portée : fin du
 * flux de la racine à la tête, sans les fins abandonnées ni les premières lignes des segments ; un
 * segment en cours de création est ignoré. `stable` refuse une tête modifiée pendant la lecture.
 */
async function readHistoryTail(source: string | CodexHistoryScope, openFile: OpenFile, stable: boolean): Promise<{ bytes: Buffer; before: 0 | 1 } | undefined> {
  if (typeof source !== "string") {
    const chain = currentChain(source);
    const parts = await partsFrom(source, chain.segments[0]!.path, openFile);
    const total = logicalLength(parts);
    if (total <= 0) return undefined;
    const length = Math.min(total, LAST_CONTEXT_TAIL_BYTES);
    const before = total > length ? 1 : 0;
    const head = parts[parts.length - 1]!;
    const bytes = await readLogical(parts, total - length - before, total, openFile);
    if (stable) {
      const file = await openFile(head.path, "r");
      try { if ((await file.stat()).size !== head.end) return undefined; } finally { await file.close(); }
    }
    return { bytes, before };
  }
  const file = await openFile(source, "r");
  try {
    const stat = await file.stat();
    if (!stat.isFile() || !Number.isSafeInteger(stat.size) || stat.size <= 0) return undefined;
    const length = Math.min(stat.size, LAST_CONTEXT_TAIL_BYTES);
    const before = stat.size > length ? 1 : 0;
    const bytes = await readRange(file, stat.size - length - before, length + before);
    if (stable) {
      const after = await file.stat();
      if (after.size !== stat.size || after.mtimeMs !== stat.mtimeMs) return undefined;
    }
    return { bytes, before };
  } finally { await file.close(); }
}

/**
 * Dernier quota connu (#205) : au plus 1 Mio + l'octet précédent, sans réseau ni modèle.
 * Première ligne partielle ignorée ; une ligne finale incomplète n'est pas interprétée.
 * Illisible, UTF-8 invalide, modification de taille pendant la lecture ou forme inconnue : absent,
 * sans erreur produit ni estimation. Une absence dans cette fenêtre n'entraîne aucune recherche plus loin.
 * Avec une portée, la fenêtre est la fin de l'historique actif ; chaîne refusée : absent.
 */
export async function readLastCodexQuota(source: string | CodexHistoryScope, openFile: OpenFile = open): Promise<CodexQuota | undefined> {
  try {
    const tail = await readHistoryTail(source, openFile, true);
    if (!tail) return undefined;
    const { bytes, before } = tail;
    const partialStart = before === 1 && bytes[0] !== 10;
    // Couper d'abord la ligne partielle : elle peut commencer au milieu d'un caractère UTF-8.
    const rest = bytes.subarray(before);
    const complete = partialStart ? rest.subarray(rest.indexOf(10) >= 0 ? rest.indexOf(10) + 1 : rest.length) : rest;
    const end = complete.lastIndexOf(10);
    if (end < 0) return undefined;
    return lastCodexQuota(new TextDecoder("utf-8", { fatal: true }).decode(complete.subarray(0, end + 1)), false);
  } catch { return undefined; }
}

/**
 * Dernières permissions connues pour `relay --check` (#203) : lit au plus le dernier Mio de
 * l'historique (plus l'octet qui le précède, pour savoir si sa première ligne est complète), sans
 * charger le reste, puis cherche le dernier `turn_context`. Absent de cette fin, ou historique
 * illisible : `undefined` (inconnu). Avec une portée, seule la partie active compte : un
 * `turn_context` d'une fin abandonnée n'est jamais rendu. Le résultat est indicatif, jamais une
 * garantie pour le tour suivant.
 */
export async function readLastTurnContext(source: string | CodexHistoryScope, openFile: OpenFile = open): Promise<LastTurnContext | undefined> {
  try {
    const tail = await readHistoryTail(source, openFile, false);
    if (!tail) return undefined;
    // Un saut de ligne juste avant la fin bornée signifie que sa première ligne est complète.
    const partialStart = tail.before === 1 && tail.bytes[0] !== 0x0a;
    return lastTurnContext(new TextDecoder("utf-8").decode(tail.bytes.subarray(tail.before)), partialStart);
  } catch {
    return undefined;
  }
}

