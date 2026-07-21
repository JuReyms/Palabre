---
title: Catalogues JSON
description: Consommer les agents, presets, scans de contexte et exports récents au format JSON versionné.
---

Ces commandes écrivent un document JSON sur stdout et terminent sans lancer de session IA.

- `palabre agents --json` expose `roles[]`, `agents[]` et `defaults.askAgents[]`. Chaque agent fournit son nom, type, rôle, disponibilité et une raison si nécessaire.
- `palabre presets --json` expose les paires, leur ordre, `available`, `missingAgents[]` et `unavailableReasons[]`.
- `palabre context scan src docs --json` expose la racine, les chemins demandés, `items[]` et `warnings[]`.
- `palabre history --json` expose les exports récents dans `history[]`.

## Règles de consommation

- vérifier `v` ;
- ignorer les champs inconnus ;
- accepter l'absence des champs optionnels ;
- ne pas recalculer la disponibilité ou les règles de scan ;
- afficher les avertissements sans en modifier le sens.
