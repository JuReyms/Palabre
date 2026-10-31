/** @file Publication explicite d'un bilan Relay : aperçu exact, confirmation opérateur et issue prudente. */
import type { Language } from "../types.js";

const texts = {
  fr: {
    title: "Bilan Relay", attribution: "Participant et agent déclarés ; publication via Palabre.", commit: "Commit concerné",
    account: "Compte GitHub qui publiera", destination: "Destination", public: "Dépôt public : ce commentaire sera public.", private: "Dépôt privé : ce commentaire sera visible aux personnes ayant accès au dépôt.",
    preview: "Commentaire exact à publier", endPreview: "Fin du commentaire", confirm: "Publier ce commentaire ici ? [o/N] ",
    invalid: "Requête invalide. Utilisez palabre relay publish --help. Aucun commentaire envoyé.",
    body: "Bilan invalide ou illisible : fichier texte UTF-8 non vide, 60 Kio au plus, sans contrôles ni caractères invisibles. Préparez un bilan séparé des exports/transcripts Palabre. Aucun commentaire envoyé.",
    unavailable: "GitHub ou la cible est inaccessible ou non vérifiable. Vérifiez la connexion de gh et le lien exact. Aucun commentaire envoyé.",
    confirmation: "La publication exige une confirmation au clavier après aperçu dans un terminal visible (entrée et stderr TTY). Présentez cette commande à l'humain ; ne confirmez jamais à sa place. --dry-run affiche seulement l'aperçu.",
    declined: "Publication refusée. Aucun commentaire envoyé.",
    changed: "Le bilan, le compte GitHub ou la cible a changé depuis l'aperçu. Rien envoyé ; relisez le nouvel aperçu avant une nouvelle demande.",
    receipt: "La trace locale ne peut pas être réservée. Aucun commentaire envoyé.",
    uncertain: "Publication non confirmée ou tentative déjà réservée. Vérifiez GitHub et la trace locale avant toute suite ; ne renvoyez pas et n'effacez pas la réservation pour rejouer.",
    cancelled: "Publication annulée avant envoi.",
    published: "Commentaire publié", already: "Publication déjà confirmée dans la trace locale ; aucun nouvel envoi.",
    traceFailed: "Le commentaire est publié, mais la mise à jour de sa trace locale a échoué. Conservez son lien et ne renvoyez pas.",
    journal: "Trace locale", help: `Usage : palabre relay publish --to <url-issue-ou-PR> --from <agent> --message-file <bilan.md>
  [--participant <nom>] [--commit <sha40>] [--dry-run] [--json] [--language fr|en]

Publie un seul commentaire de conversation sur une issue ou PR github.com existante.
--dry-run lit GitHub et affiche le corps exact sans écrire de trace ni publier.
Sans --dry-run : aperçu, compte et visibilité, puis confirmation humaine au clavier.
À l'invite : Ctrl+C annule ; Ctrl+D ou fin d'entrée refuse, sans envoi ni réservation.
--from est un nom d'agent déclaré sans identifiant de conversation ; --participant le nomme pour ce travail.
--commit est facultatif, réservé à une PR dont la tête doit correspondre au SHA indiqué.
Le bilan est un fichier choisi séparé : pas d'export ou de transcript complet.
Les retours CRLF sont normalisés en LF avant aperçu et envoi ; le reste du corps est conservé.
JSON v1 distinct : relay-publication-result. Aucun agent lancé ni configuration approuvée/modifiée.
Un seul POST ; une tentative incertaine n'est jamais renvoyée. La réservation reste locale.
Après réservation, un refus HTTP ou une annulation peut bloquer une nouvelle demande identique ; garder la trace.
Ne jamais utiliser cette commande pour contourner une revue refusée ou une limitation d'accès.
Pas de --yes, --trust-config, --config, création de ticket, revue inline ou changement d'état.`
  },
  en: {
    title: "Relay report", attribution: "Declared participant and agent; published through Palabre.", commit: "Relevant commit",
    account: "GitHub account that will publish", destination: "Destination", public: "Public repository: this comment will be public.", private: "Private repository: this comment will be visible to people with repository access.",
    preview: "Exact comment to publish", endPreview: "End of comment", confirm: "Publish this comment here? [y/N] ",
    invalid: "Invalid request. Use palabre relay publish --help. No comment sent.",
    body: "Invalid or unreadable report: a nonblank UTF-8 text file, at most 60 KiB, without controls or invisible characters. Prepare a report separate from Palabre exports/transcripts. No comment sent.",
    unavailable: "GitHub or the target is unavailable or unverified. Check gh authentication and the exact link. No comment sent.",
    confirmation: "Publishing requires keyboard confirmation after preview in a visible terminal (stdin and stderr TTY). Present this command to the human; never confirm on their behalf. --dry-run only shows the preview.",
    declined: "Publication declined. No comment sent.",
    changed: "The report, GitHub account or target changed after preview. Nothing sent; read the new preview before making a new request.",
    receipt: "The local receipt cannot be reserved. No comment sent.",
    uncertain: "Publication is unconfirmed or this request is already reserved. Check GitHub and the local receipt before continuing; do not resend or delete the reservation to replay it.",
    cancelled: "Publication cancelled before sending.",
    published: "Comment published", already: "Publication already confirmed in the local receipt; no new send.",
    traceFailed: "The comment was published, but its local receipt could not be updated. Keep its link and do not resend.",
    journal: "Local receipt", help: `Usage: palabre relay publish --to <issue-or-PR-url> --from <agent> --message-file <report.md>
  [--participant <name>] [--commit <sha40>] [--dry-run] [--json] [--language fr|en]

Publishes one conversation comment on an existing github.com issue or PR.
--dry-run reads GitHub and shows the exact body without writing a receipt or publishing.
Without --dry-run: preview, account and visibility, then human keyboard confirmation.
At the prompt: Ctrl+C cancels; Ctrl+D or end of input declines, without sending or reserving.
--from is a declared agent name without a conversation identifier; --participant names it for this work.
--commit is optional and requires a PR whose head matches the supplied SHA.
Choose a separate report file, never a complete export or transcript.
CRLF is normalized to LF before preview and sending; the rest of the body is preserved.
Separate JSON v1: relay-publication-result. No agent launch or configuration approval/change.
One POST only; uncertain attempts are never resent. The reservation stays local.
After reservation, an HTTP refusal or cancellation may block the same request; keep the receipt.
Never use this command to bypass a refused review or an access limitation.
No --yes, --trust-config, --config, ticket creation, inline review or state change.`
  }
};

/** Textes fixes ; les données de bilan restent des données non fiables. */
export function relayPublishText(language: Language): typeof texts.fr { return texts[language]; }
