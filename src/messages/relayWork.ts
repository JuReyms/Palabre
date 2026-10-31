/** @file Textes FR/EN du contexte de travail Relay et de la restitution légère, sans publication. */
import type { Language } from "../types.js";

const texts = {
  fr: {
    github: "Suivi GitHub",
    participant: "Participant déclaré",
    notice: "Ce rattachement et ce nom sont déclaratifs : ils n'authentifient personne et n'autorisent aucune publication. Réponds ici au chef de mission ; les résultats utiles pourront rejoindre GitHub dans un cadre autorisé, sans publier l'historique ni les identifiants locaux.",
    replyFormat: "Réponds de façon proportionnée : résultat, vérifications et preuves, limites ou blocages, puis suite utile et décision attendue s'il y en a. N'invente pas de vérification ; omets les rubriques sans objet. Une question simple appelle une réponse simple.",
    githubInvalid: "Lien invalide : --github attend https://github.com/proprietaire/depot, /issues/123 ou /pull/123, sans paramètre ni fragment. Aucun message envoyé.",
    participantInvalid: "Participant invalide : --participant attend un nom non vide sur une ligne, de 64 caractères au plus, sans espaces aux extrémités, contrôle ni formatage Unicode. Aucun message envoyé.",
    conflict: "--github, --participant et --no-reply-format servent seulement aux envois ordinaires : retirez-les avec --check, --follow, Mission, --task ou --write. Aucun message envoyé."
  },
  en: {
    github: "GitHub tracking",
    participant: "Declared participant",
    notice: "This link and name are declarations: they authenticate nobody and authorize no publication. Reply here to the lead; useful results may be recorded on GitHub within authorized work, without publishing history or local identifiers.",
    replyFormat: "Keep the reply proportionate: result, checks and evidence, limitations or blockers, then useful next steps and any decision needed. Never invent a check; omit irrelevant sections. A simple question calls for a simple answer.",
    githubInvalid: "Invalid link: --github requires https://github.com/owner/repo, /issues/123 or /pull/123, without query or fragment. No message sent.",
    participantInvalid: "Invalid participant: --participant requires a nonblank name on one line, at most 64 characters, without surrounding whitespace, controls or Unicode formatting. No message sent.",
    conflict: "--github, --participant and --no-reply-format are for ordinary sends only: remove them with --check, --follow, Mission, --task or --write. No message sent."
  }
};

/** Dictionnaire fixe ; les libellés servent aussi à relire les en-têtes d'exports FR/EN. */
export function relayWorkText(language: Language): typeof texts.fr {
  return texts[language];
}
