# Interfaces CLI, TUI et protocoles

Référence de développement extraite d’`AGENTS.md`. Lire [les règles communes](../../AGENTS.md) et ce document avant de modifier l'identité terminal, l'aide, la langue, les renderers ou un contrat JSON/NDJSON. Les chemins de code entre backticks sont relatifs à la racine du dépôt. Les qualifications datées décrivent un essai, pas une garantie pour toutes les versions.

## Identité visible de PALABRE

Le skill demande le libellé de tâche `Palabre <mode> : <objet>` ; seul l'hôte peut l'afficher. `src/cliIdentity.ts` pose tôt `process.title = "palabre <commande>"` avec une commande connue, jamais un sujet utilisateur. Sous Windows, Node utilise aussi le titre natif de la console, même quand les séquences terminal sont désactivées ; le nom d'exécutable peut rester `node.exe` dans les outils système.

Le titre OSC `Palabre · <Mode>` et la sauvegarde/restauration xterm sont réservés à stdout TTY hors `--json` et `--renderer ndjson`, sans `NO_COLOR` ni `TERM=dumb`. `PALABRE_ASCII=1` choisit un titre ASCII, par exemple `Palabre - Debat`. Aucun champ JSON/NDJSON n'est ajouté. Restaurer le nom logique avant de dépiler le titre assure le repli console Windows ; une erreur de décoration ne change pas le résultat CLI. Les modes/langues effectifs mettent le titre à jour, y compris depuis l'accueil TUI. Ne jamais mettre de texte libre dans une séquence de contrôle. Une terminaison forcée ou un hôte imposant son propre titre reste hors garantie.

## Internationalisation

La langue de l'interface CLI est resolue via `src/i18n.ts` avec la precedence suivante :

1. `--language <fr|en>` ou alias `--lang <fr|en>` ;
2. variable d'environnement `PALABRE_LANGUAGE` ;
3. champ racine `language` dans `palabre.config.json` ;
4. fallback `fr`.

`language` controle l'interface Palabre et la langue des prompts envoyes aux agents. Pour le MVP, garder cette regle simple : interface en francais, agents guides en francais ; interface en anglais, agents guides en anglais. Une future option `debateLanguage` ne doit etre ajoutee que si un besoin reel apparait pour decoupler les deux.

L'extension VS Code peut detecter la langue de VS Code et transmettre `--language fr` ou `--language en` au CLI. Garder le contrat CLI limite a `fr|en` tant que les dictionnaires, exports et prompts ne supportent pas officiellement d'autres langues. Les locales VS Code non supportees, par exemple portugais, doivent donc etre mappees cote integration vers une langue supportee, aujourd'hui `en` par defaut.

Decision a garder en tete : `--language <fr|en>` doit etre compris comme une consigne forte pour les agents. Si `--language en` est passe avec un sujet en francais, les agents doivent etre guides pour repondre en anglais ; si `--language fr` est passe avec un sujet en anglais, ils doivent etre guides pour repondre en francais. La detection automatique appartient aux integrations, mais l'application stricte de la langue appartient aux prompts du CLI.

Les messages traduisibles vivent dans `src/messages/`, decoupes par domaine (`common`, `doctor`, `help`, `init`, `agents`, `config`, `presets`, `update`, `preview`, `new`, `renderers`, `context`, `limits`, `orchestrator`, `output`, `adapter-errors`, `prompt`, etc.). Ajouter les nouvelles surfaces par lots coherents plutot que melanger traduction et refactor large. `palabre doctor`, `palabre help`, `palabre init`, `palabre agents`, `palabre config`, `palabre presets`, `palabre update`, `--show-prompt`, `palabre new`, les renderers console, les erreurs/warnings de contexte, les erreurs de limites `--turns`, les notices/erreurs runtime de l'orchestrateur, l'habillage de l'export Markdown, les suggestions et messages d'erreurs adapter (usage-limit, modeles, Ollama), la sortie `palabre config --ollama-models` et les prompts agents sont migres vers le dictionnaire FR/EN. Les adapters resolvent leur langue via `prompt.language` a chaque `generate`.

Toutes les donnees affichees dans un renderer humain doivent passer par
`sanitizeTerminalText` avant d'etre combinees aux couleurs ANSI generees par Palabre. Les sorties
CLI/PTY et Ollama, erreurs HTTP distantes, sujets, noms d'agents, chemins et labels de liens OSC
sont traites comme non fiables. Le nettoyage retire ANSI, OSC, DCS et les controles invisibles,
mais preserve les espaces et retours ligne utiles. `cleanTerminalOutput` ajoute le trim attendu
par les adapters.

## Syntaxe CLI courte

Le parser accepte deux formes equivalentes pour lancer un debat :

```bash
palabre run --preset claude-antigravity --subject "quel jour sommes nous ?" --turns 4
palabre claude-antigravity "quel jour sommes nous ?" -t 4
palabre -s "quel jour sommes nous ?" -t 2
```

`--subject` est le nom long recommande pour le sujet. `-s` est l'alias court, et `--topic` reste accepte pour compatibilite. Si le premier argument positionnel est un preset connu, il devient `--preset`. Le positionnel suivant devient le sujet. Un sujet positionnel doit contenir plusieurs mots ; pour un seul mot, utiliser `-s "mot"` afin d'eviter toute ambiguite avec une commande ou un preset. Une faute qui ressemble fortement a une commande connue (`nex` pour `new`, par exemple) produit une erreur de commande inconnue.

Ces formes courtes suivent le mode effectif, `--mode` puis `defaults.mode`, exactement comme `palabre run` (#104). La décision vit dans `src/launchDispatch.ts` : `isDirectChatLaunch` envoie vers Chat toute commande `run` qui n'ouvre pas l'accueil TUI (`shouldOpenTuiHome`) quand ce mode est `chat`. Le lancement nu garde l'accueil et son mode par défaut. Un preset en mode Chat est refusé avec un diagnostic ciblé (`chat.presetUnsupported`), plutôt qu'ignoré ou signalé comme « mode inconnu ». Les chemins Chat gardent le refus de `--dry-run`.

## Aide CLI

`relay publish --help` décrit le bilan choisi, l’aperçu, la confirmation stdin/stderr TTY et les issues de publication. Contrat JSON v1 distinct `relay-publication-result`, sans délivrance Relay ni succès de tâche déduit. En JSON, aperçu/confirmation sur stderr, objet unique sur stdout ; [contrat et codes](../relay-publication-contract.md).

Relay ordinaire : aide FR/EN pour `--github`, `--participant`, `--no-reply-format`. Le champ optionnel v1 `work` porte un rattachement et un participant déclarés ; exports et `relay recent` le conservent. Aucun accès GitHub ni publication. Une intégration ne déduit ni identité humaine ni autorisation de ces champs ; détails dans le [contrat du contexte de travail](../relay-work-contract.md).

`palabre result --reference <référence> --json` consulte une demande OpenCode batch exacte, sans envoi. Un seul objet `agent-result` v1 porte `status`, `exitCode`, `agent`, `session`, `sent: false`, `error` et, uniquement pour `replied`, `reply`. Codes : 0 réponse, 2 en cours/échec déclaré/illisible, 3 non-correspondance, 7 commande absente, 8 requête invalide, 130 annulation. La référence opaque reste locale ; elle contient l'identité de configuration et la corrélation, jamais le prompt. Les erreurs batch `timeout` gardent leur sens et ajoutent seulement des détails facultatifs : `waitedMs`, `stopRequested`, `localExit`, `remoteWork`, `resent`, `recovery`. Les indications d'attente sont assainies sur stderr, pas dans stdout JSON/NDJSON.

Le champ JSON facultatif `skill` dans agents/check est un diagnostic de révision déclarée, indépendant du résultat métier. Pas de notice humaine répétée lorsque les révisions concordent. `skill --read --json` fournit un seul objet v1 sans habillage terminal ; seules les instructions du paquet sont lues, aucune cible CLI n'est lancée. Le texte ne remplace pas l'autorité humaine ni les garde-fous de l'hôte. Voir [le contrat de lecture du paquet](configuration.md#consignes-relues-dans-la-conversation).

L'aide principale (`palabre -h`, `palabre help`) doit rester minimaliste, inspiree de l'aide Ollama : description courte, usage, demarrage rapide, commandes principales, flags essentiels, lien vers la documentation publique localisee (`https://palab.re/fr` ou `/en`) et mention `palabre [command] --help`.

Ne pas transformer l'aide principale en reference complete. Les details doivent aller dans l'aide de commande (`palabre config --help`, `palabre init --help`, etc.) ou dans la documentation du site.

Rappel du skill (`src/skillNotice.ts`) : après la sortie normale de l'aide et de `--version`, sur stderr seulement, quand stdin, stdout et stderr sont des TTY, hors `--json` et renderer NDJSON. Stdout reste identique. La comparaison réutilise `planSkillSync` avec le skill du paquet exécuté : lecture locale, sans réseau, écriture, configuration, registre de confiance ni agent. Le rappel apparaît seulement si une copie est `different` ou `unreadable`. Sa langue (option, environnement, langue enregistrée via `resolveCommandLanguage`) n'est résolue que si un rappel est affiché. Le texte distingue relecture des consignes par l’agent et synchronisation facultative des fichiers installés ; aucune liste obligatoire de manipulations ou de redémarrages.

En terminal humain, l'accueil TUI ajoute le même texte à sa notice initiale à partir du plan de `getUpdateInfo`, sans nouvelle détection ni remplacement d'une notice existante. Relay et Mission (aiguillés avant), les sessions Chat et les commandes non interactives ne déclenchent aucune inspection supplémentaire pour ce rappel. Une erreur du rappel est ignorée. Pas de postinstall : [npm masque par défaut la sortie de ces scripts](https://docs.npmjs.com/cli/v11/commands/npm-install/#foreground-scripts).

## Rendu Console

Ask (#261), renderers console plain/pretty : après l’écriture réussie de l’export, si des réponses valides précèdent un échec de phase summary, annoncer leur nombre et la synthèse indisponible. L’erreur et le code de sortie non nul sont conservés. Pas de bilan humain dans NDJSON, pas de changement TUI ni de relance ; ne pas annoncer un export si son écriture échoue.

Relay ordinaire (#256) : champ JSON v1 facultatif `desktop` contenant `command` et `shell` (powershell/posix), pour consulter une Codex identifiée en arrière-plan avec la config effective absolue. Même builder que le texte, aucune exécution ni preuve d'affichage ou de réussite. Les consommateurs tolèrent absence/champs inconnus ; l'agent affiche un bloc PowerShell ou bash au lieu d'un lien seul dans Claude Code Desktop. Détails et exclusions : [suggestions d'ouverture](relay-open.md#suggestions-douverture-après-relay). Le skill décrit les actions en mots simples dans les questions/boutons ; les options restent exactes dans les commandes et diagnostics.

Relay Claude (#250) : `error.hint?` et la notice `handoff?` sont rendus sur stderr, assainis comme les autres textes. Stdout JSON reste un objet unique v1 ; les ajouts facultatifs ne changent ni statut ni délivrance. Le dictionnaire `messages.relay.claude` impose la même langue au refus, à la vérification et à la passation ; aucun second choix de langue au rendu. Détails et exclusions : [contrat Relay](relay.md#claude-déjà-utilisée-et-passation-locale-250).

`src/renderers/console.ts` contient le rendu console historique. Le rendu TUI leger, utilise par defaut quand stdout est un TTY, est decoupe en quatre modules : `src/renderers/tui-theme.ts` (primitives visuelles : couleurs, boites, largeurs, liens), `src/renderers/tui-screens.ts` (ecrans plein terminal : accueil, aide, agents, roles, historique, config), `src/renderers/tui-prompts.ts` (entrees readline et commandes slash) et `src/renderers/tui-renderer.ts` (renderer des evenements de debat). `src/renderers/tui.ts` reste le point d'entree public qui re-exporte cette API ; les imports externes ne doivent viser que lui.

- `PrettyConsoleRenderer` : en-tete, separateurs, tours, synthese structuree, couleurs ANSI si TTY.
- `PlainConsoleRenderer` : rendu historique compatible logs.
- `TuiRenderer` : accueil `palabre`, composer slash commands, `/config`, `/history`, `/home`, tableau de bord plein terminal, statut d'agent en cours et sections lisibles sans dependance UI externe. Depuis `/config`, `/ollama`, `/ollama-url <url|default>`, `/ollama-model <modele>` et `/ollama-sync` exposent l'adresse et le choix du modele Ollama sans sortir de la TUI. Le composer de l'accueil accepte `--context <chemins...>` et `--files <chemins...>` en fin de sujet (`parseComposerTopic`) : les chemins sont retires du sujet et injectes comme contexte ; les chemins avec espaces ne sont pas supportes dans cette syntaxe inline.
- Etat "agent en cours" pendant les appels longs en rendu pretty.

Le flag `--terminal` force le rendu simple. `--plain` reste accepte comme alias historique. `NO_COLOR` desactive les couleurs sans changer la structure.

Le design TUI suit quelques regles fixes definies dans `tui-theme.ts` :

- toute la sortie est ancree a gauche avec une gouttiere fixe (pas de centrage dependant de la largeur du terminal) ;
- une seule famille de boites (cadre ferme, titre optionnel integre a la bordure haute), tracee en Unicode (`┌─┐│└┘`) avec repli ASCII automatique quand le terminal ne le supporte pas ou si `PALABRE_ASCII=1` est defini — les tests TUI forcent ce repli pour rester deterministes ;
- le logo 5 lignes est reserve a l'accueil ; les autres ecrans utilisent `brandHeader`, une ligne de titre accentuee suivie d'une regle horizontale ;
- les blocs label/valeur passent par `rows()` (colonne de labels adaptative) quand un label peut depasser 16 caracteres ;
- les couleurs semantiques passent par les tokens `success`/`warning`/`danger` du theme, et les marqueurs d'etat par `glyphs().check`/`glyphs().cross` ;
- le spinner utilise les frames braille avec repli ASCII ;
- les messages de debat/ask utilisent `accentBar` : en-tete du tour (titre souligne) et contenu dans un meme bloc, delimite par la seule barre laterale gauche a la couleur de l'agent — pas de cadre ferme pour les blocs qui s'enchainent ;
- la zone de saisie integre le fil d'Ariane dans la regle violette (`labeledRule`) et reduit la ligne de saisie au marqueur `❯` ;
- tout le contenu est aligne a gauche, y compris dans les boites — pas de centrage partiel.

Le TUI actuel reste leger : pas encore de split-view, pas de scrolling controle, pas d'input humain pendant le debat. Garder la logique produit dans le CLI et eviter que les integrations compensent ces limites.

## Renderer NDJSON

`src/renderers/ndjson.ts` fournit un renderer machine-readable pour les integrations out-of-process : extension VS Code Palabre-vscode, plugin Obsidian, scripts shell, replay. Le rendu humain reste assure par les renderers console.

### Activation

Trois facons equivalentes :

```bash
palabre run --preset codex-claude -s "..." --renderer ndjson
palabre run --preset codex-claude -s "..." --json
palabre codex-claude "..." --json -t 4
```

Precedence des flags : `--renderer` > `--json` > `--tui` / `--terminal` > `defaults.interface` > defaut (`tui` si TTY, `plain` sinon). `--plain` reste un alias legacy de `--terminal`. `--renderer <kind>` accepte `auto | pretty | plain | tui | ndjson`. Une valeur inconnue leve une erreur listant les choix supportes.

### Contrat de sortie

- toute la sortie va sur **stdout** ;
- une ligne = un evenement JSON valide, termine par `\n` ;
- chaque evenement porte un champ `v` (entier) pour le versioning ; la version courante est `v=1` ;
- stderr reste libre pour les messages bas niveau (Node, shell, erreurs adapter remontees comme exceptions) que les consommateurs agregent comme ils veulent.

### Schema v1

Types d'evenements emis aujourd'hui :

| Type | Quand | Champs |
| --- | --- | --- |
| `start` | une fois, au demarrage de la session | `mode` (`chat`, `debate` ou `ask`), `topic`, `agents[]` (`name`, `role`, `type`), `filesCount`, `session` (`startedAt`, `localDate`, `timeZone`, `cwd`) ; les champs Debate/Ask `turns`, `summaryEnabled`, `summaryAgent` et `earlyStop` restent présents dans ces modes |
| `notice` | message informatif | `message` |
| `warning` | avertissement | `message` |
| `turn-start` | debut d'un tour | `turn`, `totalTurns`, `agent`, `role` |
| `ask-response-start` | debut d'une reponse agent en mode `ask` | `response`, `totalResponses`, `agent`, `role` |
| `thinking-start` | agent en cours de generation | `agent`, `role` |
| `thinking-end` | fin de generation | (aucun) |
| `message` | contenu d'un message de debat | `turn`, `agent`, `role`, `content` |
| `ask-response` | contenu d'une reponse agent en mode `ask` | `response`, `agent`, `role`, `content` |
| `summary-start` | debut de la synthese finale | `agent`, `role` |
| `summary-message` | contenu de la synthese | `agent`, `role`, `content` |
| `chat-agents` | reponse a `/agents` pendant Chat | `agents[]` (`name`, `role`) |
| `chat-user-message` | message utilisateur accepte par Chat | `agent` (`user`), `role`, `content`, `createdAt` |
| `chat-message` | reponse de l'agent actif | `agent`, `role`, `content`, `createdAt` |
| `chat-consultation-start` | debut d'une consultation explicite | `agent`, `role` |
| `chat-consultation` | avis ajoute au transcript | `agent`, `role`, `content`, `createdAt` |
| `chat-agent-changed` | changement d'agent actif via `/use` | `agent`, `role` |
| `error` | erreur runtime structurée pendant le debat, ask, la synthese ou Chat | `phase` (`debate`, `ask`, `summary` ou `chat`), `kind`, `message`, optionnels `agent`, `role`, `turn` (hors Chat), `action` (Chat : `send`, `consult` ou `end`), `retryAfter`, `details` |
| `done` | fin de session ; export ecrit quand demande | `outputPath` (`null` si Chat se termine sans `/end`, ou si l'export partiel échoue après une erreur) |

En mode Chat avec `--renderer ndjson`, les integrations pilotent stdin avec
une ligne JSON par action. Le contrat d'entree v1 accepte :

```json
{"v":1,"type":"chat-send","content":"Message, y compris sur plusieurs lignes"}
{"v":1,"type":"chat-consult","agent":"vibe"}
{"v":1,"type":"chat-use","agent":"codex"}
{"v":1,"type":"chat-agents"}
{"v":1,"type":"chat-end"}
```

Les commandes texte historiques restent acceptees pour les terminaux. Une
integration doit utiliser les entrees structurees afin de conserver les sauts
de ligne et de ne pas confondre le contenu utilisateur avec une commande slash.
`chat-user-message` est emis dès acceptation du message, avant
`thinking-start`, afin que les clients puissent l'afficher immediatement.

Cycle de vie de Chat (#101) :

- une ligne vide ou d'espaces est ignorée (`parseChatInputLine` rend `blank`), en NDJSON comme en terminal : un séparateur accidentel ne ferme jamais Chat. La TUI (`src/tuiChat.ts`) ignore aussi une saisie vide depuis #103 ;
- `chat-end` / `/end` exporte puis émet `done` avec le chemin ; `/exit`, `/quit`, `/home` et la fin de stdin terminent sans export (`done` avec `null`). Aucun export automatique sur EOF ;
- après `start`, une erreur runtime émet `error` (`ChatFailure` : `phase: "chat"`, `action` `send` | `consult` | `end`, `agent`, `role`, `kind`, `message`, `retryAfter`, `details`), puis écrit l'export partiel et émet exactement un `done` avec son chemin, ou `null` sans transcript ou si l'export échoue. `error` précède l'export, qui peut être lent. Code de sortie 1, ou 130 si annulée. L'erreur n'est pas relancée : rien n'est écrit hors du flux. `ChatFailure` est distinct de `DebateFailure` ; les deux partagent la classification `classifyRuntimeError` (`src/runtimeFailure.ts`) ;
- l'annulation interrompt aussi l'attente d'une ligne : l'abort ferme la lecture de stdin (listener retiré en fin de session), puis la même terminaison s'applique avec `kind: "cancelled"`. Au repos, l'erreur ne porte ni `action` ni `agent` : elle n'est jamais attribuée à la dernière action terminée. Ce comportement vaut pour le NDJSON ; le parcours terminal n'est pas modifié ;
- le rôle annoncé pour une consultation (`chat-consultation-start`, `thinking-start`, `error`) vient de `ChatSession.agentConfig`, qui applique les overrides runtime (`--role-a`), et non du rôle brut de la config. L'indicateur d'attente de la TUI utilise la même source depuis #103 ;
- `--dry-run` est refusé en Chat (`chat`, `run --mode chat`, TUI) avant toute lecture de stdin, tout événement, appel agent ou export. Aucune prévisualisation Chat n'existe pour l'instant.

Exemple de session minimale :

```json
{"v":1,"type":"start","mode":"debate","topic":"...","turns":2,"agents":[{"name":"codex","role":"implementer","type":"cli"},{"name":"claude","role":"reviewer","type":"cli"}],"summaryEnabled":true,"summaryAgent":"claude","earlyStop":true,"filesCount":0,"session":{"startedAt":"...","localDate":"...","timeZone":"...","cwd":"..."}}
{"v":1,"type":"turn-start","turn":1,"totalTurns":2,"agent":"codex","role":"implementer"}
{"v":1,"type":"thinking-start","agent":"codex","role":"implementer"}
{"v":1,"type":"thinking-end"}
{"v":1,"type":"message","turn":1,"agent":"codex","role":"implementer","content":"..."}
{"v":1,"type":"turn-start","turn":2,"totalTurns":2,"agent":"claude","role":"reviewer"}
{"v":1,"type":"message","turn":2,"agent":"claude","role":"reviewer","content":"..."}
{"v":1,"type":"summary-start","agent":"claude","role":"summarizer"}
{"v":1,"type":"summary-message","agent":"claude","role":"summarizer","content":"..."}
{"v":1,"type":"done","outputPath":"./debate-2026-05-11.debate.md"}
```

Si un agent plante, Palabre emet `error`, ecrit tout de meme l'export Markdown partiel avec une section `Interruption`, emet `done`, puis termine avec un exit code non nul.

### Politique de versioning

Le renderer NDJSON est une API publique d'integration. Toute integration officielle doit le traiter comme un contrat versionne, pas comme un detail d'affichage interne.

- ajout d'un nouveau type d'evenement ou d'un nouveau champ optionnel : **compatible v1**, pas de bump de `v` ;
- suppression d'un type ou d'un champ obligatoire, renommage, changement de semantique : **breaking**, bump `v` a `2`, documenter la migration ici ;
- les consommateurs doivent ignorer les champs inconnus et les types inconnus plutot que crasher.
- Palabre-vscode doit continuer a supporter v1 tant que sa version minimale de CLI le demande. S'il recoit une version majeure inconnue, il doit afficher une erreur actionnable demandant de mettre a jour l'extension ou d'aligner les versions CLI/extension, sans tenter d'interpreter le flux.

### Limites actuelles

- pas d'evenement `agent-chunk` : le rendu Palabre est par message complet, pas par token. Le streaming token-par-token necessitera un changement de contrat `DebateRenderer` cote orchestrateur, pas seulement le renderer.
- pas d'evenement `early-stop` distinct : la fin du debat se voit par l'absence de nouveaux `turn-start` avant le `summary-start` ou le `done`.

Ces points sont a evaluer au cas par cas si un consommateur reel les demande. Eviter de speculer.
