/**
 * @file Validation des références de session et du message, nonce et enveloppe du relay (voir
 * AGENTS.md, section "Relay externe").
 *
 * L'enveloppe identifie l'expéditeur et porte un nonce à usage unique. Le nonce sert ensuite de
 * preuve de délivrance dans l'historique de la cible : il n'est jamais réutilisé.
 */
import { randomBytes } from "node:crypto";
import type { RelayMessages } from "../messages/relay.js";
import type { InvalidRequestReason, SessionRef } from "./types.js";

/** Taille maximale de l'enveloppe de coordination, en octets UTF-8 (hors contexte PR). */
export const MAX_RELAY_MESSAGE_BYTES = 64 * 1024;
/** Objet explicite : une ligne, 200 points de code au plus. */
export const MAX_RELAY_SUBJECT_CHARACTERS = 200;

/** En-tête transmis par Mission via l'API interne, jamais par une option CLI. */
export interface MissionEnvelopeHeader { kind: "mission"; id: string; step: number }

/** Entrées déjà validées par la commande Relay ou le contrôleur Mission. */
export interface RelayEnvelopeInput {
  from: SessionRef;
  to: SessionRef;
  nonce: string;
  message: string;
  subject?: string;
  header?: MissionEnvelopeHeader;
}

/** Refuse les objets multilignes, vides, trop longs et les contrôles de rendu. */
export function validateRelaySubject(subject: string): ValidationResult<string> {
  if (!subject.trim() || [...subject].length > MAX_RELAY_SUBJECT_CHARACTERS || /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(subject)) {
    return { ok: false, reason: "invalid-arguments" };
  }
  return { ok: true, value: subject };
}

/** Validation de la métadonnée interne avant toute lecture ou exécution Relay. */
export function validMissionHeader(header: MissionEnvelopeHeader): boolean {
  return header?.kind === "mission" && typeof header.id === "string" && isSessionId(header.id)
    && Number.isSafeInteger(header.step) && header.step >= 1 && header.step <= 100;
}

/** Forme 8-4-4-4-12 hexadécimale, seule forme d'identifiant observée chez Codex et Claude Code. */
const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Nom d'agent ou étiquette d'expéditeur. Le jeu de caractères est restreint, car l'étiquette est
 * recopiée dans l'enveloppe transmise à la cible.
 */
const AGENT_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

/**
 * Vrai si `value` est un identifiant de session valide. Les adapters le vérifient de nouveau
 * avant de construire un chemin, pour qu'un identifiant non validé ne désigne jamais un autre fichier.
 */
export function isSessionId(value: string): boolean {
  return SESSION_ID.test(value);
}

/** Résultat de validation : la valeur normalisée, ou la raison d'un `invalid-request`. */
export type ValidationResult<T> = { ok: true; value: T } | { ok: false; reason: InvalidRequestReason };

/**
 * Valide une référence `<agent>:<session>`. L'agent précède le premier `:` ; la session doit être
 * un UUID, normalisé en minuscules. Aucune sélection implicite n'existe.
 */
export function parseSessionRef(value: string): ValidationResult<SessionRef> {
  const separator = value.indexOf(":");
  if (separator <= 0) return { ok: false, reason: "invalid-arguments" };
  const agent = value.slice(0, separator);
  const sessionId = value.slice(separator + 1);
  if (!AGENT_NAME.test(agent)) return { ok: false, reason: "invalid-arguments" };
  if (!SESSION_ID.test(sessionId)) return { ok: false, reason: "invalid-session-id" };
  return { ok: true, value: { agent, sessionId: sessionId.toLowerCase() } };
}

/** Valide le message : non vide après suppression des espaces, et au plus `MAX_RELAY_MESSAGE_BYTES`. */
export function validateRelayMessage(message: string): ValidationResult<string> {
  if (message.trim() === "") return { ok: false, reason: "invalid-arguments" };
  if (Buffer.byteLength(message, "utf8") > MAX_RELAY_MESSAGE_BYTES) return { ok: false, reason: "message-too-large" };
  return { ok: true, value: message };
}

/**
 * Nonce à usage unique (64 bits aléatoires). Alphabet restreint pour rester identique une fois
 * sérialisé en JSON dans l'historique du fournisseur.
 */
export function createNonce(): string {
  return `PR-${randomBytes(8).toString("hex")}`;
}

/** Texte inline Markdown : ni l'objet ni les noms d'agents ne peuvent fermer leur mise en forme. */
function inline(text: string): string { return text.replace(/[\\`*_{}\[\]()<>#+.!|~-]/g, "\\$&"); }

/** En-tête compact avant le corps inchangé ; provenance technique et nonce en fin. */
function buildRelayEnvelope(input: RelayEnvelopeInput, messages: RelayMessages, open: boolean): string {
  const from = inline(input.from.agent), to = inline(input.to.agent);
  const title = input.header
    ? messages.missionHeader(input.header.id, input.header.step, from, to)
    : messages.envelopeHeader(from, to);
  return [title, ...(input.subject !== undefined ? [messages.subjectLine(inline(input.subject))] : []), "",
    input.message, "", "---", messages.envelopeProvenance(input.from.sessionId, input.nonce),
    open ? messages.openEnvelope.notice : messages.envelopeNotice,
    open ? messages.openEnvelope.replyHint : messages.envelopeReplyHint].join("\n");
}

/** Variante de reprise en lecture seule ; le nonce reste présent dans le message utilisateur. */
export function buildEnvelope(input: RelayEnvelopeInput, messages: RelayMessages): string {
  return buildRelayEnvelope(input, messages, false);
}

/**
 * Enveloppe de `--open` (B1) : la cible garde ses outils et permissions. Le texte annonce un
 * expéditeur déclaré non authentifié et une demande d'un autre agent, jamais une autorisation
 * humaine. Le nonce figure en pied de message : le lecteur exige toujours l'enveloppe exacte.
 */
export function buildOpenEnvelope(input: RelayEnvelopeInput, messages: RelayMessages): string {
  return buildRelayEnvelope(input, messages, true);
}
