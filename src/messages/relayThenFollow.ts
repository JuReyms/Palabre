/** @file Textes fr/en du suivi après réponse ; aucun droit ni auteur humain inféré. */
import type { Language } from "../types.js";

/** Messages communs à la commande et à l'export, sans texte utilisateur non assaini. */
export function relayThenFollowText(language: Language) {
  return language === "fr" ? {
    conflict: "--then-follow <secondes> exige un envoi vers une Codex existante en mode ouvert (--open ou auto). Incompatible avec arrière-plan, --new, Mission, --task, --write, --check et --follow.",
    invalid: "--then-follow exige un nombre entier de secondes entre 10 et 3600. Exemple : --then-follow 3600.",
    waiting: "Réponse liée reçue ; écoute du premier tour terminé ensuite. Rien ne sera renvoyé.",
    label: "Suite du travail dans l'app (auteur non vérifié ; aucune autorisation déduite)",
    statusLine: (label: string, status: string, reason?: string) => `${label} : ${status}${reason ? ` (${reason})` : ""}`,
    followed: "Le tour suivant est terminé ; sa réponse est affichée séparément.",
    awaiting: "Aucun tour terminé dans le délai de suivi. La réponse liée est conservée ; vérifiez la conversation avant toute nouvelle demande.",
    notStarted: "Suivi non démarré : la réponse liée n'a pas réussi."
  } : {
    conflict: "--then-follow <seconds> requires a message to an existing Codex conversation in open mode (--open or auto). Incompatible with background, --new, Mission, --task, --write, --check and --follow.",
    invalid: "--then-follow requires an integer from 10 to 3600 seconds. Example: --then-follow 3600.",
    waiting: "Correlated reply received; listening for the first turn completed next. Nothing will be resent.",
    label: "Continuation in the app (unverified author; no authorization inferred)",
    statusLine: (label: string, status: string, reason?: string) => `${label}: ${status}${reason ? ` (${reason})` : ""}`,
    followed: "The next turn has completed; its reply is shown separately.",
    awaiting: "No turn completed within the follow budget. The correlated reply is preserved; check the conversation before making another request.",
    notStarted: "Follow not started: the correlated reply did not succeed."
  };
}
