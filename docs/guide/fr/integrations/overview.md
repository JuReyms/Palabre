---
title: Intégrer Palabre
description: Piloter Palabre depuis une extension ou un autre processus sans reproduire sa logique métier.
seo:
  title: Piloter Palabre depuis votre propre outil
  description: Contrôler Palabre depuis une extension ou un autre processus sans réimplémenter sa logique d'orchestration.
---

Palabre CLI est la source de vérité pour les agents, presets, contexte, orchestration, erreurs et exports. Une intégration lance le CLI comme processus enfant et rend ses contrats publics, sans analyser la TUI ni réimplémenter ses décisions.

| Besoin | Contrat |
|--------|---------|
| Agents | `palabre agents --json` |
| Paires | `palabre presets --json` |
| Contexte | `palabre context scan --json` |
| Historique | `palabre history --json` |
| Prévisualisation | `--dry-run --renderer ndjson` |
| Session | `--renderer ndjson` |
| Identité | `PALABRE_CLIENT`, `PALABRE_CLIENT_VERSION` |

Les sorties portent un champ `v`. Les ajouts optionnels restent compatibles ; toute suppression, renommage ou modification de sens exige une nouvelle version.

## Lancer une session

```bash
palabre run --mode debate --subject "Sujet" --agent-a codex --agent-b claude --renderer ndjson
palabre run --mode ask --subject "Sujet" --agents codex claude --renderer ndjson
palabre chat --agent-a codex --renderer ndjson
```

Chat reçoit les messages sur stdin. Une intégration lit stdout ligne par ligne, conserve stderr séparément et attend la fermeture du processus.

Consultez [Catalogues JSON](/fr/integrations/json-contracts), [NDJSON v1](/fr/integrations/ndjson) et [Cycle de vie](/fr/integrations/client-lifecycle).

## Relay et son option Mission

`palabre relay … --json` rend un seul objet `relay-result` v1 ; `palabre mission … --json`, un seul `mission-result` v1. Contrairement au flux NDJSON des sessions Débat, Ask et Chat, ce ne sont pas des flux d'événements. Un envoi Relay ne pose pas de question ; `relay allow-repo`, commande réservée au propriétaire, exige en revanche une confirmation interactive.

Sur `config-untrusted` ou `task-not-allowed`, présentez la commande d'approbation au propriétaire et attendez. Une intégration ou un agent ne modifie ni n'approuve une politique pour élargir ses droits. `--mode` dans une commande de session prime sur `defaults.mode`.
