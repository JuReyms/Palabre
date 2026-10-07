---
title: Mode Chat
description: Converser avec un agent actif, demander un second avis et comprendre la mémoire bornée du mode Chat.
seo:
  title: "Mode Chat : un agent principal, un second avis"
  description: Converser avec un agent actif, solliciter un second avis quand c'est utile et comprendre la mémoire bornée du mode Chat.
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

En commande directe comme pour une intégration NDJSON, une ligne vide ne termine pas la conversation. `/end` l'enregistre ; `/exit`, `/home` ou la fin de l'entrée la terminent sans export. Si un agent échoue, Palabre enregistre la transcription partielle. Dans la TUI, une saisie vide revient encore à l'accueil sans enregistrer. `--dry-run` n'est pas disponible en Chat : la commande est refusée sans rien lancer.

Les intégrations pilotent Chat avec le [flux NDJSON](/fr/integrations/ndjson).
