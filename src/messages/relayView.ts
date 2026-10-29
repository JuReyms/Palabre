/** @file Textes FR/EN de la préférence Relay et de sa confirmation opérateur. */
import type { Language } from "../types.js";

/** Libellés humains ; les identifiants de configuration restent compatibles. */
const frenchView = (view: string) => view === "auto" ? "Privilégier la conversation ouverte" : "Arrière-plan";
const englishView = (view: string) => view === "auto" ? "Prefer the open conversation" : "Background";

const texts = {
  fr: {
    missionBackground: "Mission reste en arrière-plan. Retirez --open ; ce parcours exige une conversation fermée.",
    busyExplicit: "Rien n'a été envoyé : --background impose l'arrière-plan pour cet appel, et cette conversation Codex est ouverte. Pour garder les outils limités de ce parcours, le propriétaire peut fermer cette conversation puis demander un nouvel envoi. Il peut aussi choisir --open pour un nouvel appel avec les outils et permissions de la conversation, y compris l'écriture si elle est autorisée. Après un refus --background, seul le propriétaire peut décider ce nouvel appel ; aucun repli automatique.",
    conflict: "--open et --background sont incompatibles. Choisissez une seule option pour cet appel, ou omettez-les pour laisser PALABRE appliquer la préférence du propriétaire.",
    usage: "Commande : palabre config --relay-view <auto|background> [--config <fichier>] [--language fr|en]. Aucun --yes ni --trust-config ; utilisez cette commande seule.",
    terminal: "Le propriétaire doit lancer palabre config --relay-view <auto|background> dans son terminal visible (entrée et sortie TTY), puis confirmer au clavier. Un agent ne confirme jamais à sa place.",
    unreadable: (file: string) => `Configuration absente, illisible ou invalide : ${file}. Le propriétaire doit vérifier ce fichier avant de relancer la commande.`,
    plan: (file: string, before: string, after: string) => `Fichier : ${file}\nPréférence Relay : ${frenchView(before)} -> ${frenchView(after)}.\nArrière-plan est le défaut : outils limités, conversation fermée requise. Privilégier la conversation ouverte utilise les outils et permissions de la conversation Codex, y compris l'écriture si elle est autorisée ; si elle est fermée, l'envoi part en arrière-plan. Une conversation quittée mais encore chargée dans Codex compte comme ouverte, sans garantie d'affichage. Un état invérifiable refuse l'envoi. Les autres réglages sont conservés.`,
    notice: "L'accord approuve le contenu entier du fichier affiché. Cette préférence change les permissions possibles des tours Relay ; seul le propriétaire la choisit.",
    confirm: "Appliquer ce changement ? [o/N] ",
    declined: "Changement refusé : aucune configuration ni approbation modifiée.",
    changed: (file: string) => `Configuration ou approbation modifiée pendant la confirmation : ${file}. Rien n'a été remplacé ; le propriétaire doit vérifier puis relancer.`,
    done: (file: string, view: string) => `Préférence Relay enregistrée dans ${file} : ${frenchView(view)}.`,
    failed: (file: string) => `Écriture ou approbation incomplète : ${file}. Le propriétaire doit vérifier le fichier et son approbation avant de relancer.`,
    busy: (command: string) => `Rien n'a été envoyé : cette conversation Codex est ouverte. L'arrière-plan, utilisé par défaut, exige une conversation fermée et limite les outils de l'équipier. Pour cet échange, le propriétaire peut choisir --open : la conversation utilisera ses outils et permissions actuelles, y compris l'écriture si elle est autorisée. Pour garder les outils limités, il peut fermer cette conversation puis demander un nouvel envoi. Pour les prochains échanges, il peut choisir « Privilégier la conversation ouverte » en lançant et confirmant lui-même : ${command}. Ce réglage utilise l'arrière-plan si la conversation est fermée. Aucun basculement automatique après ce refus.`,
    source: (source: string) => `Choix du mode : ${source === "explicit" ? "option explicite pour cet appel" : source === "setting" ? "arrière-plan (défaut ou préférence enregistrée)" : "réglage du propriétaire ou contraintes du parcours"}.`
  },
  en: {
    missionBackground: "Mission stays in background. Remove --open; this path requires a closed conversation.",
    busyExplicit: "Nothing was sent: --background requires background operation for this call, and this Codex conversation is open. To keep this path's limited tools, the owner can close this conversation and request a new send. They can also choose --open for a new call with the conversation's tools and permissions, including writing if allowed. After a --background refusal, only the owner can decide on this new call; there is no automatic fallback.",
    conflict: "--open and --background are incompatible. Choose one option for this call, or omit both to let PALABRE apply the owner's preference.",
    usage: "Command: palabre config --relay-view <auto|background> [--config <file>] [--language fr|en]. No --yes or --trust-config; use this command on its own.",
    terminal: "The owner must run palabre config --relay-view <auto|background> in their visible terminal (TTY input and output), then confirm using the keyboard. An agent must never confirm for them.",
    unreadable: (file: string) => `Missing, unreadable or invalid configuration: ${file}. The owner must check this file before running the command again.`,
    plan: (file: string, before: string, after: string) => `File: ${file}\nRelay preference: ${englishView(before)} -> ${englishView(after)}.\nBackground is the default: limited tools, closed conversation required. Prefer the open conversation uses the Codex conversation's tools and permissions, including writing if allowed; when closed, it sends in background. A conversation you left that is still loaded in Codex counts as open, with no display guarantee. An unverifiable state refuses sending. Other settings are preserved.`,
    notice: "Confirmation approves the entire displayed configuration file. This preference changes the permissions Relay turns may use; only the owner chooses it.",
    confirm: "Apply this change? [y/N] ",
    declined: "Change declined: no configuration or approval changed.",
    changed: (file: string) => `Configuration or approval changed during confirmation: ${file}. Nothing was replaced; the owner must check it before trying again.`,
    done: (file: string, view: string) => `Relay preference saved in ${file}: ${englishView(view)}.`,
    failed: (file: string) => `Incomplete write or approval: ${file}. The owner must check the file and its approval before trying again.`,
    busy: (command: string) => `Nothing was sent: this Codex conversation is open. Background, used by default, requires a closed conversation and limits the teammate's tools. For this exchange, the owner can choose --open: the conversation will use its current tools and permissions, including writing if allowed. To keep limited tools, they can close this conversation and request a new send. For future exchanges, they can choose "Prefer the open conversation" by running and confirming themselves: ${command}. That setting uses background when the conversation is closed. There is no automatic switch after this refusal.`,
    source: (source: string) => `Mode source: ${source === "explicit" ? "explicit option for this call" : source === "setting" ? "background (default or saved preference)" : "owner's setting or path requirements"}.`
  }
};

/** Retourne les textes sans effet de bord, dans la langue résolue de la commande. */
export function relayViewText(language: Language) { return texts[language]; }
