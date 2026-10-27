/**
 * @file Historique Codex découpé en segments : résolution stricte de la chaîne d'une conversation.
 *
 * Depuis Codex 0.163.0-alpha.11 (observé en octobre 2026, format non documenté), une conversation
 * peut tenir dans plusieurs fichiers :
 * - la racine `rollout-<date>-<conversation>.jsonl`, seule forme des historiques plus anciens ;
 * - des segments `rollout-<date>-<conversation>_<segment>.jsonl`, dont la première ligne
 *   `session_meta` porte `history_mode: "paginated"` et `history_base` :
 *   `{ thread_id, end_ordinal_exclusive, end_byte_offset }`.
 *
 * `history_base.thread_id` désigne le fichier précédent (la conversation elle-même pour la racine).
 * Le segment reprend l'historique de ce fichier jusqu'à `end_byte_offset` exclu : la fin du fichier
 * précédent, au-delà de cette coupure, est abandonnée (cas observé : un tour interrompu puis repris).
 * Le premier enregistrement du segment porte l'ordinal `end_ordinal_exclusive`.
 *
 * Aucune sélection « du plus récent » : la tête est le seul fichier atteint en suivant des liens
 * validés depuis la racine. Racine absente ou en double, lien cassé, embranchement, segment
 * inatteignable ou coupure incohérente : refus, jamais de choix. Lectures synchrones bornées
 * (première ligne et ligne de coupure, 1 Mio chacune) ; aucun historique complet n'est chargé ici.
 */
import { closeSync, fstatSync, openSync, readdirSync, readSync } from "node:fs";
import path from "node:path";
import { isSessionId } from "./envelope.js";

type JsonObject = Record<string, unknown>;

/** Plafond d'une ligne lue pour valider la chaîne (première ligne ou ligne de coupure). */
export const HISTORY_LINE_LIMIT = 1024 * 1024;

/** Lien d'un segment vers le fichier dont il reprend l'historique. */
export interface CodexSegmentBase {
  /** Identifiant du fichier précédent : la conversation pour la racine, sinon un segment. */
  id: string;
  /** Coupure dans le fichier précédent : la suite de ce fichier n'appartient plus à l'historique. */
  endOffset: number;
  endOrdinal: number;
}

/** Un fichier de la chaîne, avec sa partie active. */
export interface CodexSegment {
  path: string;
  /** Identifiant du segment ; celui de la conversation pour la racine. */
  id: string;
  /** Taille lue à la résolution ; la tête peut grandir ensuite. */
  size: number;
  /** Octets de la première ligne, saut de ligne compris. */
  headerBytes: number;
  /** Charge utile de `session_meta`. */
  meta: JsonObject;
  base?: CodexSegmentBase;
  /** Fin de la partie active : coupure annoncée par le segment suivant, sinon `size`. */
  activeEnd: number;
}

/** Raisons de refus, stables et sans chemin ni contenu. */
export type CodexHistoryRefusal =
  | "duplicate-root"
  | "missing-root"
  | "duplicate-segment"
  | "invalid-header"
  | "broken-link"
  | "fork"
  | "unreachable-segment"
  | "invalid-cut";

export type CodexHistoryResult =
  /** `segments` va de la racine à la tête ; `pending` compte les fichiers à l'en-tête encore incomplet, écartés. */
  | { status: "found"; segments: CodexSegment[]; pending: number }
  | { status: "not-found" }
  | { status: "refused"; reason: CodexHistoryRefusal };

/** Nom d'un fichier de la conversation : racine (`segment` absent) ou segment. */
function parseName(name: string, sessionId: string): { segment?: string } | undefined {
  const lower = name.toLowerCase();
  if (!lower.startsWith("rollout-") || !lower.endsWith(".jsonl")) return undefined;
  if (lower.endsWith(`-${sessionId}.jsonl`)) return {};
  const match = /_([0-9a-f-]{36})\.jsonl$/.exec(lower);
  if (!match || !isSessionId(match[1]!) || !lower.slice(0, match.index).endsWith(`-${sessionId}`)) return undefined;
  return { segment: match[1]! };
}

/**
 * Fichiers de la conversation sous `<home>/sessions/**` et `<home>/archived_sessions/**`, racine
 * et segments. Un identifiant invalide ne désigne aucun fichier.
 */
export function findCodexHistoryFiles(home: string, sessionId: string): { path: string; segment?: string }[] {
  if (!isSessionId(sessionId)) return [];
  const id = sessionId.toLowerCase();
  const found: { path: string; segment?: string }[] = [];
  for (const root of [path.join(home, "sessions"), path.join(home, "archived_sessions")]) {
    let entries: string[];
    try {
      entries = readdirSync(root, { recursive: true }) as string[];
    } catch {
      continue;
    }
    for (const entry of entries) {
      const parsed = parseName(path.basename(entry), id);
      if (parsed) found.push({ path: path.join(root, entry), ...parsed });
    }
  }
  return found;
}

/** Lecture exacte d'une plage ; une fin de fichier prématurée est une erreur. */
function readExact(fd: number, position: number, length: number): Buffer {
  const bytes = Buffer.alloc(length);
  let read = 0;
  while (read < length) {
    const count = readSync(fd, bytes, read, length - read, position + read);
    if (count === 0) throw new Error("history-replaced");
    read += count;
  }
  return bytes;
}

/**
 * Ligne terminée commençant à `position`, au plus `HISTORY_LINE_LIMIT` octets. `incomplete` : pas
 * encore de saut de ligne avant la fin du fichier ; `too-large` : ligne plus longue que le plafond.
 */
function readLineAt(fd: number, size: number, position: number): Buffer | "incomplete" | "too-large" {
  const parts: Buffer[] = [];
  let at = position;
  const limit = Math.min(size, position + HISTORY_LINE_LIMIT);
  while (at < limit) {
    const chunk = readExact(fd, at, Math.min(4096, limit - at));
    const end = chunk.indexOf(10);
    if (end >= 0) {
      parts.push(chunk.subarray(0, end + 1));
      return Buffer.concat(parts);
    }
    parts.push(chunk);
    at += chunk.length;
  }
  return size - position >= HISTORY_LINE_LIMIT ? "too-large" : "incomplete";
}

function parseRecord(line: Buffer): JsonObject | undefined {
  try {
    const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(line));
    return value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : undefined;
  } catch {
    return undefined;
  }
}

const isObject = (value: unknown): value is JsonObject => value !== null && typeof value === "object" && !Array.isArray(value);
const isCount = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

/** En-tête lu d'un fichier, avant validation des liens. */
interface Header {
  path: string;
  id: string;
  size: number;
  headerBytes: number;
  meta: JsonObject;
  ordinal?: number;
  base?: CodexSegmentBase;
}

/**
 * Lit et valide la première ligne : `session_meta` de la même conversation. Une racine ne porte
 * pas de `history_base` ; un segment porte `history_mode: "paginated"`, un `history_base` complet
 * et l'ordinal de son premier enregistrement.
 */
function readHeader(file: { path: string; segment?: string }, sessionId: string): Header | "pending" | "invalid" {
  let fd: number;
  try { fd = openSync(file.path, "r"); } catch { return "invalid"; }
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || !Number.isSafeInteger(stat.size)) return "invalid";
    const line = readLineAt(fd, stat.size, 0);
    // Un fichier qui vient d'être créé peut n'avoir qu'une première ligne partielle.
    if (line === "incomplete") return "pending";
    if (line === "too-large") return "invalid";
    const record = parseRecord(line);
    const meta = record?.type === "session_meta" && isObject(record.payload) ? record.payload : undefined;
    if (typeof meta?.id !== "string" || meta.id.toLowerCase() !== sessionId) return "invalid";
    const header: Header = { path: file.path, id: file.segment ?? sessionId, size: stat.size, headerBytes: line.length, meta };
    if (file.segment === undefined) return meta.history_base === undefined ? header : "invalid";
    const base = isObject(meta.history_base) ? meta.history_base : undefined;
    const baseId = typeof base?.thread_id === "string" ? base.thread_id.toLowerCase() : undefined;
    if (meta.history_mode !== "paginated" || !baseId || !isSessionId(baseId) || baseId === file.segment
      || !isCount(base!.end_byte_offset) || !isCount(base!.end_ordinal_exclusive) || !isCount(record!.ordinal)) return "invalid";
    return { ...header, ordinal: record!.ordinal, base: { id: baseId, endOffset: base!.end_byte_offset, endOrdinal: base!.end_ordinal_exclusive } };
  } catch {
    return "invalid";
  } finally {
    closeSync(fd);
  }
}

/**
 * Ligne terminée par l'octet `end - 1` (un saut de ligne), au plus `HISTORY_LINE_LIMIT` octets ;
 * `too-large` si son début n'est pas trouvé dans cette limite.
 */
function readLineBefore(fd: number, end: number): Buffer | "too-large" {
  const limit = Math.max(0, end - 1 - HISTORY_LINE_LIMIT);
  let position = end - 1;
  while (position > limit) {
    const length = Math.min(4096, position - limit);
    const chunk = readExact(fd, position - length, length);
    const newline = chunk.lastIndexOf(10);
    if (newline >= 0) {
      const start = position - length + newline + 1;
      return readExact(fd, start, end - start);
    }
    position -= length;
  }
  return position === 0 ? readExact(fd, 0, end) : "too-large";
}

/**
 * Vérifie la coupure annoncée par `child` dans `parent` : après la première ligne, dans le
 * fichier, sur une frontière de ligne ; le premier enregistrement du segment et, s'il existe,
 * l'enregistrement abandonné à la coupure portent l'ordinal annoncé, et la dernière ligne conservée
 * du parent porte l'ordinal précédent (y compris pour une coupure en fin de fichier).
 */
function validCut(parent: Header, child: Header): boolean {
  const { endOffset, endOrdinal } = child.base!;
  if (child.ordinal !== endOrdinal || endOrdinal === 0 || endOffset < parent.headerBytes || endOffset > parent.size) return false;
  let fd: number;
  try { fd = openSync(parent.path, "r"); } catch { return false; }
  try {
    if (readExact(fd, endOffset - 1, 1)[0] !== 10) return false;
    const kept = readLineBefore(fd, endOffset);
    if (typeof kept === "string" || parseRecord(kept)?.ordinal !== endOrdinal - 1) return false;
    if (endOffset === parent.size) return true;
    const line = readLineAt(fd, parent.size, endOffset);
    return typeof line !== "string" && parseRecord(line)?.ordinal === endOrdinal;
  } catch {
    return false;
  } finally {
    closeSync(fd);
  }
}

/**
 * Résout la chaîne d'une conversation Codex, de la racine à la tête. Un historique d'un seul
 * fichier sans `history_base` (forme antérieure) donne une chaîne d'un élément.
 *
 * Refus : deux racines (`duplicate-root`, y compris une copie archivée), aucune racine lisible
 * alors que des segments existent (`missing-root`), deux fichiers pour un même segment, en-tête
 * invalide ou d'une autre conversation, lien vers un fichier absent (`broken-link`), deux
 * segments sur le même fichier (`fork`), segment non atteint depuis la racine, coupure incohérente.
 * Un fichier dont la première ligne est encore partielle est écarté et compté dans `pending`.
 */
export function resolveCodexHistory(home: string, sessionId: string): CodexHistoryResult {
  const id = sessionId.toLowerCase();
  const files = findCodexHistoryFiles(home, id);
  if (files.length === 0) return { status: "not-found" };
  // Deux racines restent ambiguës quel que soit leur contenu, comme avant les segments.
  if (files.filter((file) => file.segment === undefined).length > 1) return { status: "refused", reason: "duplicate-root" };
  const headers: Header[] = [];
  let pending = 0;
  for (const file of files) {
    const header = readHeader(file, id);
    if (header === "pending") pending += 1;
    else if (header === "invalid") return { status: "refused", reason: "invalid-header" };
    else headers.push(header);
  }
  const roots = headers.filter((header) => header.base === undefined);
  if (roots.length > 1) return { status: "refused", reason: "duplicate-root" };
  if (roots.length === 0) return headers.length === 0 && pending > 0 ? { status: "not-found" } : { status: "refused", reason: "missing-root" };
  const byId = new Map<string, Header>();
  for (const header of headers) {
    if (byId.has(header.id)) return { status: "refused", reason: "duplicate-segment" };
    byId.set(header.id, header);
  }
  const children = new Map<string, Header>();
  for (const header of headers) {
    if (!header.base) continue;
    if (!byId.has(header.base.id)) return { status: "refused", reason: "broken-link" };
    if (children.has(header.base.id)) return { status: "refused", reason: "fork" };
    children.set(header.base.id, header);
  }
  const chain: Header[] = [roots[0]!];
  for (let next = children.get(roots[0]!.id); next; next = children.get(next.id)) {
    if (chain.length > headers.length) return { status: "refused", reason: "unreachable-segment" };
    if (!validCut(chain[chain.length - 1]!, next)) return { status: "refused", reason: "invalid-cut" };
    chain.push(next);
  }
  if (chain.length !== headers.length) return { status: "refused", reason: "unreachable-segment" };
  const segments = chain.map((header, index): CodexSegment => ({
    path: header.path,
    id: header.id,
    size: header.size,
    headerBytes: header.headerBytes,
    meta: header.meta,
    ...(header.base ? { base: header.base } : {}),
    activeEnd: chain[index + 1]?.base?.endOffset ?? header.size
  }));
  return { status: "found", segments, pending };
}

/**
 * Plage d'un fichier dans le flux logique d'une conversation. Le flux suivi depuis un fichier
 * d'ancrage commence à l'octet 0 de ce fichier (offsets logiques = offsets réels de l'ancrage),
 * puis enchaîne, pour chaque segment suivant, ses octets après sa première ligne. Chaque fichier
 * s'arrête à sa partie active.
 */
export interface HistoryPart {
  path: string;
  start: number;
  end: number;
  logicalStart: number;
}

/** Parties du flux logique à partir du segment `anchor` (indice dans `segments`). */
export function historyParts(segments: readonly CodexSegment[], anchor: number): HistoryPart[] {
  const parts: HistoryPart[] = [];
  let logical = 0;
  segments.slice(anchor).forEach((segment, index) => {
    const start = index === 0 ? 0 : segment.headerBytes;
    parts.push({ path: segment.path, start, end: segment.activeEnd, logicalStart: logical });
    logical += segment.activeEnd - start;
  });
  return parts;
}

/** Libellé court d'un refus, pour un diagnostic sans chemin ni contenu. */
export function historyRefusalDetail(reason: CodexHistoryRefusal): string {
  const ambiguous = reason === "duplicate-root" || reason === "duplicate-segment" || reason === "fork";
  return `historique Codex refusé (${reason}) : ${ambiguous ? "cible ambiguë" : "chaîne incohérente"}`;
}
