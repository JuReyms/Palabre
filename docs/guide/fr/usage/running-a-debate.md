---
title: Lancer un débat
description: Choisir les agents, les réponses, les presets et les options principales pour lancer un débat Palabre.
---

## Accueil TUI

```bash
palabre
```

L'accueil TUI est le point de départ recommandé. Il affiche les agents actifs, les rôles, la synthèse, le dossier courant et les commandes utiles.

Depuis cet écran :

- tapez un sujet pour lancer le mode courant ;
- utilisez `/ask` ou `/debat` pour changer de mode ;
- utilisez `/agents` pour choisir les agents ;
- utilisez `/roles` pour appliquer des rôles ;
- utilisez `/config` pour modifier les réglages sans quitter la TUI.

`palabre new` reste disponible comme assistant guidé historique.

## Avec les agents par défaut

```bash
palabre -s "Critique ce plan" -t 4
```

Cette commande utilise les agents définis dans votre configuration.

## Avec un preset

```bash
palabre codex-claude "Critique ce plan" -t 4
```

Un preset choisit rapidement une paire d'agents. L'ordre compte : `codex-claude` fait répondre Codex en premier, puis Claude.

## Avec des agents explicites

```bash
palabre run --subject "Critique ce plan" --agent-a codex --agent-b claude --turns 4
```

Cette forme est plus longue, mais elle rend la commande totalement explicite.

## Mode Ask

```bash
palabre ask "Compare ces deux options" --agents codex claude opencode
```

Le mode Ask envoie le même sujet et le même contexte à plusieurs agents, sans transcript partagé entre eux. Chaque agent répond seul. Ensuite, l'agent de synthèse résume fidèlement ce que chaque agent a dit et compare les réponses.

Sans `--agents`, Palabre utilise `defaults.askAgents` si défini, sinon la paire de débat par défaut.

Le mode Ask accepte 1 à 4 agents :

```bash
palabre ask "Quelle approche choisir ?" --agents codex claude opencode gemini
```

L'export utilise l'extension `.ask.md`.

## Nombre de réponses

`--turns` ou `-t` indique le nombre total de réponses, entre 1 et 20.

Exemple avec `codex` en agent A et `claude` en agent B :

| Valeur | Déroulé |
|--------|---------|
| `-t 2` | codex, puis claude |
| `-t 3` | codex, claude, codex |
| `-t 4` | codex, claude, codex, claude |

Par défaut, Palabre peut s'arrêter avant la limite si les agents expriment clairement un accord complet après un tour complet.

Pour forcer toutes les réponses demandées :

```bash
palabre codex-claude "Sujet" -t 4 --no-early-stop
```

## Choisir un modèle à la volée

Palabre ne liste pas les modèles des CLIs, car ils changent souvent. Il transmet simplement la valeur à l'agent. Si le modèle n'existe pas ou n'est pas autorisé par votre compte, la CLI renverra l'erreur.

```bash
palabre codex-claude "Sujet" --model-a gpt-5.5 --model-b opus-4.7
```

Pour Ollama :

```bash
palabre codex-ollama "Sujet" --model-b gemma4:e4b
```

## Prévisualiser sans appeler d'IA

```bash
palabre codex-claude "Sujet" --show-prompt
```

Cette commande affiche le prompt du premier tour, les agents et les options de synthèse, puis s'arrête. C'est utile pour vérifier le contexte envoyé sans consommer de requête IA.

## Interface TUI et rendu terminal brut

Par défaut, Palabre privilégie l'interface TUI quand la sortie est un vrai terminal. `palabre` ouvre l'accueil, et une commande directe comme `palabre codex-claude "Sujet" -t 4` lance la session avec le rendu TUI.

Pour obtenir un rendu brut adapté aux logs :

```bash
palabre codex-claude "Sujet" --terminal
```

Pour en faire le comportement par défaut :

```bash
palabre config --interface terminal
```
