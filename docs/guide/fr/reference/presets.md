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
| `codex-antigravity` | Comparaison Codex / Antigravity. |
| `claude-antigravity` | Comparaison Claude / Antigravity. |
| `codex-opencode` | Codex face à OpenCode. |
| `opencode-claude` | OpenCode face à Claude. |
| `codex-vibe` | Codex face à Mistral Vibe. |
| `vibe-claude` | Mistral Vibe en premier, Claude en relecture. |
| `codex-ollama` | Agent CLI puissant face à modèle local. |
| `ollama-claude` | Modèle local en premier, Claude en relecture. |

`palabre presets --json` inclut maintenant des métadonnées de disponibilité locale pour les intégrations. Un preset est marqué indisponible si un agent manque dans la config, si une CLI connue n'est pas détectée, ou si le modèle Ollama configuré n'est pas installé.

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
