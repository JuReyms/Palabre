# Protocole B2.3 : essais réels jetables du relay vers Claude ouvert

Statut au 8 octobre 2026 : **proposé, non lancé**. Aucun essai, aucun appel de modèle et aucun
envoi n'a lieu avant l'accord explicite du mainteneur. Notre conversation active est **exclue** de
tout le protocole : un essai sur elle demandera un accord distinct, donné au moment même (§ 8).

Référence : contrat `CONTRAT-B2.md` (B2.1, B2.2a), PR #113 au commit `0ac9054`.

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

**Conversations jetables uniquement.**
- Toute cible a son dossier de travail sous une racine dédiée :
  `%TEMP%\palabre-b23\<essai>\`.
- Elle porte un nom unique, `palabre-b23-<essai>-<cible>`.
- Les cibles du terminal sont créées par le harnais avec `--session-id <uuid>` choisi par lui.
  Les cibles desktop sont créées par le mainteneur, dans un dossier de cette racine.
- Toutes sont en `haiku`, ou à défaut dans le plus petit modèle proposé par Claude desktop.

**Avant chaque envoi**, le harnais refuse la cible sauf si toutes ces conditions sont réunies :
- l'UUID figure dans le manifeste de l'essai ;
- le registre (`claude agents --json`) contient une seule entrée pour cet UUID et ce nom ;
- le `cwd` de cette entrée est sous la racine jetable ;
- l'UUID diffère de `CLAUDE_CODE_SESSION_ID` et de `CLAUDE_CODE_HOST_SESSION_ID` de l'appelant ;
- le `pid` diffère de `CLAUDE_PID`.

Notre conversation a son dossier dans le dépôt et ne peut donc pas remplir ces conditions. Le
refus d'auto-ciblage de Palabre (`self-target`) reste actif en plus.

**Environnement.** Les cibles du terminal et les messagers du harnais reçoivent l'environnement
nettoyé de Palabre, sans les variables `CLAUDE_CODE_*` (dont le socket et le jeton de messagerie de
notre session), `CLAUDECODE`, `CLAUDE_PID` ni `CLAUDE_AGENT_SDK_*`.

**Exécutable.** On utilise toujours `%USERPROFILE%\.local\bin\claude.exe` (2.1.292), par son chemin
absolu. Le premier `claude.exe` du PATH est l'alias `WindowsApps` en 2.1.85, que le pilote refuse. La
version est relevée au début et à la fin de l'essai ; un changement arrête tout (§ 6).

**Aucun réglage persistant modifié.** Les réglages de l'utilisateur, ceux de Claude desktop et les
réglages administrés restent intacts. Chaque cible reçoit ses réglages par `--settings` à son
lancement. Seul effet persistant hors des dossiers jetables : l'approbation de la config temporaire,
ajoutée à `~/.palabre/trusted-configs.json`, comme pour le smoke relay.

**Cibles sans écriture.** Les cibles du terminal sont lancées avec `--tools Read,Glob,Grep`,
`disableAllHooks` et un dossier vide, y compris en mode contournement. La réception d'un message
n'est pas un outil, donc cette restriction ne la change pas.

**Messages bénins.** Le contexte initial est un code factice, par exemple
`Contexte : le code de cette conversation est CAMPANULE-<n>. Réponds uniquement OK.`. Le message
relayé demande de rappeler ce code et porte un jeton propre à l'essai, `B23-<essai>-<n>`.

## 3. Préparation (après accord)

1. **Harnais** `scripts/prototypes/relay/b23-*.mjs`, conservé et non versionné comme les sondes :
   - il lance et ferme les cibles du terminal (pseudo-terminal, comme `open-claude-tui.mjs`) ;
   - il écrit le manifeste, appelle `palabre relay --open --json` et lance les messagers de panne ;
   - il copie les traces et tient le compteur de budget ;
   - les messagers qu'il lance lui-même reprennent `messengerArgs`, `messengerSettings` et
     `messengerPrompt` compilés de Palabre. Seul le garde change (§ 4, E2 à E4).
2. **Contrôle à sec**, sans modèle ni cible : `--version`, `auth status`, `agents --json`,
   construction du manifeste et des arguments. Le résultat est montré avant tout appel de modèle.
3. **Config jetable** dans la racine : agent `claude` avec le chemin absolu de l'exécutable,
   approuvée par `--trust-config`.

## 4. Essais

Chaque essai commence par une référence des transcripts concernés. Il se termine par une lecture
de contrôle : aucune entrée de pair portant le jeton de l'essai hors de la cible prévue.

Abréviations :
- `peer` : entrée de pair reçue par la cible, sous la forme exacte `<cross-session-message …>` ;
- « fuite » : toute entrée de pair liée à l'essai alors que le garde n'a rien autorisé.

### E1. Nominal, cible du terminal en mode `default` (P1, P2, P5, P9)

- Montage : cible T1, puis `palabre relay --open --json --timeout 180`.
- Attendu :
  - `status: replied` ;
  - une seule entrée `peer` dont le corps est exactement l'enveloppe, sans le texte de
    remplacement ;
  - le code CAMPANULE rappelé ;
  - côté messager : `guard: loaded`, `guardConsulted: true`, `sendAllowed: true`, `model` haiku ;
  - `system/init` ne liste que `SendMessage` et l'outil du garde.
- Relevés :
  - demande brute reçue par le garde (`tool_name`, clés de `input`, `tool_use_id`) ;
  - noms (pas les valeurs) des variables d'environnement du serveur MCP ;
  - durée, coût annoncé par le messager.

  Ces relevés passent par un garde témoin qui journalise puis délègue au vrai garde, dans un
  second lancement E1b.
- Lancements : 2 messagers. Cible : 1 tour de contexte et 2 réponses.

### E2. Garde consulté et refus (P2, P9)

- Montage : cible T2, messager du harnais avec un garde qui journalise et **refuse**.
- Attendu :
  - la demande est journalisée par le garde ;
  - le résultat de l'outil signale le refus ;
  - aucune entrée `peer` dans T2 pendant 60 s après la fin du messager.
- Lancements : 1 messager.

### E3. Pannes du garde (P3, P4)

Un messager par panne, tous vers la même cible T2. Chaque panne correspond à un garde du harnais :

| Essai | Panne |
| --- | --- |
| E3a | Script absent : `--mcp-config` pointe vers un fichier inexistant |
| E3b | Plantage au démarrage : sortie en code 1 avant `initialize` |
| E3c | Plantage pendant la décision : sortie à réception de `tools/call` |
| E3d | Aucune réponse : `tools/call` reste sans réponse, puis le harnais arrête le messager au bout de 60 s |
| E3e | Réponse au JSON invalide dans le texte de l'outil |

- Attendu pour chacune :
  - aucune entrée `peer` dans T2 pendant le lancement et les 60 s suivantes ;
  - le texte de remplacement n'apparaît nulle part dans le transcript.
- E3d vérifie aussi que l'arbre de processus est bien terminé (`forcedReturn: false`, aucun
  `claude.exe` ni garde survivant). Il couvre l'arrêt pendant une demande de permission.
- Relevés : issue, `stopReason`, flux `stream-json`, `consulted.jsonl` le cas échéant.
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
- Attendu : `persisted-no-reply` ou `replied`. Le lecteur doit rester cohérent : pas de réponse
  attribuée à tort, et la raison `turn-start-not-proven` si le message se mêle au tour.
- Lancements : 1 messager. Cible : 2 tours environ.

### D1 et D2. Claude desktop (P1, P7), avec le mainteneur

Ces cibles demandent une action manuelle : le harnais ne peut pas créer de conversation desktop.

- **Préparation par le mainteneur.**
  - Créer deux conversations dans `%TEMP%\palabre-b23\<essai>\desktop-1` et `desktop-2`, en Haiku.
  - Les renommer `palabre-b23-<essai>-d1` et `-d2`.
  - Y envoyer le message de contexte.
  - D2 est mise en mode « Contourner les permissions ».
- Le harnais retrouve chaque UUID dans le registre par son dossier (une seule entrée exigée).
- D1, en mode par défaut : attendu `replied`, comme E1.
- D2 : attendu un `hold` par défaut que desktop ne peut pas afficher, puis son expiration. Palabre
  rend `timeout` / `unknown`, et aucune entrée `peer` n'apparaît 6 min après l'envoi.
- Lancements : 2 messagers.

## 5. Budget

| Poste | Plafond |
| --- | --- |
| Lancements de messager (`haiku`, `--max-budget-usd 0.25` chacun) | **25** au total, reprises comprises |
| Conversations cibles | **14** (10 du terminal, 2 desktop, 2 de réserve) |
| Tours de modèle des cibles | **40** |
| Coût estimé cumulé (messagers + cibles) | arrêt à **4 USD** |
| Durée | environ 1 h 30, dont les attentes d'expiration (E5d, E5e, D2) |

Estimation attendue : **1 à 2 USD**, en équivalent API avec les tarifs Haiku.
- Le coût d'un messager vient de `total_cost_usd`, annoncé par son événement `result`.
- Le coût d'une cible est estimé d'après les champs `usage` de ses entrées assistant.

Sur un abonnement, ce montant correspond à une consommation de quota, pas à une facture.

Reprises : une seule par essai, et seulement pour un résultat non concluant de cause
environnementale (modèle qui n'appelle pas l'outil, cible pas encore prête). Une reprise ne sert
jamais à « obtenir le bon résultat ».

## 6. Critères d'arrêt

**Arrêt immédiat de tout le protocole.** Le harnais ne fait plus aucun envoi, ferme les cibles et
conserve les traces :
1. une entrée `peer` liée à l'essai apparaît dans une conversation autre que la cible prévue,
   notamment notre conversation active ;
2. une **fuite** en E2 ou E3 : l'envoi passe sans autorisation du garde. La propriété P3 est alors
   réfutée, et la suite n'aurait plus de sens ;
3. plus d'une entrée `peer` pour une seule tentative ;
4. un corps reçu différent de l'enveloppe, ou le texte de remplacement reçu ;
5. un messager dont le modèle n'est pas haiku, ou qui annonce d'autres outils que `SendMessage` et
   le garde ;
6. un processus qui survit à l'arrêt (`forcedReturn: true`) ;
7. le budget atteint (§ 5), ou une limite d'usage signalée ;
8. un changement de version de `claude.exe`, une collision de nom ou une anomalie du registre
   portant sur une cible ;
9. une demande d'arrêt du mainteneur, ou un fichier `STOP` dans la racine de l'essai.

**Arrêt d'un seul essai**, sans arrêt du protocole : deux résultats non concluants de suite, ou
une boîte de dialogue inattendue sur une cible du terminal. L'essai est alors noté non concluant.

## 7. Traces et conservation

- Dossier `.tmp/relay-b23/<essai>/` :
  - manifeste (UUID, noms, dossiers, modes) ;
  - versions et sortie JSON de chaque `palabre relay` ;
  - flux `stream-json` des messagers et journaux des gardes ;
  - copie des transcripts cibles ;
  - écrans nettoyés des cibles du terminal ;
  - compteur de budget.
- Les conversations jetables, leurs dossiers et les scripts du harnais sont **conservés**, comme les
  sondes précédentes. Les cibles du terminal sont fermées à la fin ; les conversations desktop
  restent à la main du mainteneur.
- Bilan en français sur #96 : résultat par propriété (démontrée, réfutée ou non concluante),
  limites constatées, et documentation à corriger dans le contrat.

## 8. Après B2.3, sur accord séparé

1. **Notre conversation active.** Un seul relay, depuis une autre session, avec un accord donné au
   moment même et le texte du message montré avant l'envoi.
2. **Promotion vers `not-delivered`.** Elle n'est examinée qu'au vu des résultats de E2 et E3, et
   seulement dans le périmètre de versions et de politiques vérifié.

B2.3 ne couvre ni les politiques administrées, ni d'autres versions que 2.1.292 (messager) et celle
de Claude desktop relevée, ni macOS ou Linux.

## 9. Décisions demandées

1. Accord sur la liste des essais, ou retrait de certains essais : E5g, ou D1 et D2 qui demandent ta
   présence.
2. Accord sur le budget : 25 messagers, 40 tours cibles, arrêt à 4 USD estimés.
3. Veux-tu relire le harnais et le contrôle à sec avant le premier appel de modèle, ou l'accord
   couvre-t-il l'enchaînement complet ?
