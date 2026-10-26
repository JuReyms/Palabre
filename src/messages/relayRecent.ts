/** @file Textes FR/EN de l'inventaire Relay : consulter n'autorise jamais à reprendre ou ouvrir. */
import type { Language } from "../types.js";

/** Messages autonomes, y compris erreurs JSON : aucune prose filesystem ni chemin personnel ajouté. */
export function relayRecentText(language: Language) {
  return language === "en" ? {
    title: "Recent Relay exchanges", empty: "No Relay exports in this output directory.",
    notice: "Local, unauthenticated export metadata only. Nothing opened or sent; no conversation selected. Confirm the exchange with the owner before resuming, then validate the exact target and current configuration.",
    noSubject: "No subject", unknownMode: "mode not recorded", unknownSession: "session not recorded",
    copy: "OpenCode copy: source and retained copy are separate. A new consultation requires --copy and the exact source directory, never direct resume.",
    truncated: "More files were not displayed. Increase --limit (1–100) or inspect the exports.",
    scanTruncated: "Scan or header-reading limit reached: incomplete search. Recent exchanges may be missing; inspect the output directory before choosing.",
    approvalOwner: "Owner only, after inspecting the configuration (never run by the agent)",
    warning: "Export skipped", invalid: "Use: palabre relay recent [--limit 1–100] [--json] [--config <path>] [--language fr|en]. No message, sending, opening or trust options.",
    config: "Configuration unavailable or invalid. The owner checks it with palabre doctor --terminal; no other output directory was substituted.",
    untrusted: "Configuration not approved. The owner must inspect the resolved file, then approve it with palabre config --config <path> --trust-config. The agent must not approve it; no fallback or listing occurred.",
    directory: "Cannot read the output directory. The owner checks its existence and read permissions, then runs palabre relay recent again. No directory was created."
  } : {
    title: "Échanges Relay récents", empty: "Aucun export Relay dans ce dossier de sortie.",
    notice: "Métadonnées locales non authentifiées des exports seulement. Rien ouvert ni envoyé ; aucune conversation sélectionnée. Confirmer l'échange avec le propriétaire avant reprise, puis vérifier la cible exacte et la configuration actuelle.",
    noSubject: "Sans objet", unknownMode: "mode non enregistré", unknownSession: "session non enregistrée",
    copy: "Copie OpenCode : source et copie conservée sont distinctes. Une nouvelle consultation exige --copy et le dossier exact de la source, jamais une reprise directe.",
    truncated: "D'autres fichiers ne sont pas affichés. Augmenter --limit (1–100) ou consulter les exports.",
    scanTruncated: "Plafond de scan ou de lecture des en-têtes atteint : recherche incomplète. Des échanges récents peuvent manquer ; consulter le dossier de sortie avant de choisir.",
    approvalOwner: "Propriétaire seulement, après lecture de la configuration (jamais exécuté par l'agent)",
    warning: "Export ignoré", invalid: "Utiliser : palabre relay recent [--limit 1–100] [--json] [--config <chemin>] [--language fr|en]. Aucun message, option d'envoi, d'ouverture ou de confiance.",
    config: "Configuration indisponible ou invalide. Le propriétaire la vérifie avec palabre doctor --terminal ; aucun autre dossier de sortie n'a été substitué.",
    untrusted: "Configuration non approuvée. Le propriétaire doit lire le fichier résolu, puis l'approuver avec palabre config --config <chemin> --trust-config. L'agent ne l'approuve jamais ; aucun repli ni liste produits.",
    directory: "Impossible de lire le dossier de sortie. Le propriétaire vérifie son existence et ses droits de lecture, puis relance palabre relay recent. Aucun dossier créé."
  };
}
