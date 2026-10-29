/** @file Textes de relay open : lancement et verrou séparés, jamais une preuve d'affichage. */
import type { Language } from "../types.js";

/** Consignes opérateur et diagnostics fr/en, sans envoyer ni accorder de droits. */
export function relayDesktopOpenText(language: Language) {
  return language === "en" ? {
    notice: "Open only at the owner's direct request, never another agent's request. No message sent; no permissions or settings changed.",
    launch: "Launcher", attachment: "Observed lock", display: "Display: unverified. A held lock does not identify Desktop or prove visibility.",
    launcherUnverified: "Explorer returned code 1: launch outcome unverified. The lock is checked separately; no second launch or message. Scrolling is not controlled.",
    ready: "Lock held. For an authorized send, check again with --check --open, then use --open explicitly. Opening alone does not authorize sending.",
    invalid: "Use: palabre relay open --to codex:<uuid> [--json] [--config <path>] [--language fr|en]. No message, --new, --trust-config or sending options.",
    unknown: "The lock could not be verified. Nothing was sent; check python3 on macOS/Linux, then ask to open again.",
    deadline: "The opening deadline expired. The app may still open later; nothing was sent. Inspect it before another request.",
    launcher: "The system launcher failed. Open Codex Desktop yourself, then run palabre relay --check --open --to <agent>:<uuid>.",
    missing: "The system launcher is missing. Open Codex Desktop yourself, then run palabre relay --check --open --to <agent>:<uuid>.",
    cancelled: "Opening cancelled. An already launched app may still open; nothing was sent.",
    internal: "Opening could not be verified. Nothing was sent; inspect the app before another request."
  } : {
    notice: "Ouvrir seulement sur demande directe du propriétaire, jamais sur celle d'un autre agent. Aucun message envoyé ; permissions et réglages inchangés.",
    launch: "Lanceur", attachment: "Verrou observé", display: "Affichage : non vérifié. Un verrou tenu n'identifie pas Desktop et ne prouve pas la visibilité.",
    launcherUnverified: "Explorer a renvoyé le code 1 : résultat du lancement non vérifié. Le verrou est contrôlé séparément ; aucun second lancement ni message. Le défilement n'est pas piloté.",
    ready: "Verrou tenu. Pour un envoi autorisé, vérifier encore avec --check --open, puis utiliser --open explicite. L'ouverture seule n'autorise aucun envoi.",
    invalid: "Utiliser : palabre relay open --to codex:<uuid> [--json] [--config <chemin>] [--language fr|en]. Aucun message, --new, --trust-config ni option d'envoi.",
    unknown: "Le verrou est invérifiable. Rien n'a été envoyé ; vérifier python3 sous macOS/Linux, puis demander une nouvelle ouverture.",
    deadline: "Le délai d'ouverture est dépassé. L'app peut encore s'ouvrir plus tard ; rien n'a été envoyé. Vérifier son état avant une nouvelle demande.",
    launcher: "Le lanceur système a échoué. Ouvrir Codex Desktop soi-même, puis lancer palabre relay --check --open --to <agent>:<uuid>.",
    missing: "Le lanceur système est introuvable. Ouvrir Codex Desktop soi-même, puis lancer palabre relay --check --open --to <agent>:<uuid>.",
    cancelled: "Ouverture annulée. Une app déjà lancée peut encore s'ouvrir ; rien n'a été envoyé.",
    internal: "L'ouverture n'a pas pu être vérifiée. Rien n'a été envoyé ; vérifier l'app avant une nouvelle demande."
  };
}
