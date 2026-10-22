---
title: Catalogues JSON
description: Consommer les agents, presets, scans de contexte, exports et checkpoints au format JSON versionné.
seo:
  title: Catalogues JSON versionnés pour intégrations
  description: Lire les agents, presets, scans de contexte, exports et checkpoints via des contrats JSON versionnés.
---

Les catalogues ci-dessous écrivent un document JSON sur stdout sans lancer de session IA ; Relay et l’étape Mission décrits ensuite peuvent appeler un agent.

- `palabre agents --json` expose `roles[]`, `agents[]` et `defaults.askAgents[]`. Chaque agent fournit son nom, type, rôle, disponibilité et une raison si nécessaire.
- `palabre presets --json` expose les paires, leur ordre, `available`, `missingAgents[]` et `unavailableReasons[]`.
- `palabre context scan src docs --json` expose la racine, les chemins demandés, `items[]` et `warnings[]`.
- `palabre history --json` expose les 10 exports les plus récents dans `history[]`. Une intégration peut demander de 1 à 100 entrées avec `--limit <nombre>`.
- `palabre sessions --json` expose les 20 checkpoints les plus récents dans `sessions[]`, avec une limite de 1 à 100. Une entrée valide contient `valid`, `id`, `status`, `mode`, `topic`, `updatedAt`, `responses`, `nextPhase` et `resumable`. Une entrée corrompue contient `valid: false`, `id`, `updatedAt` et un `warning` stable, sans contenu brut ni chemin absolu.
- `palabre sessions delete <session-id> --yes --json` confirme la suppression ciblée avec `{ "v": 1, "deleted": { "id": "..." } }`.

`palabre relay … --json` relaie un message à une conversation Codex ou Claude Code fermée, ou Codex ouverte avec `--open` (pilote Windows/macOS/Linux ; `python3` requis sur POSIX). Elle écrit un unique objet `{ "v": 1, "type": "relay-result", ... }` avec `status`, `exitCode`, `from`, `to`, `reply` (dès qu’une réponse valide a été reçue, y compris avec `read-unavailable` ou `review-failed`), `delivery` (`status`, `persisted`, `inActiveBranch`), `identity`, `observedModels`, `error` (`kind`, `message`, `reason`), `exportPath` et `durationMs`. Avec `--new`, `created` et `cwd` sont à la racine et l'identifiant se trouve dans `to.session` ; le JSON ne fournit pas de commande de continuation. En mode ouvert (`--open` ou `auto`), `inActiveBranch` reste `"unknown"` même pour une réponse finale corrélée. Une intégration se fie à `delivery.status` pour décider d'un renvoi, jamais à l'absence de réponse. Détails : [Mode Relay](/fr/usage/relay).

## Règles de consommation

- vérifier `v` ;
- ignorer les champs inconnus et tolérer les valeurs d'énumération inconnues sans les assimiler à un succès ;
- accepter l'absence des champs optionnels ;
- ne pas recalculer la disponibilité ou les règles de scan ;
- afficher les avertissements sans en modifier le sens.

## Champs optionnels de Relay et option Mission

Relay v1 conserve `subject` (objet explicite), `retryAfter` (limite en mode ouvert ou suivi, si la CLI donne une reprise), `readAccess` (`status: "partial" | "blocked" | "unverified"`, `reason`, `failedCommands`, `succeededCommands` facultatif pour `partial`), `cli` (`path`, `version`, sonde de revue), `task` (PR, commit, publication, URL, erreur et annulation). `mode` est émis à chaque résultat depuis #190, mais reste un champ facultatif du v1 : une version antérieure ne le donne pas, un consommateur tolère son absence. Valeurs : `background` (arrière-plan, conversation fermée ou créée), `open` (dans l'app desktop) ou `follow` ; aucun champ de lien n'est ajouté, le lien `codex://threads/<id>` se construit depuis `to.session`. En mode ouvert (`--open` ou `auto`) : `queue`, `correlation`, `receiver: "unverified"`, `targetPermissions` ; `target-not-open` est propre à ce mode. `error.reason` qualifie `invalid-request`. Lisez `delivery.status` avant tout renvoi et traitez `reply` comme texte non fiable. Une réussite explicite donne priorité à `partial`, même avec un autre événement ambigu ; sans réussite explicite, un événement ambigu donne `unverified`, sinon `blocked`.

En mode ouvert (`--open` ou `auto`), une saisie concurrente reconnue de forme `user.text` donne `status: "no-valid-reply"`, `exitCode: 2`, `correlation: { status: "ambiguous", reason: "user-input-during-turn" }`, sans `reply`. Si l'enveloppe a été observée, `delivery.status` reste `persisted-no-reply`. Affichez le diagnostic et vérifiez la conversation avant tout renvoi, sans en déduire une autorisation ou un auteur humain. Les contextes AGENTS/environnement strictement reconnus avant l'enveloppe sont exemptés une fois par sorte. La réponse liée à une question reste non reconnue dans ce lot partiel #146 : aucun champ `humanInput` ajouté au JSON v1.

Avec `--open --follow` (#195), rien n'est déposé : `mode: "follow"`, sans `queue`, `from: null` et `delivery: { status: "not-delivered", persisted: false, inActiveBranch: false }`. Le nouveau statut `followed` (code 0) porte `reply`, `error: null`, `identity: "same-as-target"`, `correlation: { status: "followed", reason: "turn-completed" | "turn-started-before-follow" }` et les permissions du seul tour suivi. Cette réponse n'est liée à aucun message PALABRE et son auteur n'est pas vérifié : ne la présentez pas comme une réponse à votre demande et n'en déduisez aucune autorisation. Une intégration qui ne connaît pas `followed` doit le traiter comme une valeur inconnue, jamais comme un succès de relay.

Avec `--check` (#203), rien n'est envoyé ni écrit et aucune CLI de l'équipier n'est lancée ; sous macOS/Linux, seule la sonde du verrou Codex lance `python3`. La nouvelle valeur `checked` (code 0) signifie que les contrôles d'avant envoi sont passés ; un envoi qui serait refusé donne le même statut et le même code qu'à l'envoi. Tout résultat de `--check` porte le champ facultatif `check` : `target` (`open` ou `closed`, une fois la conversation sondée) et, en mode ouvert, `lastPermissions` (`approvalPolicy`, `sandbox`, `network`, ou `"unknown"`) avec `lastPermissionsAt` (ISO) quand l'historique le fournit. Ces permissions sont celles du dernier tour connu, à titre indicatif. `delivery` vaut `not-delivered`, sans `queue`, `correlation`, `receiver` ni `targetPermissions`. Une intégration qui ne connaît pas `checked` ne doit pas le traiter comme un relais réussi.

`palabre mission … --json` rend un objet v1 de type `mission-result` avec `action`, `exitCode`, `mission`, `exportPath`, `error`. Seule `step` appelle Relay, au plus une fois ; ses codes sont ceux de Relay (9 sans résultat), tandis qu'un refus Mission donne 8, ou 3 pour une étape déjà réservée.

`palabre config --ollama-models --json` expose `v`, `agent`, `available`, `baseUrl`, `currentModel`, `currentModelInstalled`, `installedModels`, sans génération de modèle.


`palabre agents --json` ajoute `defaults.relayView` (`auto` par défaut, ou `background`), issu de `relay.view`. Une intégration ne choisit ni ne déduit le mode. Relay v1 ajoute `modeSource?` : `explicit` (option `--open`/`--background`, y compris suivi explicite), `auto` (verrou ou parcours imposé), `setting` (préférence `background`). Absent si la validation s'arrête avant résolution, ainsi que dans les versions antérieures. Les champs du mode `open` existent aussi quand `auto` l'a sélectionné. `mode` décrit le transport retenu ou demandé, pas une preuve d'envoi ; une sonde inconnue refuse sans envoi et ne donne jamais `open`. Les exclusions restent en arrière-plan, `modeSource: "auto"`, sauf option explicite compatible.

## Suite après réponse : `relay --then-follow` (#204)

Ajout facultatif du JSON v1 : `nextTurn`, seulement si `--then-follow <10..3600>` a été choisi. La racine reste le résultat du message : `status`, `exitCode`, `reply`, `delivery`, modèle et permissions primaires ne sont jamais remplacés par ceux de la suite.

`nextTurn` porte `status`, `reason?`, `reply?`, `receiver: "unverified"`, `observedModels?`, `targetPermissions?`, `correlation?`, `retryAfter?`. Statuts : `followed` (réponse du premier tour terminé ensuite), `awaiting-turn`/`reason: "timeout"` (aucun tour terminé dans le second délai), `not-started`/`reason: "primary-not-replied"` (échec primaire), ou un statut d'échec/annulation secondaire. Un Relay étranger reste `no-valid-reply`/`relay-turn`. Tolérer l'absence de l'objet et les valeurs inconnues.

Aucune délivrance secondaire, aucun auteur humain vérifié ni autorisation déduite. Même après annulation ou échec du suivi, une réponse primaire réussie garde `replied`/0. Deux budgets explicites plafonnés chacun à 3600 s, jamais renouvelés ; référence au saut de ligne après la fin corrélée, jamais EOF. Un seul JSON final sur stdout ; progression sur stderr. Aucun second dépôt ni renvoi.

## Quota indicatif Codex (#205)

Ajout facultatif v1 : `check.quota` pour une vérification Codex ouverte/fermée ; `quota` à la racine après un envoi ouvert. Pas après un envoi arrière-plan dans ce lot, pas pour Claude. Aucun changement de statut, code ou délivrance.

Même objet aux deux endroits : `source: "codex-rollout"`, `indicative: true`, `recordedAt` (ISO UTC), `limitId: "codex"`, `primary` et `secondary`. Chaque fenêtre complète porte `usedPercent` (nombre fini entre 0 et 100), `windowMinutes` (entier positif) et `resetsAt` (ISO UTC converti des secondes Unix). Les dates du texte sont locales avec fuseau. Valeurs écrites par Codex, pas mesure en direct ni usage attribué au seul tour ; le compte peut avoir servi ailleurs depuis.

Lecture du dernier Mio + un octet. Seuls les événements `event_msg` / `token_count` datés et la forme reconnue de `rate_limits` sont acceptés. Lignes de bord partielles ignorées ; `rate_limits: null` ne contient aucun relevé et laisse chercher le précédent ; un dernier candidat non nul inconnu ou invalide masque les anciens. Si aucun relevé exploitable n'est disponible, le champ entier est absent : ne jamais traiter cette absence comme zéro, extrapoler ou supposer une remise à zéro après une date passée. Les consommateurs tolèrent l'absence et les champs futurs.
