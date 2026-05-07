---
title: Synthèses
description: Comprendre la synthèse finale, choisir l'agent de synthèse et désactiver la synthèse si nécessaire.
---

À la fin d'un débat, Palabre peut demander à un agent de produire une synthèse finale.

## Format de synthèse

La synthèse finale demande quatre sections :

1. `Consensus`
2. `Desaccords / incertitudes`
3. `Actions proposees`
4. `Conclusion`

Les trois premières sections sont structurées en listes. `Conclusion` est un court paragraphe en prose pour comprendre rapidement ce qu'il faut retenir.

## Agent de synthèse

Palabre utilise `defaults.summaryAgent` quand il existe. Sinon, il utilise l'agent B.

Pour choisir l'agent de synthèse sur une commande :

```bash
palabre codex-claude "Critique ce plan" --summary-agent claude
```

Pour choisir aussi le modèle :

```bash
palabre codex-ollama "Critique ce plan" --summary-agent ollama-local --summary-model gemma4:e4b
```

## Désactiver la synthèse

```bash
palabre codex-claude "Critique ce plan" --no-summary
```

## Lisibilité

Dans le terminal, le rendu standard met en forme les titres de synthèse pour les rendre plus faciles à scanner.

Dans l'export `.debate.md`, la synthèse finale est séparée du transcript par une ligne horizontale et commence par une table indiquant l'agent, le rôle et la date de production.
