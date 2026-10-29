/** @file Inventaire borné des exports Relay locaux ; aucune sélection, conversation ou permission sondée. */
import { constants } from "node:fs";
import { lstat, open, opendir } from "node:fs/promises";
import path from "node:path";
import { createTranslator } from "./i18n.js";
import { parseAgentName, parseSessionRef, validateRelaySubject } from "./externalSessions/envelope.js";
import { isOpenCodeSessionId, parseOpenCodeRef } from "./externalSessions/opencodeCopy.js";
import { RELAY_EXIT_CODES } from "./externalSessions/outcome.js";
import type { DeliveryStatus, ExternalProvider, RelayStatus } from "./externalSessions/types.js";

/** Bornes de travail indépendantes de la taille des messages/réponses exportés. */
export const RELAY_RECENT_BOUNDS = { directoryEntries: 5000, headerFiles: 200, headerBytes: 16 * 1024 } as const;

/** Métadonnées déclarées dans un export, jamais une preuve d'identité, d'état ou de droits actuels. */
export interface RecentRelayEntry {
  fileName: string;
  date: string;
  subject: string | null;
  agent: string;
  to: { agent: string; session: string | null } | null;
  provider: ExternalProvider | "opencode";
  mode: "background" | "open" | "follow" | "copy" | null;
  status: RelayStatus;
  delivery: DeliveryStatus;
  copy?: { source: string; session: string | null; verified: boolean };
}

/** Motif stable et nom relatif seulement ; jamais de message système contenant un chemin personnel. */
export interface RecentRelayWarning { fileName: string; reason: "unreadable" | "invalid-header" | "header-too-large" | "not-regular" | "changed" | "invalid-name" }

/** `truncated` : fichiers non présentés ; `scanTruncated` : plafond de scan atteint, ordre global non garanti. */
export interface RecentRelayInventory {
  entries: RecentRelayEntry[];
  warnings: RecentRelayWarning[];
  truncated: boolean;
  scanTruncated: boolean;
}

/** Erreur de dossier sans prose filesystem ni chemin absolu à exposer dans le JSON. */
export class RelayRecentReadError extends Error { constructor() { super("directory-unreadable"); } }

const dictionaries = [createTranslator("fr"), createTranslator("en")];
const deliveries: readonly string[] = ["replied", "not-delivered", "persisted-no-reply", "unknown"];
const modes: readonly string[] = ["background", "open", "follow", "copy"];

/**
 * Lit seulement la table initiale Palabre FR/EN. S'arrête au premier blanc : une table dans
 * le message ou la réponse ne remplace jamais une métadonnée. Les cellules échappées restent
 * littérales ; champs requis/identifiants inconnus et doublons sont refusés, pas devinés.
 */
export function parseRecentRelayHeader(header: string, fileName: string): RecentRelayEntry | undefined {
  const lines = header.replace(/^\uFEFF/, "").split(/\r?\n/);
  const messages = dictionaries.find(m => lines[0] === `# ${m.relay.export.title}`);
  if (!messages || lines[1] !== "" || lines[2] !== `| ${messages.relay.export.field} | ${messages.relay.export.value} |`
    || !/^\|\s*-+\s*\|\s*-+\s*\|$/.test(lines[3] ?? "")) return undefined;
  const fields = new Map<string, string>();
  let ended = false;
  for (const line of lines.slice(4)) {
    if (line === "") { ended = true; break; }
    // Le writer échappe chaque pipe interne avec un antislash, y compris après un antislash littéral.
    const cells = line.split(/(?<!\\)\|/);
    if (cells.length !== 4 || cells[0] !== "" || cells[3] !== "") return undefined;
    const key = cells[1]!.trim(), value = cells[2]!.trim().replace(/\\\|/g, "|").replace(/&#58;\*\*/g, ":**");
    if (fields.has(key)) return undefined;
    fields.set(key, value);
  }
  if (!ended) return undefined;
  const label = messages.relay.export;
  const provider = fields.get(label.provider);
  if (provider !== "codex" && provider !== "claude" && provider !== "opencode") return undefined;
  const date = fields.get(label.startedAt) ?? "";
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(date) || !Number.isFinite(Date.parse(date))
    || new Date(date).toISOString() !== date) return undefined;
  const subject = fields.get(label.subject) ?? null;
  if (subject !== null && !validateRelaySubject(subject).ok) return undefined;
  const status = fields.get(label.status) ?? "", delivery = fields.get(label.delivery) ?? "";
  if (!Object.hasOwn(RELAY_EXIT_CODES, status) || !deliveries.includes(delivery)) return undefined;
  const rawMode = fields.get(label.mode);
  const mode = rawMode === undefined ? null : rawMode.split(" — ")[0]!;
  if (mode !== null && !modes.includes(mode)) return undefined;
  const target = fields.get(label.to) ?? "";
  let to: NonNullable<RecentRelayEntry["to"]>;
  if (!target.includes(":")) {
    if (!parseAgentName(target).ok) return undefined;
    to = { agent: target, session: null };
  } else {
    const parsed = provider === "opencode" ? parseOpenCodeRef(target) : parseSessionRef(target);
    if (!parsed.ok) return undefined;
    to = { agent: parsed.value.agent, session: parsed.value.sessionId };
  }
  const result: RecentRelayEntry = { fileName, date, subject, agent: to.agent, to, provider, mode: mode as RecentRelayEntry["mode"],
    status: status as RelayStatus, delivery: delivery as DeliveryStatus };
  if (provider === "opencode") {
    const copy = messages.relay.copy;
    const source = fields.get(copy.source), retained = fields.get(copy.copy), verified = fields.get(copy.verified);
    if (mode !== "copy" || !isOpenCodeSessionId(source) || (verified !== messages.output.yes && verified !== messages.output.no)) return undefined;
    const session = isOpenCodeSessionId(retained) ? retained : null;
    if (retained !== copy.none && retained !== copy.unknown && session === null) return undefined;
    const checked = verified === messages.output.yes;
    if ((checked && (!session || to.session !== session)) || (!checked && to.session !== null) || source === session) return undefined;
    result.copy = { source, session, verified: checked };
    result.to = null; // Une copie historique ne doit jamais devenir une proposition de reprise directe.
  } else if (mode === "copy") return undefined;
  return result;
}

/** Nom relatif d'un seul fichier ; exclut liens de chemin et contrôles même sous un autre OS. */
function safeFileName(name: string): boolean { return !/[/\\\p{Cc}\p{Cf}]/u.test(name) && !path.win32.isAbsolute(name); }

/**
 * Inventorie un dossier plat sans lancer de CLI ni consommer les corps Markdown. Tri par mtime
 * puis nom ; les limites de scan sont explicites. Les exports individuels défectueux sont
 * signalés sans masquer les autres. Dossier absent : vide ; autre erreur de dossier : refus.
 */
export async function listRecentRelays(directory: string, limit = 10): Promise<RecentRelayInventory> {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new RangeError("invalid-limit");
  const result: RecentRelayInventory = { entries: [], warnings: [], truncated: false, scanTruncated: false };
  const files: { name: string; mtimeMs: number }[] = [];
  try {
    const handle = await opendir(directory);
    let count = 0;
    for await (const item of handle) {
      if (++count > RELAY_RECENT_BOUNDS.directoryEntries) { result.scanTruncated = true; break; }
      if (!/\.relay\.md$/i.test(item.name)) continue;
      if (!safeFileName(item.name)) { result.warnings.push({ fileName: "[invalid-name]", reason: "invalid-name" }); continue; }
      if (!item.isFile()) { result.warnings.push({ fileName: item.name, reason: "not-regular" }); continue; }
      try {
        const info = await lstat(path.join(directory, item.name));
        if (!info.isFile()) { result.warnings.push({ fileName: item.name, reason: "not-regular" }); continue; }
        files.push({ name: item.name, mtimeMs: info.mtimeMs });
      } catch { result.warnings.push({ fileName: item.name, reason: "unreadable" }); }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return result;
    throw new RelayRecentReadError();
  }
  files.sort((a, b) => b.mtimeMs - a.mtimeMs || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  let index = 0;
  for (; index < files.length && result.entries.length < limit && index < RELAY_RECENT_BOUNDS.headerFiles; index++) {
    const file = files[index]!;
    const fullPath = path.join(directory, file.name);
    let handle;
    try {
      // O_NOFOLLOW quand disponible ; lstat/fstat recoupent le fichier sous Windows également.
      const before = await lstat(fullPath);
      if (!before.isFile()) { result.warnings.push({ fileName: file.name, reason: "not-regular" }); continue; }
      handle = await open(fullPath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
      const opened = await handle.stat();
      if (!opened.isFile() || opened.dev !== before.dev || opened.ino !== before.ino) {
        result.warnings.push({ fileName: file.name, reason: "changed" }); continue;
      }
      const buffer = Buffer.alloc(RELAY_RECENT_BOUNDS.headerBytes);
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
      const after = await handle.stat();
      if (opened.size !== after.size || opened.mtimeMs !== after.mtimeMs || opened.ctimeMs !== after.ctimeMs
        || opened.mtimeMs !== file.mtimeMs) { result.warnings.push({ fileName: file.name, reason: "changed" }); continue; }
      const text = buffer.subarray(0, bytesRead).toString("utf8");
      const tableComplete = text.split(/\r?\n/).slice(4).includes("");
      const entry = parseRecentRelayHeader(text, file.name);
      if (entry) result.entries.push(entry);
      else result.warnings.push({ fileName: file.name, reason: !tableComplete && bytesRead === buffer.length ? "header-too-large" : "invalid-header" });
    } catch { result.warnings.push({ fileName: file.name, reason: "unreadable" }); }
    finally { await handle?.close(); }
  }
  if (index < files.length && index === RELAY_RECENT_BOUNDS.headerFiles && result.entries.length < limit) result.scanTruncated = true;
  result.truncated = result.scanTruncated || index < files.length;
  return result;
}
