/**
 * @file Prototype B1 : corrélation hors ligne d'une réponse Codex dans un rollout.
 * Aucun accès disque, envoi, polling, reprise ni appel de modèle. Ce dialecte expérimental utilise
 * les item_completed liés à un thread/tour observés avec Codex 0.151.0 sous Windows.
 */
import { createHash } from "node:crypto";

/** Offset avant dépôt et empreintes bornées ; ne garantit pas l'intégrité de tout l'historique. */
export interface OpenBaseline {
  bytes: number;
  firstLineSha256: string;
  sha256: string;
}

/** Première ligne et derniers octets avant l'offset, lus sans charger l'historique. */
export interface OpenReference {
  bytes: number;
  firstLine: string;
  witness: Uint8Array;
}

/** Seul l'ajout depuis l'offset est fourni au lecteur ; la taille totale peut dépasser 50 Mio. */
export interface OpenSnapshot extends OpenReference {
  added: Uint8Array;
}

/** Le nonce et l'enveloppe exacte sont propres à une seule tentative. */
export interface OpenRequest {
  threadId: string;
  nonce: string;
  envelope: string;
  baseline: OpenBaseline;
}

/** Observation de la conversation, distincte de l'accusé d'acceptation par la file. */
export interface OpenObservation {
  status: "awaiting-message" | "awaiting-reply" | "replied" | "failed" | "ambiguous" | "unreadable";
  persisted: boolean | "unknown";
  reason: string;
  turnId?: string;
  reply?: string;
}

/** Statuts existants de délivrance, proposés pour B1 sans ajouter « queued » à leur sens. */
export interface OpenDelivery {
  status: "not-delivered" | "unknown" | "persisted-no-reply" | "replied";
  persisted: boolean | "unknown";
  reply?: string;
}

type JsonObject = Record<string, unknown>;
/** Budgets expérimentaux du lecteur, distincts de la taille totale du fichier. */
export const OPEN_READ_LIMITS = { firstLineBytes: 1024 * 1024, witnessBytes: 64 * 1024, addedBytes: 50 * 1024 * 1024 } as const;

function object(value: unknown): JsonObject | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : undefined;
}

/** N'accepte que du texte ; ne reconstruit pas implicitement une image ou un contenu inconnu. */
function contentText(value: unknown): string | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const parts: string[] = [];
  for (const valuePart of value) {
    const part = object(valuePart);
    if (!part || !["text", "Text", "input_text", "output_text"].includes(String(part.type)) || typeof part.text !== "string") return undefined;
    parts.push(part.text);
  }
  return parts.join("\n");
}

function digest(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Capture un offset en fin de ligne avant queue et deux empreintes bornées. Le témoin couvre
 * les 64 derniers Kio, pas tout l'historique : une réécriture ailleurs peut ne pas être détectée.
 */
export function captureOpenBaseline(reference: OpenReference): OpenBaseline {
  const { bytes, firstLine, witness } = reference;
  if (!Number.isSafeInteger(bytes) || bytes <= 0 || Buffer.byteLength(firstLine) > OPEN_READ_LIMITS.firstLineBytes
    || Buffer.byteLength(firstLine) > bytes || witness.byteLength !== Math.min(bytes, OPEN_READ_LIMITS.witnessBytes)) throw new Error("invalid-baseline");
  if (!firstLine.endsWith("\n") || witness[witness.byteLength - 1] !== 10) throw new Error("baseline-incomplete");
  return { bytes, firstLineSha256: digest(Buffer.from(firstLine)), sha256: digest(witness) };
}

/**
 * Observe uniquement l'ajout depuis l'offset. Une dernière ligne incomplète est ignorée jusqu'au
 * prochain snapshot ; une ligne terminée invalide ou un témoin changé interdit tout succès.
 *
 * Succès : enveloppe exacte dans un message utilisateur neuf, item UserMessage du même texte
 * lié à la cible et à un tour commencé après l'offset, un seul utilisateur et une seule réponse
 * final_answer dans ce tour, puis task_complete avec un texte identique. Tout conflit reste explicite.
 * Les anciens event_msg/user_message et agent_message ne suffisent pas à identifier un tour.
 */
export function inspectOpenReply(snapshot: OpenSnapshot, request: OpenRequest): OpenObservation {
  const unreadable = (reason: string): OpenObservation => ({ status: "unreadable", persisted: "unknown", reason });
  if (!request.threadId || !request.nonce || !request.envelope.includes(request.nonce)) return unreadable("invalid-request");
  const baseline = request.baseline;
  if (!Number.isSafeInteger(baseline.bytes) || baseline.bytes <= 0 || !/^[a-f0-9]{64}$/.test(baseline.sha256)
    || !/^[a-f0-9]{64}$/.test(baseline.firstLineSha256)) return unreadable("invalid-baseline");
  if (!Number.isSafeInteger(snapshot.bytes) || snapshot.bytes < baseline.bytes) return unreadable("history-replaced");
  if (Buffer.byteLength(snapshot.firstLine) > OPEN_READ_LIMITS.firstLineBytes) return unreadable("identity-too-large");
  let identity: JsonObject | undefined;
  try { identity = object(JSON.parse(snapshot.firstLine)); } catch { return unreadable("identity-mismatch"); }
  if (!snapshot.firstLine.endsWith("\n") || identity?.type !== "session_meta" || object(identity.payload)?.id !== request.threadId) return unreadable("identity-mismatch");
  if (digest(Buffer.from(snapshot.firstLine)) !== baseline.firstLineSha256
    || snapshot.witness.byteLength !== Math.min(baseline.bytes, OPEN_READ_LIMITS.witnessBytes)
    || digest(snapshot.witness) !== baseline.sha256) return unreadable("history-replaced");
  if (snapshot.added.byteLength > OPEN_READ_LIMITS.addedBytes || snapshot.bytes - baseline.bytes > OPEN_READ_LIMITS.addedBytes) return unreadable("added-too-large");
  if (snapshot.added.byteLength !== snapshot.bytes - baseline.bytes) return unreadable("incomplete-snapshot");
  // Décoder seulement les lignes terminées, même si un caractère UTF-8 chevauche la fin lue.
  const added = Buffer.from(snapshot.added.buffer, snapshot.added.byteOffset, snapshot.added.byteLength);
  let text: string;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(added.subarray(0, added.lastIndexOf(10) + 1)); }
  catch { return unreadable("invalid-utf8"); }
  const fresh: JsonObject[] = [];
  for (const line of text.split("\n").slice(0, -1)) {
    if (!line.trim()) continue;
    let row: JsonObject | undefined;
    try { row = object(JSON.parse(line)); } catch { return unreadable("invalid-json-line"); }
    if (!row || typeof row.type !== "string") return unreadable("invalid-record");
    if (row.type === "session_meta") return unreadable("identity-mismatch");
    fresh.push(row);
  }
  const users = fresh.filter((row) => {
    const payload = object(row.payload);
    return row.type === "response_item" && payload?.type === "message" && payload.role === "user" && contentText(payload.content) === request.envelope;
  });
  if (users.length === 0) {
    const altered = fresh.some((row) => {
      const payload = object(row.payload);
      return row.type === "response_item" && payload?.type === "message" && payload.role === "user" && contentText(payload.content)?.includes(request.nonce);
    });
    return altered ? { status: "ambiguous", persisted: "unknown", reason: "envelope-altered" }
      : { status: "awaiting-message", persisted: false, reason: "envelope-not-observed" };
  }
  const observation = (status: OpenObservation["status"], reason: string, turnId?: string): OpenObservation => ({ status, persisted: true, reason, ...(turnId ? { turnId } : {}) });
  if (users.length !== 1) return observation("ambiguous", "duplicate-envelope");
  const events = fresh.filter((row) => row.type === "event_msg").map((row) => object(row.payload)).filter((row): row is JsonObject => row !== undefined);
  const bound = events.filter((event) => {
    const item = object(event.item);
    return event.type === "item_completed" && item?.type === "UserMessage" && contentText(item.content) === request.envelope;
  });
  if (bound.length === 0) return observation("awaiting-reply", "turn-binding-not-observed");
  if (bound.length !== 1) return observation("ambiguous", "duplicate-turn-binding");
  const anchor = bound[0]!;
  if (anchor.thread_id !== request.threadId || typeof anchor.turn_id !== "string" || anchor.turn_id === "") return observation("ambiguous", "invalid-turn-binding");
  const turnId = anchor.turn_id;
  const turn = events.filter((event) => event.turn_id === turnId);
  if (turn.some((event) => event.thread_id !== undefined && event.thread_id !== request.threadId)) return observation("ambiguous", "foreign-thread-event", turnId);
  const position = (event: JsonObject) => fresh.findIndex((row) => row.type === "event_msg" && row.payload === event);
  const userPosition = fresh.indexOf(users[0]!);
  const starts = turn.filter((event) => event.type === "task_started");
  if (starts.length === 0) return observation("ambiguous", "turn-start-not-observed-after-baseline", turnId);
  if (starts.length !== 1) return observation("ambiguous", "duplicate-turn-start", turnId);
  if (position(starts[0]!) >= userPosition) return observation("ambiguous", "invalid-event-order", turnId);
  const turnUsers = turn.filter((event) => event.type === "item_completed" && object(event.item)?.type === "UserMessage");
  if (turnUsers.length !== 1) return observation("ambiguous", "multiple-users-in-turn", turnId);
  // Hypothèses défensives testées sur fixtures : ces formats d'échec du rollout restent à
  // observer réellement. Une erreur non attribuable au tour ne prouve pas sa terminaison.
  if (turn.some((event) => ["error", "turn_aborted", "task_cancelled", "task_failed"].includes(String(event.type)))) return observation("failed", "turn-failed-or-cancelled", turnId);
  const finals = turn.filter((event) => event.type === "item_completed" && object(event.item)?.type === "AgentMessage" && object(event.item)?.phase === "final_answer");
  const completions = turn.filter((event) => event.type === "task_complete");
  if (finals.length > 1 || completions.length > 1) return observation("ambiguous", "multiple-finals-or-completions", turnId);
  if (finals.length === 0 || completions.length === 0) return observation("awaiting-reply", "final-or-completion-not-observed", turnId);
  const final = finals[0]!;
  const completion = completions[0]!;
  const anchorPosition = position(anchor);
  const completionPosition = position(completion);
  if (anchorPosition < userPosition || position(final) < anchorPosition || completionPosition < position(final)) return observation("ambiguous", "invalid-event-order", turnId);
  if (final.thread_id !== request.threadId) return observation("ambiguous", "unidentified-final-thread", turnId);
  // Une seconde saisie brute peut manquer d'événement typé. Ne pas supposer alors qu'elle
  // appartient à un autre tour ; seules des liaisons uniques et explicites le démontrent.
  for (const row of fresh.slice(position(starts[0]!) + 1, completionPosition)) {
    if (row === users[0]) continue;
    const payload = object(row.payload);
    if (row.type !== "response_item" || payload?.type !== "message" || payload.role !== "user") continue;
    const text = contentText(payload.content);
    const bindings = events.filter((event) => {
      const item = object(event.item);
      return text !== undefined && event.type === "item_completed" && item?.type === "UserMessage" && contentText(item.content) === text;
    });
    const binding = bindings[0];
    if (bindings.length !== 1 || !binding || binding.thread_id !== request.threadId
      || typeof binding.turn_id !== "string" || binding.turn_id === "" || binding.turn_id === turnId
      || position(binding) < fresh.indexOf(row) || position(binding) > completionPosition) {
      return observation("ambiguous", "unbound-concurrent-user", turnId);
    }
  }
  if (completion.status !== undefined && completion.status !== "completed") return observation("failed", "unsuccessful-completion", turnId);
  const reply = contentText(object(final.item)?.content);
  if (reply === undefined || reply.trim() === "" || typeof completion.last_agent_message !== "string" || completion.last_agent_message !== reply) return observation("ambiguous", "completion-text-mismatch", turnId);
  return { status: "replied", persisted: true, reason: "correlated-final", turnId, reply };
}

/**
 * Délivrance à la fin d'une tentative. L'accusé queue, un timeout et un Ctrl+C ne prouvent ni la
 * réception ni la suppression du message. Une preuve actuelle ou antérieure dans l'historique
 * l'emporte sur attempted, même si une lecture ultérieure échoue.
 * Ce prototype ne recommande jamais un retry ; il ne contrôle pas la file du fournisseur.
 */
export function settleOpenDelivery(observation: OpenObservation, attempted: boolean, previouslyPersisted = false): OpenDelivery {
  if (observation.status === "replied" && observation.reply !== undefined) return { status: "replied", persisted: true, reply: observation.reply };
  if (observation.persisted === true || previouslyPersisted) return { status: "persisted-no-reply", persisted: true };
  if (!attempted) return { status: "not-delivered", persisted: observation.persisted };
  return { status: "unknown", persisted: observation.persisted };
}
