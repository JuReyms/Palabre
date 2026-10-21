/**
 * @file Relay B1 (`palabre relay --open`) : corrélation d'une réponse Codex dans un rollout (voir
 * AGENTS.md, section "Relay externe", et `scripts/prototypes/relay/CONTRAT-B1.md`).
 * Fonctions pures : aucun accès disque, envoi, attente, reprise ni appel de modèle. Le dialecte
 * expérimental utilise les item_completed liés à un thread et à un tour, observés avec Codex 0.151.0
 * (TUI) et 0.160.1 (app-server de Codex desktop) sous Windows ; ce n'est pas un schéma public.
 */
import { createHash } from "node:crypto";
import { extractRetryAfter } from "../adapters/cli-shared.js";

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
  /** Indication CLI : secondes, ISO ou heure HH:mm sans date/fuseau. Jamais issue d'un texte de modèle. */
  retryAfter?: number | string;
  /** Relevé du `turn_context` du seul tour corrélé ; présent pour `replied` et `failed` quand il est attribuable. */
  context?: OpenTurnContext;
}

/**
 * Modèle et permissions effectivement appliqués au tour corrélé, relevés après coup pour
 * diagnostic. Champs bornés et sélectionnés : ni chemins, ni `turn_context` complet. Un champ
 * absent est inconnu ; il n'est jamais repris d'un autre tour ni du dernier profil historique.
 */
export interface OpenTurnContext {
  model?: string;
  approvalPolicy?: string;
  sandbox?: string;
  network?: "enabled" | "restricted";
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

/**
 * Contextes observés sous Windows : environnement (desktop 0.160.1), AGENTS seul ou AGENTS puis
 * environnement en deux parties (rollouts locaux du 21 octobre 2026). Seules les sortes, leur
 * ordre dans le message et les délimiteurs sont inspectés ; aucun texte privé n'est exporté.
 * Chaque sorte exige la métadonnée du tour et un bloc complet. Cette exception n'authentifie
 * pas une origine système et n'ajoute aucun droit ; ses bornes sont vérifiées par l'appelant.
 */
function turnSystemContexts(payload: JsonObject, turnId: string): Array<"environment" | "agents"> | undefined {
  const metadata = object(payload.internal_chat_message_metadata_passthrough);
  const kinds = metadata?.content_item_kinds;
  if (metadata?.turn_id !== turnId || !Array.isArray(kinds) || !Array.isArray(payload.content) || payload.content.length !== kinds.length) return undefined;
  // Formes observées sous Windows : un contexte seul ou AGENTS puis environnement, jamais
  // une liste arbitraire. Les métadonnées ne sont pas une authentification de leur provenance.
  const signature = JSON.stringify(kinds);
  if (![ '["environments.environment_context"]', '["agents_md.instructions"]', '["agents_md.instructions","environments.environment_context"]' ].includes(signature)) return undefined;
  const result: Array<"environment" | "agents"> = [];
  for (let i = 0; i < kinds.length; i++) {
    if ((kinds[i] === "agents_md.instructions" || kinds.length === 2) && object(payload.content[i])?.type !== "input_text") return undefined;
    const text = contentText([payload.content[i]])?.trim();
    if (text === undefined) return undefined;
    if (kinds[i] === "environments.environment_context") {
      if (!/^<environment_context>(?:(?!<\/?environment_context>)[\s\S])*<\/environment_context>$/.test(text)) return undefined;
      result.push("environment");
    } else {
      if (!/^# AGENTS\.md instructions for [^\r\n]+\r?\n\s*<INSTRUCTIONS>(?:(?!<\/?INSTRUCTIONS>)[\s\S])*<\/INSTRUCTIONS>$/.test(text)) return undefined;
      result.push("agents");
    }
  }
  return result;
}

/**
 * Forme `user.text` observée : diagnostic de saisie concurrente seulement, jamais une preuve
 * de l'identité du propriétaire ni une réponse liée à une question. Enveloppes, wrappers et
 * formats inconnus gardent l'ambiguïté générique ; aucun contenu ne devient une autorisation.
 */
function isTurnFreeInput(payload: JsonObject, turnId: string, nonce: string): boolean {
  const metadata = object(payload.internal_chat_message_metadata_passthrough);
  const kinds = metadata?.content_item_kinds;
  if (metadata?.turn_id !== turnId || !Array.isArray(kinds) || kinds.length !== 1 || kinds[0] !== "user.text") return false;
  if (!Array.isArray(payload.content) || payload.content.length !== 1 || object(payload.content[0])?.type !== "input_text") return false;
  const text = contentText(payload.content)?.trim();
  return Boolean(text && !text.includes(nonce) && !/PR-[a-f0-9]{16}|PALABRE (?:Relay|Mission)|^# AGENTS\.md instructions for |^[<{\[]/.test(text));
}

/** Valeur courte et sans caractère de contrôle, recopiable dans un diagnostic. */
const CONTEXT_TOKEN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;

/**
 * Relève le `turn_context` du tour corrélé. Il doit être unique dans l'ajout et porter le même
 * `turn_id` ; sinon le relevé est inconnu (`undefined`). Le réseau vient du profil de permissions,
 * à défaut de `sandbox_policy.network_access`.
 */
function turnContextOf(fresh: readonly JsonObject[], turnId: string): OpenTurnContext | undefined {
  const contexts = fresh.filter((row) => row.type === "turn_context" && object(row.payload)?.turn_id === turnId);
  if (contexts.length !== 1) return undefined;
  const payload = object(contexts[0]!.payload)!;
  const token = (value: unknown) => (typeof value === "string" && CONTEXT_TOKEN.test(value) ? value : undefined);
  const sandboxPolicy = object(payload.sandbox_policy);
  const profileNetwork = object(payload.permission_profile)?.network;
  const network = profileNetwork === "enabled" || profileNetwork === "restricted"
    ? profileNetwork
    : typeof sandboxPolicy?.network_access === "boolean" ? (sandboxPolicy.network_access ? "enabled" : "restricted") : undefined;
  const context: OpenTurnContext = {
    ...(token(payload.model) ? { model: token(payload.model) } : {}),
    ...(token(payload.approval_policy) ? { approvalPolicy: token(payload.approval_policy) } : {}),
    ...(token(sandboxPolicy?.type) ? { sandbox: token(sandboxPolicy?.type) } : {}),
    ...(network ? { network } : {})
  };
  return Object.keys(context).length > 0 ? context : undefined;
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
 * final_answer dans ce tour, puis task_complete sans `error` avec un texte identique. Un seul
 * contexte de chaque sorte (AGENTS/environnement), porteur de la métadonnée du tour, sans le
 * nonce et placé avant le relay, échappe à la règle des saisies non liées. Une saisie libre de
 * forme user.text reste ambiguë, avec un diagnostic distinct, jamais une autorisation. Une
 * réponse à une question n'est pas exemptée tant que sa liaison réelle n'a pas été observée.
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
  const withContext = (turnId: string) => {
    const context = turnContextOf(fresh, turnId);
    return context ? { context } : {};
  };
  // Le relevé du tour n'accompagne qu'un échec lié au tour : jamais une ambiguïté.
  const observation = (status: OpenObservation["status"], reason: string, turnId?: string): OpenObservation =>
    ({ status, persisted: true, reason, ...(turnId ? { turnId } : {}), ...(status === "failed" && turnId ? withContext(turnId) : {}) });
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
  if (turnUsers.length !== 1) {
    const finalPosition = fresh.findIndex(row => row.type === "event_msg" && object(row.payload)?.turn_id === turnId
      && object(object(row.payload)?.item)?.type === "AgentMessage" && object(object(row.payload)?.item)?.phase === "final_answer");
    const extras = turnUsers.filter(event => event !== anchor);
    const freeOnly = extras.length > 0 && extras.every(event => {
      const text = contentText(object(event.item)?.content);
      const raw = fresh.filter(row => row.type === "response_item" && object(row.payload)?.type === "message"
        && object(row.payload)?.role === "user" && contentText(object(row.payload)?.content) === text);
      return text !== undefined && raw.length === 1 && event.thread_id === request.threadId
        && turnUsers.filter(candidate => contentText(object(candidate.item)?.content) === text).length === 1
        && position(event) > position(anchor)
        && fresh.indexOf(raw[0]!) > userPosition && position(event) >= fresh.indexOf(raw[0]!)
        && (finalPosition < 0 || position(event) < finalPosition)
        && isTurnFreeInput(object(raw[0]!.payload)!, turnId, request.nonce);
    });
    return observation("ambiguous", freeOnly ? "user-input-during-turn" : "multiple-users-in-turn", turnId);
  }
  // Hypothèses défensives testées sur fixtures : ces formats d'échec du rollout restent à
  // observer réellement. Une erreur non attribuable au tour ne prouve pas sa terminaison.
  if (turn.some((event) => ["error", "turn_aborted", "task_cancelled", "task_failed"].includes(String(event.type)))) return observation("failed", "turn-failed-or-cancelled", turnId);
  // Forme observée dans Codex 0.163.0 : seul le code structuré de la terminaison
  // liée classe la limite. Le message d'erreur sert uniquement à extraire sa reprise.
  const completed = turn.filter((event) => event.type === "task_complete");
  const completionError = completed.length === 1 ? object(completed[0]!.error) : undefined;
  if (completionError?.codex_error_info === "usage_limit_exceeded"
    && position(anchor) >= userPosition && position(completed[0]!) >= position(anchor)) {
    const retryAfter = typeof completionError.message === "string"
      ? extractRetryAfter(completionError.message.slice(0, 4096)) : undefined;
    return { ...observation("failed", "usage-limit", turnId),
      ...(retryAfter !== undefined && (typeof retryAfter === "string" || Number.isFinite(retryAfter) && retryAfter >= 0) ? { retryAfter } : {}) };
  }
  // Format observé (Codex 0.151.0, modèle refusé) : task_complete porte `error` et
  // last_agent_message: null. Échec même sans réponse finale, et même si un texte final existe.
  if (turn.some((event) => event.type === "task_complete" && event.error !== undefined && event.error !== null)) return observation("failed", "completion-error", turnId);
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
  // Une exemption par sorte de contexte, y compris pour le message regroupant les deux sortes.
  const exemptedContexts = new Set<"environment" | "agents">();
  for (const row of fresh.slice(position(starts[0]!) + 1, completionPosition)) {
    if (row === users[0]) continue;
    const payload = object(row.payload);
    if (row.type !== "response_item" || payload?.type !== "message" || payload.role !== "user") continue;
    const text = contentText(payload.content);
    const bindings = events.filter((event) => {
      const item = object(event.item);
      return text !== undefined && event.type === "item_completed" && item?.type === "UserMessage" && contentText(item.content) === text;
    });
    const contexts = turnSystemContexts(payload, turnId);
    const contextPartBound = contexts && (payload.content as unknown[]).some(part => events.some(event =>
      event.type === "item_completed" && object(event.item)?.type === "UserMessage"
      && contentText(object(event.item)?.content) === contentText([part])));
    if (bindings.length === 0 && !contextPartBound && fresh.indexOf(row) < userPosition && contexts) {
      // Un contexte qui cite le nonce pourrait porter la demande : il n'est jamais exempté.
      if (text!.includes(request.nonce)) return observation("ambiguous", contexts.includes("agents") ? "nonce-in-agents-context" : "nonce-in-environment-context", turnId);
      for (const kind of contexts) {
        if (exemptedContexts.has(kind)) return observation("ambiguous", kind === "agents" ? "multiple-agents-contexts" : "multiple-environment-contexts", turnId);
        exemptedContexts.add(kind);
      }
      continue;
    }
    const binding = bindings[0];
    if (bindings.length !== 1 || !binding || binding.thread_id !== request.threadId
      || typeof binding.turn_id !== "string" || binding.turn_id === "" || binding.turn_id === turnId
      || position(binding) < fresh.indexOf(row) || position(binding) > completionPosition) {
      const freeInput = bindings.length === 0 && fresh.indexOf(row) > position(anchor) && fresh.indexOf(row) < position(final)
        && isTurnFreeInput(payload, turnId, request.nonce);
      return observation("ambiguous", freeInput ? "user-input-during-turn" : "unbound-concurrent-user", turnId);
    }
  }
  if (completion.status !== undefined && completion.status !== "completed") return observation("failed", "unsuccessful-completion", turnId);
  const reply = contentText(object(final.item)?.content);
  if (reply === undefined || reply.trim() === "" || typeof completion.last_agent_message !== "string" || completion.last_agent_message !== reply) return observation("ambiguous", "completion-text-mismatch", turnId);
  return { status: "replied", persisted: true, reason: "correlated-final", turnId, reply, ...withContext(turnId) };
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
