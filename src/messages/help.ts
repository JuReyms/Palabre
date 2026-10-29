/** @file Aide CLI FR/EN : options, prochaines étapes et limites de chaque commande. */
import type { Language } from "../types.js";

/** Rendu de l'aide globale et des commandes, sans lancer d'agent ni modifier de configuration. */
export interface HelpMessages {
  render(presets: string): string;
  renderCommand(command: string): string | undefined;
}

const frCommandHelp: Record<string, string> = {
  skill: `
Garde le skill installé aligné sur le paquet de la CLI exécutée, sans réseau ni config.
  palabre skill                        affiche l'état et le plan, sans écrire
  palabre skill --sync                 rafraîchit les copies détectées après confirmation
  palabre skill --install codex        installe dans ~/.agents/skills/palabre
  palabre skill --install claude       installe dans ~/.claude/skills/palabre
  --check, --dry-run                   lecture seule, même avec --sync ou --install
  --yes                                accord explicite sans question, plan toujours affiché
Les fichiers personnalisés remplacés sont sauvegardés hors des dossiers de skills.
Les jonctions et ajouts privés sont conservés. Les liens internes sont refusés.
Les copies illisibles sont signalées et ignorées, sans bloquer update ni les autres copies.
Sans copie différente, --sync et --install ne demandent aucun accord et n'écrivent rien.
Si la CLI est mise à jour mais pas le skill, le message le précise : palabre skill --sync.
La source est skills/palabre du paquet courant ; aucun suivi de GitHub main.
L'agent ne lance pas --sync, --install ou update sans accord humain sur ces instructions.
Après rafraîchissement, rechargez le skill ou reprenez la conversation de l'agent.
`,
  mission: `
Un chef de mission appelle son équipier en arrière-plan ; vous prenez les décisions.
Mission est gelée : conservée, correctifs de sécurité seulement.
Lot v2.0 : lecture seule, un appel explicite par étape, aucune boucle automatique.

Utilisation (depuis le même dossier) :
  palabre mission start --from <chef-de-mission>:<uuid> --to <équipier>:<uuid> --criteria "<réussite attendue>" "<objectif>"
  palabre mission step <id> "<demande>" [--timeout <secondes>]
  palabre mission step <id> "<consigne de revue>" --task review --pr https://github.com/owner/repo/pull/123
  palabre mission status <id> [--json]
  palabre mission stop <id> [--reason "<motif>"]

Cadre de start (fixé par vos réponses au chef de mission) :
  --tasks <consult,review>    consult par défaut ; review exige la politique Relay déjà approuvée
  --max-steps <1..100>        10 tentatives par défaut, refus compris
  --max-duration <10..86400>  3600 secondes depuis start, temps entre étapes compris
  --timeout <10..3600>        600 secondes par étape ; surcharge possible sur step
  --config <chemin>           configuration Relay, jamais approuvée par mission
  --language <fr|en>          langue du cadre et des sorties
  --json                      un objet JSON v1 pour chaque commande, erreurs comprises

La conversation de l'équipier doit rester fermée (terminal, Desktop, IDE).
Le chef de mission suit status, l'export .mission.md et GitHub ; aucun affichage Desktop immédiat promis.
Une étape n'est jamais rejouée automatiquement. Après coupure, état running ou uncertain :
le chef de mission vérifie l'export et la conversation avec vous, sans supprimer le verrou pour réessayer.
Conversation occupée : fermer la conversation avant une nouvelle step explicite (budget consommé).
stop annule au mieux l'appel ; un message ou une revue déjà partis ne sont pas retirés.
Un budget épuisé ou un arrêt exige une nouvelle mission après décision du propriétaire.
Les délais bornent l'appel Relay ; les sondes et GitHub gardent leurs propres bornes.
État/export locaux dans .palabre/missions/<id>/ ; identifiants privés, réponses non vérifiées.
Pas de code, commit, push, merge, release, --open, --trust-config ou changement de chef de mission.
La tâche review publie seulement une revue COMMENT sous la politique Relay existante.
Si Codex signale des lectures bloquées sous Windows : Mission en pause, réponse conservée,
aucune revue publiée. Cause probable : le raccourci Microsoft Store WindowsApps\\pwsh.exe.
Le propriétaire consulte https://palab.re/fr/troubleshooting (Codex sous Windows) et #128 ;
alias Store confirmé écarté seulement dans l'enfant Codex si un PowerShell natif reste disponible.
Les autres alias de ce dossier y deviennent indisponibles. Aucun changement de permission ni renvoi automatique.
Chaque étape reçoit l'en-tête PALABRE Mission, puis l'avertissement ℹ️ sur une ligne séparée
avant le contenu. Objectif et critères sont lisibles sur deux lignes, sans JSON ; la partie
« 🤖 Message pour l'agent » termine le message. Le tout compte dans les 64 Kio UTF-8 de coordination.
Une limite d'usage connue met l'étape en pause ; reprise CLI conservée si fournie.
Aucun renvoi automatique, même après cette heure ; le chef de mission attend la décision humaine.
Le rôle et le cadre ne donnent aucun droit supplémentaire. Aucun plafond de coût monétaire.
`,
  init: `
Initialise explicitement une configuration Palabre.

Note :
  palabre sans argument crée déjà la configuration globale au premier lancement TUI.

Utilisation :
  palabre init [flags]

Options :
  --local                     crée ./palabre.config.json
  --language <fr|en>          définit la langue
  --config <chemin>           chemin de config explicite
`,
  "agent-role": `
Modifie le rôle durable d'un agent dans la configuration.

Utilisation :
  palabre agent-role <agent> <rôle>

Exemple :
  palabre agent-role claude critic

Rôles :
  implementer, reviewer, architect, scout, critic, summarizer
`,
  agents: `
Liste les agents déclarés dans la config.

Utilisation :
  palabre agents [flags]

Options :
  --config <chemin>           chemin de config explicite
  --language <fr|en>          force la langue
  --json                      sortie JSON pour les intégrations
`,
  presets: `
Liste les presets de paires d'agents.

Utilisation :
  palabre presets [flags]

Options :
  --json                      sortie structurée pour intégrations
  --config <chemin>           chemin de config explicite
`,
  history: `
Liste les derniers exports Palabre.

Utilisation :
  palabre history [flags]
  palabre historique [flags]

Options :
  --json                      sortie structurée pour intégrations
  --limit <nombre>            nombre d'exports (1 à 100, défaut : 10)
  --config <chemin>           chemin de config explicite
`,
  historique: `
Liste les derniers exports Palabre.

Utilisation :
  palabre history [flags]
  palabre historique [flags]

Options :
  --json                      sortie structurée pour intégrations
  --limit <nombre>            nombre d'exports (1 à 100, défaut : 10)
  --config <chemin>           chemin de config explicite
`,
  context: `
Scanne le contexte projet avec les mêmes règles que --context.

Utilisation :
  palabre context scan [paths...] [flags]

Options :
  --json                      sortie structurée pour intégrations
  --language <fr|en>          force la langue des avertissements
`,
  config: `
Configure les agents par défaut, la synthèse, le nombre de réponses et la langue.

Utilisation :
  palabre config
  palabre config --prune-trust [--dry-run]
  palabre config --set-defaults <agentA> <agentB>
  palabre config -t <nombre>
  palabre config --summary-agent <nom|none>
  palabre config --ask-summary-agent <nom|none>
  palabre config --mode <chat|debate|ask>
  palabre config --ask-agents <noms...>
  palabre config --interface <tui|terminal>
  palabre config --relay-view <auto|background> # arrière-plan par défaut ; auto = privilégier la conversation ouverte
  auto suit le verrou Codex (tenu : permissions de la conversation ouverte ; libre : arrière-plan).
  background impose l'arrière-plan. État invérifiable : aucun envoi.
  Config déjà approuvée, fichier/changement affichés ; entrée ET sortie TTY requises.
  Aucun --yes, --trust-config ou mélange de mutations. L'agent ne confirme jamais à votre place.
  palabre config --language <fr|en>

  --prune-trust retire seulement les approbations de fichiers disparus : liste,
  confirmation au clavier, puis sauvegarde horodatée. --dry-run affiche sans écrire.
  À lancer vous-même dans votre terminal ; aucun --yes. Les fichiers existants sont conservés.

Options :
  --clear-defaults            supprime les paramètres par défaut
  --sync-agents               ajoute les agents détectés ; conserve les commandes avec chemin absolu
                              Chemin absent : indisponible ; aucun repli vers une autre installation.
  --ollama-models             liste les modèles Ollama ; --json : sortie structurée
  --set-ollama-model <modèle>
                              choisit un modèle installé pour ollama-local
  --sync-ollama-model         remplace le modèle ollama-local absent par un modèle installé
  --config <chemin>           chemin de config explicite
`,
  new: `
Assistant interactif pour préparer un Débat ou un Ask.

Utilisation :
  palabre new [flags]

Options :
  --config <chemin>           chemin de config explicite
  --language <fr|en>          force la langue
`,
  doctor: `
Vérifie l'approbation, PowerShell Windows, les connexions Claude/Codex et le skill.
Ne modifie rien. Sondes status bornées sur configuration approuvée, aucun appel modèle.

Utilisation :
  palabre doctor [flags]

Options :
  --terminal                  sortie simple pour logs
  --config <chemin>           chemin de config explicite
  --language <fr|en>          force la langue
`,
  update: `
Affiche ou exécute les étapes de mise à jour.
Le même plan et la même confirmation couvrent le skill des copies détectées.
Après mise à jour, la source est le paquet nouvellement installé, avec sauvegardes
sous ~/.palabre/skill-backups, jonctions et ajouts privés conservés.
Si seule la copie du skill diffère, son rafraîchissement reste proposé.
Pour le skill seul sans réseau : palabre skill --sync.

Utilisation :
  palabre update [flags]

Options :
  --check                     vérifie canal et version sans modifier
  --dry-run                   prévisualise les étapes sans modifier
  --yes                       confirme l'application sans prompt
  --apply                     alias compatible de --yes
  --config <chemin>           chemin de config explicite
`,
  resume: `
Reprend une conversation Débat ou Ask depuis son dernier checkpoint complet.

Utilisation :
  palabre resume <id-session>

Options :
  --yes                       confirme la reprise en mode non interactif
  --terminal                  force le rendu terminal brut
  --renderer <rendu>          auto, pretty, plain, tui ou ndjson
  --ollama-url <url>          surcharge l'adresse Ollama pour les appels repris
  --pull-models               autorise le téléchargement d'un modèle Ollama manquant
`,
  relay: `
Transmet un message à une conversation précise et renvoie sa réponse ; PALABRE choisit le mode.
Avec --open, dépose le message dans une conversation Codex ouverte et attend sa réponse.
Avec --copy, demande un avis dans une copie OpenCode (pilote Windows, CLI 2.0.32).

Utilisation :
  palabre relay --to <agent>:<session> "<message>"
  palabre relay --new --to <agent> "<message>"
  palabre relay --copy --to opencode:ses_... --dir "C:\\projets\\exemple" "<avis sans modification>"
  palabre relay --new --write --to codex --dir <projet-git> "<tâche>"
  palabre relay approve-write <WR-id>    # confirmation par l'humain, dans son terminal
  palabre relay run-write <WR-id> --json # un seul appel après accord
  palabre relay --from <agent>:<session> --to <agent>:<session> --message-file <chemin>
  palabre relay allow-repo proprietaire/depot [--config <chemin>]
  palabre relay allow-repo 'proprietaire/*' [--config <chemin>]
  palabre relay --open --from <agent>:<session> --to <agent-codex>:<session> "<message>"
  palabre relay --open --follow --to <agent-codex>:<session>   # suite d'un tour lancé depuis l'app
  palabre relay --check --to <agent>:<session>   # vérifie le mode et la conversation, sans rien envoyer

Options :
  --from <agent>[:<uuid>]     expéditeur facultatif, déclaré et non authentifié ; terminal si absent
  --to <agent>:<uuid>         cible existante ; nom d'agent seul avec --new
  --new                       crée une conversation persistante, lecture seule par défaut, sans --open
  --copy                      copie OpenCode explicite, profil habituel sans lecture seule imposée
  --model <référence>         --copy seulement ; sans variante = default, pas héritée
  --write                     expérimental, gelé : tâche Codex Windows avec accord humain et worktree séparé
  --dir <chemin>              dossier de --new (défaut : courant), obligatoire et exact avec --copy
  Omettez --from et --dir s'ils n'ont pas de valeur ; une chaîne vide est refusée.
  --message-file <chemin>     lit le message dans un fichier (64 Kio au plus)
  --subject <objet>           objet facultatif : une ligne non vide, 200 caractères au plus, sans contrôle
  --reference <repère>        PR, issue ou nom court stable (mêmes limites que --subject)
  --exchange <numéro>         avec --reference : entier de 1 à 999999, choisi par le chef de mission
  Même repère dans la réponse ; aucun compteur automatique ni réussite de tâche certifiée.
  Repères réservés aux envois ordinaires, hors --check, --follow et fonctions gelées.
  --task review               gelé : rédige et publie une revue COMMENT si la config l'autorise
  --pr <url>                  PR github.com exacte ; obligatoire avec --task review
  --open                      vise une conversation Codex ouverte (TUI ou Codex desktop), pour cet appel
  --background                force l'arrière-plan pour cet appel ; incompatible avec --open
  Codex/Claude : pour un avis ou une relecture devant rester sans modification, passer --background :
  réduction des droits pour cet appel, sans changer le réglage. Ne pas choisir le mode par habitude ailleurs.
  --follow                    avec --open : ne dépose rien, attend le prochain tour terminé
  --then-follow <secondes>    après la réponse liée, écoute un seul tour supplémentaire (10 à 3600 s)
  --check                     vérifie mode, conversation et permissions connues, sans rien envoyer
  --timeout <secondes>        délai maximal, de 10 à 3600 (défaut : 600)
  --json                      sortie JSON v1 pour les intégrations
  --no-export                 n'écrit ni l'export .relay.md ni la passation .handoff.md
  --config <chemin>           chemin de config explicite
  --trust-config              approuve la config résolue (aucune question n'est posée)
  --language <fr|en>          force la langue

Message exact : pour un envoi ordinaire, le texte complet, enveloppe comprise, est conservé
dans l'export et son chemin est annoncé. Avec --no-export, Palabre n'en garde pas de copie
locale ; l'outil IA peut la garder. Cette trace ne prouve pas la réception et n'inclut pas tout le contexte de l'outil.

Conversation Claude déjà utilisée (#250) : target-busy, code 3, rien envoyé. Un processus
Claude (app, terminal ou intégration) y est attaché, même au repos ; ni l'affichage ni une
génération en cours n'en sont déduits. Répondre à une demande reçue dans le même tour ;
sinon passation via l'humain, ou --check puis décision d'un nouvel envoi (error.hint).
Envoi ordinaire seulement : corps original gardé dans <sortie>/palabre-handoff-….handoff.md,
NON ENVOYÉ, jamais renvoyé ni notifié (JSON handoff) ; exportPath reste null. Avec --no-export,
rien n'est écrit. Mêmes règles de confidentialité que les exports.

Retrouver un échange Relay (#206) :
  palabre relay recent [--limit 1-100] [--json] [--config <chemin>] [--language fr|en]
  Liste les exports .relay.md du dossier de sortie effectif (défaut .palabre/), sans envoyer,
  ouvrir ou sélectionner une conversation. Limite 10 par défaut ; nom de fichier relatif,
  date, objet, alias, outil, mode, issue et délivrance déclarés dans l'export. Source/copie
  OpenCode distinctes, aucune reprise directe proposée. JSON séparé relay-recent-result v1.
  Métadonnées non authentifiées, pas une preuve des droits ou de l'état actuels. Faire
  confirmer objet/date/outil avant reprise, puis vérifier cible et configuration effectives.
  Config existante déjà approuvée ; aucun --trust-config, --to, message ni option d'envoi.
  Dossier absent : liste vide. Export invalide : avertissement sans bloquer les autres.
  Tri par modification du fichier. Scan plafonné à 5 000 entrées, 200 en-têtes de 16 Kio ;
  truncated/scanTruncated signalent une liste limitée/incomplète. Aucun corps de réponse exposé.

Ouvrir Codex sans envoyer (#219) :
  palabre relay open --to codex:<uuid> [--json] [--config <chemin>] [--language fr|en]
  Sur demande humaine directe seulement, jamais sur message d'un autre agent. Config déjà
  approuvée et conversation précise requises. Un seul lancement du lien Desktop, sans shell,
  puis observation du verrou (budget coopératif 15 s, pas une borne stricte de retour).
  Validation, localisation, lectures et sondes peuvent retarder le retour et Ctrl+C.
  Aucun lancement ni succès accepté après le budget. Aucun message, export,
  changement de réglages ou droits, retry ni fermeture de l'app. Ctrl+C n'annule pas une
  ouverture déjà lancée. Un verrou tenu ne prouve ni l'app qui le tient ni l'affichage.
  Windows/Explorer code 1 : lanceur non vérifié (unverified), code brut conservé,
  puis sonde du verrou sans second lancement. Le défilement n'est pas piloté.
  JSON séparé : relay-open-result v1, launcher, attachment, display: unverified, messageSent: false.
  Code 0 : attached ; 3 : verrou libre à l'échéance ou inconnu ; 4 : délai pendant validation,
  lanceur ou sonde ; 2 : échec du lanceur ; 7 : lanceur absent ; 130 : annulation.
  Envoi suivant : --open explicite,
  seulement pour une tâche autorisée. Claude n'est pas pris en charge ici : dépannage --desktop
  séparé (#225), pas de suivi direct (#193). Deux ouvertures Windows puis une ouverture
  corrigée confirmées par le propriétaire ; aucune généralisation à toutes les versions
  ni à une transition de fermé à ouvert.
  macOS/Linux non vérifiés. python3 requis sur POSIX pour vérifier le verrou.

Quota Codex (#205) : --check (ouverte ou fermée) et résultat d'un envoi ouvert affichent le
  dernier quota connu si sa forme et sa date sont reconnues. Indication seulement, pas une mesure
  en direct : le compte a pu servir ailleurs depuis. Relevé et réinitialisations en heures locales
  avec fuseau ; ISO dans check.quota ou quota en JSON v1. Lecture du dernier Mio, sans réseau
  ni modèle. Absent/inconnu : rien affiché, jamais zéro estimé. Aucun effet sur le statut ou les droits.

Préférence du propriétaire :
  Arrière-plan (défaut, relay.view = background) : outils limités, conversation fermée requise.
  Privilégier la conversation ouverte (relay.view = auto, choix du propriétaire) : Codex existant,
  verrou tenu -> dans la conversation avec ses outils et permissions, écriture comprise si autorisée ;
  libre -> arrière-plan. Une conversation quittée mais encore chargée compte comme ouverte, sans
  garantie d'affichage. Les réglages auto déjà enregistrés sont conservés.
  Verrou invérifiable : target-state-unknown, aucun envoi. Aucun repli après refus.
  Cible ouverte en arrière-plan : target-busy, rien envoyé ; --open permet un choix pour cet échange,
  après explication des permissions ; seul le propriétaire décide après un refus --background.
  --open et --background priment sur le réglage sans le changer ; ensemble, refusés.
  --new, Mission, --task review, --write et Claude Code restent en arrière-plan.
  Le propriétaire lance palabre config --relay-view <auto|background> : chemin/changement affichés,
  config déjà approuvée, confirmation clavier avec entrée ET sortie TTY ; aucun --yes ni --trust-config.
  Un agent ne modifie jamais ce réglage et ne confirme jamais à sa place.
  agents --json expose defaults.relayView ; Relay JSON v1 : modeSource facultatif,
  explicit (option), default (arrière-plan sans choix enregistré), setting (background enregistré),
  auto (verrou ou parcours imposé). Un réglage permanent reste un choix humain facultatif.

Limites :
  Codex desktop chef de mission : autoriser chaque commande vers Claude hors du bac à sable,
  cette fois seulement, sans règle durable. --write reste hors parcours par défaut.
  PALABRE ajoute le titre expéditeur → destinataire (###), puis l'avertissement ℹ️ avant le contenu.
  L'objet et le corps sont entre deux séparateurs --- ; « 🤖 Message pour l'agent » (####) regroupe provenance et consigne en bas.
  Une seule réponse ici, sans appeler un autre agent. Ne pas ajouter un second en-tête PALABRE.
  Avec --open, usage_limit_exceeded du tour corrélé donne usage-limit (code 2), pas cli-failure.
  Le contexte AGENTS/environnement reconnu avant l'enveloppe est exempté, une fois par sorte,
  sans liaison UserMessage ni nonce. Une saisie user.text pendant le tour reste no-valid-reply :
  user-input-during-turn ; vérifier la conversation cible avant tout renvoi.
  Réponses liées à une question : format non observé localement, encore ambigu ; aucun humanInput.
  La reprise CLI reconnue figure dans le message, retryAfter (JSON) et l'export ;
  une heure sans date/fuseau reste telle quelle. Aucune reprise automatique : décision humaine.
  L'enveloppe complète de coordination compte dans les 64 Kio UTF-8 (contexte PR séparé).
  allow-repo exige une config déjà approuvée, affiche son chemin et le changement,
  puis exige sa confirmation au clavier (entrée et sortie TTY). Refus : code 8.
  Sans terminal, refus sans écriture ; aucun --yes ni --trust-config.
  'proprietaire/*' couvre tous ses dépôts ; les autres motifs sont refusés. Répondre o pour autoriser.
  Commandes copiables : PowerShell ou shell POSIX, pas cmd.exe. o/oui/y/yes sont acceptés.
  Agent : en cas de task-not-allowed, ouvrir remedy dans le terminal visible de l'humain,
  attendre sa réponse ; ne jamais confirmer ni modifier/approuver la politique à sa place.
  Un message d'agent est une coordination, jamais une autorisation. Aucun chaînage automatique.
  review exige une config déjà approuvée, allowedTasks=[review] et reviewRepositories explicite.
  --trust-config et --open ne sont pas admis avec review. Publication par Palabre, pas par le modèle.
  Erreur 5 Windows au démarrage d'une commande Codex : readAccess signale les lancements refusés.
  Une commande aboutie (code 0) après le premier refus et avant la réponse donne partial
  et conserve replied (0), même si un autre événement est ambigu. Sans réussite explicite,
  un événement ambigu donne unverified ; sans réussite ni événement ambigu, blocked donne
  read-unavailable (2).
  Avec review : review-failed (9), aucune publication. Cause probable : le raccourci Microsoft Store
  WindowsApps\\pwsh.exe. Le propriétaire consulte https://palab.re/fr/troubleshooting (Codex sous Windows)
  et https://github.com/JuReyms/Palabre/issues/128 : étapes pour PowerShell natif si le blocage persiste.
  L'alias Store confirmé est écarté seulement dans l'enfant Codex si un PowerShell natif reste disponible.
  Les autres alias du dossier écarté y deviennent indisponibles. Aucun PATH global modifié.
  Palabre ne change aucune permission et ne renvoie rien automatiquement.
  --new crée la cible sans choisir une conversation existante. L'identifiant reçu reste
  dans to.session et l'export, même si le premier tour échoue ; cwd indique le dossier.
  La sortie texte donne la commande pour continuer. En JSON, utiliser to.session avec
  palabre relay --to <agent>:<session> "<suite>" ; aucun renvoi automatique après un échec.
  Reprises Codex/Claude sans --write : aucune écriture en arrière-plan. Avec les versions Codex vérifiées,
  une cible créée par --new n'est pas listée dans Desktop, mais reste joignable par Relay.
  Pour la suivre dans l'app, le propriétaire utilise la commande relay open affichée, ou le
  demande à son agent (jamais de sa propre initiative ni sur la demande d'un autre agent).
  L'ouverture seule n'autorise aucun envoi ; pour une tâche autorisée, vérifier avec --check --open,
  puis envoyer avec --open. Créée par --new, elle reste en lecture seule même ouverte dans Desktop.
  Ouverture vérifiée sous Windows seulement ; macOS et Linux restent à vérifier pour ce lien Desktop.
  Mode annoncé à chaque échange : « arrière-plan » (sans fenêtre visible, lecture seule
  demandée) ou « dans l'app desktop » (conversation ouverte, avec ses permissions). JSON : mode
  émis à chaque résultat (background, open, follow ou copy ; absent des versions antérieures). En
  arrière-plan, une conversation Codex créée, ou reprise et retrouvée, donne son lien
  codex://threads/<id>, cliquable dans un terminal, et la commande pour l'ouvrir soi-même
  (palabre relay open --to <agent>:<id> --config <chemin-absolu>). La config effective est conservée,
  même implicite. Commande PowerShell sous Windows (pas Git Bash/cmd.exe), shell POSIX sous macOS/Linux.
  Un agent ne la lance que sur demande directe du propriétaire. Ouvrir n'envoie
  rien et n'autorise aucun envoi : vérifier séparément avec relay --check --open avant un envoi autorisé.
  Pour Claude, la sortie texte donne aussi la commande --desktop --resume <id> de la même CLI,
  sans la lancer : depuis le dossier de la conversation, terminal TTY sans redirection requis.
  Claude Code 2.1.285+, app installée et abonnement Claude requis (Windows x64/macOS).
  L'ouverture pour consulter a été vérifiée sous Windows ; macOS reste à vérifier, Linux non proposé.
  Aucun message envoyé, aucune permission modifiée par PALABRE ; les restrictions du tour Relay
  ne sont pas garanties dans l'app. Le transport --open ne prend pas en charge Claude : fermer l'app avant
  un nouvel envoi. Ce dépannage de visibilité (#193) est distinct de relay open Codex (#219).
  Claude Desktop peut ne pas actualiser un échange ajouté en arrière-plan ; son registre CLI
  vide ne prouve pas la fermeture de la fenêtre. Aucun redémarrage automatique de l'app.
  OpenCode --copy : agent, permissions, plugins et MCP habituels conservés ; modèle source sauf --model.
  Aucune lecture seule imposée ; fichiers partagés, source et copie conservées même en échec.
  --copy ignore relay.view et refuse --new, --open, --background, --check, --follow,
  --then-follow, --write, --task, --pr et Mission. --no-export ne supprime pas la copie.
  --write exige --new, un dépôt Git et une config déjà approuvée. Aucun --open, --task ou --trust-config.
  Le premier appel ne lance pas de modèle : write-approval-required (8), writeRequest et remedy.
  Le propriétaire lance approve-write dans un terminal visible (entrée ET sortie TTY), relit tâche,
  agent, projet, commit et dossier, puis confirme au clavier. Aucun --yes ; l'agent ne confirme jamais.
  run-write consomme cet accord pour un seul appel, même en échec. Aucun rejeu automatique.
  approve-write/run-write gardent la langue de la demande ; aucun --language sur ces commandes.
  Le worktree part du commit annoncé : changements non commités et dépendances locales non inclus.
  Travail conservé. Confinement vérifié avant modèle : réseau des commandes coupé, aucune escalade,
  MCP/plugins/hooks neutralisés. Pas de commit/push/merge, installation ni réglage utilisateur.
  Ces garanties dépendent du backend Windows ; unelevated a une isolation réseau plus faible.
  Windows seulement ; Claude natif refusé. Métadonnées CLI/Git nécessaires hors du worktree.
  JSON/export : write donne branche, dossier, fichiers/diff Git, commandes observées avec codes/sorties.
  Aucun succès de test déduit de la prose ; spawn EPERM reste un blocage, sans repli non confiné.
  En mode arrière-plan, une conversation existante doit être fermée : aucun TUI, desktop, IDE ni exécution
  en cours.

Avec --open (pilote Codex ; Windows, macOS et Linux) :
  La conversation cible doit être ouverte : son verrou d'écriture doit être tenu, sinon rien
  n'est déposé (target-not-open). Le message passe par codex queue ; l'enveloppe complète est
  limitée à 8 192 unités UTF-16. Le verrou ne prouve ni l'affichage ni la consommation du
  message : le récepteur est annoncé non vérifié. La cible répond avec ses propres outils et
  permissions : aucune lecture seule n'est garantie, et les garanties ci-dessous ne s'appliquent
  pas. Un message déposé peut être traité après le délai, même sans être affiché ; Ctrl+C
  n'annule pas un dépôt, et il n'y a aucun renvoi automatique. Sur macOS/Linux, python3 est requis
  pour éprouver le verrou POSIX ; outil absent, timeout ou erreur ambiguë = target-state-unknown.

Avec --then-follow <secondes> (envoi puis écoute, mode ouvert explicite ou auto) :
  Seulement si une validation humaine dans l'app est attendue : le suivi attend le premier tour
  suivant terminé, au plus pendant le délai ; sans suite, jusqu'à l'échéance. En JSON, la réponse
  liée n'est rendue qu'à la fin de ce suivi. Préférer un délai court (120 s).
  Un seul dépôt. --timeout borne la réponse liée ; le second délai explicite (10 à 3600 s)
  commence à sa réception. La référence suit exactement sa ligne de fin, sans perdre une suite rapide.
  En texte, réponse liée immédiate puis suite séparée ; en JSON, un seul objet final sur stdout,
  progression sur stderr. status/reply/delivery principaux restent ceux de la réponse liée ; nextTurn
  rapporte la suite (followed), l'échéance (awaiting-turn, reason timeout), l'annulation ou l'erreur.
  Première réponse échouée : nextTurn not-started, aucune écoute. Aucun auteur ni accord humain déduit.
  Refus : arrière-plan, Claude Code, --new, Mission, --task review, --write, --check ou --follow.

Avec --open --follow (suivre la suite sans --then-follow) :
  Quand la conversation attend une action dans l'app (par exemple une confirmation), la suite se
  joue dans un nouveau tour qu'aucun appel Relay n'écoute. --follow ne dépose rien et ne lance
  aucun processus Codex (sous macOS/Linux, seule la sonde du verrou lance python3, comme pour
  --open) : il attend le premier tour terminé après l'appel et rend sa réponse avec
  l'issue followed (code 0). Ce n'est pas la réponse à un message PALABRE, et l'auteur du tour
  n'est pas vérifié ; aucune autorisation n'en est déduite. Lancer --follow avant d'agir dans
  l'app : un tour déjà terminé n'est pas rendu. Une enveloppe PALABRE observée dans le tour donne
  no-valid-reply (relay-turn) ; un tour commencé avant l'appel est rendu sans que son origine (app
  ou autre Relay) soit connue. Échéance : relancer --follow ; un tour encore en cours sera rendu.
  Interdit avec un message, --message-file, --subject, --from, --new,
  --task ou --write. JSON : mode follow, delivery not-delivered (rien n'est envoyé), sans queue.

Avec --copy (pilote OpenCode CLI 2.0.32, Windows seulement) :
  Le rappel Plan standard est reconnu dans le contexte source et conservé dans la copie.
  Aucun autre message synthétique n'est accepté ; aucun mode ni permission n'est changé.
  Une seule notice de date core/date strictement qualifiée est admise avant le message.
  Tout ajout, doublon ou autre notification système reste refusé ; aucun droit ajouté.
  Fermez la source et indiquez son ID exact ses_... et son dossier --dir. La source ne reçoit
  jamais le message : PALABRE vérifie un fork, puis lui demande un avis. Aucun --auto,
  retry ou repli payant. Agent, modèle et variante sont ceux de la source, sauf --model explicite.
  --model fournisseur/modèle[#variante] change seulement la copie ; sans # = variante default.
  Catalogue et sélection contrôlés avant envoi. Choix absent/invérifiable = arrêt sans prompt.
  Le catalogue ne garantit ni connexion ni quota. Aucun remplacement ; aucune modification du profil.
  JSON copy.model (avec --model) : requested, source?, selected?, verified ; observedModels = réponse.
  Permissions, plugins et MCP habituels conservés : aucune lecture seule imposée. Le fork copie
  la conversation, pas les fichiers du projet. Ne réutilisez pas la source pendant l'appel :
  les relevés ne forment pas un verrou global. Source et copie restent dans OpenCode, même
  après échec ; --no-export ne supprime pas la copie. Nettoyage : 10 s au plus après le délai.
  JSON mode=copy : copy.source est l'original ; to.session est la copie vérifiée, ou null.
  copy.session conserve aussi une copie non vérifiée ; vérifiez copy.verified et delivery.
  Une réponse validée est conservée même si l'arrêt ou l'export échoue ensuite.
  Aucun --new, --open, --background, --check, --follow, --then-follow, --write, --task, --pr
  ou Mission. Desktop non qualifié.

Garanties conditionnelles (reprises Codex/Claude seulement, pas --copy) :
  Avec les options imposées par Palabre et sur les versions de CLI vérifiées, la cible ne
  dispose d'aucun outil d'écriture, et les hooks et la commande notify non gérés sont
  neutralisés. Les serveurs MCP sont neutralisés sous réserve que la configuration ne change
  pas entre l'inspection et la reprise. Ces garanties ne couvrent ni les politiques
  administrées, ni les versions de CLI non vérifiées.
  Pendant le tour relayé, Codex perd ses plugins, connecteurs et serveurs MCP ; Claude n'a
  que les outils de lecture. La configuration n'est pas modifiée.

Effets :
  Lecture seule ne veut pas dire sans effet : le message enveloppé, la réponse et les appels
  d'outils de lecture sont ajoutés à l'historique de la conversation cible, même après un
  échec, et Palabre ne peut pas les retirer.
  Aucun renvoi automatique : not-delivered permet un nouvel envoi sans doublon ;
  persisted-no-reply et unknown déconseillent de renvoyer sans vérification.
`,
  sessions: `
Liste les checkpoints du dossier courant ou en supprime un explicitement.

Utilisation :
  palabre sessions [flags]
  palabre sessions delete <id-session> [flags]

Options :
  --json                      sortie JSON v1 pour les intégrations
  --limit <nombre>            nombre de checkpoints (1 à 100, défaut : 20)
  --yes                       confirme la suppression en mode non interactif
  --language <fr|en>          force la langue
`,
  run: `
Lance un Débat, un Ask ou un Chat selon --mode ou le mode configuré.

Utilisation :
  palabre run --mode debate --preset codex-claude -s "Sujet" -t 4
  palabre run --mode ask --agents codex claude -s "Sujet"
  palabre run --mode chat --agent-a codex -s "Contexte initial"

Sans --mode, le mode configuré s'applique aussi aux formes courtes :
  palabre <preset> "Sujet" ; palabre -s "Sujet"
Un preset n'est pas utilisable en Chat ; voir palabre chat --help.
Pour les particularités de chaque mode : palabre ask --help et palabre chat --help.

Agents et mode :
  --mode <debate|ask|chat>    mode de cette session, sans modifier la configuration
  -s, --subject <texte>       sujet (--topic : alias compatible)
  -t, --turns <nombre>        réponses du Débat : entier de 1 à 20 (configuration, sinon 4)
  --preset <nom>              paire d'agents (palabre presets)
  --agent-a <nom>             agent A ; agent actif en Chat
  --agent-b <nom>             agent B du Débat
  --agents <noms...>          participants Ask (1 à 4)
  --role-a <rôle>             rôle temporaire de A ; --role-b <rôle> : rôle de B
  --ask-role <rôle>           rôle commun temporaire en Ask
Rôles : implementer, reviewer, architect, scout, critic, summarizer.
Les rôles sont temporaires et ne donnent aucun droit supplémentaire.

Contexte et modèles :
  --files <chemins...>        fichiers précis (64 Kio chacun, 192 Kio au total)
  --context <chemins...>      fichiers ou dossiers à parcourir avec limites et exclusions
  --model-a <modèle>          modèle brut de A ; --model-b <modèle> : modèle de B
  --ollama-url <url>          adresse Ollama pour cette session
  --pull-models               autorise le téléchargement d'un modèle Ollama manquant
Budget partagé entre --files et --context ; --context ignore les fichiers exclus,
binaires ou trop grands avec avertissements. --files refuse les entrées invalides.
Les modèles sont ceux des agents configurés, sauf remplacement explicite.

Synthèse et préparation (Débat/Ask seulement) :
  --summary-agent <nom>       agent de synthèse
  --summary-model <modèle>    modèle brut de synthèse
  --no-summary                désactive la synthèse
  --no-early-stop             désactive l'arrêt sur accord en Débat seulement
  --show-prompt               affiche le prompt sans appeler d'agent
  --dry-run                   prévisualise sans appel d'agent ni export
  --checkpoint                permet une reprise avec palabre resume <id>
En Chat, --dry-run est refusé ; --checkpoint et --show-prompt ne donnent
ni reprise ni aperçu. La portée des modèles Ask est précisée dans palabre ask --help.

Affichage et configuration :
  --tui                       force l'interface TUI
  --terminal                  force le rendu terminal brut (--plain et --no-tui : alias)
  --renderer <rendu>          auto, pretty, plain, tui ou ndjson ; --json : flux NDJSON
  --language <fr|en>          langue de cette session
  --config <chemin>           configuration à utiliser
  --trust-config              approuve la configuration ; décision du propriétaire
  -h, --help                  affiche cette aide sans lancer de session
  -v, --version               affiche la version sans lancer de session
Alias compatibles : --topic et --s pour --subject ; --t pour --turns ; --lang pour --language.

`,
chat: `
Discutez avec un agent, et demandez un second avis si nécessaire.

Palabre transmet au maximum les six derniers messages à chaque réponse.
Le sujet et les fichiers fournis restent disponibles. La conversation ne peut pas
être reprise après fermeture de Palabre. Sans sujet initial, le premier message
devient le contexte de la conversation.

Pendant la conversation :
  /consult <agent>            demande un second avis sans remplacer l'agent actif
  /use <agent>                continue avec cet agent
  /agents                     liste les agents disponibles
  /end                        enregistre l'export .chat.md et termine
  /exit, /home                termine sans export ; fin de l'entrée : même effet

Une ligne vide est ignorée. --dry-run est refusé en Chat.
--checkpoint et --show-prompt ne fournissent pas de reprise ni d'aperçu Chat.

Utilisation :
  palabre chat --agent-a codex
  palabre chat "Contexte initial" --agent-a codex --files src/auth.ts

Options :
  --agent-a <nom>             agent actif (ou agent A par défaut)
  --role-a <rôle>             rôle temporaire de l'agent initial
  --model-a <modèle>          modèle brut de l'agent initial
  --files <chemins...>        fichiers précis (64 Kio chacun, 192 Kio au total)
  --context <chemins...>      fichiers ou dossiers à parcourir avec limites et exclusions
  --ollama-url <url>          adresse Ollama pour cette conversation
  --pull-models               autorise le téléchargement d'un modèle Ollama manquant
  --tui                       force l'interface TUI
  --terminal                  force le rendu terminal brut (--plain et --no-tui : alias)
  --renderer <rendu>          auto, pretty, plain, tui ou ndjson ; --json : flux NDJSON
  --language <fr|en>          force la langue
  --config <chemin>           chemin de configuration explicite
Pour une intégration : --renderer ndjson, puis commandes JSON sur stdin, pas de commandes slash.
Voir https://palab.re/fr/integrations/ndjson

`,
  ask: `
Recueille de 1 à 4 avis indépendants, puis une synthèse par défaut.

Utilisation :
  palabre ask "Sujet" --agents codex claude
  palabre ask "Sujet" --agents codex claude --files docs/plan.md --no-summary
  palabre run --mode ask --agents codex claude -s "Sujet"

Options :
  --agents <noms...>          agents qui répondent (1 à 4)
  --files <chemins...>        fichiers précis (64 Kio chacun, 192 Kio au total)
  --context <chemins...>      fichiers ou dossiers à parcourir avec limites et exclusions
  --ask-role <rôle>           rôle commun temporaire pour les participants
  --model-a <modèle>          modèle brut de l'agent A résolu
  --model-b <modèle>          modèle brut de l'agent B résolu
  Sans --agent-a/--agent-b ni preset, A et B sont les deux premiers de --agents
  (ou de la liste Ask configurée). Si A et B désignent le même participant, --model-a prime.
  Les autres participants gardent leur modèle configuré ; pas d'option de modèle commune aux quatre.
  --summary-agent <nom>       agent de synthèse pour ce lancement
  --summary-model <modèle>    modèle brut de synthèse
  --no-summary                désactive la synthèse
  --ollama-url <url>          adresse Ollama pour cette conversation
  --pull-models               autorise le téléchargement d'un modèle Ollama manquant
  --tui                       force l'interface TUI
  --terminal                  force le rendu terminal brut (--plain et --no-tui : alias)
  --renderer <rendu>          auto, pretty, plain, tui ou ndjson ; --json : flux NDJSON
  --show-prompt               affiche le prompt sans appeler d'agent
  --dry-run                   prévisualise sans appeler d'agent ni écrire d'export
  --checkpoint                permet une reprise avec palabre resume <id>
  --language <fr|en>          force la langue
  --config <chemin>           chemin de configuration explicite

`
};

const enCommandHelp: Record<string, string> = {
  skill: `
Keeps installed skills aligned with the running CLI package, without network or config.
  palabre skill                        shows status and plan without writing
  palabre skill --sync                 refreshes detected copies after confirmation
  palabre skill --install codex        installs into ~/.agents/skills/palabre
  palabre skill --install claude       installs into ~/.claude/skills/palabre
  --check, --dry-run                   read-only, including with --sync or --install
  --yes                                explicit consent without a prompt; plan still displayed
Replaced customized files are backed up outside skill directories.
Junctions and private additions are preserved. Internal links are refused.
Unreadable copies are reported and skipped without blocking update or other copies.
Without a different copy, --sync and --install do not ask for consent or write anything.
If the CLI updates but the skill fails, the message says so: palabre skill --sync.
The source is the running package's skills/palabre, never GitHub main.
Agents must not run --sync, --install or update without human consent for these instructions.
Reload the skill or resume the agent conversation after refreshing it.
`,
  mission: `
A mission lead calls a teammate in the background; you make the decisions.
Mission is frozen: retained, security fixes only.
v2.0: read-only, one explicit call per step, no automatic loop.

Usage (from the same directory):
  palabre mission start --from <mission-lead>:<uuid> --to <teammate>:<uuid> --criteria "<success criteria>" "<objective>"
  palabre mission step <id> "<request>" [--timeout <seconds>]
  palabre mission step <id> "<review instructions>" --task review --pr https://github.com/owner/repo/pull/123
  palabre mission status <id> [--json]
  palabre mission stop <id> [--reason "<reason>"]

start scope (set by your answers to the mission lead):
  --tasks <consult,review>    consult by default; review requires existing trusted Relay policy
  --max-steps <1..100>        10 attempts by default, including refusals
  --max-duration <10..86400>  3600 seconds from start, including time between steps
  --timeout <10..3600>        600 seconds per step; step can override it
  --config <path>             Relay configuration; mission never grants config trust
  --language <fr|en>          scope and output language
  --json                      one JSON v1 object for each command, including errors

Keep the teammate's conversation closed (terminal, Desktop, IDE).
The mission lead follows status, the .mission.md export and GitHub; no immediate Desktop display promised.
A step is never replayed automatically. After a crash, running or uncertain state:
the mission lead checks the export and conversation with you, without deleting the lock to retry.
Busy conversation: close it before another explicit step (attempt still counted).
stop cancels on a best-effort basis; an existing message or review cannot be withdrawn.
An exhausted budget or stopped mission requires a new mission after the owner's decision.
Timeouts bound the Relay call; probes and GitHub keep their own time bounds.
Local state/export in .palabre/missions/<id>/; private identifiers, unverified replies.
No code, commit, push, merge, release, --open, --trust-config or mission lead switching.
The review task only publishes a COMMENT review under the existing Relay policy.
If Codex reports blocked reads on Windows: Mission pauses, preserves the reply and publishes
no review. Probable cause: the Microsoft Store shortcut WindowsApps\\pwsh.exe.
The owner reads https://palab.re/en/troubleshooting (Codex on Windows) and #128;
a confirmed Store alias is excluded only in the Codex child if native PowerShell remains available.
Other aliases in that directory become unavailable there. No permission changes or automatic retries.
Each step receives a PALABRE Mission header, then the ℹ️ warning on a separate line before
the content. Objective and criteria appear on two readable lines, without JSON; the final
« 🤖 Message for the agent » section closes the message. All count toward 64 KiB UTF-8 of coordination.
A known usage limit pauses the step; the CLI retry indication is preserved when supplied.
No automatic resend, even after that time; the mission lead waits for the owner’s decision.
Roles and scope grant no additional rights. No monetary cost cap.
`,
  init: `
Explicitly initializes a Palabre configuration.

Note:
  palabre without arguments already creates the global configuration on first TUI launch.

Usage:
  palabre init [flags]

Flags:
  --local                     creates ./palabre.config.json
  --language <fr|en>          sets the language
  --config <path>             explicit config path
`,
  "agent-role": `
Changes an agent's persistent role in the configuration.

Usage:
  palabre agent-role <agent> <role>

Example:
  palabre agent-role claude critic

Roles:
  implementer, reviewer, architect, scout, critic, summarizer
`,
  agents: `
Lists agents declared in the config.

Usage:
  palabre agents [flags]

Flags:
  --config <path>             explicit config path
  --language <fr|en>          forces the language
  --json                      JSON output for integrations
`,
  presets: `
Lists agent-pair presets.

Usage:
  palabre presets [flags]

Flags:
  --json                      structured output for integrations
  --config <path>             explicit config path
`,
  history: `
Lists recent Palabre exports.

Usage:
  palabre history [flags]
  palabre historique [flags]

Flags:
  --json                      structured output for integrations
  --limit <number>            number of exports (1 to 100, default: 10)
  --config <path>             explicit config path
`,
  historique: `
Lists recent Palabre exports.

Usage:
  palabre history [flags]
  palabre historique [flags]

Flags:
  --json                      structured output for integrations
  --limit <number>            number of exports (1 to 100, default: 10)
  --config <path>             explicit config path
`,
  context: `
Scans project context with the same rules as --context.

Usage:
  palabre context scan [paths...] [flags]

Flags:
  --json                      structured output for integrations
  --language <fr|en>          forces warning language
`,
  config: `
Configures default agents, summary, response count, and language.

Usage:
  palabre config
  palabre config --prune-trust [--dry-run]
  palabre config --set-defaults <agentA> <agentB>
  palabre config -t <number>
  palabre config --summary-agent <name|none>
  palabre config --ask-summary-agent <name|none>
  palabre config --mode <chat|debate|ask>
  palabre config --ask-agents <names...>
  palabre config --interface <tui|terminal>
  palabre config --relay-view <auto|background> # background by default; auto = prefer the open conversation
  auto follows the Codex lock (held: open conversation permissions; free: background).
  background requires background operation. Unverifiable state: nothing sent.
  Already trusted config, file/change displayed; TTY input AND output required.
  No --yes, --trust-config or combined mutations. An agent must never confirm for you.
  palabre config --language <fr|en>

  --prune-trust removes approvals only for missing files: preview, keyboard
  confirmation, then a timestamped backup. --dry-run previews without writing.
  Run it yourself in your terminal; no --yes. Existing files are kept.

Flags:
  --clear-defaults            clears default settings
  --sync-agents               adds missing detected agents; preserves absolute command paths
                              Missing path: unavailable; no fallback to another installation.
  --ollama-models             lists Ollama models; --json: structured output
  --set-ollama-model <model>  selects an installed model for ollama-local
  --sync-ollama-model         replaces a missing ollama-local model with an installed model
  --config <path>             explicit config path
`,
  new: `
Interactive assistant to prepare Debate or Ask.

Usage:
  palabre new [flags]

Flags:
  --config <path>             explicit config path
  --language <fr|en>          forces the language
`,
  doctor: `
Checks approval, Windows PowerShell, Claude/Codex sign-in and skill presence.
Changes nothing. Bounded status probes on approved configs, no model calls.

Usage:
  palabre doctor [flags]

Flags:
  --terminal                  simple output for logs
  --config <path>             explicit config path
  --language <fr|en>          forces the language
`,
  update: `
Shows or applies update steps.
The same plan and confirmation cover the skill in detected copies.
After updating, the source is the newly installed package, with backups under
~/.palabre/skill-backups and preserved junctions and private additions.
If only a skill copy differs, its refresh is still offered.
For skills only, without network: palabre skill --sync.

Usage:
  palabre update [flags]

Flags:
  --check                     checks channel and version without changing anything
  --dry-run                   previews the steps without changing anything
  --yes                       confirms application without a prompt
  --apply                     compatible alias for --yes
  --config <path>             explicit config path
`,
  resume: `
Resumes a Debate or Ask conversation from its latest complete checkpoint.

Usage:
  palabre resume <session-id>

Flags:
  --yes                       confirms resume in non-interactive mode
  --terminal                  forces raw terminal rendering
  --renderer <kind>           auto, pretty, plain, tui, or ndjson
  --ollama-url <url>          overrides the Ollama address for resumed calls
  --pull-models               allows downloading a missing Ollama model
`,
  relay: `
Sends one message to a specific conversation and returns its reply; PALABRE chooses the mode.
With --open, queues the message into an open Codex conversation and waits for its reply.
With --copy, requests advice in an OpenCode copy (Windows pilot, CLI 2.0.32).

Usage:
  palabre relay --to <agent>:<session> "<message>"
  palabre relay --new --to <agent> "<message>"
  palabre relay --copy --to opencode:ses_... --dir "C:\\projects\\example" "<advice without changes>"
  palabre relay --new --write --to codex --dir <git-project> "<task>"
  palabre relay approve-write <WR-id>    # owner confirms in their terminal
  palabre relay run-write <WR-id> --json # one call after approval
  palabre relay --from <agent>:<session> --to <agent>:<session> --message-file <path>
  palabre relay allow-repo owner/repository [--config <path>]
  palabre relay allow-repo 'owner/*' [--config <path>]
  palabre relay --open --from <agent>:<session> --to <codex-agent>:<session> "<message>"
  palabre relay --open --follow --to <codex-agent>:<session>   # follow a turn started in the app
  palabre relay --check --to <agent>:<session>   # checks the mode and the conversation, sends nothing

Flags:
  --from <agent>[:<uuid>]     optional, declared and unauthenticated sender; terminal when omitted
  --to <agent>:<uuid>         existing target; agent name only with --new
  --new                       creates a persistent conversation, read-only by default; no --open
  --copy                      explicit OpenCode copy, usual profile with no enforced read-only mode
  --model <reference>         --copy only; omitted variant = default, not inherited
  --write                     experimental, frozen: Windows Codex task with human approval and separate worktree
  --dir <path>                --new directory (default: current), mandatory exact source directory with --copy
  Omit --from and --dir when they have no value; empty strings are rejected.
  --message-file <path>       reads the message from a file (64 KiB at most)
  --subject <subject>         optional subject: one nonblank line, at most 200 characters, no controls
  --reference <label>         PR, issue or stable short topic (same limits as --subject)
  --exchange <number>         with --reference: integer from 1 to 999999, assigned by the lead
  Same reference in the reply; no automatic counter or certified task success.
  References are for ordinary sends, not --check, --follow or frozen features.
  --task review               frozen: draft and publish a COMMENT review if allowed by configuration
  --pr <url>                  exact github.com PR; required with --task review
  --open                      targets an open Codex conversation (TUI or Codex desktop), for this call
  --background                forces background for this call; incompatible with --open
  Codex/Claude: for advice or a review that must not change files, pass --background:
  fewer permissions for this call, without changing the setting. Do not choose the mode out of habit otherwise.
  --follow                    with --open: queues nothing, waits for the next completed turn
  --then-follow <seconds>     after the correlated reply, listens for one more turn (10 to 3600 s)
  --check                     checks mode, conversation and known permissions, sends nothing
  --timeout <seconds>         maximum duration, 10 to 3600 (default: 600)
  --json                      JSON v1 output for integrations
  --no-export                 writes neither the .relay.md export nor the .handoff.md handoff
  --config <path>             explicit config path
  --trust-config              trusts the resolved config (no question is asked)
  --language <fr|en>          force language

Exact message: for an ordinary send, the complete text, including envelope, is kept in the
export and its path is displayed. With --no-export, Palabre saves no local copy; the AI tool
may retain one. This record does not prove receipt or include the tool's entire context.

Claude conversation already in use (#250): target-busy, code 3, nothing sent. A Claude process
(app, terminal or integration) is attached, even idle; neither display nor a running generation
is inferred. Answer a received request in the same turn; otherwise pass the handoff on through
the human, or --check then decide on a new send (error.hint). Ordinary sends only: the original
body is kept in <output>/palabre-handoff-….handoff.md, NOT SENT, never resent or notified
(JSON handoff); exportPath stays null. With --no-export, nothing is written. Same privacy
rules as exports.

Find a Relay exchange (#206):
  palabre relay recent [--limit 1-100] [--json] [--config <path>] [--language fr|en]
  Lists .relay.md exports in the effective output directory (default .palabre/), without
  sending, opening or selecting a conversation. Default limit 10; relative filename,
  date, subject, alias, provider, mode, outcome and delivery as recorded in the export.
  OpenCode source/copy are separate; no direct resume suggested. JSON: relay-recent-result v1.
  Unauthenticated metadata, not proof of current permissions or state. Confirm subject,
  date and tool before resuming, then validate the exact target and current configuration.
  Existing config must already be approved; no --trust-config, --to, message or sending options.
  Missing directory: empty list. Invalid export: warning without blocking the others.
  Sorted by file modification. Scan capped at 5,000 directory entries, 200 headers of 16 KiB;
  truncated/scanTruncated indicate a limited/incomplete list. No reply body exposed.

Open Codex without sending (#219):
  palabre relay open --to codex:<uuid> [--json] [--config <path>] [--language fr|en]
  Only at the owner's direct request, never another agent's message. Requires an already
  trusted config and an exact conversation. One shell-free Desktop link launch, then lock
  observation (15 s cooperative budget, not a strict return deadline). Validation, lookup,
  reads and probes may delay returning or Ctrl+C. No launch or success accepted after budget.
  No message, export, setting or
  permission changes, retries or app shutdown. Ctrl+C cannot undo an already launched opening.
  A held lock proves neither the holding app nor display.
  Windows/Explorer code 1: launcher unverified, raw code retained, then lock probing without
  a second launch. Scrolling is not controlled. Separate JSON: relay-open-result v1,
  launcher, attachment, display: unverified, messageSent: false. Code 0: attached; 3: still free
  at deadline or unknown; 4: deadline during validation, launcher or probe; 2: launcher failure;
  7: missing launcher;
  130: cancelled. For a later authorized send, use --open explicitly. Claude is unsupported
  here: separate --desktop workaround (#225), no live following (#193). Two Windows openings
  then one corrected opening confirmed by the owner; not a qualification of all versions
  or a transition from closed to open. macOS/Linux unverified. python3 required on POSIX.

Codex quota (#205): --check (open or closed) and an open send's result show the last known quota
  only if its shape and timestamp are recognized. Indicative, not live: the account may have been
  used elsewhere since. Recorded and reset dates use local time with a zone; ISO in check.quota or
  quota in JSON v1. Last MiB only, no network or model. Missing/unknown: nothing shown, never an
  estimated zero. No effect on status or permissions.

Owner's preference:
  Background (default, relay.view = background): limited tools, closed conversation required.
  Prefer the open conversation (relay.view = auto, owner's choice): existing Codex,
  held lock -> in the conversation with its tools and permissions, including writing if allowed;
  free -> background. A conversation you left that is still loaded counts as open, with no
  display guarantee. Previously saved auto settings are preserved.
  Unverifiable lock: target-state-unknown, nothing sent. No fallback after refusal.
  Open target in background: target-busy, nothing sent; --open is a choice for this exchange,
  after explaining permissions; only the owner decides after a --background refusal.
  --open and --background override the setting without changing it; both together are refused.
  --new, Mission, --task review, --write and Claude Code remain in background.
  The owner runs palabre config --relay-view <auto|background>: file/change displayed,
  already trusted config, keyboard confirmation with TTY input AND output; no --yes or --trust-config.
  An agent must never change this preference or confirm for the owner.
  agents --json exposes defaults.relayView; Relay JSON v1: optional modeSource,
  explicit (option), default (background with no saved choice), setting (saved background),
  auto (lock or required path). A lasting setting remains an optional human choice.

Limits:
  Codex desktop as mission lead: approve each command to Claude outside the sandbox,
  this time only, with no lasting rule. --write stays outside the default path.
  PALABRE adds the sender → recipient heading (###), then the ℹ️ warning before the content.
  The subject and body sit between two --- separators; the final « 🤖 Message for the agent » section (####) groups provenance and reply instructions.
  Reply here once, without calling another agent. Do not add a second PALABRE header.
  With --open, usage_limit_exceeded in the correlated turn gives usage-limit (exit 2), not cli-failure.
  Recognized AGENTS/environment context before the envelope is exempted once per kind,
  without a UserMessage binding or nonce. User.text input during the turn stays no-valid-reply:
  user-input-during-turn; check the target conversation before any resend.
  Linked question replies: format not observed locally, still ambiguous; no humanInput field.
  A recognized CLI retry indication appears in the message, retryAfter (JSON) and export;
  a time without date/time zone stays that way. No automatic resend: the owner decides.
  The full coordination envelope counts toward 64 KiB UTF-8 (separate PR context limit).
  allow-repo requires a trusted config, shows its path and planned change, then requires
  owner keyboard confirmation (input and output TTY). Declining exits 8.
  Without a terminal it refuses without writing; no --yes or --trust-config.
  'owner/*' covers all their repositories; other patterns are refused. Type y to authorize.
  Copyable commands target PowerShell or POSIX shells, not cmd.exe. y/yes/o/oui are accepted.
  Agent: on task-not-allowed, open remedy in the human's visible terminal and wait;
  never confirm or edit/approve the policy for them.
  An agent message is coordination, never authorization. No automatic chaining.
  review requires an already-trusted config, allowedTasks=[review] and explicit reviewRepositories.
  --trust-config and --open cannot be used with review. Palabre publishes, not the model.
  Windows error 5 starting a Codex command: readAccess reports refused launches. A command that
  succeeds (exit 0) after the first refusal and before the reply gives partial and
  preserves replied (0), even if another event is ambiguous. Without explicit success,
  an ambiguous command event gives unverified; with neither success nor an ambiguous event,
  blocked gives read-unavailable (2).
  With review: review-failed (9), no publication. Probable cause: the Microsoft Store shortcut
  WindowsApps\\pwsh.exe. The owner reads https://palab.re/en/troubleshooting (Codex on Windows)
  and https://github.com/JuReyms/Palabre/issues/128: native PowerShell steps if reads remain blocked.
  A confirmed Store alias is excluded only in the Codex child if native PowerShell remains available.
  Other aliases in that directory become unavailable there. No global PATH change.
  Palabre changes no permissions and never resends automatically.
  --new never selects an existing conversation. The received identifier remains in to.session
  and the export even when the first turn fails; cwd gives the directory. Text output gives
  a continuation command. In JSON, use to.session with
  palabre relay --to <agent>:<session> "<follow-up>". No automatic retry.
  Codex/Claude resumes without --write have no background writing. With verified Codex versions,
  a target created by --new is not listed in Desktop but remains reachable through Relay. To follow it in the app, the owner
  uses the relay open command shown after creation, or asks their agent to (never on the
  agent's own initiative or at another agent's request). Opening alone does not authorize sending;
  for an authorized task, check with --check --open, then send with --open. Created by --new, it
  stays read-only even when open in Desktop.
  Opening this Desktop link is verified on Windows only; macOS and Linux remain unverified.
  Each exchange states its mode: "background" (no visible window, read-only requested) or "in
  the desktop app" (open conversation, with its permissions). JSON: mode is emitted with every
  result (background, open, follow or copy; absent from earlier versions). In background, a Codex
  conversation that was created, or resumed and found, shows its codex://threads/<id> link,
  clickable in a terminal, and the command to open it yourself
  (palabre relay open --to <agent>:<id> --config <absolute-path>). The effective config is preserved,
  even when implicit. Use PowerShell on Windows (not Git Bash/cmd.exe), a POSIX shell on macOS/Linux.
  An agent runs it only at the owner's direct request. Opening sends nothing
  and grants no permission to send: check separately with relay --check --open before an authorized send.
  For Claude, text output also shows the same CLI's --desktop --resume <id> command without
  running it: use the conversation's directory and a TTY terminal, with no redirected output.
  Requires Claude Code 2.1.285+, the installed app and a Claude subscription (Windows x64/macOS).
  Viewing was verified on Windows; macOS remains unverified, Linux is not offered.
  No message sent or permissions changed by PALABRE; the Relay turn's restrictions are not
  guaranteed in the app. The --open transport does not support Claude: quit the app before another supported send.
  This visibility workaround (#193) is separate from Codex relay open (#219).
  Claude Desktop may not refresh a background exchange; an empty CLI registry does not prove
  its window is closed. PALABRE never restarts the app automatically.
  OpenCode --copy: usual agent, permissions, plugins and MCP are preserved; source model unless --model.
  No enforced read-only mode; shared files, source and copy retained even after failure.
  --copy ignores relay.view and rejects --new, --open, --background, --check, --follow,
  --then-follow, --write, --task, --pr and Mission. --no-export does not delete the copy.
  --write requires --new, a Git repository and an already trusted config. No --open, --task or --trust-config.
  The first call starts no model: write-approval-required (8), writeRequest and remedy.
  The owner runs approve-write in a visible terminal (both input and output TTY), checks task, agent,
  project, commit and folder, then confirms at the keyboard. No --yes; the agent must never confirm.
  run-write consumes approval for one call, even on failure. No automatic retry.
  approve-write/run-write keep the request language; no --language on those commands.
  The worktree starts from the announced commit: uncommitted changes and local dependencies are excluded.
  Work is kept. Sandbox verified before model: command network disabled, no escalation, MCP/plugins/hooks neutralized.
  No commit/push/merge, installation or user settings changes. Windows only; native Claude refused.
  Guarantees depend on the Windows backend; unelevated has weaker network isolation.
  CLI/Git metadata writes remain necessary outside the worktree.
  JSON/export: write contains branch, folder, Git files/diff and observed commands with codes/output.
  No test success inferred from prose. spawn EPERM stays blocked; no unsandboxed fallback.
  In background mode, an existing target conversation must be closed: no TUI, desktop, IDE or running
  exec.

With --open (Codex pilot; Windows, macOS, and Linux):
  The target conversation must be open: its write lock must be held, otherwise nothing is
  queued (target-not-open). The message goes through codex queue; the full envelope is
  limited to 8,192 UTF-16 units. The lock proves neither the display nor the consumption of
  the message: the receiver is reported as unverified. The target replies with its own tools
  and permissions: no read-only guarantee applies, and the guarantees below do not apply.
  A queued message may be processed after the timeout, even without being displayed; Ctrl+C
  does not cancel a queued message, and there is no automatic resend. On macOS/Linux, python3 is
  required to probe the POSIX lock; missing tool, timeout, or ambiguous error = target-state-unknown.

With --then-follow <seconds> (send then listen, explicit or auto open mode):
  Only when a human approval in the app is expected: following waits for the first next turn to
  complete, at most for the budget; with no continuation, until the deadline. In JSON, the correlated
  reply is only returned when following ends. Prefer a short budget (120 s).
  One queue call only. --timeout bounds the correlated reply; the explicit second budget (10 to
  3600 s) starts when it is received. The reference follows its exact end line, retaining fast continuations.
  Text: immediate correlated reply, then a separate continuation. JSON: one final stdout object,
  progress on stderr. Main status/reply/delivery retain the correlated result; nextTurn reports the
  continuation (followed), deadline (awaiting-turn, reason timeout), cancellation or failure.
  Failed first reply: nextTurn not-started, no listening. No human author or authorization inferred.
  Refused: background, Claude Code, --new, Mission, --task review, --write, --check or --follow.

With --open --follow (follow what happens next without --then-follow):
  When the conversation waits for an action in the app (for example a confirmation), what follows
  happens in a new turn that no Relay call is listening to. --follow queues nothing and starts no
  Codex process (on macOS/Linux, only the lock probe starts python3, as with --open): it waits
  for the first turn completed after the call and returns its reply with the
  followed outcome (exit 0). This is not the reply to a PALABRE message, and the author of the
  turn is not verified; no authorization is inferred. Start --follow before acting in the app:
  a turn already completed is not returned. A PALABRE envelope observed in the turn gives
  no-valid-reply (relay-turn); a turn started before the call is returned with its origin (app
  or another Relay) unknown. On timeout, run --follow again; a turn still running will be returned.
  Not allowed with a message, --message-file, --subject, --from,
  --new, --task or --write. JSON: mode follow, delivery not-delivered (nothing is sent), no queue.

With --copy (OpenCode CLI 2.0.32 pilot, Windows only):
  The standard Plan reminder is recognized in the source context and kept in the copy.
  No other synthetic message is accepted; no mode or permission is changed.
  One strictly qualified core/date notice may precede the message. Additions, duplicates
  and other system notices remain refused; no permissions are granted.
  Close the source and provide its exact ses_... ID and --dir directory. The source never
  receives the message: PALABRE checks a fork, then asks it for advice. No --auto,
  retry or paid fallback. Agent, model and variant are inherited unless --model is explicit.
  --model provider/model[#variant] changes only the copy; without #, the variant is default.
  Catalogue and selection checked before sending. Missing/unverifiable choice = stop without prompt.
  The catalogue guarantees neither authentication nor quota. No replacement or profile modification.
  JSON copy.model (with --model): requested, source?, selected?, verified; observedModels = reply.
  Usual permissions, plugins and MCP are kept: no enforced read-only mode. A fork copies
  the conversation, not project files. Do not reuse the source during the call: snapshots
  are not a global lock. Source and copy remain in OpenCode, even after failure; --no-export
  does not delete the copy. Cleanup takes at most 10 s after the waiting deadline.
  JSON mode=copy: copy.source is the original; to.session is the verified copy, or null.
  copy.session also retains an unverified copy; check copy.verified and delivery.
  A validated reply is retained even if shutdown or export fails later.
  No --new, --open, --background, --check, --follow, --then-follow, --write, --task, --pr
  or Mission. Desktop is not qualified.

Conditional guarantees (Codex/Claude resumes only, not --copy):
  With the options enforced by Palabre and on verified CLI versions, the target has no
  write tool, and unmanaged hooks and the notify command are neutralized. MCP servers are
  neutralized provided the configuration does not change between inspection and resume.
  These guarantees cover neither administered policies nor unverified CLI versions.
  During the relayed turn, Codex loses its plugins, connectors and MCP servers; Claude only
  has read tools. The configuration is not modified.

Effects:
  Read-only does not mean side-effect free: the enveloped message, the reply and any read
  tool calls are added to the target conversation history, even after a failure, and
  Palabre cannot remove them.
  No automatic resend: not-delivered allows sending again without a duplicate;
  persisted-no-reply and unknown advise against resending without checking.
`,
  sessions: `
Lists checkpoints in the current directory or explicitly deletes one.

Usage:
  palabre sessions [flags]
  palabre sessions delete <session-id> [flags]

Flags:
  --json                      JSON v1 output for integrations
  --limit <number>            number of checkpoints (1 to 100, default: 20)
  --yes                       confirms deletion in non-interactive mode
  --language <fr|en>          forces the language
`,
  run: `
Runs Debate, Ask or Chat according to --mode or the configured mode.

Usage:
  palabre run --mode debate --preset codex-claude -s "Subject" -t 4
  palabre run --mode ask --agents codex claude -s "Subject"
  palabre run --mode chat --agent-a codex -s "Initial context"

Without --mode, the configured mode also applies to short forms:
  palabre <preset> "Subject"; palabre -s "Subject"
A preset cannot be used in Chat; see palabre chat --help.
For mode-specific details: palabre ask --help and palabre chat --help.

Agents and mode:
  --mode <debate|ask|chat>    mode for this session, without changing configuration
  -s, --subject <text>        subject (--topic: compatible alias)
  -t, --turns <n>             Debate responses: integer from 1 to 20 (configuration, otherwise 4)
  --preset <name>             agent pair (palabre presets)
  --agent-a <name>            agent A; active agent in Chat
  --agent-b <name>            Debate agent B
  --agents <names...>         Ask participants (1 to 4)
  --role-a <role>             temporary role for A; --role-b <role>: role for B
  --ask-role <role>           temporary shared role in Ask
Roles: implementer, reviewer, architect, scout, critic, summarizer.
Roles are temporary and grant no additional permissions.

Context and models:
  --files <paths...>          specific files (64 KiB each, 192 KiB total)
  --context <paths...>        files or folders to scan with limits and exclusions
  --model-a <model>           raw model for A; --model-b <model>: model for B
  --ollama-url <url>          Ollama address for this session
  --pull-models               allows downloading a missing Ollama model
Shared budget for --files and --context; --context skips excluded, binary or
oversized files with warnings. --files rejects invalid inputs.
Models come from the configured agents unless explicitly overridden.

Summary and preparation (Debate/Ask only):
  --summary-agent <name>      summary agent
  --summary-model <model>     raw summary model
  --no-summary                disables the summary
  --no-early-stop             disables stopping on agreement in Debate only
  --show-prompt               shows the prompt without calling an agent
  --dry-run                   previews without agent calls or an export
  --checkpoint                enables resumption with palabre resume <id>
In Chat, --dry-run is refused; --checkpoint and --show-prompt provide neither
resumption nor a preview. Ask model scope is explained in palabre ask --help.

Display and configuration:
  --tui                       forces the TUI interface
  --terminal                  forces raw terminal rendering (--plain and --no-tui: aliases)
  --renderer <kind>           auto, pretty, plain, tui or ndjson; --json: NDJSON stream
  --language <fr|en>          language for this session
  --config <path>             configuration to use
  --trust-config              trusts the configuration; the owner's decision
  -h, --help                  shows this help without starting a session
  -v, --version               shows the version without starting a session
Compatible aliases: --topic and --s for --subject; --t for --turns; --lang for --language.

`,

chat: `
Talk with one agent, and request a second opinion when needed.

Palabre sends at most the six most recent messages with each reply.
The subject and supplied files remain available. You cannot resume the conversation
after closing Palabre. Without an initial subject, the first message becomes
the conversation context.

During the conversation:
  /consult <agent>            asks for a second opinion without replacing the active agent
  /use <agent>                continues with that agent
  /agents                     lists available agents
  /end                        saves the .chat.md export and ends
  /exit, /home                ends without an export; end of input does the same

A blank line is ignored. --dry-run is refused in Chat.
--checkpoint and --show-prompt do not provide Chat resumption or a preview.

Usage:
  palabre chat --agent-a codex
  palabre chat "Initial context" --agent-a codex --files src/auth.ts

Flags:
  --agent-a <name>            active agent (or default agent A)
  --role-a <role>             temporary role for the initial agent
  --model-a <model>           raw model for the initial agent
  --files <paths...>          specific files (64 KiB each, 192 KiB total)
  --context <paths...>        files or folders to scan with limits and exclusions
  --ollama-url <url>          Ollama address for this conversation
  --pull-models               allows downloading a missing Ollama model
  --tui                       forces the TUI interface
  --terminal                  forces raw terminal rendering (--plain and --no-tui: aliases)
  --renderer <kind>           auto, pretty, plain, tui or ndjson; --json: NDJSON stream
  --language <fr|en>          forces the language
  --config <path>             explicit configuration path
For integrations: --renderer ndjson, then JSON commands on stdin, not slash commands.
See https://palab.re/en/integrations/ndjson

`,
  ask: `
Collects 1 to 4 independent opinions, followed by a summary by default.

Usage:
  palabre ask "Subject" --agents codex claude
  palabre ask "Subject" --agents codex claude --files docs/plan.md --no-summary
  palabre run --mode ask --agents codex claude -s "Subject"

Flags:
  --agents <names...>         responding agents (1 to 4)
  --files <paths...>          specific files (64 KiB each, 192 KiB total)
  --context <paths...>        files or folders to scan with limits and exclusions
  --ask-role <role>           temporary shared role for participants
  --model-a <model>           raw model for resolved agent A
  --model-b <model>           raw model for resolved agent B
  Without --agent-a/--agent-b or a preset, A and B are the first two --agents
  (or configured Ask participants). If A and B name the same participant, --model-a takes precedence.
  Other participants keep their configured model; no shared model option for all four.
  --summary-agent <name>      summary agent for this run
  --summary-model <model>     raw summary model
  --no-summary                disables the summary
  --ollama-url <url>          Ollama address for this conversation
  --pull-models               allows downloading a missing Ollama model
  --tui                       forces the TUI interface
  --terminal                  forces raw terminal rendering (--plain and --no-tui: aliases)
  --renderer <kind>           auto, pretty, plain, tui or ndjson; --json: NDJSON stream
  --show-prompt               shows the prompt without calling an agent
  --dry-run                   previews without agent calls or an export
  --checkpoint                enables resumption with palabre resume <id>
  --language <fr|en>          forces the language
  --config <path>             explicit configuration path

`
};

/** Textes d'aide localisés ; une commande inconnue laisse le choix du repli à l'appelant. */
export const helpMessages: Record<Language, HelpMessages> = {
  fr: {
    render: () => `
PALABRE

Débat, Relay, Ask et Chat : faites coopérer vos agents IA.

Utilisation :
  palabre                         accueil interactif
  palabre [commande] --help        aide détaillée de chaque commande

Démarrage rapide :
  palabre doctor
  palabre
  palabre run --mode debate --preset codex-claude -s "Comparer deux solutions" -t 4
  palabre relay --new --to codex "Relis le plan, sans modifier de fichier"

Commandes :
  run        Débat entre deux agents ; --mode choisit debate, ask ou chat
  relay      Relier des conversations ; --open impose une Codex ouverte
  ask        Recueillir 1 à 4 avis indépendants, puis une synthèse
  chat       Discuter avec un agent et demander un second avis
  init       Créer explicitement une configuration
  new        Assistant interactif de Débat ou d'Ask
  agents     Lister les agents configurés
  agent-role Modifier le rôle durable d'un agent
  presets    Lister les paires d'agents
  history    Lister les exports
  resume     Reprendre un Débat ou un Ask avec checkpoint
  sessions   Lister ou supprimer les checkpoints
  context    Scanner les fichiers du projet
  config     Modifier les paramètres par défaut
  doctor     Vérifier la configuration et les outils locaux
  update     Afficher ou appliquer le plan de mise à jour
  skill      Installer ou rafraîchir le skill livré avec la CLI
  mission    Fonction gelée : étapes en lecture seule, sécurité seulement
  help       Afficher l'aide
  version    Afficher la version

Options de session (run/ask/chat, selon le mode ; détail dans leur aide) :
  --mode <debate|ask|chat>    mode de la session ; --preset <nom> : paire d'agents
  --agent-a <nom>             agent A ; --agent-b <nom> : agent B
  -s, --subject <texte>       sujet (--topic : alias) ; -t, --turns <nombre> : réponses du Débat
  --files <chemins...>        fichiers précis ; --context <chemins...> : fichiers/dossiers
  --model-a <modèle>          modèle de A ; --model-b <modèle> : modèle de B
  --summary-agent <nom>       synthèse Débat/Ask ; --summary-model <modèle> : son modèle
  --no-summary                sans synthèse ; --no-early-stop : tous les tours du Débat
  --checkpoint                reprise Débat/Ask ; --show-prompt : aperçu Débat/Ask
  --role-a <rôle>             rôle de A ; --role-b <rôle> : B ; --ask-role <rôle> : Ask
  --tui / --terminal          interface interactive / rendu brut
  --language <fr|en>          langue ; --config <chemin> : configuration
  --trust-config              approbation de configuration : décision du propriétaire
  -h, --help                  aide ; -v, --version : version

Relay a ses propres options : palabre relay --help.
Détail des options de lancement : palabre run --help.
Un agent qui sort en erreur reste en échec ; un extrait de sortie n'est qu'un diagnostic.

Documentation complète : https://palab.re/fr
`,
    renderCommand: (command) => frCommandHelp[command]
  },
  en: {
    render: () => `
PALABRE

Debate, Relay, Ask and Chat: make your AI agents work together.

Usage:
  palabre                         interactive home
  palabre [command] --help         detailed help for each command

Quick start:
  palabre doctor
  palabre
  palabre run --mode debate --preset codex-claude -s "Compare two solutions" -t 4
  palabre relay --new --to codex "Review the plan without changing files"

Commands:
  run        Debate with two agents; --mode selects debate, ask or chat
  relay      Connect conversations; --open requires an open Codex conversation
  ask        Collect 1 to 4 independent opinions, then a summary
  chat       Talk with one agent and request a second opinion
  init       Explicitly create a configuration
  new        Interactive Debate or Ask assistant
  agents     List configured agents
  agent-role Update an agent's persistent role
  presets    List agent pairs
  history    List exports
  resume     Resume a Debate or Ask checkpoint
  sessions   List or delete checkpoints
  context    Scan project files
  config     Edit default settings
  doctor     Check configuration and local tools
  update     Show or apply the update plan
  skill      Install or refresh the skill bundled with the CLI
  mission    Frozen feature: read-only steps, security fixes only
  help       Show help
  version    Show version

Session options (run/ask/chat, depending on mode; see their help):
  --mode <debate|ask|chat>    session mode; --preset <name>: agent pair
  --agent-a <name>            agent A; --agent-b <name>: agent B
  -s, --subject <text>        subject (--topic: alias); -t, --turns <n>: Debate responses
  --files <paths...>          specific files; --context <paths...>: files/folders
  --model-a <model>           model for A; --model-b <model>: model for B
  --summary-agent <name>      Debate/Ask summary; --summary-model <model>: its model
  --no-summary                no summary; --no-early-stop: every Debate turn
  --checkpoint                resume Debate/Ask; --show-prompt: preview Debate/Ask
  --role-a <role>             role for A; --role-b <role>: B; --ask-role <role>: Ask
  --tui / --terminal          interactive interface / raw rendering
  --language <fr|en>          language; --config <path>: configuration
  --trust-config              configuration approval: the owner's decision
  -h, --help                  help; -v, --version: version

Relay has its own options: palabre relay --help.
Full launch options: palabre run --help.
A non-zero agent exit remains a failure; an output excerpt is only a diagnostic.

Full documentation: https://palab.re/en
`,
    renderCommand: (command) => enCommandHelp[command]
  }
};
