/** @file Textes FR/EN de la préférence Relay et de sa confirmation opérateur. */
import type { Language } from "../types.js";

/** Libellés humains ; les identifiants de configuration restent compatibles. */
const frenchView = (view: string) => view === "auto" ? "Privilégier la conversation ouverte" : "Arrière-plan";
const englishView = (view: string) => view === "auto" ? "Prefer the open conversation" : "Background";

/**
 * #250 : le signal reste le verrou Codex ; aucune surface, app ou fenêtre n'est détectée. Le retour
 * macOS cité est un constat rapporté, pas une règle pour toutes les versions ni un essai Palabre.
 */
const frenchStillUsed = "Fermer la fenêtre ne suffit pas toujours : un retour sous macOS (#250) a montré l'app ChatGPT garder la conversation chargée après la fermeture de sa fenêtre. Palabre ne détecte pas quelle app tient le verrou.";
const englishStillUsed = "Closing the window is not always enough: a macOS report (#250) showed the ChatGPT app keeping the conversation loaded after its window was closed. Palabre does not detect which app holds the lock.";

const texts = {
  fr: {
    missionBackground: "Mission reste en arrière-plan. Retirez --open ; ce parcours exige une conversation fermée.",
    busyExplicit: [
      "Rien n'a été envoyé.",
      "--background impose l'arrière-plan et ses outils limités ; cette conversation est encore utilisée par Codex (verrou tenu).",
      frenchStillUsed,
      "Pour cet échange, l'humain peut choisir un nouvel envoi --open avec les outils et permissions actuels de la conversation, y compris l'écriture si elle est autorisée.",
      "Pour garder ces limites, l'humain libère d'abord la conversation (quitter l'app peut être nécessaire selon la surface), puis demande un nouvel envoi.",
      "Après ce refus, seul l'humain décide ce nouvel appel ; aucun repli automatique."
    ].join("\n"),
    /** Conseil `error.hint` (#250) : vérification sans envoi, puis décision humaine ; aucune action. */
    busyHint: (command?: string) => `Avant tout nouvel envoi, vérifiez l'état ${command ? `avec ${command}` : "avec palabre relay --check --open en conservant exactement la cible et la configuration de cet appel"} : rien n'est envoyé, et les dernières permissions lues ne sont qu'indicatives. Si l'humain choisit ensuite un envoi --open, c'est un nouvel appel dans un autre mode : le même identifiant désigne la même conversation, pas le même mode ni les mêmes permissions. Sinon, l'humain libère la conversation puis demande un nouvel envoi en arrière-plan. Palabre ne renvoie rien, ne bascule pas et ne ferme aucune application.`,
    busyMode: "Mode demandé : arrière-plan — conversation libre requise ; aucun envoi effectué. L'identifiant désigne la conversation, pas un mode ni des permissions.",
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
      "Cette conversation est encore utilisée par Codex : son verrou est tenu (app, terminal ou intégration). L'arrière-plan, utilisé par défaut, exige une conversation libre et limite les outils de l'équipier.",
      frenchStillUsed,
      "Pour cet échange, l'humain peut choisir un nouvel envoi --open avec les outils et permissions actuels de la conversation, y compris l'écriture si elle est autorisée.",
      "Pour rester en arrière-plan, l'humain libère d'abord la conversation (quitter l'app peut être nécessaire selon la surface), puis demande un nouvel envoi.",
      `Pour les prochains échanges, choix facultatif « Privilégier la conversation ouverte » (arrière-plan si libre), à lancer et confirmer par le propriétaire : ${command}`,
      "Aucun basculement ni renvoi automatique après ce refus."
    ].join("\n"),
    source: (source: string) => `Choix du mode : ${source === "explicit" ? "option explicite pour cet appel" : source === "default" ? "arrière-plan par défaut" : source === "setting" ? "préférence arrière-plan enregistrée" : "état de la conversation ou parcours imposé"}.`
  },
  en: {
    missionBackground: "Mission stays in background. Remove --open; this path requires a closed conversation.",
    busyExplicit: [
      "Nothing was sent.",
      "--background requires background operation with limited tools; this conversation is still in use by Codex (lock held).",
      englishStillUsed,
      "For this exchange, the human can choose a new --open send with the conversation's current tools and permissions, including writing if allowed.",
      "To keep these limits, the human first frees the conversation (quitting the app may be needed depending on the surface), then requests a new send.",
      "After this refusal, only the human decides on a new call; there is no automatic fallback."
    ].join("\n"),
    /** `error.hint` advice (#250): a check that sends nothing, then a human decision; no action. */
    busyHint: (command?: string) => `Before any new send, check the state ${command ? `with ${command}` : "with palabre relay --check --open keeping the exact target and configuration of this call"}: nothing is sent, and the last permissions read are only indicative. If the human then chooses an --open send, it is a new call in another mode: the same identifier designates the same conversation, not the same mode or the same permissions. Otherwise, the human frees the conversation and then requests a new background send. Palabre resends nothing, does not switch and closes no application.`,
    busyMode: "Requested mode: background — a free conversation is required; nothing was sent. The identifier designates the conversation, not a mode or permissions.",
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
      "This conversation is still in use by Codex: its lock is held (app, terminal or integration). Background, used by default, requires a free conversation and limits the teammate's tools.",
      englishStillUsed,
      "For this exchange, the human can choose a new --open send with the conversation's current tools and permissions, including writing if allowed.",
      "To stay in background, the human first frees the conversation (quitting the app may be needed depending on the surface), then requests a new send.",
      `For future exchanges, optional choice "Prefer the open conversation" (background when free), to be run and confirmed by the owner: ${command}`,
      "There is no automatic switch or resend after this refusal."
    ].join("\n"),
    source: (source: string) => `Mode source: ${source === "explicit" ? "explicit option for this call" : source === "default" ? "background by default" : source === "setting" ? "saved background preference" : "conversation state or required path"}.`
  }
};

/** Retourne les textes sans effet de bord, dans la langue résolue de la commande. */
export function relayViewText(language: Language) { return texts[language]; }
