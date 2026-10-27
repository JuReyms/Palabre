/**
 * @file Historiques Codex factices découpés en segments. Structure relevée sur des
 * historiques locaux en octobre 2026 (Codex 0.163.0-alpha.11.2) : première ligne `session_meta`
 * avec `history_mode: "paginated"` et `history_base`, ordinal de chaque ligne, coupure du fichier
 * précédent sur la ligne qui porte `end_ordinal_exclusive`. Aucun texte ni identifiant réel.
 */
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

export type Row = Record<string, unknown>;

/** Fichier écrit : offset de chaque ordinal, pour placer une coupure exacte. */
export interface SegmentFile {
  path: string;
  /** Identifiant du segment ; celui de la conversation pour la racine. */
  id: string;
  offsets: Map<number, number>;
  size: number;
  nextOrdinal: number;
}

const encode = (row: Row) => `${JSON.stringify(row)}\n`;

function write(file: SegmentFile, rows: readonly Row[], append: boolean): void {
  let text = "";
  for (const row of rows) {
    const ordinal = file.nextOrdinal++;
    file.offsets.set(ordinal, file.size + Buffer.byteLength(text));
    text += encode({ timestamp: "2026-10-27T10:00:00.000Z", ordinal, ...row });
  }
  if (append) appendFileSync(file.path, text); else writeFileSync(file.path, text);
  file.size += Buffer.byteLength(text);
}

function filePath(home: string, day: string, name: string, archived = false): string {
  const dir = path.join(home, archived ? "archived_sessions" : "sessions", "2026", "10", day);
  mkdirSync(dir, { recursive: true });
  return path.join(dir, name);
}

/** Racine : forme antérieure sans `history_mode`, sauf si `paginated` est demandé. */
export function writeRoot(home: string, thread: string, cwd: string, rows: readonly Row[], options: { day?: string; paginated?: boolean; archived?: boolean; name?: string } = {}): SegmentFile {
  const file: SegmentFile = {
    path: filePath(home, options.day ?? "19", options.name ?? `rollout-2026-10-${options.day ?? "19"}T10-00-00-${thread}.jsonl`, options.archived),
    id: thread, offsets: new Map(), size: 0, nextOrdinal: 0
  };
  write(file, [{ type: "session_meta", payload: { id: thread, session_id: thread, cwd, ...(options.paginated ? { history_mode: "paginated" } : {}) } }, ...rows], false);
  return file;
}

/**
 * Segment repris de `parent` à l'ordinal `cutOrdinal` (coupure sur la ligne qui le porte, ou fin
 * du fichier si aucun enregistrement ne le porte encore). `override` force des valeurs invalides.
 */
export function writeSegment(home: string, thread: string, cwd: string, parent: SegmentFile, id: string, cutOrdinal: number, rows: readonly Row[], options: {
  day?: string; archived?: boolean; header?: string;
  override?: { endOffset?: number; headerOrdinal?: number; baseId?: string; mode?: unknown; withoutBase?: boolean };
} = {}): SegmentFile {
  const day = options.day ?? "27";
  const endOffset = options.override?.endOffset ?? parent.offsets.get(cutOrdinal) ?? parent.size;
  const file: SegmentFile = {
    path: filePath(home, day, `rollout-2026-10-${day}T11-00-00-${thread}_${id}.jsonl`, options.archived),
    id, offsets: new Map(), size: 0, nextOrdinal: options.override?.headerOrdinal ?? cutOrdinal
  };
  if (options.header !== undefined) {
    writeFileSync(file.path, options.header);
    file.size = Buffer.byteLength(options.header);
    return file;
  }
  const base = { thread_id: options.override?.baseId ?? parent.id, end_ordinal_exclusive: cutOrdinal, end_byte_offset: endOffset };
  write(file, [{ type: "session_meta", payload: {
    id: thread, session_id: thread, cwd, history_mode: options.override?.mode ?? "paginated",
    ...(options.override?.withoutBase ? {} : { history_base: base })
  } }, ...rows], false);
  return file;
}

/** Ajoute des lignes numérotées à la suite, comme l'écrivain de Codex. */
export function appendSegmentRows(file: SegmentFile, rows: readonly Row[]): void {
  write(file, rows, true);
}
