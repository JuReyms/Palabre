---
title: Presets
description: Liste et principe des presets de paires d'agents utilisables dans les commandes courtes.
seo:
  title: Presets de paires d'agents
  description: Tous les presets de paires d'agents fournis, et comment lancer un débat avec une commande courte.
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
| `codex-claude` | Codex parle en premier, Claude répond ; les rôles restent configurés. |
| `claude-codex` | Claude parle en premier, Codex répond ; les rôles restent configurés. |
| `codex-antigravity` | Comparaison Codex / Antigravity. |
| `claude-antigravity` | Comparaison Claude / Antigravity. |
| `codex-opencode` | Codex face à OpenCode. |
| `opencode-claude` | OpenCode face à Claude. |
| `codex-vibe` | Codex face à Mistral Vibe. |
| `vibe-claude` | Mistral Vibe en premier, puis Claude. |
| `codex-ollama` | Agent CLI puissant face à modèle local. |
| `ollama-claude` | Modèle local en premier, puis Claude. |

`palabre presets --json` inclut des métadonnées de disponibilité locale pour les intégrations. Un preset est marqué indisponible si un agent manque dans la config, si une CLI connue n'est pas détectée, ou si le modèle Ollama configuré n'est pas installé.

## Choisir les modèles

Les modèles peuvent être transmis sans que Palabre les liste :

```bash
palabre codex-claude "Sujet" --model-a <modele-codex> --model-b <modele-claude>
```

Pour Ollama :

```bash
palabre codex-ollama "Sujet" --model-b <modele-ollama-installe>
```

## Quand utiliser un preset ?

Utilisez un preset quand vous voulez une commande courte et explicite.

Utilisez les agents par défaut quand vous lancez souvent la même paire.

Utilisez `--agent-a` et `--agent-b` quand vous écrivez un script ou une documentation très précise.

Ce tableau est une sélection. `palabre presets` liste les 30 presets : toutes les paires entre les cinq CLI connues et chacune avec Ollama, dans les deux sens. `--json` expose `available`, `missingAgents` et `unavailableReasons` : agent absent, CLI non détectée, API Ollama injoignable ou modèle absent. Les intégrations utilisent cette disponibilité.

Les presets choisissent seulement la paire et son ordre, pas les rôles ni les modèles. Ils servent à Débat et Ask, sont refusés en Chat et ne choisissent jamais les cibles Relay.
