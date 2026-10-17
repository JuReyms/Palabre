---
title: Mode Ask
description: Comparer jusqu'à quatre réponses indépendantes avant une synthèse fidèle.
seo:
  title: "Mode Ask : comparer jusqu’à quatre réponses IA"
  description: Poser une question à un maximum de quatre agents IA, comparer leurs réponses indépendantes puis obtenir une synthèse fidèle.
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

## Synthèse, options et échec

Les agents sont appelés l'un après l'autre ; leur durée s'additionne. La [synthèse](/fr/usage/summaries) résume chaque avis, compare, relève les incertitudes, propose des actions puis conclut. Agent de synthèse : `--summary-agent`, puis `defaults.askSummaryAgent`, `defaults.summaryAgent`, puis le dernier agent Ask ; `--no-summary` la désactive.

Options : `--ask-role critic` (rôle commun temporaire, comme `/roles critic`), `--files`, `--context`, `--checkpoint`. Forme équivalente : `palabre run --mode ask --agents codex claude -s "Sujet"`. Défaut durable : `palabre config --mode ask --ask-agents codex claude opencode`.

En cas d'échec, PALABRE tente un export partiel. Avec `--checkpoint`, `palabre resume <session-id>` reprend l'agent restant qui n'a pas encore répondu, puis les suivants et la synthèse ; pas de rejeu des réponses acceptées.
