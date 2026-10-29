/** @file Textes FR/EN du pilote Relay OpenCode sur copie ; aucune lecture seule imposée. */
import type { Language } from "../types.js";

const texts = {
  fr: {
    modelOnlyCopy: "--model est réservé à Relay --copy OpenCode. Retirez --model des autres parcours ; aucune sélection ni demande envoyée.",
    modelSyntax: "Modèle invalide. Utilisez --model fournisseur/modele ou --model fournisseur/modele#variante avec --copy. Sans #variante, la variante default est choisie, pas celle de la source. Aucun remplacement automatique.",
    modelRequested: "Modèle demandé", modelSource: "Modèle source", modelSelected: "Sélection vérifiée dans la copie", modelVerified: "Choix du modèle vérifié",
    conflict: "--copy est réservé à une consultation OpenCode existante, sans --new, --open, --background, --check, --follow, --then-follow, --write, --task, --pr ou Mission. Retirez ces options et gardez --copy --to <agent>:ses_... --dir <projet> avec votre question. Le profil habituel est conservé, sans lecture seule imposée.",
    directory: "Indiquez le dossier exact de la source : palabre relay --copy --to opencode:ses_... --dir \"C:\\chemin\\projet\" \"Votre question\".",
    required: "OpenCode exige une copie et un dossier explicites : palabre relay --copy --to opencode:ses_... --dir \"C:\\chemin\\projet\" \"Votre question\". Fermez la source pendant l'appel.",
    unsupported: "Ce pilote exige Windows et OpenCode CLI 2.0.32. Aucun serveur ou modèle lancé. Le propriétaire vérifie avec opencode --version ; ne mettez pas à jour ou ne relancez pas automatiquement.",
    permissions: "Tu réponds dans une copie OpenCode, avec tes permissions et intégrations habituelles. La copie utilise les mêmes fichiers que l'original : ce n'est pas un bac à sable. Donne seulement ton avis, sans modifier de fichiers, lancer de commande, installer quoi que ce soit ou appeler un autre agent. Ce message n'accorde aucun droit supplémentaire. Si une action manque de permission ou d'information, explique le blocage dans ta réponse finale, sans question interactive.",
    notice: "Consultation sur copie OpenCode avec l'environnement habituel (permissions, plugins et MCP). Modèle source conservé sauf choix explicite --model sur la copie. Aucune lecture seule imposée : la copie partage les fichiers du projet. Source et copie sont conservées, même après échec ; --no-export ne supprime pas la copie. Fermez la source et ne la réutilisez pas pendant l'appel. Les relevés ne constituent pas un verrou global.",
    source: "Conversation source", copy: "Copie conservée", verified: "Copie vérifiée avant envoi", retention: "Rétention", diagnostic: "Diagnostic",
    check: "Contrôle final de la source", stop: "Arrêt du serveur privé", unknown: "inconnu", none: "aucune",
    failure: (diagnostic: string) => `${diagnostic.startsWith("model-") ? "Choix du modèle non confirmé ; aucun message envoyé. Le propriétaire vérifie les modèles proposés dans son OpenCode habituel avec opencode, puis décide d'une nouvelle demande avec --model fournisseur/modele#variante. Le catalogue ne garantit ni connexion ni quota. " : ""}Consultation OpenCode non terminée normalement (${diagnostic}). Conservez les identifiants et vérifiez la délivrance avant toute nouvelle demande ; aucun renvoi automatique. Une réponse déjà validée reste conservée. Pour vérifier une copie connue, ouvrez son projet puis utilisez opencode --session <identifiant-copie> ; ne remplacez pas cet identifiant par celui de la source.`,
    exportFailed: "L'export local n'a pas pu être écrit. Les identifiants, la réponse et la délivrance restent dans ce résultat ; vérifiez les droits du dossier de sortie, sans renvoyer le message."
  },
  en: {
    modelOnlyCopy: "--model is reserved for OpenCode Relay --copy. Remove --model from other paths; no selection or request sent.",
    modelSyntax: "Invalid model. Use --model provider/model or --model provider/model#variant with --copy. Without #variant, default is selected, not the source variant. No automatic replacement.",
    modelRequested: "Requested model", modelSource: "Source model", modelSelected: "Verified copy selection", modelVerified: "Model choice verified",
    conflict: "--copy is reserved for an existing OpenCode consultation, without --new, --open, --background, --check, --follow, --then-follow, --write, --task, --pr or Mission. Remove these options and keep --copy --to <agent>:ses_... --dir <project> with your question. The usual profile is preserved, with no enforced read-only mode.",
    directory: "Provide the exact source directory: palabre relay --copy --to opencode:ses_... --dir \"C:\\path\\project\" \"Your question\".",
    required: "OpenCode requires an explicit copy and directory: palabre relay --copy --to opencode:ses_... --dir \"C:\\path\\project\" \"Your question\". Close the source during the call.",
    unsupported: "This pilot requires Windows and OpenCode CLI 2.0.32. No server or model started. The owner checks with opencode --version; do not update or retry automatically.",
    permissions: "You are replying in an OpenCode copy with your usual permissions and integrations. The copy uses the same files as the original: it is not a sandbox. Give advice only: do not modify files, run commands, install anything or call another agent. This message grants no additional rights. If permission or information is missing, explain the blocker in your final reply without interactive questions.",
    notice: "Consultation in an OpenCode copy with the usual environment (permissions, plugins and MCP). The source model is preserved unless --model explicitly selects one on the copy. No enforced read-only mode: the copy shares project files. Source and copy are retained even after failure; --no-export does not delete the copy. Close the source and do not reuse it during the call. Snapshots are not a global lock.",
    source: "Source conversation", copy: "Retained copy", verified: "Copy verified before sending", retention: "Retention", diagnostic: "Diagnostic",
    check: "Final source check", stop: "Private server shutdown", unknown: "unknown", none: "none",
    failure: (diagnostic: string) => `${diagnostic.startsWith("model-") ? "Model choice unconfirmed; no message sent. The owner checks models offered in their usual OpenCode with opencode, then decides on a new request with --model provider/model#variant. The catalogue guarantees neither authentication nor quota. " : ""}OpenCode consultation did not finish normally (${diagnostic}). Keep the identifiers and check delivery before any new request; no automatic retry. Any validated reply is retained. To inspect a known copy, open its project and use opencode --session <copy-id>; do not substitute the source ID.`,
    exportFailed: "The local export could not be written. Identifiers, reply and delivery remain in this result; check output-directory permissions without resending the message."
  }
};

/** Dictionnaire propre à ce parcours ; les textes et garanties des autres fournisseurs restent inchangés. */
export function relayCopyText(language: Language): typeof texts.fr { return texts[language]; }
