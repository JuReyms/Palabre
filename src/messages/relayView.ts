/** @file Textes FR/EN de la préférence Relay et de sa confirmation opérateur. */
import type { Language } from "../types.js";

/** Libellés humains ; les identifiants de configuration restent compatibles. */
const frenchView = (view: string) => view === "auto" ? "Privilégier la conversation ouverte" : "Arrière-plan";
const englishView = (view: string) => view === "auto" ? "Prefer the open conversation" : "Background";

const texts = {
  fr: {
    missionBackground: "Mission reste en arrière-plan. Retirez --open ; ce parcours exige une conversation fermée.",
    busyExplicit: [
      "Rien n'a été envoyé.",
      "--background impose l'arrière-plan et ses outils limités ; cette conversation Codex est ouverte.",
      "Pour garder ces limites, le propriétaire peut fermer cette conversation puis demander un nouvel envoi.",
      "Pour cet échange, il peut choisir --open avec les outils et permissions de la conversation, y compris l'écriture si elle est autorisée.",
      "Après ce refus, seul le propriétaire décide ce nouvel appel ; aucun repli automatique."
    ].join("\n"),
    conflict: "--open et --background sont incompatibles. Choisissez une seule option pour cet appel, ou omettez-les pour laisser PALABRE appliquer la préférence du propriétaire.",
    usage: "Commande : palabre config --relay-view <auto|background> [--config <fichier>] [--language fr|en]. Aucun --yes ni --trust-config ; utilisez cette commande seule.",
    terminal: "Le propriétaire doit lancer palabre config --relay-view <auto|background> dans son terminal visible (entrée et sortie TTY), puis confirmer au clavier. Un agent ne confirme jamais à sa place.",
    unreadable: (file: string) => `Configuration absente, illisible ou invalide : ${file}. Le propriétaire doit vérifier ce fichier avant de relancer la commande.`,
    plan: (file: string, before: string, after: string, beforeSaved: boolean) => `Fichier : ${file}\nPréférence Relay : ${frenchView(before)} (${beforeSaved ? "enregistré" : "défaut"}) -> ${frenchView(after)} (enregistré).\nArrière-plan est le défaut : outils limités, conversation fermée requise. Privilégier la conversation ouverte utilise les outils et permissions de la conversation Codex, y compris l'écriture si elle est autorisée ; si elle est fermée, l'envoi part en arrière-plan. Une conversation quittée mais encore chargée dans Codex compte comme ouverte, sans garantie d'affichage. Un état invérifiable refuse l'envoi. Les autres réglages sont conservés.`,
    notice: "L'accord approuve le contenu entier du fichier affiché. Cette préférence change les permissions possibles des tours Relay ; seul le propriétaire la choisit.",
    confirm: "Appliquer ce changement ? [o/N] ",
    declined: "Changement refusé : aucune configuration ni approbation modifiée.",
    changed: (file: string) => `Configuration ou approbation modifiée pendant la confirmation : ${file}. Rien n'a été remplacé ; le propriétaire doit vérifier puis relancer.`,
    done: (file: string, view: string) => `Préférence Relay enregistrée dans ${file} : ${frenchView(view)}.`,
    failed: (file: string) => `Écriture ou approbation incomplète : ${file}. Le propriétaire doit vérifier le fichier et son approbation avant de relancer.`,
    busy: (command: string) => [
      "Rien n'a été envoyé.",
      "Cette conversation Codex est ouverte. L'arrière-plan, utilisé par défaut, exige une conversation fermée et limite les outils de l'équipier.",
      "Pour cet échange, le propriétaire peut choisir --open avec les outils et permissions de la conversation, y compris l'écriture si elle est autorisée.",
      "Pour garder les outils limités, il peut fermer cette conversation puis demander un nouvel envoi.",
      `Pour les prochains échanges, choix facultatif « Privilégier la conversation ouverte » (arrière-plan si fermée), à lancer et confirmer par le propriétaire : ${command}`,
      "Aucun basculement automatique après ce refus."
    ].join("\n"),
    source: (source: string) => `Choix du mode : ${source === "explicit" ? "option explicite pour cet appel" : source === "default" ? "arrière-plan par défaut" : source === "setting" ? "préférence arrière-plan enregistrée" : "état de la conversation ou parcours imposé"}.`
  },
  en: {
    missionBackground: "Mission stays in background. Remove --open; this path requires a closed conversation.",
    busyExplicit: [
      "Nothing was sent.",
      "--background requires background operation with limited tools; this Codex conversation is open.",
      "To keep these limits, the owner can close this conversation and request a new send.",
      "For this exchange, they can choose --open with the conversation's tools and permissions, including writing if allowed.",
      "After this refusal, only the owner decides on a new call; there is no automatic fallback."
    ].join("\n"),
    conflict: "--open and --background are incompatible. Choose one option for this call, or omit both to let PALABRE apply the owner's preference.",
    usage: "Command: palabre config --relay-view <auto|background> [--config <file>] [--language fr|en]. No --yes or --trust-config; use this command on its own.",
    terminal: "The owner must run palabre config --relay-view <auto|background> in their visible terminal (TTY input and output), then confirm using the keyboard. An agent must never confirm for them.",
    unreadable: (file: string) => `Missing, unreadable or invalid configuration: ${file}. The owner must check this file before running the command again.`,
    plan: (file: string, before: string, after: string, beforeSaved: boolean) => `File: ${file}\nRelay preference: ${englishView(before)} (${beforeSaved ? "saved" : "default"}) -> ${englishView(after)} (saved).\nBackground is the default: limited tools, closed conversation required. Prefer the open conversation uses the Codex conversation's tools and permissions, including writing if allowed; when closed, it sends in background. A conversation you left that is still loaded in Codex counts as open, with no display guarantee. An unverifiable state refuses sending. Other settings are preserved.`,
    notice: "Confirmation approves the entire displayed configuration file. This preference changes the permissions Relay turns may use; only the owner chooses it.",
    confirm: "Apply this change? [y/N] ",
    declined: "Change declined: no configuration or approval changed.",
    changed: (file: string) => `Configuration or approval changed during confirmation: ${file}. Nothing was replaced; the owner must check it before trying again.`,
    done: (file: string, view: string) => `Relay preference saved in ${file}: ${englishView(view)}.`,
    failed: (file: string) => `Incomplete write or approval: ${file}. The owner must check the file and its approval before trying again.`,
    busy: (command: string) => [
      "Nothing was sent.",
      "This Codex conversation is open. Background, used by default, requires a closed conversation and limits the teammate's tools.",
      "For this exchange, the owner can choose --open with the conversation's tools and permissions, including writing if allowed.",
      "To keep limited tools, they can close this conversation and request a new send.",
      `For future exchanges, optional choice "Prefer the open conversation" (background when closed), to be run and confirmed by the owner: ${command}`,
      "There is no automatic switch after this refusal."
    ].join("\n"),
    source: (source: string) => `Mode source: ${source === "explicit" ? "explicit option for this call" : source === "default" ? "background by default" : source === "setting" ? "saved background preference" : "conversation state or required path"}.`
  }
};

/** Retourne les textes sans effet de bord, dans la langue résolue de la commande. */
export function relayViewText(language: Language) { return texts[language]; }
