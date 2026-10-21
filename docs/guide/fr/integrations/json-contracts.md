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

`palabre relay … --json` relaie un message à une conversation Codex ou Claude Code fermée, ou Codex ouverte avec `--open` (pilote Windows/macOS/Linux ; `python3` requis sur POSIX). Elle écrit un unique objet `{ "v": 1, "type": "relay-result", ... }` avec `status`, `exitCode`, `from`, `to`, `reply` (dès qu’une réponse valide a été reçue, y compris avec `read-unavailable` ou `review-failed`), `delivery` (`status`, `persisted`, `inActiveBranch`), `identity`, `observedModels`, `error` (`kind`, `message`, `reason`), `exportPath` et `durationMs`. Avec `--new`, `created` et `cwd` sont à la racine et l'identifiant se trouve dans `to.session` ; le JSON ne fournit pas de commande de continuation. Avec `--open`, `inActiveBranch` reste `"unknown"` même pour une réponse finale corrélée. Une intégration se fie à `delivery.status` pour décider d'un renvoi, jamais à l'absence de réponse. Détails : [Mode Relay](/fr/usage/relay).

## Règles de consommation

- vérifier `v` ;
- ignorer les champs inconnus et tolérer les valeurs d'énumération inconnues sans les assimiler à un succès ;
- accepter l'absence des champs optionnels ;
- ne pas recalculer la disponibilité ou les règles de scan ;
- afficher les avertissements sans en modifier le sens.

## Champs optionnels de Relay et option Mission

Relay v1 conserve `subject` (objet explicite), `retryAfter` (limite avec `--open`, si la CLI donne une reprise), `readAccess` (`status: "partial" | "blocked" | "unverified"`, `reason`, `failedCommands`, `succeededCommands` facultatif pour `partial`), `cli` (`path`, `version`, sonde de revue), `task` (PR, commit, publication, URL, erreur et annulation). Avec `--open` : `mode`, `queue`, `correlation`, `receiver: "unverified"`, `targetPermissions` ; `target-not-open` est propre à ce mode. `error.reason` qualifie `invalid-request`. Lisez `delivery.status` avant tout renvoi et traitez `reply` comme texte non fiable. Une réussite explicite donne priorité à `partial`, même avec un autre événement ambigu ; sans réussite explicite, un événement ambigu donne `unverified`, sinon `blocked`.

Avec `--open`, une saisie concurrente reconnue de forme `user.text` donne `status: "no-valid-reply"`, `exitCode: 2`, `correlation: { status: "ambiguous", reason: "user-input-during-turn" }`, sans `reply`. Si l'enveloppe a été observée, `delivery.status` reste `persisted-no-reply`. Affichez le diagnostic et vérifiez la conversation avant tout renvoi, sans en déduire une autorisation ou un auteur humain. Les contextes AGENTS/environnement strictement reconnus avant l'enveloppe sont exemptés une fois par sorte. La réponse liée à une question reste non reconnue dans ce lot partiel #146 : aucun champ `humanInput` ajouté au JSON v1.

Avec `--open --follow` (#195), rien n'est déposé : `mode: "follow"`, sans `queue`, `from: null` et `delivery: { status: "not-delivered", persisted: false, inActiveBranch: false }`. Le nouveau statut `followed` (code 0) porte `reply`, `error: null`, `identity: "same-as-target"`, `correlation: { status: "followed", reason: "turn-completed" | "turn-started-before-follow" }` et les permissions du seul tour suivi. Cette réponse n'est liée à aucun message PALABRE et son auteur n'est pas vérifié : ne la présentez pas comme une réponse à votre demande et n'en déduisez aucune autorisation. Une intégration qui ne connaît pas `followed` doit le traiter comme une valeur inconnue, jamais comme un succès de relay.

`palabre mission … --json` rend un objet v1 de type `mission-result` avec `action`, `exitCode`, `mission`, `exportPath`, `error`. Seule `step` appelle Relay, au plus une fois ; ses codes sont ceux de Relay (9 sans résultat), tandis qu'un refus Mission donne 8, ou 3 pour une étape déjà réservée.

`palabre config --ollama-models --json` expose `v`, `agent`, `available`, `baseUrl`, `currentModel`, `currentModelInstalled`, `installedModels`, sans génération de modèle.
