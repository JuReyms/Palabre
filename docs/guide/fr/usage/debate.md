---
title: Mode Débat
description: Faire dialoguer deux agents, régler les tours et obtenir une synthèse contradictoire.
---

Débat est le mode principal de Palabre. Deux agents se répondent sur un même sujet avec le contexte et l'historique des réponses précédentes.

## Depuis la TUI

```bash
palabre
```

Puis :

```text
/debat
/agents codex claude
/roles architect critic
Critique ce plan et tranche les désaccords importants
```

Chaque réponse reçoit le sujet, le contexte, les fichiers injectés et l'historique. La synthèse finale organise le consensus, les désaccords, les actions proposées et une conclusion courte.

Le nombre de réponses est compris entre 1 et 20. Il s'agit du total, pas du nombre par agent. Palabre peut s'arrêter après un tour complet lorsqu'un accord explicite est détecté.

## Commandes directes

```bash
palabre codex-claude "Critique ce plan" -t 4
palabre run --subject "Critique ce plan" --agent-a codex --agent-b claude --turns 4
```

Ajoutez `--no-early-stop`, `--no-summary` ou `--summary-agent <agent>` selon le besoin. `--dry-run` prévisualise la session sans appeler d'agent. L'export utilise `.debate.md`.
