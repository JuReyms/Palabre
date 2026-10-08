# Protocole B2.3 : essais réels jetables du relay vers Claude ouvert

Statut au 8 octobre 2026 : **proposé, non lancé**. Révision après la relecture de `7afebd9`.

Aucun essai, aucun appel de modèle et aucun envoi n'a lieu avant l'accord explicite du mainteneur.
Notre conversation active est **exclue** de tout le protocole : un essai sur elle demandera un
accord distinct, donné au moment même (§ 9).

Ordre convenu :
1. protocole relu ;
2. harnais écrit, puis contrôle à sec sans appel de modèle (§ 3) ;
3. revue du harnais et du contrôle à sec ;
4. seulement ensuite, demande d'accord pour les appels réels.

Référence : contrat `CONTRAT-B2.md` (B2.1, B2.2a), PR #113.

## 1. Questions auxquelles B2.3 doit répondre

Les tests sans quota vérifient le code de Palabre avec une fausse CLI. Restent à observer sur la
vraie CLI :

| Propriété | Question | Essais |
| --- | --- | --- |
| P1 | La chaîne complète fonctionne-t-elle : envoi, réception exacte, réponse corrélée ? | E1, D1 |
| P2 | `SendMessage` passe-t-il toujours par le garde avec la règle `ask` ? | E1, E2 |
| P3 | Un garde absent, en échec, muet ou au JSON invalide bloque-t-il l'envoi ? | E3 |
| P4 | Un arrêt du messager pendant la décision empêche-t-il l'envoi, avec une terminaison effective ? | E3d |
| P5 | `updatedInput` est-il appliqué : enveloppe exacte, jamais le texte de remplacement ? | E1, E4 |
| P6 | Une seule autorisation, même pour deux appels ? | E4 |
| P7 | Comportement selon les modes et réglages de réception de la cible | E5, D2 |
| P8 | Cible occupée par un tour avec outils | E6 |
| P9 | Formats réels : demande et réponse du garde, environnement du serveur MCP, `system/init` | E1, E2 |

B2.3 ne tranche pas la promotion vers `not-delivered`. Il rassemble seulement les observations ; la
discussion vient après, comme convenu.

## 2. Garde-fous

### 2.1 Isolement indépendant du garde

Le manifeste contrôle la destination **prévue**, mais pas l'appel **réel** du modèle. Si le garde
est contourné ou défaillant, c'est le modèle messager qui choisit `to`. Une vérification faite
après la réception arrive trop tard pour empêcher un premier envoi hors périmètre.

Les essais E1 à E6 se déroulent donc dans une **zone isolée** :
- tous les processus Claude du harnais (cibles du terminal, messagers, `palabre relay` et ses
  sondes) reçoivent `CLAUDE_CONFIG_DIR=<racine>\config`. Ce dossier est neuf et propre à l'essai ;
- Palabre conserve cette variable dans l'environnement nettoyé, qui ne retire que `CLAUDECODE`,
  `CLAUDE_CODE_*`, `CLAUDE_PID`, `CLAUDE_AGENT_SDK_*` et les variables Codex. Le socket et le jeton
  de messagerie de notre session ne passent donc pas ;
- **le mainteneur connecte lui-même** ce dossier (`claude auth login` avec cette variable).
  Ni Claude ni le harnais ne lisent, copient ou saisissent d'identifiants ;
- la zone ne contient que les cibles jetables du terminal. Les conversations desktop et notre
  session utilisent le dossier de configuration habituel.

**Condition préalable, vérifiée à sec** (§ 3) : vue de la zone, `claude agents --json` ne doit lister
que les cibles du harnais. Il ne doit montrer ni notre session ni aucune autre conversation ouverte.
Réciproquement, vu du dossier habituel, aucune cible de la zone ne doit apparaître.

Si cet isolement n'est pas démontré, **E1 à E6 sont différés**. En effet, tant que P2 n'est pas
établie, même l'essai nominal ne confine pas l'appel du modèle. Aucun essai de remplacement n'est
alors lancé.

**Défense supplémentaire, non suffisante seule.** Le modèle messager ne connaît que le nom de la
cible prévue. Il n'a ni `ListAgents` ni aucun autre outil, et la zone ne contient pas d'autre nom.

**Cibles desktop (D1, D2).** Elles sont hors zone, puisque Claude desktop utilise le dossier
habituel. Elles ne sont lancées que si E1 à E4 ont établi P2, P3, P5 et P6, toutes pannes concluantes
et sans fuite. Elles passent par `palabre relay` et son vrai garde, qui impose `to` par
substitution. Sinon, D1 et D2 sont différés.

### 2.2 Ciblage et identité

- Racine dédiée : `%TEMP%\palabre-b23\<essai>\`. Chaque cible a son dossier de travail dessous et
  un nom unique, `palabre-b23-<essai>-<cible>`.
- Les cibles du terminal sont créées par le harnais avec `--session-id <uuid>` choisi par lui. Les
  cibles desktop sont créées par le mainteneur, dans un dossier de cette racine.
- Toutes sont en `haiku`, ou à défaut dans le plus petit modèle proposé par Claude desktop.

Avant chaque envoi, le harnais refuse la cible sauf si toutes ces conditions sont réunies :
- l'UUID figure dans le manifeste de l'essai ;
- le registre contient une seule entrée pour cet UUID et ce nom ;
- le `cwd` de cette entrée est sous la racine jetable ;
- l'UUID diffère de `CLAUDE_CODE_SESSION_ID` et de `CLAUDE_CODE_HOST_SESSION_ID` de l'appelant ;
- le `pid` diffère de `CLAUDE_PID`.

Le refus d'auto-ciblage de Palabre (`self-target`) reste actif en plus.

### 2.3 Outils des cibles

`--tools Read,Glob,Grep` ne retire pas les outils MCP. Les cibles du terminal sont donc lancées
avec :
- `--tools Read,Glob,Grep` ;
- `--strict-mcp-config --mcp-config {"mcpServers":{}}` : aucun serveur MCP, y compris ceux du compte
  ou d'un plugin ;
- `--settings` avec `disableAllHooks` (et `crossSessionInbound` pour E5e et E5f) ;
- un dossier de travail vide et le dossier de configuration neuf de la zone : ni plugin, ni réglage
  ou serveur MCP de l'utilisateur.

`--restricted` n'est pas utilisé pour les cibles, car il refuse `bypassPermissions`, dont E5d a
besoin.

**Contrôle des outils effectivement exposés**, par des commandes locales sans appel de modèle :
- au contrôle à sec, puis avant le tour de contexte de chaque cible, le harnais relève l'écran de
  `/mcp` (aucun serveur attendu) et de `/context` (aucun outil MCP attendu) ;
- après chaque tour, le transcript ne doit contenir que des appels `Read`, `Glob` ou `Grep`.

Si ces commandes ne permettent pas de lister les outils de façon fiable avec cette version, le
contrôle à sec le signale et le mainteneur décide avant toute suite.

Côté messager, `system/init` ne doit annoncer que `SendMessage` et l'outil du garde (§ 7, critère 5).

### 2.4 Exécutable, réglages et messages

- **Exécutable** : `%USERPROFILE%\.local\bin\claude.exe` (2.1.292), toujours par son chemin
  absolu. Le premier `claude.exe` du PATH est l'alias `WindowsApps` en 2.1.85, que le pilote
  refuse. La version est relevée au début et à la fin de l'essai.
- **Aucun réglage persistant modifié** : ni les réglages de l'utilisateur, ni ceux de Claude
  desktop, ni les réglages administrés. Deux effets persistants sont attendus hors des dossiers
  jetables :
  - l'approbation de la config temporaire de Palabre, dans `~/.palabre/trusted-configs.json` ;
  - la connexion du dossier isolé, que le mainteneur peut retirer à la fin (`claude auth logout`
    avec la même variable).
- **Messages bénins.** Le contexte initial est un code factice, par exemple
  `Contexte : le code de cette conversation est CAMPANULE-<n>. Réponds uniquement OK.`. Le message
  relayé demande de rappeler ce code et porte un jeton propre à l'essai, `B23-<essai>-<n>`.

### 2.5 Arrêt des processus

- Le harnais n'arrête **que les processus qu'il a créés**.
- À chaque lancement, il inscrit dans le manifeste le `pid`, l'heure de création et le chemin de
  l'exécutable.
- Avant tout arrêt, il revérifie ces trois valeurs, pour ne pas viser un `pid` réutilisé. Il arrête
  alors l'arbre issu de ce `pid` (`taskkill /PID <pid> /T`). Il n'arrête jamais par nom d'image
  (`claude.exe`, `node.exe`).
- Les gardes sont des enfants du messager et sont couverts par l'arbre.
- Un processus qui survit est signalé (§ 7, critère 6) et laissé au mainteneur.

**Cibles desktop.** Le harnais ne les arrête jamais et n'agit pas sur Claude desktop. Pour les
arrêter, il cesse tout envoi et demande au mainteneur, dans la conversation de pilotage, de :
- arrêter le tour en cours avec le bouton d'arrêt de la conversation ;
- puis archiver ou fermer la conversation.

Un message gardé en attente (D2) expire seul. Le harnais relève encore le transcript 6 minutes après
l'envoi, puis s'arrête.

## 3. Préparation et contrôle à sec (après accord sur ce protocole)

1. **Harnais** `scripts/prototypes/relay/b23-*.mjs`, conservé et non versionné comme les sondes.
   - Il lance et ferme les cibles du terminal (pseudo-terminal, comme `open-claude-tui.mjs`).
   - Il écrit le manifeste, appelle `palabre relay --open --json` et lance les messagers de panne.
   - Il copie les traces et tient le suivi du budget (§ 6).
   - Ses propres messagers reprennent `messengerArgs`, `messengerSettings` et `messengerPrompt`
     compilés de Palabre. Seul le garde change (E2 à E4).
2. **Config jetable** dans la racine : agent `claude` avec le chemin absolu de l'exécutable,
   approuvée par `--trust-config`.
3. **Contrôle à sec**, sans aucun message envoyé à un modèle :
   - versions de `claude.exe` et Node ;
   - `auth status` dans la zone, après la connexion faite par le mainteneur ;
   - **isolement** (§ 2.1) :
     - ouverture d'une cible du terminal dans la zone, sans lui écrire ;
     - `agents --json` vu de la zone, puis vu du dossier habituel ;
   - **outils exposés** (§ 2.3) : écrans `/mcp` et `/context` de cette cible ;
   - construction du manifeste, des arguments de chaque messager et des configurations de panne ;
   - test des gardes de panne hors CLI : chacun, piloté directement en JSON-RPC, doit produire la
     panne prévue au bon moment ;
   - test de l'arrêt ciblé sur un processus factice créé par le harnais.

   Ouvrir une cible du terminal ne lui envoie aucun message. La CLI peut toutefois faire des
   requêtes de service au démarrage ; le contrôle à sec relève les écrans pour le montrer.
4. **Revue** du harnais et du rapport du contrôle à sec, puis demande d'accord pour les appels réels.

## 4. Essais en zone isolée

Chaque essai commence par une référence des transcripts concernés. Il se termine par une lecture
de contrôle : aucune entrée de pair portant le jeton de l'essai hors de la cible prévue. Cette
lecture reste un critère d'arrêt (§ 7), mais n'est **pas** la protection : c'est la zone isolée qui
la fournit.

Abréviations :
- `peer` : entrée de pair reçue par la cible, sous la forme exacte `<cross-session-message …>` ;
- « fuite » : toute entrée de pair liée à l'essai alors que le garde n'a rien autorisé.

### E1. Nominal, cible du terminal en mode `default` (P1, P2, P5, P9)

- Montage : cible T1, puis `palabre relay --open --json --timeout 180`.
- Attendu :
  - `status: replied` ;
  - une seule entrée `peer`, dont le corps est exactement l'enveloppe, sans le texte de
    remplacement ;
  - le code CAMPANULE rappelé ;
  - côté messager : `guard: loaded`, `guardConsulted: true`, `sendAllowed: true`, `model` haiku ;
  - `system/init` ne liste que `SendMessage` et l'outil du garde.
- Relevés, par un garde témoin qui journalise puis délègue au vrai garde, dans un second
  lancement E1b :
  - la demande brute reçue par le garde (`tool_name`, clés de `input`, `tool_use_id`) ;
  - les noms (pas les valeurs) des variables d'environnement du serveur MCP ;
  - la durée et le coût annoncé par le messager.
- Lancements : 2 messagers. Cible : 1 tour de contexte et 2 réponses.

### E2. Garde consulté et refus (P2, P9)

- Montage : cible T2, messager du harnais avec un garde qui journalise et **refuse**.
- Attendu :
  - la demande est journalisée par le garde ;
  - le résultat de l'outil signale le refus ;
  - aucune entrée `peer` dans T2 pendant 60 s après la fin du messager.
- Lancements : 1 messager.

### E3. Pannes du garde (P3, P4)

Un messager par panne, tous vers la même cible T2, qui est la seule conversation de la zone pendant
cette série :

| Essai | Panne (configuration MCP toujours valide) |
| --- | --- |
| E3a | **Script absent** : l'entrée `palabre_guard` lance l'interpréteur Node courant sur un chemin de script inexistant |
| E3b | Plantage au démarrage : script présent, qui sort en code 1 avant de répondre à `initialize` |
| E3c | Plantage pendant la décision : le script sort à réception de `tools/call` |
| E3d | Aucune réponse : `tools/call` reste sans réponse, puis le harnais arrête le messager au bout de 60 s |
| E3e | Réponse au JSON invalide dans le texte de l'outil |

Chaque résultat est classé dans l'une de ces trois catégories, et seule la deuxième établit P3
pour cette panne :

1. **Refus au démarrage** : la CLI s'arrête ou signale l'outil de permission indisponible avant
   tout appel `SendMessage` du modèle. Le flux ne contient aucun `tool_use`. C'est un échec fermé,
   mais il ne teste pas le chemin de décision.
2. **Panne effectivement atteinte** : le flux contient le `tool_use` `SendMessage`, et la panne a
   eu lieu au moment prévu.
   - Pour E3a et E3b, le garde est annoncé en échec dans `system/init`, ou son processus est sorti
     avant `initialize`.
   - Pour E3c, E3d et E3e, le journal du garde montre la réception de `tools/call`.

   Attendu : aucune entrée `peer` dans T2 pendant le lancement et les 60 s suivantes, et le texte
   de remplacement absent du transcript.
3. **Non concluant** : le modèle n'appelle pas `SendMessage`, ou la panne n'a pas eu lieu comme
   prévu (par exemple, pas de `tools/call` journalisé pour E3c). L'essai peut être repris une fois
   (§ 6).

E3d vérifie aussi que l'arbre de processus est bien terminé (`forcedReturn: false`, aucun processus
du manifeste survivant). Il couvre l'arrêt pendant une demande de permission.

- Relevés : issue, catégorie, `stopReason`, flux `stream-json`, journal du garde.
- Lancements : 5 messagers.

### E4. Unicité et substitution (P5, P6)

- Montage : cible T1. Messager du harnais avec le vrai garde (via le garde témoin) et une consigne
  qui demande **deux** appels `SendMessage` dans le même message, avec `--max-turns 3`.
- Attendu :
  - le garde enregistre une autorisation et un refus ;
  - une seule entrée `peer`, égale à l'enveloppe.
- Si le modèle ne fait qu'un appel, l'essai est noté non concluant et repris une seule fois.
- Lancements : 1 à 2 messagers.

### E5. Modes et réglages de réception de la cible (P7)

Une cible du terminal par ligne, puis `palabre relay --open --json --timeout 120`, sans répondre à
aucune boîte de dialogue :

| Essai | Cible | Attendu documenté |
| --- | --- | --- |
| E5a | `--permission-mode acceptEdits` | Message remis, `replied` |
| E5b | `--permission-mode plan`, sans contournement disponible | Compte comme une demande de permissions : message remis |
| E5c | `--permission-mode plan --allow-dangerously-skip-permissions` | Compte comme un contournement en terminal interactif : message gardé pour approbation |
| E5d | `--permission-mode bypassPermissions --allow-dangerously-skip-permissions` | Message gardé ; `hold` par défaut expiré après `dialogExpiry` (5 min) ; aucune entrée `peer` 6 min après l'envoi |
| E5e | `default`, avec `crossSessionInbound: "hold"` explicite | Message conservé sans remise, sans expiration : contrôlé à 6 min, puis la cible est fermée sans répondre |
| E5f | `default`, avec `crossSessionInbound: "refuse"` | Message supprimé, aucune entrée `peer` |
| E5g | `--permission-mode auto` | Facultatif : seulement si le compte le propose, sinon noté indisponible |

- Pour E5c, E5d et E5e, Palabre doit rendre `timeout` avec la délivrance `unknown`, jamais
  `not-delivered`. On relève l'écran de la cible (boîte d'approbation visible ou non).
- Lancements : 6 à 7 messagers. Cibles : 1 tour de contexte chacune, une réponse pour E5a et E5b.

### E6. Cible occupée (P8)

- Montage : cible T3, à qui l'on demande de lire un à un six petits fichiers du dossier jetable,
  puis de les résumer. Le relay part dès le premier appel d'outil observé.
- Attendu : `persisted-no-reply` ou `replied`. Le lecteur doit rester cohérent : aucune réponse
  attribuée à tort, et la raison `turn-start-not-proven` si le message se mêle au tour.
- Lancements : 1 messager. Cible : 2 tours environ.

## 5. Essais desktop D1 et D2 (P1, P7), avec le mainteneur

Ils ne sont lancés qu'aux conditions du § 2.1 : P2, P3, P5 et P6 établies en zone isolée.

- **Préparation par le mainteneur** :
  - créer deux conversations dans `%TEMP%\palabre-b23\<essai>\desktop-1` et `desktop-2`, en Haiku ;
  - les renommer `palabre-b23-<essai>-d1` et `-d2` ;
  - y envoyer le message de contexte ;
  - mettre D2 en mode « Contourner les permissions ».
- Le harnais retrouve chaque UUID dans le registre habituel, par son dossier. Il exige une seule
  entrée par dossier.
- **D1**, en mode par défaut : attendu `replied`, comme E1.
- **D2** : attendu un `hold` par défaut, que desktop ne peut pas afficher, puis son expiration.
  Palabre rend `timeout` / `unknown`, et aucune entrée `peer` n'apparaît 6 min après l'envoi.
- Arrêt : voir le § 2.5.
- Lancements : 2 messagers.

## 6. Budget

### Plafonds

| Poste | Plafond |
| --- | --- |
| Lancements de messager (`haiku`, `--max-budget-usd 0.25` chacun) | **25** au total, reprises comprises |
| Conversations cibles | **14** (10 du terminal, 2 desktop, 2 de réserve) |
| Appels de modèle des cibles | **40** |
| Coût estimé cumulé (messagers et cibles) | arrêt à **4 USD** |
| Durée | environ 1 h 30, dont les attentes d'expiration (E5d, E5e, D2) |

Estimation attendue : 1 à 2 USD en équivalent API. Sur un abonnement, c'est une consommation de
quota, pas une facture.

### Suivi

- **Messager.** Le coût est le `total_cost_usd` de son événement `result`. Sans cet événement (arrêt,
  plantage, échéance), le coût est estimé d'après les champs `usage` des messages assistant
  **complets** du flux, mais seulement si le flux montre qu'aucune requête n'était en cours à
  l'arrêt, par exemple un `tool_use` en attente de permission. Sinon, le coût est **inconnu**.
- **Cibles.** Chaque appel de modèle est compté par identifiant de message assistant distinct dans
  le transcript. Son coût est estimé d'après ses champs `usage`. Si `/cost` donne un montant
  lisible à la fermeture d'une cible, il sert de recoupement, et le plus élevé des deux est retenu.
  Une cible dont le transcript est illisible a un coût et un nombre d'appels inconnus.
- **Tarifs.** Ils sont relevés sur la page officielle des prix pour le modèle annoncé
  (`system/init` ou transcript) et inscrits dans le harnais avant la revue. Un modèle absent de
  cette table donne un coût inconnu.
- **Un coût absent ou inconnu n'est jamais compté pour zéro.**

### Avant chaque lancement

Un lancement (messager, ou tour de contexte d'une cible) n'est permis que si :
1. le suivi est **complet** : aucun coût ni nombre d'appels inconnu à ce stade ;
2. la somme suivante reste sous le plafond de 4 USD :
   - le coût déjà constaté ;
   - 0,25 USD par messager prévu par l'essai (son plafond `--max-budget-usd`) ;
   - une réserve par appel de cible prévu. Elle vaut 0,10 USD au départ, puis deux fois le plus
     coûteux des appels de cible observés.
3. les plafonds de lancements et d'appels restent respectés en comptant l'essai entier.

**Si le suivi devient incomplet, aucun nouvel appel n'est lancé.** Le harnais suspend le protocole
et le signale au mainteneur. La reprise exige son accord, avec une borne explicite pour le coût
inconnu.

### Reprises

Une seule reprise par essai, et seulement pour un résultat non concluant de cause
environnementale : modèle qui n'appelle pas l'outil, ou cible pas encore prête. Une reprise ne sert
jamais à « obtenir le bon résultat ».

## 7. Critères d'arrêt

**Arrêt immédiat de tout le protocole.** Le harnais ne fait plus aucun envoi, arrête ses propres
processus (§ 2.5) et conserve les traces :
1. une entrée `peer` liée à l'essai apparaît dans une conversation autre que la cible prévue,
   notamment notre conversation active ;
2. une **fuite** en E2 ou E3 : l'envoi passe sans autorisation du garde. La propriété P3 est alors
   réfutée, et la suite n'aurait plus de sens ;
3. plus d'une entrée `peer` pour une seule tentative ;
4. un corps reçu différent de l'enveloppe, ou le texte de remplacement reçu ;
5. un messager dont le modèle n'est pas haiku, ou qui annonce d'autres outils que `SendMessage` et
   le garde ; une cible qui expose un outil MCP ou un autre outil que `Read`, `Glob` et `Grep` ;
6. un processus du manifeste qui survit à l'arrêt (`forcedReturn: true`) ;
7. le budget atteint (§ 6), ou une limite d'usage signalée ;
8. un changement de version de `claude.exe`, une collision de nom, une anomalie du registre portant
   sur une cible, ou une conversation non prévue visible dans la zone isolée ;
9. une demande d'arrêt du mainteneur, ou un fichier `STOP` dans la racine de l'essai.

**Suspension** (aucun nouvel appel, reprise sur accord du mainteneur) : suivi du budget incomplet
(§ 6).

**Arrêt d'un seul essai**, sans arrêt du protocole : deux résultats non concluants de suite, ou
une boîte de dialogue inattendue sur une cible du terminal. L'essai est alors noté non concluant.

## 8. Traces et conservation

- Dossier `.tmp/relay-b23/<essai>/` :
  - manifeste : UUID, noms, dossiers, modes, processus créés ;
  - rapport du contrôle à sec ;
  - versions et sortie JSON de chaque `palabre relay` ;
  - flux `stream-json` des messagers et journaux des gardes ;
  - copie des transcripts cibles ;
  - écrans nettoyés des cibles du terminal ;
  - suivi du budget.
- Le dossier de configuration isolé est conservé, sauf ses identifiants. Leur retrait appartient
  au mainteneur.
- Les conversations jetables, leurs dossiers et les scripts du harnais sont **conservés**, comme
  les sondes précédentes. Les cibles du terminal sont fermées à la fin ; les conversations desktop
  restent à la main du mainteneur.
- Bilan en français sur #96 : résultat par propriété (démontrée, réfutée ou non concluante),
  catégorie de chaque panne E3, limites constatées, et documentation à corriger dans le contrat.

## 9. Après B2.3, sur accord séparé

1. **Notre conversation active** : un seul relay, depuis une autre session, avec un accord donné au
   moment même et le texte du message montré avant l'envoi.
2. **Promotion vers `not-delivered`** : examinée seulement au vu des résultats de E2 et E3, et
   seulement dans le périmètre de versions et de politiques vérifié.

B2.3 ne couvre pas :
- les politiques administrées ;
- d'autres versions que 2.1.292 pour le messager et celle de Claude desktop relevée ;
- macOS et Linux.
