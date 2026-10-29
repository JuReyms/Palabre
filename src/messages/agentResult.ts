/** @file Textes FR/EN de `palabre result` : lecture sans envoi, états honnêtes, aucune autorité. */
import type { Language } from "../types.js";

/** Textes sans donnée utilisateur, hors alias validé ; assainis au rendu terminal. */
export interface AgentResultText {
  help: string;
  invalid(reason: string): string;
  replied(agent: string): string;
  pending(agent: string): string;
  notSucceeded(reason: string, outcome?: string): string;
  mismatch(reason: string): string;
  unreadable(reason: string): string;
  commandNotFound(agent: string): string;
  cancelled: string;
}

const frInvalid: Record<string, string> = {
  "invalid-arguments": "Arguments invalides. Usage : palabre result --reference <référence> [--timeout 5-600] [--json] [--language fr|en]. Rien n'a été lu ni envoyé.",
  "invalid-reference": "Référence de lecture illisible ou incomplète : rien n'a été lu ni envoyé.",
  "config-unavailable": "Configuration de l'envoi absente ou illisible : aucune lecture effectuée.",
  "config-changed": "La configuration n'est plus celle utilisée pour l'envoi : aucune lecture effectuée. Vérifiez la réponse dans l'outil, sans renvoyer la demande.",
  "config-untrusted": "Configuration non approuvée : aucune lecture effectuée. Seul le propriétaire peut la relire et l'approuver.",
  "unknown-agent": "Agent absent de cette configuration : aucune lecture effectuée.",
  "unsupported-agent": "Cet agent n'utilise plus le profil OpenCode qualifié : aucune lecture automatique possible. Vérifiez la réponse dans l'outil, sans renvoyer la demande.",
  "agent-changed": "La commande de cet agent a changé depuis l'envoi : aucune lecture effectuée.",
  "cwd-unavailable": "Le dossier de la demande n'est plus disponible : aucune lecture effectuée."
};

const enInvalid: Record<string, string> = {
  "invalid-arguments": "Invalid arguments. Usage: palabre result --reference <reference> [--timeout 5-600] [--json] [--language fr|en]. Nothing was read or sent.",
  "invalid-reference": "Unreadable or incomplete reading reference: nothing was read or sent.",
  "config-unavailable": "The configuration used for the send is missing or unreadable: nothing was read.",
  "config-changed": "The configuration is no longer the one used for the send: nothing was read. Check the reply in the tool, without resending the request.",
  "config-untrusted": "Untrusted configuration: nothing was read. Only the owner can review and trust it.",
  "unknown-agent": "Agent missing from this configuration: nothing was read.",
  "unsupported-agent": "This agent no longer uses the qualified OpenCode profile: no automatic reading is possible. Check the reply in the tool, without resending the request.",
  "agent-changed": "This agent's command changed since the send: nothing was read.",
  "cwd-unavailable": "The request's folder is no longer available: nothing was read."
};

const texts: Record<Language, AgentResultText> = {
  fr: {
    help: [
      "Usage : palabre result --reference <référence> [--timeout <secondes>] [--json] [--language fr|en]",
      "",
      "Relit, sans rien envoyer ni lancer de modèle, la réponse d'UNE demande OpenCode dont l'attente a",
      "expiré. La référence vient de l'erreur de délai (details.recovery.reference) ; elle garde la",
      "configuration approuvée exacte, l'agent, le dossier et le modèle de l'envoi. Une configuration",
      "modifiée ou non approuvée est refusée avant tout lancement.",
      "Réponse rendue seulement si cette session contient ce seul message, terminé avec succès ;",
      "jamais le raisonnement ni une autre réponse. Sinon : en cours (2), sans réponse finale réussie (2),",
      "lecture impossible (2), non-correspondance (3), demande invalide (8). Aucun renvoi ; une nouvelle",
      "lecture plus tard reste possible."
    ].join("\n"),
    invalid: (reason) => frInvalid[reason] ?? frInvalid["invalid-arguments"]!,
    replied: (agent) => `Réponse retrouvée pour cette demande à ${agent}. Rien n'a été renvoyé ; le contenu reste à vérifier comme toute réponse d'agent.`,
    pending: (agent) => `${agent} n'a pas encore terminé cette demande d'après l'outil. Rien n'a été renvoyé : une nouvelle lecture plus tard reste possible.`,
    notSucceeded: (reason, outcome) => `L'outil n'indique pas de réponse finale réussie pour cette demande (${reason}${outcome ? ` : ${outcome}` : ""}). Rien n'a été renvoyé et aucune autre réponse n'est utilisée.`,
    mismatch: (reason) => `La conversation lue ne correspond pas exactement à cette demande (${reason}) : aucune réponse n'est rendue, et rien n'a été renvoyé.`,
    unreadable: (reason) => `Lecture impossible pour le moment (${reason}). Rien n'a été renvoyé ; l'état de la demande reste inconnu.`,
    commandNotFound: (agent) => `Commande configurée de ${agent} introuvable : aucune lecture effectuée.`,
    cancelled: "Lecture annulée ; rien n'a été envoyé."
  },
  en: {
    help: [
      "Usage: palabre result --reference <reference> [--timeout <seconds>] [--json] [--language fr|en]",
      "",
      "Reads, without sending anything or starting a model, the reply to ONE OpenCode request whose wait",
      "expired. The reference comes from the timeout error (details.recovery.reference); it keeps the",
      "exact trusted configuration, agent, folder and model of the send. A changed or untrusted",
      "configuration is refused before anything is started.",
      "A reply is returned only if this session holds this single message, completed successfully;",
      "never reasoning or another reply. Otherwise: in progress (2), no successful final reply (2),",
      "unreadable (2), mismatch (3), invalid request (8). No resend; reading again later remains possible."
    ].join("\n"),
    invalid: (reason) => enInvalid[reason] ?? enInvalid["invalid-arguments"]!,
    replied: (agent) => `Reply found for this request to ${agent}. Nothing was resent; check the content like any agent reply.`,
    pending: (agent) => `${agent} has not finished this request yet, according to the tool. Nothing was resent: reading again later remains possible.`,
    notSucceeded: (reason, outcome) => `The tool reports no successful final reply for this request (${reason}${outcome ? `: ${outcome}` : ""}). Nothing was resent and no other reply is used.`,
    mismatch: (reason) => `The conversation read does not exactly match this request (${reason}): no reply is returned, and nothing was resent.`,
    unreadable: (reason) => `Cannot read it right now (${reason}). Nothing was resent; the request state remains unknown.`,
    commandNotFound: (agent) => `Configured command for ${agent} not found: nothing was read.`,
    cancelled: "Reading cancelled; nothing was sent."
  }
};

/** Retourne les textes de la langue résolue, sans effet de bord. */
export function agentResultText(language: Language): AgentResultText {
  return texts[language];
}
