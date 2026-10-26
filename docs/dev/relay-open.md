# Relay ouvert, suivi, quotas et Desktop

Référence de développement extraite d’`AGENTS.md`. Lire [les règles communes](../../AGENTS.md) et ce document avant de modifier ou qualifier `--open`, `--follow`, `--check`, `--then-follow`, le quota ou les suggestions d'ouverture. Les chemins de code entre backticks sont relatifs à la racine du dépôt. Les qualifications datées décrivent un essai, pas une garantie pour toutes les versions.

Lire aussi [le socle Relay](relay.md). Ouvrir, envoyer et suivre sont trois actions distinctes ; un verrou ne prouve ni l'affichage ni l'autorisation humaine.

### Relay vers une conversation ouverte (`--open`, B1)

Contrat de référence : `scripts/prototypes/relay/CONTRAT-B1.md`, relu dans la PR #110. Pilote **Codex seulement, sous Windows, macOS et Linux** ; une cible Claude donne `invalid-request` / `unsupported-agent`. Sous macOS/Linux, `python3` doit être disponible pour la sonde `flock` ; sinon l'issue est `target-state-unknown`, sans dépôt.

```text
palabre relay --open --from <agent>:<session> --to <agent-codex>:<session> ("<message>" | --message-file <chemin>)
              [--timeout <secondes>] [--json] [--no-export] [--config <chemin>] [--trust-config] [--language <fr|en>]
```

La validation des arguments, la config approuvée, l'agent et l'exécutable (D21) sont ceux de Relay A. Ensuite (`src/externalSessions/openRelay.ts`), sous **une seule échéance** `--timeout` couvrant référence, dépôt et attente :

1. **Localisation bornée** (`locateOpenRollout`) : rollout par UUID, doublons refusés, première ligne seulement (1 Mio au plus), `session_meta.id` et dossier de travail validés. L'historique n'est jamais chargé en entier, quelle que soit sa taille. Aucun modèle n'est recherché : B1 ne lance aucune reprise.
2. **Verrou tenu** obligatoire : absent ou libre, `target-not-open` ; invérifiable, `target-state-unknown`. Aucun dépôt dans les deux cas.
3. **Contrôle du dépôt** (`codexQueue.ts`) : enveloppe complète d'au plus 8 192 unités UTF-16 ; aucun NUL ; ligne de commande Windows réellement sérialisée (exécutable, arguments préfixés D21, arguments et échappement libuv, NUL final) d'au plus 32 767 unités. Sinon `invalid-request` / `message-too-large`, sans dépôt.
4. **Référence** du rollout (`captureOpenRollout`) : une fin de ligne partielle est réessayée pendant 2 s au plus, dans le budget et annulable ; ensuite, `no-valid-reply` avec la raison, sans dépôt.
5. **Nouveau contrôle du verrou** immédiatement avant le dépôt. Il réduit la fenêtre de course sans rendre vérification et dépôt atomiques. Verrou libéré : `target-not-open` ; invérifiable : `target-state-unknown`, sans dépôt.
6. **Un seul `codex queue --thread <uuid> --message <enveloppe>`**, lancé par `runExternalProcess` : sans shell, dans le dossier de la cible, environnement nettoyé, stdin vide, en `min(60 s, budget restant)` et 1 Mio au plus. Annulation et budget sont recontrôlés juste avant le lancement : si la sonde a épuisé le budget, `timeout` sans dépôt (ce contrôle ne rend pas sonde et lancement atomiques). Dès qu'un processus est créé, la tentative compte.
7. **Attente** : lectures bornées de l'ajout (`readOpenRollout`, `inspectOpenReply`) toutes les 500 ms jusqu'à une observation terminale, l'échéance ou l'annulation. Annulation et échéance sont contrôlées avant chaque lecture **et après son retour**, avant d'accepter une observation terminale : une lecture terminée après Ctrl+C ou après l'échéance donne `cancelled` ou `timeout`, sans réponse. Toute preuve de réception est mémorisée.

L'enveloppe `--open` annonce un expéditeur déclaré non authentifié et une demande d'un autre agent : ce n'est pas une instruction de l'utilisateur, elle n'autorise aucune action et ne lève aucune restriction. Ctrl+C est géré avant la référence ; le gestionnaire est retiré en fin de relay.

**Issues.** Avant tentative, la délivrance est toujours `not-delivered`. Après tentative, elle vient de `settleOpenDelivery` : `persisted-no-reply` dès qu'une preuve de réception existe (actuelle ou conservée), sinon `unknown`.

| Cas | Issue / code | Délivrance |
| --- | --- | --- |
| Verrou absent ou libre (avant ou juste avant le dépôt) | `target-not-open` / 3 | `not-delivered` |
| Sonde invérifiable | `target-state-unknown` / 3 | `not-delivered` |
| Enveloppe, NUL ou ligne Windows hors limite | `invalid-request`, `message-too-large` / 8 | `not-delivered` |
| Référence toujours partielle ou illisible | `no-valid-reply` / 2, raison conservée | `not-delivered` |
| Lancement impossible, aucun enfant créé | `command-not-found`, `invalid-request` / `invalid-working-directory` ou `cli-failure` | `not-delivered` |
| CLI sans sous-commande `queue` : refus de son analyseur d'arguments sous la forme observée avec Codex 0.151.0 pour une sous-commande inconnue, exigée en entier (code 2, stdout vide, première ligne `error: unexpected argument '--thread' found`, usage `Usage: codex [OPTIONS] [PROMPT]`) | `cli-failure` / 2 | `not-delivered`. Toute autre sortie, simple mention dans un journal ou accusé contradictoire, garde l'incertitude |
| Ctrl+C, y compris pendant la référence, `queue` ou une lecture | `cancelled` / 130 | `not-delivered` avant tentative, sinon selon la preuve |
| Échéance, y compris juste avant le lancement, pendant `queue` ou pendant une lecture | `timeout` / 4 | idem |
| Plafond de sortie de `queue` | `output-too-large` / 2 | selon la preuve ; la sortie partielle n'est jamais un accusé |
| `queue` terminé en non-zéro | `cli-failure` / 2 | selon la preuve |
| `queue` terminé à zéro, accusé absent, non conforme ou d'une autre conversation | `no-valid-reply` / 2 | selon la preuve |
| Observation `failed` du tour corrélé (dont `task_complete.error`) | `cli-failure` / 2 | `persisted-no-reply` |
| Observation `ambiguous` ou `unreadable` | `no-valid-reply` / 2 | selon la preuve |
| Observation `awaiting-*` à l'échéance | `timeout` / 4 | selon la preuve |
| Observation `replied` | `replied` / 0 | `replied` |

Après un échec du déposant (code non nul, accusé absent ou étranger, plafond), une dernière lecture bornée peut relever une réception, si le budget le permet et sans annulation. Elle ne remplace jamais l'issue primaire, ne rend jamais de réponse et n'efface aucune preuve. Aucun renvoi, aucune reprise `exec resume`.

**Corrélation #146 (lot partiel).** Les messages de contexte observés sous Windows sont exemptés seulement après `task_started`, avant l'enveloppe, sans liaison `UserMessage`, sans nonce et avec métadonnée du tour corrélé. Une sorte AGENTS et une sorte environnement au plus, en messages séparés ou dans un message à deux parties AGENTS puis environnement : `content_item_kinds` doit correspondre exactement aux blocs complets (`agents_md.instructions`, `environments.environment_context`). Aucun autre texte ni doublon n'est exempté. Ces métadonnées ne sont pas une authentification système.

Une saisie libre de forme `user.text` du même tour, après l'enveloppe et avant la finale, ne devient pas une réponse liée : `no-valid-reply` / 2, `correlation.reason: user-input-during-turn`, vérification de la conversation avant tout renvoi. Une enveloppe d'agent ou un format inconnu conserve l'ambiguïté générique. Aucun auteur humain, clic, accord ou droit n'en est déduit. La forme réelle d'une réponse liée à une question n'a pas été observée localement : aucune exemption supposée ni champ `humanInput`. #146 reste partielle ; #190 n'est pas validée par ce lot. Les fixtures ne contiennent que structures relevées et textes factices ; leur provenance et les variations négatives sont précisées dans `tests/fixtures/external-sessions/open-user-context.md`. Le skill conserve la consigne de ne pas poser de question pendant un tour relayé.

**Champs JSON v1 optionnels, en mode `open` (explicite ou automatique) :**

- `mode: "open"` (le champ `mode` lui-même est désormais émis à chaque résultat, voir [la préférence #190 dans le socle Relay](relay.md#préférence-de-mode-190-lot-b)) ;
- `queue` : `{ attempted, accepted?, itemId?, diagnostic? }`. `accepted` vaut `true` pour un accusé reconnu et lié à la cible, `false` seulement pour le refus certain d'une CLI sans `queue`, `"unknown"` sinon : une absence d'accusé n'est pas un refus. `itemId` n'est présent que pour un accusé reconnu, et ne prouve pas la réception du texte exact ;
- `correlation` : `{ status, reason }`, statut et raison exacts du lecteur. Absent tant que rien n'a été inspecté ;
- `receiver: "unverified"` : le verrou tenu ne prouve ni la surface, ni la version, ni l'affichage, ni la consommation du message. La version de la CLI qui dépose n'est pas celle du récepteur, et aucun binaire desktop n'est recherché ni exécuté. Une version inconnue n'est pas bloquée dans ce pilote explicite ;
- `targetPermissions` : `{ approvalPolicy?, sandbox?, network? }` relevés dans le `turn_context` **du seul tour corrélé** (réponse ou échec lié), ou `"unknown"`. Jamais repris d'un autre tour ni du dernier profil historique ; ni chemins, ni `turn_context` complet.

`identity` vaut `same-as-target` seulement pour `replied` (liaison au fil et au tour prouvée), `unavailable` sinon. `observedModels` vient du seul tour corrélé. `inActiveBranch` vaut `unknown` après tentative. Sans enveloppe observée après une tentative, le message d'erreur dit « réception non observée » : un format inconnu ou une lecture manquée ne prouvent pas l'absence de consommation, et le message peut être traité plus tard.

**Engagements et limites propres à `--open` :**

- Aucune lecture seule : la conversation ouverte répond avec ses outils, MCP, hooks et permissions, et Codex desktop applique ses permissions courantes au tour relayé. Palabre ne neutralise ni ne modifie ces réglages. Les garanties conditionnelles de Relay A ne s'appliquent pas.
- Un message déposé peut être traité après le délai, même sans être affiché : Codex desktop garde un fil chargé après qu'on l'a quitté. Ni l'échéance, ni Ctrl+C, ni la fermeture de Palabre ne retirent un message de la file.
- Le format du rollout est expérimental (Codex 0.151.0 en TUI, app-server 0.160.1 de Codex desktop 26.930.7945.0), pas un schéma public.
- L'export `.relay.md` ajoute le mode, le dépôt, la corrélation, le récepteur et les permissions relevées, avec un avertissement propre à `--open`. Un refus avant tentative n'écrit pas d'export.

### Suivre la suite d'une conversation ouverte (`--open --follow`, #195)

Un appel `--open` attend la réponse à son enveloppe, puis s'arrête. Quand l'équipier attend une action dans l'app (confirmation d'un lot qui écrit, #187), la suite se joue dans un tour lancé depuis l'app, qu'aucun appel n'écoute. `--follow` comble ce trou **sans dépôt** :

- `relay()` refuse `--follow` sans `--open`, ou avec un message, `--message-file`, `--subject`, `--from`, `--new`, `--dir`, `--task`, `--pr`, `--write` ou un en-tête Mission (`invalid-arguments`). Aucune enveloppe n'est construite et l'exécutable de la cible n'est pas résolu : aucun processus Codex n'est lancé. Sous macOS/Linux, la sonde de verrou partagée avec `--open` lance seulement `python3` (`flock`), sans lire le contenu du verrou.
- `runFollowRelay` (`openRelay.ts`) partage avec `runOpenRelay` la localisation bornée, le verrou tenu (`target-not-open` / `target-state-unknown`), la référence (`captureReference`, fin de ligne partielle réessayée 2 s), les lectures bornées, l'échéance unique et le contrôle d'annulation avant et après chaque lecture.
- `inspectFollowedTurn` (`openReader.ts`, fonction pure, contrôles d'ajout communs `freshRows`) rend le **premier** tour terminé après la référence. Succès : une seule fin `task_complete` sans `error`, une seule `final_answer` liée à la conversation, placée avant la fin, de texte égal à `last_agent_message`. Tour commencé avant la référence : rendu, `turn-started-before-follow` ; son début n'étant pas lu, son origine (app ou Relay arrivé à échéance) est inconnue et annoncée comme telle. Nonce PALABRE observé dans le tour après la référence : `relay-turn` (ambigu), jamais présenté comme une suite. À l'échéance, un nouvel appel rend le tour encore en cours. Échecs : `usage-limit` (code structuré seulement, `retryAfter`), sinon `cli-failure`.
- Issue `followed` (code 0) : `reply`, `identity: same-as-target` (fil vérifié), `delivery: not-delivered` (rien n'est envoyé), `mode: "follow"`, sans `queue`, `correlation`, `receiver: "unverified"`, `targetPermissions` du seul tour suivi. `followed` et `mode: "follow"` sont des ajouts v1 propres à cette option ; une intégration qui ne les connaît pas ne doit pas les traiter comme un succès de relay.
- **L'auteur du tour n'est pas vérifié** (l'humain dans l'app, ou autre) : ni autorisation, ni clic humain, ni décision n'en sont déduits. Le texte, l'export et le JSON le disent ; la sortie texte n'affiche aucune consigne de renvoi.
- Un tour terminé avant l'appel n'est pas rendu : le chef de mission lance le suivi avant que l'humain agisse dans l'app. Les tests (`tests/external-sessions-open-follow.test.ts`, `tests/relay-command.test.ts`) utilisent des rollouts factices et un verrou tenu par le test : aucun Codex réel.

### Vérifier avant d'envoyer (`--check`, #203)

Avec `relay.view: auto`, le mode n'est connu qu'à l'envoi. `--check` rend ce choix visible avant, sans rien envoyer :

- `relay()` refuse `--check` avec un message, `--message-file`, `--subject`, `--from`, `--new`, `--dir`, `--task`, `--pr`, `--write`, `--follow`, `--timeout`, `--no-export`, `--trust-config` (qui réécrirait le registre de confiance) ou un en-tête Mission (`invalid-arguments`). `--open` et `--background` gardent leur sens. `check` est porté dès les arguments bruts, donc sur tout résultat de `--check`, refus précoces compris.
- Mêmes étapes qu'un envoi jusqu'à `resolveRelayView` inclus (config approuvée, agent, fournisseur, exécutable résolu, sonde `auto`), puis `relayCheck` : en mode ouvert, `locateOpenRollout` et sonde du verrou (`target-not-open` / `target-state-unknown`) ; en arrière-plan, `assessClosedTarget`, partagé avec l'envoi, donc mêmes refus et mêmes conseils `target-busy` (`setting`, `--background`). Ni enveloppe, ni `codex mcp list`, ni reprise, ni dépôt, ni export ; seule la sonde POSIX du verrou lance `python3`.
- Issue `checked` (code 0), `delivery: not-delivered`, champ facultatif `check` sur tout résultat de `--check` : `target` (`open` | `closed`, renseigné dès que l'état est connu, y compris avant `target-busy` ou `target-not-open`) et, en mode ouvert, `lastPermissions` (`approvalPolicy`, `sandbox`, `network` ou `"unknown"`) et `lastPermissionsAt`. Les champs de dépôt (`queue`, `correlation`, `receiver`, `targetPermissions`) sont absents.
- `readLastTurnContext` (`openRollout.ts`) lit au plus le dernier Mio du rollout, plus l'octet qui le précède pour savoir si sa première ligne est complète ; `lastTurnContext` (`openReader.ts`, pur) prend le dernier `turn_context` lisible, ligne partielle ignorée. Ces permissions sont **indicatives** : le tour suivant peut en appliquer d'autres. Absentes de cette fin : `"unknown"`.
- L'état peut changer entre `--check` et l'envoi ; l'envoi revérifie toujours, sans repli plus permissif. `neutralization-failed` reste possible à l'envoi. Tests : `tests/relay-check.test.ts`, profil fictif et sonde simulée.

### Hors périmètre de cette version

- Le fork d'une conversation Codex ou Claude Code ; le pilote OpenCode `--copy` est distinct.
- La détection automatique de l'expéditeur.
- Avec `--open` : Claude Code (lot B2), l'app-server `--remote` et les IDE. Codex Desktop comme expéditeur exige les autorisations techniques ponctuelles de l'hôte ; ne pas le présenter comme intrinsèquement indisponible.
- En mode arrière-plan imposé : les conversations ouvertes restent refusées.
- Les chaînes de relay et le retry.
- Palabre-vscode, qui consommera `--json` sans recalculer l'état.

### Dernier quota Codex connu (#205)

`quota.ts` analyse seulement les événements `event_msg` / `token_count` portant `rate_limits` dans la fin déjà bornée d'un rollout. Forme expérimentale fournie dans #205 : `limit_id: codex`, deux fenêtres complètes `primary`/`secondary` (`used_percent` fini entre 0 et 100, `window_minutes` entier positif, `resets_at` secondes Unix entières représentables) et `timestamp` ISO avec fuseau et date réelle. `rate_limits: null` signifie aucun relevé dans cet événement : chercher le précédent. Un dernier candidat non nul inconnu ou invalide masque les anciens : aucune estimation, aucune lecture de prose. Lignes de bord incomplètes ignorées. `readLastCodexQuota` lit au plus 1 Mio + un octet, en lecture seule, sans réseau ni modèle ; absence, forme inconnue, fichier illisible, UTF-8 invalide ou taille/mtime changées pendant la lecture = champ absent, sans effet sur l'issue.

Ajouts facultatifs JSON v1 : `check.quota` pour `relay --check` vers Codex ouverte ou fermée ; `quota` à la racine après un envoi en mode ouvert, dont le rollout est déjà localisé. Aucun ajout après un envoi arrière-plan ou pour Claude. Même type : `source: codex-rollout`, `indicative: true`, `recordedAt` ISO UTC, `limitId: codex`, `primary` et `secondary` avec `usedPercent`, `windowMinutes`, `resetsAt` ISO UTC. Ce n'est pas une mesure en direct ni un coût attribué au tour : le compte peut avoir servi ailleurs depuis. Les valeurs historiques restent datées même si une réinitialisation est déjà passée ; ne jamais les remettre à zéro. Texte fr/en : dates locales et fuseau pour relevé et réinitialisations. Ne changer ni permissions, ni statut, ni délivrance, ni code de sortie pour un quota absent ou élevé. Avant un lot important, le skill demande `relay --check` ; dès 80 % utilisés sur une fenêtre, informer l'humain et proposer découpage/attente, jamais abandon ni relance automatique.

### Relay : envoi puis suivi (#204)

`--then-follow <10..3600>` est une option à valeur d'un envoi vers une Codex existante en mode ouvert (`--open` ou `auto` résolu en ouvert). Refuser avant dépôt avec arrière-plan, Claude Code, `--new`, Mission, `--task`, `--write`, `--check`, `--follow`. Un seul dépôt ; aucune nouvelle enveloppe, aucun renvoi. `--timeout` garde son budget ; le suivi dispose d'un second budget explicite, démarrant à la réponse corrélée, chacun plafonné à 3600 s. L'échéance ne se renouvelle jamais.

`inspectOpenReply` peut produire une référence interne après la ligne complète du `task_complete` corrélé : offset UTF-8, identité et témoin borné construits à partir du snapshot validé. Ne jamais recapturer EOF entre les tours : une suite peut déjà y être terminée. La boucle de `runFollowRelay` accepte cette référence et réutilise `inspectFollowedTurn`, ses limites et refus (`relay-turn` pour un Relay étranger). `--follow` seul conserve sa capture initiale. Les références internes ne vont pas dans le JSON.

Ajout facultatif v1 `nextTurn` : `status`, `reason?`, `reply?`, `receiver: unverified`, `observedModels?`, `targetPermissions?`, `correlation?`, `retryAfter?`. Statuts secondaires : `followed`, `awaiting-turn` avec `reason: timeout`, `not-started` avec `reason: primary-not-replied`, ou échec/annulation du suivi. Jamais de délivrance secondaire. L'issue, le code, la réponse et la délivrance primaires restent ceux du premier échange, même après Ctrl+C pendant le suivi. Aucun auteur humain ni accord déduit. Texte : première réponse immédiate, puis suite distincte sans duplication. JSON : un seul résultat final sur stdout, progression sur stderr. Export : deux parties séparées. Les tests utilisent seulement des historiques et profils fictifs via `scripts/test.mjs`.


## Suggestions d'ouverture après Relay

Suggestions Codex après Relay : le rendu texte propose `palabre relay open --to <alias>:<uuid> --config <chemin-absolu>` plutôt qu'un lanceur système. Même preuve de cible que le lien (création identifiée ou reprise localisée), même alias et config effective, y compris implicite. Le chemin absolu reste une métadonnée privée de présentation : aucun champ JSON/export ajouté. Quoting PowerShell/POSIX sans interpolation ; contrôles/caractères de format et guillemets typographiques PowerShell font omettre la suggestion, jamais changer de config. Aucun lancement au rendu ; l'accord d'ouverture n'autorise aucun envoi, qui reste séparé après `--check --open` et avec `--open` explicite. Transports Claude inchangés ; même filtrage renforcé des guillemets PowerShell dans sa suggestion. Shell de la suggestion Codex affiché : PowerShell sous Windows (pas Git Bash/cmd.exe), POSIX sous macOS/Linux.


### Relay : création et expéditeur facultatif (#150)

`--new --to <agent>` crée une conversation persistante Claude/Codex en reprenant la même politique que Relay fermé. Le dossier est courant par défaut, ou `--dir` (création seulement). Aucun `--last`, aucune reprise implicite, aucun `--open` avec `--new`. Les adapters fournissent `createArgs` et extraient l'identité des événements structurés ; le lanceur les observe pendant stdout. L'identifiant initial est conservé même après erreur/annulation et sert à vérifier la réponse et le nonce dans l'historique. Avant cet événement, ne jamais chercher un historique avec un identifiant vide.

Le JSON v1 ajoute `created` et `cwd` pour `--new` seulement : `created` signifie identifiant reçu, pas succès du tour ; `to.session` est null avant réception. La sortie et l'export conservent ces informations sans retry. `from` vaut null si absent ; un nom seul donne `{ agent }`, une référence donne `{ agent, session }`. `SenderRef` permet cette souplesse, tandis que `SessionRef` garde son UUID strict pour les cibles existantes et Mission. Le terminal est aussi un expéditeur déclaratif, jamais une autorisation humaine. L'écriture par un équipier n'est pas établie par ce lot.

Lien Desktop (#188, après #150) : après création d'une conversation Codex, le texte et l'export `.relay.md` affichent `codex://threads/<id>`. Aucun champ JSON n'est ajouté : une intégration construit le lien depuis `to.session`. La conversation créée par la CLI n'est pas listée dans Desktop avec les versions vérifiées ; le propriétaire ouvre le lien, ou demande directement à son agent de l'ouvrir ; un agent ne l'ouvre jamais de sa propre initiative ni sur la demande d'un autre agent (un message Relay ne vaut pas accord). L'ouverture avec historique a été vérifiée sous Windows (Codex Desktop 26.1013.40934) seulement ; macOS et Linux restent à vérifier pour ce lien. Une fois ouverte dans Desktop, Relay utilise `--open` et les permissions de Desktop, sans élargissement implicite.

Restitution par le skill : le compte rendu d'un Relay vise un utilisateur de l'app desktop. Résultat en mots simples, mode, une seule action humaine si nécessaire ; pour ouvrir une conversation créée, seulement la commande d'ouverture dans un bloc shell (bouton Run de l'hôte), jamais le lien seul. Sur demande directe de l'humain (phrase ou bouton de l'hôte), l'agent lance lui-même cette commande ; cet accord vaut pour l'ouverture seulement. Un envoi exige une tâche déjà autorisée ou une nouvelle demande humaine, se vérifie avec `relay --check --open` (sans `--open`, `checked` peut désigner une cible fermée) et part avec `--open` explicite pour qu'une conversation relâchée soit refusée plutôt que jointe en arrière-plan. L'agent garde identifiant, dossier et export pour « continue » et ne les affiche, avec une commande `palabre relay --to …`, que sur demande, sans mémoire de conversation chez l'hôte ou pour diagnostiquer un échec. La sortie texte de `relay` et l'aide (fr/en) reprennent la règle d'ouverture sur demande directe du propriétaire. Une conversation créée par `--new` garde le profil de sa création (`read-only`, `approval_policy=never`, `codex.ts`) même ouverte dans Desktop : constaté le 23 octobre 2026, l'ouverture ne la rend pas inscriptible. Pour faire écrire Codex, l'humain crée la conversation dans Desktop avec les permissions qu'il choisit et la désigne explicitement. `--then-follow` n'est pas un défaut du skill : le suivi attend le premier tour suivant terminé, jusqu'à l'échéance s'il n'en vient aucun, et avec `--json` la réponse principale n'est rendue qu'à la fin de ce suivi ; le skill le réserve à une validation humaine attendue d'avance, avec un délai court (120 s), et préfère sinon `--open --follow` lancé quand la validation apparaît.


### Ouvrir une conversation Codex par Relay

`relay open` (#219) est un parcours distinct Codex seulement dans commands/relayOpen.ts :
validation commune --check --open sans message, puis un lanceur OS sans shell et observation
du verrou sous budget coopératif de 15 s. Validation/localisation/lectures/sondes peuvent
retarder le retour et Ctrl+C ; pas de borne murale stricte, aucun lancement/succès tardif.
JSON distinct relay-open-result ; ne jamais déduire un
affichage, une surface ou un droit d'un verrou tenu. À échéance/annulation, détacher le
lanceur sans tuer son arbre (Desktop pourrait en être descendant), aucun retrait promis.
Pas de message, export, retry, réglage ni fermeture d'app. Claude/OpenCode restent refusés.
Contrat complet docs/relay-desktop-open-contract.md. Deux ouvertures Windows confirmées
le 23 octobre 2026 malgré Explorer code 1 ; seul ce cas donne launcher.status unverified,
code brut conservé, puis sonde du verrou sans relance. Les autres erreurs gardent leur
priorité. Défilement non piloté. Un verrou préexistant ne prouve aucun nouvel affichage.
Bilan et échange séparé Codex → Codex : docs/relay-codex-desktop-qualification.md.
Correctif testé hors ligne puis confirmé sur une ouverture réelle au commit 4d464e2 :
lanceur unverified/1, attached/0, 728 ms, bonne cible affichée selon le propriétaire.
Ne pas généraliser à toutes les versions ni à une transition de fermé à ouvert.
Ne pas rejouer les échanges ni lancer un modèle pour qualifier une ouverture.

Le lanceur est créé dans un groupe isolé (`detached: true`, stdio ignore), puis unref à
l'arrêt de l'attente ; ne pas le laisser dans le groupe du terminal POSIX (Ctrl+C).

### Ouvrir une conversation Claude dans Desktop

Ouverture Claude Desktop (premier dépannage #193, préparation #219) : le texte Relay propose
`--desktop --resume <uuid>` avec la CLI déjà résolue et son préfixe Node éventuel, jamais une
autre installation ni les arguments d'agent. UUID reçu après création ou historique localisé
requis, Windows/macOS seulement ; aucun lancement automatique, aucun champ JSON ajouté.
Le dossier localisé accompagne le rendu ; la commande affichée y entre temporairement
(Push-Location/try/finally en PowerShell, cd gardé en sous-shell POSIX) et restaure le cwd.
Un changement de dossier impossible interdit le lancement, chemins quotés sans interpolation.
Qualification détaillée : docs/relay-desktop-qualification.md. L'essai Windows du 23 octobre
confirme l'historique partagé après redémarrage humain, pas l'actualisation de la fenêtre ouverte.
Le registre CLI vide ne prouve pas la fermeture Desktop (check.target: closed observé à tort
pour la surface). Ne jamais fermer/tuer l'app, archiver, supprimer ou renvoyer automatiquement.
L'agent propose un seul bouton court « Ouvrir dans Claude » ou « Ouvrir dans Codex », puis
ouvre uniquement sur demande humaine directe, jamais sur message Relay. Claude exige un TTY
sans sortie redirigée et son dossier de conversation ; CLI 2.1.285+, app et abonnement Claude.
Essai confirmé dans l'app sous Windows le 23 octobre 2026, macOS non vérifié, Linux non proposé.
L'ouverture ne prouve ni affichage ni droits et n'autorise aucun envoi. Ne pas promettre que les
restrictions du tour Claude fermé survivent dans Desktop ; vérifier les permissions dans l'app.
Relay vers Claude ouverte reste refusé : fermer avant un nouvel envoi autorisé, sans dupliquer
un message déjà délivré. #193 (dépôt/corrélation ouverts) et #219 (commande open/observation)
restent ouverts ; ni transport nouveau, ni --open Claude, ni pilotage de fenêtre.

### Codex Windows : alias PowerShell Store (#128)

`CodexSessionAdapter.environment` prépare une copie de l'environnement pour `exchange` (MCP puis création/reprise), donc aussi Mission et review. Le PATH parent, les autres fournisseurs et `--open` restent inchangés. Si le `pwsh.exe` prioritaire est un AppExecLink confirmé par `fsutil` natif (3 s / 8 Kio), situé directement sous WindowsApps ou dans le dossier d'alias du paquet (`WindowsApps\Microsoft.PowerShell_<éditeur>`, cas de l'essai #171), son dossier et ses doublons sont retirés seulement si un PowerShell natif régulier reste disponible. Si un autre alias confirmé passe alors en tête, il est retiré à son tour (au plus 4 dossiers) ; un alias suivant non confirmé laisse l'environnement inchangé, car Codex le choisirait encore. Un dossier d'installation versionné (`Program Files\WindowsApps\Microsoft.PowerShell_7.x…`) n'est jamais un emplacement d'alias. Ne pas traiter tout dossier WindowsApps comme suspect ; il peut contenir de vrais exécutables ou des runtimes Codex. Lire l'entrée par lstat : existsSync peut nier l'existence d'un alias présent. Sonde inconnue ou repli incertain = environnement inchangé. Préserver les valeurs UTF-8 par défaut et le nettoyage des variables de session de l'hôte.

Le retrait rend aussi les autres alias de ce dossier indisponibles à l'enfant ; le documenter. Aucune modification de config, de PATH global, de permission, de sandbox ni de retry. L'erreur de lecture et l'interdiction de publier une revue à l'aveugle restent actives. Essai réel Windows/Codex 0.163.0 : alias sous :read-only en erreur 5, même lecture native réussie avec écritures refusées ; Relay neuf incapable de lire avant le correctif, lecture du contenu fictif réussie après avec le PATH du terminal habituel. Ne pas extrapoler à tout Windows ou à toute erreur 5.
