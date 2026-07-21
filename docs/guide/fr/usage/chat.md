---
title: Mode Chat
description: Converser avec un agent actif, demander un second avis et comprendre la mémoire bornée du mode Chat.
---

Chat convient lorsqu'un seul agent suffit, avec la possibilité de consulter ponctuellement un autre agent.

## Depuis la TUI

Lancez `palabre`, puis `/chat`. Chat utilise l'agent A par défaut. `/agents codex` choisit l'agent actif.

| Commande | Effet |
|----------|-------|
| `/consult claude` | Demande un second avis sans remplacer l'agent actif. |
| `/use claude` | Continue avec Claude. |
| `/agents` | Affiche les agents disponibles. |
| `/end` | Enregistre et termine. |
| `/home` | Revient sans enregistrer. |

Après un Débat ou un Ask, `/chat` reprend le sujet et la synthèse finale, ou les six échanges récents sans synthèse.

## Mémoire et limites

Chat est stateless côté agents externes. Chaque réponse lance un appel batch et réinjecte au maximum les six messages récents. Il ne promet ni session provider persistante, ni streaming token par token, ni reprise après redémarrage.

## Commande directe

```bash
palabre chat --agent-a codex
```

`--role-a`, `--model-a`, `--language`, `--files` et `--context` restent disponibles. L'export `.chat.md` conserve le transcript, l'heure et la raison de fin, sans synthèse automatique.
