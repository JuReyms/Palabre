---
title: Lancer une première session
description: Ouvrir Palabre, lancer un premier débat depuis la TUI et retrouver son export Markdown.
---

Le parcours recommandé tient en une commande :

```bash
palabre
```

Dans un terminal interactif, Palabre crée la configuration globale au premier lancement si nécessaire, détecte les agents installés et ouvre l'accueil TUI. Vous n'avez pas besoin de mémoriser une commande complète pour commencer.

## 1. Lancer un Débat

Débat est le mode principal. Si nécessaire, saisissez `/debat`, puis choisissez la paire :

```text
/agents codex claude
```

Le premier agent répond en premier ; le second lui répond. `/agents` sans argument affiche les choix disponibles.

## 2. Saisir le sujet

```text
Critique ce plan technique et identifie les risques prioritaires
```

Pour ajouter du contexte projet :

```text
Critique cette architecture --context src docs
```

Les agents se répondent, puis Palabre produit une synthèse finale lorsqu'elle est activée.

## 3. Retrouver le résultat

Palabre affiche le chemin de l'export `.debate.md`. Utilisez ensuite `/history` pour retrouver les exports Débat, Chat et Ask.

## Essayer les autres modes

| Mode | Agents | Usage |
|------|--------|-------|
| Débat | 2 | Confronter deux positions — mode principal. |
| Chat | 1 actif, consultation facultative | Avancer avec un agent et demander un second avis. |
| Ask | 1 à 4 | Comparer des réponses indépendantes. |

Passez à Chat avec `/chat`, ou à Ask avec `/ask`.

## Commandes directes

Elles sont utiles pour les scripts, les intégrations ou les utilisateurs avancés :

```bash
palabre codex-claude "Critique ce plan" --context src -t 4
palabre chat --agent-a codex
palabre ask "Compare ces approches" --agents codex claude opencode
```

Dans un vrai terminal, elles utilisent encore la TUI par défaut. Ajoutez `--terminal` pour des logs humains ou `--renderer ndjson` pour une intégration.

Continuez avec [Choisir un mode](/fr/usage/running-a-debate), [Utiliser la TUI](/fr/usage/tui) et [Exports](/fr/usage/exports).
