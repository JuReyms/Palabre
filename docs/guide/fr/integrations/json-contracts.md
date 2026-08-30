---
title: Catalogues JSON
description: Consommer les agents, presets, scans de contexte, exports et checkpoints au format JSON versionné.
seo:
  title: Catalogues JSON versionnés pour intégrations
  description: Lire les agents, presets, scans de contexte, exports et checkpoints via des contrats JSON versionnés.
---

Ces commandes écrivent un document JSON sur stdout et terminent sans lancer de session IA.

- `palabre agents --json` expose `roles[]`, `agents[]` et `defaults.askAgents[]`. Chaque agent fournit son nom, type, rôle, disponibilité et une raison si nécessaire.
- `palabre presets --json` expose les paires, leur ordre, `available`, `missingAgents[]` et `unavailableReasons[]`.
- `palabre context scan src docs --json` expose la racine, les chemins demandés, `items[]` et `warnings[]`.
- `palabre history --json` expose les 10 exports les plus récents dans `history[]`. Une intégration peut demander de 1 à 100 entrées avec `--limit <nombre>`.
- `palabre sessions --json` expose les 20 checkpoints les plus récents dans `sessions[]`, avec une limite de 1 à 100. Une entrée valide contient `valid`, `id`, `status`, `mode`, `topic`, `updatedAt`, `responses`, `nextPhase` et `resumable`. Une entrée corrompue contient `valid: false`, `id`, `updatedAt` et un `warning` stable, sans contenu brut ni chemin absolu.
- `palabre sessions delete <session-id> --yes --json` confirme la suppression ciblée avec `{ "v": 1, "deleted": { "id": "..." } }`.

## Règles de consommation

- vérifier `v` ;
- ignorer les champs inconnus ;
- accepter l'absence des champs optionnels ;
- ne pas recalculer la disponibilité ou les règles de scan ;
- afficher les avertissements sans en modifier le sens.
