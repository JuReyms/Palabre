---
title: Référence du fichier de configuration
description: Référence du format palabre.config.json, des agents, des defaults et des options avancées.
---

Cette page sert de référence rapide pour `palabre.config.json`.

Pour une explication progressive, commencez par [Configuration](/fr/configuration/overview).

## Exemple complet

```json
{
  "language": "fr",
  "outputDir": ".palabre",
  "defaults": {
    "agentA": "codex",
    "agentB": "claude",
    "summaryAgent": "claude",
    "turns": 4
  },
  "agents": {
    "codex": {
      "type": "cli",
      "command": "codex",
      "args": ["exec", "--skip-git-repo-check", "--color", "never", "--sandbox", "read-only", "-"],
      "promptMode": "stdin",
      "shell": true,
      "role": "implementer"
    },
    "claude": {
      "type": "cli",
      "command": "claude.exe",
      "args": ["--print", "--output-format", "text", "--no-session-persistence"],
      "promptMode": "stdin",
      "shell": false,
      "role": "reviewer"
    }
  }
}
```

## Racine

| Champ | Type | Description |
|-------|------|-------------|
| `language` | `fr` ou `en` | Langue de l'interface Palabre. Peut être forcée ponctuellement avec `--language` ou `PALABRE_LANGUAGE`. |
| `outputDir` | string | Dossier d'export des fichiers `.debate.md`. |

## `defaults`

| Champ | Type | Description |
|-------|------|-------------|
| `agentA` | string | Agent qui répond en premier. |
| `agentB` | string | Agent qui répond en second. |
| `summaryAgent` | string | Agent de synthèse finale. |
| `turns` | number | Nombre total de réponses, entre 1 et 20. |

## Agent CLI

| Champ | Type | Description |
|-------|------|-------------|
| `type` | `cli` | Type de l'agent. |
| `command` | string | Commande à lancer. |
| `args` | string[] | Arguments transmis. |
| `promptMode` | `stdin` ou `argument` | Manière de transmettre le prompt. |
| `shell` | boolean | Lance via le shell système. |
| `role` | string | Rôle de l'agent. |
| `model` | string | Modèle par défaut optionnel. |
| `modelArg` | string | Flag modèle optionnel. |
| `timeoutMs` | number | Timeout global. |
| `idleTimeoutMs` | number | Timeout d'inactivité. |

## Agent Ollama

| Champ | Type | Description |
|-------|------|-------------|
| `type` | `ollama` | Type de l'agent. |
| `baseUrl` | string | URL de l'API Ollama. |
| `model` | string | Modèle local. |
| `role` | string | Rôle de l'agent. |
| `validateModel` | boolean | Vérifie que le modèle existe. |
| `autoPullModel` | boolean | Télécharge le modèle si absent. |
| `pullTimeoutMs` | number | Timeout de téléchargement. |
| `unloadOtherModels` | boolean | Décharge les autres modèles. |
| `keepAlive` | string | Maintien du modèle chargé. |
| `temperature` | number | Variation des réponses. |
