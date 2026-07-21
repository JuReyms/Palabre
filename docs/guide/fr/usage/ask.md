---
title: Mode Ask
description: Comparer jusqu'à quatre réponses indépendantes avant une synthèse fidèle.
---

Ask envoie le même sujet et le même contexte à plusieurs agents. Chacun répond sans voir les autres réponses, puis un agent de synthèse les résume et les compare.

## Depuis la TUI

```text
/ask
/agents codex claude opencode
Compare ces deux stratégies de migration
```

Ask accepte de 1 à 4 agents. `/roles critic` applique un rôle commun à tous les agents Ask actifs.

Ask sert à vérifier une convergence sans influence mutuelle, comparer des stratégies ou obtenir plusieurs analyses avant synthèse. Le nombre de réponses dépend des agents ; `--turns` ne s'applique pas.

## Commande directe

```bash
palabre ask "Compare ces approches" --agents codex claude opencode
```

Sans `--agents`, Palabre utilise `defaults.askAgents`, puis la paire de débat par défaut. L'export utilise `.ask.md`.
