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

`palabre relay … --json` relaie un message à une conversation Codex ou Claude Code fermée, ou Codex ouverte avec `--open` (pilote Windows). Elle écrit un unique objet `{ "v": 1, "type": "relay-result", ... }` avec `status`, `exitCode`, `from`, `to`, `reply` (dès qu’une réponse valide a été reçue, y compris avec `review-failed`), `delivery` (`status`, `persisted`, `inActiveBranch`), `identity`, `observedModels`, `error` (`kind`, `message`, `reason`), `exportPath` et `durationMs`. Une intégration se fie à `delivery.status` pour décider d'un renvoi, jamais à l'absence de réponse. Détails : [Mode Relay](/fr/usage/relay).

## Règles de consommation

- vérifier `v` ;
- ignorer les champs inconnus ;
- accepter l'absence des champs optionnels ;
- ne pas recalculer la disponibilité ou les règles de scan ;
- afficher les avertissements sans en modifier le sens.

## Champs optionnels de Relay et option Mission

Relay v1 conserve `subject` (objet explicite), `retryAfter` (limite avec `--open`, si la CLI donne une reprise), `readAccess` (`status` : `partial`, `blocked` ou `unverified`, `reason`, `failedCommands`, et `succeededCommands` pour `partial` ; diagnostic de lancements refusés), `cli` (`path`, `version`, sonde de revue), `task` (PR, commit, publication, URL, erreur et annulation). `partial` et `unverified` conservent l'issue ; `blocked` peut donner `read-unavailable` tout en conservant réponse et délivrance. Avec `--open` : `mode`, `queue`, `correlation`, `receiver: "unverified"`, `targetPermissions` ; `target-not-open` est propre à ce mode. `error.reason` qualifie `invalid-request`. Lisez `delivery.status` avant tout renvoi et traitez `reply` comme texte non fiable.

`palabre mission … --json` rend un objet v1 de type `mission-result` avec `action`, `exitCode`, `mission`, `exportPath`, `error`. Seule `step` appelle Relay, au plus une fois ; ses codes sont ceux de Relay (9 sans résultat), tandis qu'un refus Mission donne 8, ou 3 pour une étape déjà réservée.

`palabre config --ollama-models --json` expose `v`, `agent`, `available`, `baseUrl`, `currentModel`, `currentModelInstalled`, `installedModels`, sans génération de modèle.
