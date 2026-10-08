/**
 * @file Relay B2.1 : corrélation pure d'une réponse dans le transcript d'une conversation Claude
 * Code ouverte, après un message de pair (voir `scripts/prototypes/relay/CONTRAT-B2.md`).
 * Fonctions pures : aucun accès disque, envoi, attente ni appel de modèle. Les lectures bornées
 * de B1 (`captureOpenRollout`, `readOpenRollout`) conviennent telles quelles : elles ne dépendent
 * pas du format. Le dialecte est celui relevé avec Claude Code 2.1.293 (Claude desktop) sous
 * Windows ; ce n'est pas un schéma public. Les formes non observées restent prudentes : jamais de
 * réponse rendue, et la preuve de réception n'est jamais effacée par une ambiguïté du tour.
 */
import { CONTEXT_TOKEN, checkOpenFraming, openAddedLines, type OpenBaseline, type OpenObservation, type OpenSnapshot } from "./openReader.js";

/** Le nonce et le corps exact sont propres à une seule tentative. */
export interface ClaudeOpenRequest {
  /** UUID de la conversation cible, égal au nom du transcript et à chaque `sessionId`. */
  sessionId: string;
  nonce: string;
  /** Corps exact remis au pair (`origin.body` attendu), nonce compris. */
  envelope: string;
  baseline: OpenBaseline;
}

/** Relevé du seul tour corrélé, pour diagnostic. Un champ absent est inconnu. */
export interface ClaudeTurnContext {
  /** Modèles annoncés par les entrées `assistant` du segment, dans l'ordre d'apparition. */
  models?: string[];
  /** `permissionMode` de l'ancre : mode de la cible au début du tour. */
  permissionMode?: string;
}

/**
 * Observation du transcript. `persisted: true` vient seulement d'une entrée de pair au corps
 * exact (preuve de réception), indépendamment de la validité du début de tour. `queued` est un
 * diagnostic : la forme exacte de file a été vue, sans rien prouver de plus.
 */
export interface ClaudeOpenObservation {
  status: OpenObservation["status"];
  persisted: boolean | "unknown";
  reason: string;
  queued: boolean;
  promptId?: string;
  reply?: string;
  /** Présent pour `replied` et `failed`, quand un champ est relevé. */
  context?: ClaudeTurnContext;
}

type JsonObject = Record<string, unknown>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Types de pièces jointes relevés dans le transcript jetable (2.1.293), tous sans saisie de
 * l'utilisateur ni d'un pair. Tout autre type chaîné dans le segment reste ambigu : une saisie
 * mise en file pendant un tour pourrait prendre la forme d'une pièce jointe.
 */
export const CLAUDE_ANNEX_ATTACHMENTS: ReadonlySet<string> = new Set([
  "agent_listing_delta", "auto_mode", "credential_org", "date", "deferred_tools_delta", "environment", "language",
  "mcp_instructions_delta", "model", "prompt_snapshot", "remote_session_change", "session_context", "skill_listing",
  "total_tokens_reminder"
]);

/**
 * Entrées de conversation : elles doivent toujours porter un `uuid` non vide. Sans lui, elles
 * sont structurellement invalides, jamais assimilées à des métadonnées.
 */
const CONVERSATION_TYPES: ReadonlySet<string> = new Set(["assistant", "attachment", "system", "user"]);

/** Métadonnées non chaînées relevées dans le transcript jetable (2.1.293), admises pendant un tour. */
export const CLAUDE_METADATA_TYPES: ReadonlySet<string> = new Set([
  "agent-name", "atis-latch", "custom-title", "file-history-snapshot", "last-prompt", "queue-operation"
]);

/** Identifiant de chaîne exploitable : chaîne non vide. */
function hasChainId(row: JsonObject): boolean {
  return typeof row.uuid === "string" && row.uuid !== "";
}

const QUEUE_OPEN =/^<cross-session-message from="[^"\r\n]*" from-name="[^"\r\n]*" from-mode="[^"\r\n]*">\n/;
const QUEUE_CLOSE = "\n</cross-session-message>";

function object(value: unknown): JsonObject | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : undefined;
}

/**
 * Forme exacte relevée sur les 11 réceptions du transcript jetable : le corps entre exactement un
 * `\n` de chaque côté, attributs sans guillemet ni saut de ligne. Une enveloppe qui contient la
 * balise n'est jamais reconnue : la forme ne serait plus univoque.
 */
export function isClaudeQueuedForm(content: unknown, envelope: string): boolean {
  if (typeof content !== "string" || envelope.includes("<cross-session-message") || envelope.includes("</cross-session-message>")) return false;
  const head = QUEUE_OPEN.exec(content)?.[0];
  return head !== undefined && content.slice(head.length) === envelope + QUEUE_CLOSE;
}

/** Début de tour : entrée `user` qui porte une marque de tour, quelle que soit son origine. */
function isTurnStart(row: JsonObject): boolean {
  return row.type === "user" && (row.turnOrigin !== undefined || row.turnPosition !== undefined);
}

/** Forme d'une fin valide, sans la liaison au segment (vérifiée par l'appelant quand elle est visible). */
function isEndForm(row: JsonObject | undefined, sessionId: string): boolean {
  return row?.type === "system" && row.subtype === "stop_hook_summary" && hasChainId(row)
    && row.preventedContinuation === false && Array.isArray(row.hookErrors) && row.hookErrors.length === 0
    && row.isSidechain === false && row.sessionId === sessionId;
}

/** Textes saisis d'une entrée `user` : contenu textuel et corps de pair, jamais les résultats d'outils. */
function userTexts(row: JsonObject): string[] {
  const content = object(row.message)?.content;
  const texts = typeof content === "string" ? [content]
    : Array.isArray(content) ? content.map(object).filter((block) => block?.type === "text" && typeof block.text === "string").map((block) => block!.text as string) : [];
  const body = object(row.origin)?.body;
  return typeof body === "string" ? [...texts, body] : texts;
}

/** État visible avant l'offset : dernière entrée chaînée, `uuid` et débuts de tour du témoin. */
interface WitnessState {
  lastChained?: JsonObject;
  uuids: Set<string>;
  promptIds: Set<string>;
}

/**
 * Lit le témoin (64 derniers Kio avant l'offset). Sa première ligne peut être tronquée, sauf s'il
 * couvre tout le fichier. Une ligne illisible retire toute preuve : la fin précédente n'est alors
 * jamais considérée comme prouvée.
 */
function readWitness(witness: Uint8Array, wholeFile: boolean): WitnessState {
  const empty: WitnessState = { uuids: new Set(), promptIds: new Set() };
  const bytes = Buffer.from(witness.buffer, witness.byteOffset, witness.byteLength);
  let text: string;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(wholeFile ? 0 : bytes.indexOf(10) + 1)); }
  catch { return empty; }
  const state: WitnessState = { uuids: new Set(), promptIds: new Set() };
  for (const line of text.split("\n").slice(0, -1)) {
    if (!line.trim()) continue;
    let row: JsonObject | undefined;
    try { row = object(JSON.parse(line)); } catch { return empty; }
    if (!row) return empty;
    if (hasChainId(row)) { state.uuids.add(row.uuid as string); state.lastChained = row; }
    if (isTurnStart(row) && typeof row.promptId === "string") state.promptIds.add(row.promptId);
  }
  return state;
}

/**
 * Observe uniquement l'ajout depuis l'offset et corrèle la réponse au message de pair.
 *
 * Réception : une seule entrée `user` neuve, `origin.kind: "peer"`, `origin.body` identique à
 * l'enveloppe, `sessionId` de la cible et `isSidechain: false`. Elle donne `persisted: true`, même
 * si le début du tour n'est pas prouvé.
 *
 * Réponse : la même entrée doit aussi ouvrir un tour (`turnOrigin: "peer"`, `promptIndex: 1`,
 * `promptId` UUID distinct des autres débuts de tour visibles, parent égal à une fin valide). Le
 * segment suit la chaîne jusqu'à la première fin valide ; il n'admet que des `assistant`, des
 * pièces jointes relevées et des résultats d'outils liés à leur appel ; entre l'ancre et la fin, seules
 * des métadonnées relevées peuvent rester sans `uuid`. Le texte rendu est celui du
 * groupe `assistant` final, après le dernier résultat d'outil. Les tours suivants sont hors segment.
 */
export function inspectClaudeOpenReply(snapshot: OpenSnapshot, request: ClaudeOpenRequest): ClaudeOpenObservation {
  const unreadable = (reason: string): ClaudeOpenObservation => ({ status: "unreadable", persisted: "unknown", reason, queued: false });
  if (!UUID.test(request.sessionId) || !request.nonce || !request.envelope.includes(request.nonce)) return unreadable("invalid-request");
  const { baseline } = request;
  const framing = checkOpenFraming(snapshot, baseline);
  if (framing) return unreadable(framing);
  let identity: JsonObject | undefined;
  try { identity = object(JSON.parse(snapshot.firstLine)); } catch { return unreadable("identity-mismatch"); }
  if (!snapshot.firstLine.endsWith("\n") || identity?.sessionId !== request.sessionId) return unreadable("identity-mismatch");
  const lines = openAddedLines(snapshot, baseline);
  if (typeof lines === "string") return unreadable(lines);

  // Contrôles globaux, sur tout l'ajout : lignes terminées valides et identité.
  const fresh: JsonObject[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    let row: JsonObject | undefined;
    try { row = object(JSON.parse(line)); } catch { return unreadable("invalid-json-line"); }
    if (!row || typeof row.type !== "string") return unreadable("invalid-record");
    if ("sessionId" in row && row.sessionId !== request.sessionId) return unreadable("identity-mismatch");
    fresh.push(row);
  }
  const queued = fresh.some((row) => row.type === "queue-operation" && row.operation === "enqueue"
    && row.sessionId === request.sessionId && isClaudeQueuedForm(row.content, request.envelope));

  const anchors = fresh.filter((row) => row.type === "user" && object(row.origin)?.kind === "peer"
    && object(row.origin)?.body === request.envelope && row.sessionId === request.sessionId && row.isSidechain === false);
  const altered = fresh.some((row) => row.type === "user" && !anchors.includes(row) && userTexts(row).some((text) => text.includes(request.nonce)));
  if (anchors.length === 0) {
    return altered ? { status: "ambiguous", persisted: "unknown", reason: "envelope-altered", queued }
      : { status: "awaiting-message", persisted: false, reason: "envelope-not-observed", queued };
  }
  const received = (status: ClaudeOpenObservation["status"], reason: string, extra: Partial<ClaudeOpenObservation> = {}): ClaudeOpenObservation =>
    ({ status, persisted: true, reason, queued, ...extra });
  if (anchors.length !== 1) return received("ambiguous", "duplicate-envelope");
  if (altered) return received("ambiguous", "envelope-altered");
  const anchor = anchors[0]!;

  // Index de la chaîne de l'ajout ; la référence ne fournit que sa dernière entrée chaînée.
  const witness = readWitness(snapshot.witness, snapshot.witness.byteLength === baseline.bytes);
  const position = new Map(fresh.map((row, index) => [row, index]));
  const chained = fresh.filter(hasChainId);
  const counts = new Map<string, number>();
  const children = new Map<string, JsonObject[]>();
  for (const row of chained) {
    counts.set(row.uuid as string, (counts.get(row.uuid as string) ?? 0) + 1);
    if (typeof row.parentUuid === "string") children.set(row.parentUuid, [...(children.get(row.parentUuid) ?? []), row]);
  }
  const unique = (row: JsonObject) => hasChainId(row) && counts.get(row.uuid as string) === 1 && !witness.uuids.has(row.uuid as string);
  const knownParent = (row: JsonObject) => typeof row.parentUuid === "string"
    && (counts.has(row.parentUuid) || row.parentUuid === witness.lastChained?.uuid);

  // Une ancre sans identifiant de chaîne prouve la réception, jamais un début de tour.
  if (!hasChainId(anchor)) return received("ambiguous", "malformed-entry-in-turn");
  // Début de tour : parent égal à une fin valide, de la référence ou de l'ajout, avant l'ancre.
  const parentUuid = anchor.parentUuid;
  const parentInAdded = typeof parentUuid === "string" ? chained.find((row) => row.uuid === parentUuid) : undefined;
  const provenEnd = typeof parentUuid === "string" && (parentInAdded
    ? counts.get(parentUuid) === 1 && position.get(parentInAdded)! < position.get(anchor)! && isEndForm(parentInAdded, request.sessionId)
    : witness.lastChained?.uuid === parentUuid && isEndForm(witness.lastChained, request.sessionId));
  if (anchor.turnOrigin !== "peer" || object(anchor.turnPosition)?.promptIndex !== 1 || !provenEnd) return received("ambiguous", "turn-start-not-proven");
  if (!unique(anchor)) return received("ambiguous", "duplicate-uuid");
  if ((children.get(parentUuid as string) ?? []).length !== 1) return received("ambiguous", "concurrent-branch");
  const promptId = anchor.promptId;
  if (typeof promptId !== "string" || !UUID.test(promptId)) return received("ambiguous", "invalid-prompt-id");
  const otherStarts = fresh.filter((row) => row !== anchor && isTurnStart(row)).map((row) => row.promptId);
  if (witness.promptIds.has(promptId) || otherStarts.includes(promptId)) return received("ambiguous", "duplicate-prompt-id");
  const anchored = (status: ClaudeOpenObservation["status"], reason: string, extra: Partial<ClaudeOpenObservation> = {}) =>
    received(status, reason, { promptId, ...extra });

  // Segment : chaîne linéaire depuis l'ancre jusqu'à la première fin valide.
  const segment: JsonObject[] = [anchor];
  const pending = new Map<string, JsonObject>();
  const calls = new Set<string>();
  const models: string[] = [];
  let lastResult = 0;
  const context = (): ClaudeTurnContext | undefined => {
    const permissionMode = typeof anchor.permissionMode === "string" && CONTEXT_TOKEN.test(anchor.permissionMode) ? anchor.permissionMode : undefined;
    const value: ClaudeTurnContext = { ...(models.length ? { models: [...models] } : {}), ...(permissionMode ? { permissionMode } : {}) };
    return Object.keys(value).length ? value : undefined;
  };
  /**
   * Entrées hors segment écrites après l'ancre et avant `until`. Seules les métadonnées relevées
   * sont admises. Une entrée de conversation sans `uuid` valide est mal formée ; un type non
   * chaîné inconnu reste ambigu ; une entrée chaînée est une branche ou un lien rompu (compaction).
   */
  const outOfSegment = (until: number): string | undefined => {
    const rows = fresh.filter((row) => position.get(row)! > position.get(anchor)! && position.get(row)! < until && !segment.includes(row));
    const loose = rows.filter((row) => !hasChainId(row));
    if (loose.some((row) => CONVERSATION_TYPES.has(row.type as string))) return "malformed-entry-in-turn";
    if (loose.some((row) => !CLAUDE_METADATA_TYPES.has(row.type as string))) return "unknown-entry-in-turn";
    const strays = rows.filter(hasChainId);
    if (strays.length === 0) return undefined;
    return strays.some((row) => !knownParent(row)) ? "broken-chain" : "concurrent-branch";
  };
  let end: JsonObject | undefined;
  for (let current = anchor; !end;) {
    const next = children.get(current.uuid as string) ?? [];
    if (next.length > 1) return anchored("ambiguous", "concurrent-branch");
    if (next.length === 0) {
      const issue = outOfSegment(fresh.length);
      return issue ? anchored("ambiguous", issue) : anchored("awaiting-reply", "end-not-observed");
    }
    const row = next[0]!;
    if (position.get(row)! < position.get(current)!) return anchored("ambiguous", "invalid-chain-order");
    if (!unique(row)) return anchored("ambiguous", "duplicate-uuid");
    if (row.isSidechain !== false) return anchored("ambiguous", "unknown-entry-in-turn");
    if (row.type === "assistant") {
      const message = object(row.message);
      // Hypothèse défensive (forme non observée) : erreur d'API synthétique ou structurée.
      if (row.isApiErrorMessage === true || row.error !== undefined || message?.model === "<synthetic>") return anchored("failed", "assistant-error", { context: context() });
      if (!message || !Array.isArray(message.content)) return anchored("ambiguous", "unknown-entry-in-turn");
      for (const value of message.content) {
        const block = object(value);
        if (block?.type === "tool_use") {
          if (typeof block.id !== "string" || block.id === "" || calls.has(block.id)) return anchored("ambiguous", "duplicate-tool-call");
          calls.add(block.id);
          pending.set(block.id, row);
        } else if (!(block?.type === "text" && typeof block.text === "string") && block?.type !== "thinking" && block?.type !== "redacted_thinking") {
          return anchored("ambiguous", "unknown-entry-in-turn");
        }
      }
      if (typeof message.model === "string" && CONTEXT_TOKEN.test(message.model) && !models.includes(message.model)) models.push(message.model);
    } else if (row.type === "user") {
      if (!consumeToolResult(row, current, promptId, request.sessionId, pending)) return anchored("ambiguous", "concurrent-input-in-turn");
      lastResult = segment.length;
    } else if (row.type === "attachment") {
      if (!CLAUDE_ANNEX_ATTACHMENTS.has(String(object(row.attachment)?.type))) return anchored("ambiguous", "unknown-entry-in-turn");
    } else if (row.type === "system") {
      // Une fin d'une autre forme, ou un sous-type inconnu, n'est jamais ignoré pour lire plus loin.
      if (!isEndForm(row, request.sessionId)) return anchored("ambiguous", "unknown-terminal");
      end = row;
    } else {
      return anchored("ambiguous", "unknown-entry-in-turn");
    }
    segment.push(row);
    current = row;
  }

  const issue = outOfSegment(position.get(end)!);
  if (issue) return anchored("ambiguous", issue);
  // Seules des pièces jointes relevées peuvent séparer la dernière réponse de la fin.
  const body = segment.slice(0, -1);
  const last = [...body].reverse().find((row) => row.type !== "attachment");
  if (last?.type !== "assistant") return anchored("ambiguous", "unknown-terminal");
  if (pending.size > 0) return anchored("ambiguous", "unresolved-tool-call");
  const texts = body.slice(lastResult + 1).filter((row) => row.type === "assistant")
    .flatMap((row) => (object(row.message)!.content as unknown[]).map(object))
    .filter((block) => block?.type === "text").map((block) => block!.text as string);
  if (!texts.some((text) => text.trim() !== "")) return anchored("ambiguous", "empty-final-text");
  const turnContext = context();
  return anchored("replied", "correlated-final", { reply: texts.join("\n"), ...(turnContext ? { context: turnContext } : {}) });
}

/**
 * Résultat d'outil admis dans le segment : seulement des blocs `tool_result`, chacun lié à un
 * appel encore en attente de l'entrée parente, consommé une seule fois ; `sourceToolAssistantUUID`
 * égal au parent, `promptId` de l'ancre, sans marque de tour ni origine. Consomme les appels liés.
 */
function consumeToolResult(row: JsonObject, parent: JsonObject, promptId: string, sessionId: string, pending: Map<string, JsonObject>): boolean {
  const content = object(row.message)?.content;
  if (!Array.isArray(content) || content.length === 0 || row.sourceToolAssistantUUID !== parent.uuid || row.promptId !== promptId
    || row.sessionId !== sessionId || row.turnOrigin !== undefined || row.turnPosition !== undefined || row.origin !== undefined) return false;
  const ids = content.map((value) => {
    const block = object(value);
    return block?.type === "tool_result" && typeof block.tool_use_id === "string" ? block.tool_use_id : undefined;
  });
  if (ids.some((id) => id === undefined || pending.get(id) !== parent) || new Set(ids).size !== ids.length) return false;
  for (const id of ids) pending.delete(id!);
  return true;
}
