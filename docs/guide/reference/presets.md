---
title: Presets
description: Liste et principe des presets de paires d'agents utilisables dans les commandes courtes.
---

Les presets permettent de choisir rapidement une paire d'agents.

## Syntaxe courte

```bash
palabre codex-claude "Sujet" -t 4
```

Cette commande équivaut à choisir `codex` en agent A et `claude` en agent B.

## Presets courants

| Preset | Usage typique |
|--------|---------------|
| `codex-claude` | Codex propose, Claude relit. |
| `claude-codex` | Claude propose, Codex relit. |
| `codex-gemini` | Comparaison Codex / Gemini. |
| `claude-gemini` | Comparaison Claude / Gemini. |
| `codex-opencode` | Codex face à OpenCode. |
| `opencode-claude` | OpenCode face à Claude. |
| `codex-ollama` | Agent CLI puissant face à modèle local. |
| `ollama-claude` | Modèle local en premier, Claude en relecture. |

Les presets disponibles dépendent du code de Palabre, pas de votre configuration locale. Si un agent du preset n'existe pas dans votre config, la commande échoue avec un message explicite.

## Choisir les modèles

Les modèles peuvent être transmis sans que Palabre les liste :

```bash
palabre codex-claude "Sujet" --model-a gpt-5.5 --model-b opus-4.7
```

Pour Ollama :

```bash
palabre codex-ollama "Sujet" --model-b gemma4:e4b
```

## Quand utiliser un preset ?

Utilisez un preset quand vous voulez une commande courte et explicite.

Utilisez les agents par défaut quand vous lancez souvent la même paire.

Utilisez `--agent-a` et `--agent-b` quand vous écrivez un script ou une documentation très précise.
