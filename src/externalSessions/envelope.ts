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

/** Taille maximale du message relayé, en octets UTF-8. */
export const MAX_RELAY_MESSAGE_BYTES = 64 * 1024;

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

/**
 * Construit le texte transmis à la cible : en-tête avec le nonce, expéditeur, consigne de réponse,
 * puis le message inchangé.
 */
export function buildEnvelope(input: { from: SessionRef; nonce: string; message: string }, messages: RelayMessages): string {
  return [
    messages.envelopeHeader(input.nonce),
    messages.envelopeFrom(input.from.agent, input.from.sessionId),
    messages.envelopeReplyHint,
    "",
    input.message
  ].join("\n");
}

/**
 * Enveloppe de `--open` (B1) : la cible garde ses outils et permissions. Le texte annonce un
 * expéditeur déclaré non authentifié et une demande d'un autre agent, jamais une autorisation
 * humaine. Le nonce figure dans l'en-tête : le lecteur exige l'enveloppe exacte. Vers Claude
 * (B2.2), la consigne de réponse demande de répondre dans la conversation, sans `SendMessage`.
 */
export function buildOpenEnvelope(
  input: { from: SessionRef; nonce: string; message: string },
  messages: RelayMessages,
  provider: "codex" | "claude" = "codex"
): string {
  const open = messages.openEnvelope;
  return [
    open.header(input.nonce),
    open.from(input.from.agent, input.from.sessionId),
    open.notice,
    // Une cible Claude pourrait répondre par SendMessage au messager, déjà terminé : la réponse
    // est demandée dans la conversation, où le lecteur la corrèle.
    provider === "claude" ? open.claudeReplyHint : open.replyHint,
    "",
    input.message
  ].join("\n");
}
