/** @file Textes FR/EN de la préférence Relay et de sa confirmation opérateur. */
import type { Language } from "../types.js";

const texts = {
  fr: {
    missionBackground: "Mission reste en arrière-plan. Retirez --open ; ce parcours exige une conversation fermée.",
    busyExplicit: "--background impose l'arrière-plan pour cet appel. Fermez cette conversation dans Codex, ou relancez sans --background pour appliquer la préférence du propriétaire.",
    conflict: "--open et --background sont incompatibles. Choisissez une seule option pour cet appel, ou omettez-les pour laisser PALABRE appliquer la préférence du propriétaire.",
    usage: "Commande : palabre config --relay-view <auto|background> [--config <fichier>] [--language fr|en]. Aucun --yes ni --trust-config ; utilisez cette commande seule.",
    terminal: "Le propriétaire doit lancer palabre config --relay-view <auto|background> dans son terminal visible (entrée et sortie TTY), puis confirmer au clavier. Un agent ne confirme jamais à sa place.",
    unreadable: (file: string) => `Configuration absente, illisible ou invalide : ${file}. Le propriétaire doit vérifier ce fichier avant de relancer la commande.`,
    plan: (file: string, before: string, after: string) => `Fichier : ${file}\nPréférence Relay : ${before} -> ${after}.\nauto suit le verrou de Codex et peut utiliser les permissions de la conversation ouverte ; background impose l'arrière-plan. Les autres réglages sont conservés.`,
    notice: "L'accord approuve le contenu entier du fichier affiché. Cette préférence change les permissions possibles des tours Relay ; seul le propriétaire la choisit.",
    confirm: "Appliquer ce changement ? [o/N] ",
    declined: "Changement refusé : aucune configuration ni approbation modifiée.",
    changed: (file: string) => `Configuration ou approbation modifiée pendant la confirmation : ${file}. Rien n'a été remplacé ; le propriétaire doit vérifier puis relancer.`,
    done: (file: string, view: string) => `Préférence Relay enregistrée dans ${file} : ${view}.`,
    failed: (file: string) => `Écriture ou approbation incomplète : ${file}. Le propriétaire doit vérifier le fichier et son approbation avant de relancer.`,
    busy: (command: string) => `L'arrière-plan exige une conversation fermée. Le propriétaire doit fermer cette conversation dans Codex avant de renvoyer, ou choisir lui-même la préférence avec : ${command}`,
    source: (source: string) => `Choix du mode : ${source === "explicit" ? "option explicite pour cet appel" : source === "setting" ? "préférence arrière-plan" : "résolution automatique (état de la conversation ou parcours imposé)"}.`
  },
  en: {
    missionBackground: "Mission stays in background. Remove --open; this path requires a closed conversation.",
    busyExplicit: "--background forces background for this call. Close this conversation in Codex, or retry without --background to apply the owner's preference.",
    conflict: "--open and --background are incompatible. Choose one option for this call, or omit both to let PALABRE apply the owner's preference.",
    usage: "Command: palabre config --relay-view <auto|background> [--config <file>] [--language fr|en]. No --yes or --trust-config; use this command on its own.",
    terminal: "The owner must run palabre config --relay-view <auto|background> in their visible terminal (TTY input and output), then confirm using the keyboard. An agent must never confirm for them.",
    unreadable: (file: string) => `Missing, unreadable or invalid configuration: ${file}. The owner must check this file before running the command again.`,
    plan: (file: string, before: string, after: string) => `File: ${file}\nRelay preference: ${before} -> ${after}.\nauto follows the Codex lock and may use the open conversation's permissions; background requires background operation. Other settings are preserved.`,
    notice: "Confirmation approves the entire displayed configuration file. This preference changes the permissions Relay turns may use; only the owner chooses it.",
    confirm: "Apply this change? [y/N] ",
    declined: "Change declined: no configuration or approval changed.",
    changed: (file: string) => `Configuration or approval changed during confirmation: ${file}. Nothing was replaced; the owner must check it before trying again.`,
    done: (file: string, view: string) => `Relay preference saved in ${file}: ${view}.`,
    failed: (file: string) => `Incomplete write or approval: ${file}. The owner must check the file and its approval before trying again.`,
    busy: (command: string) => `Background operation requires a closed conversation. The owner must close it in Codex before sending again, or choose the preference themselves with: ${command}`,
    source: (source: string) => `Mode source: ${source === "explicit" ? "explicit option for this call" : source === "setting" ? "background preference" : "automatic resolution (conversation state or required path)"}.`
  }
};

/** Retourne les textes sans effet de bord, dans la langue résolue de la commande. */
export function relayViewText(language: Language) { return texts[language]; }
