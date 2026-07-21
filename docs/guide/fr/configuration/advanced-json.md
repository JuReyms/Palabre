---
title: JSON avancé
description: Modifier directement le JSON de configuration pour les usages avancés et les agents personnalisés.
---

La plupart des réglages courants peuvent se faire avec `palabre config`. Cette page concerne les cas où vous éditez directement `palabre.config.json`.

## Structure minimale

```json
{
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
      "args": ["exec", "-"],
      "promptMode": "stdin",
      "role": "implementer"
    },
    "claude": {
      "type": "cli",
      "command": "claude",
      "args": ["--print"],
      "promptMode": "stdin",
      "role": "reviewer"
    }
  }
}
```

## Champs principaux

| Champ | Description |
|-------|-------------|
| `outputDir` | Dossier de destination des exports `.debate.md`, `.chat.md` et `.ask.md`. |
| `defaults.agentA` | Agent qui répond en premier par défaut. |
| `defaults.agentB` | Agent qui répond en second par défaut. |
| `defaults.summaryAgent` | Agent utilisé pour la synthèse finale par défaut. |
| `defaults.turns` | Nombre total de réponses, entre 1 et 20. |
| `agents` | Liste des agents disponibles. Elle doit contenir au moins un agent utilisable. |

## Agent CLI

```json
"claude": {
  "type": "cli",
  "command": "claude.exe",
  "args": ["--print", "--output-format", "text", "--no-session-persistence", "--tools", "Read,Glob,Grep"],
  "promptMode": "stdin",
  "shell": false,
  "role": "reviewer"
}
```

Options utiles :

| Option | Description |
|--------|-------------|
| `command` | Commande à lancer. |
| `args` | Arguments transmis à la commande. |
| `promptMode` | `stdin` ou `argument`. |
| `modelArg` | Flag utilisé pour transmettre un modèle. |
| `model` | Modèle par défaut de cet agent. |
| `shell` | Utile sur Windows pour certains wrappers npm ou PowerShell. |
| `role` | Rôle de l'agent. |
| `timeoutMs` | Timeout global. |
| `idleTimeoutMs` | Timeout si la CLI reste silencieuse. |
| `maxOutputBytes` | Taille maximale cumulée de la sortie, 50 Mio par défaut. Une valeur invalide rétablit cette limite sûre. |
| `cols` / `rows` | Dimensions du pseudo-terminal pour les agents `cli-pty`. |

## Agent Ollama

```json
"ollama-local": {
  "type": "ollama",
  "baseUrl": "http://localhost:11434",
  "model": "<modele-ollama-installe>",
  "role": "critic",
  "validateModel": true,
  "unloadOtherModels": true
}
```

Options utiles :

| Option | Description |
|--------|-------------|
| `model` | Modèle Ollama utilisé. |
| `baseUrl` | URL de l'API Ollama. |
| `validateModel` | Vérifie que le modèle est installé. |
| `autoPullModel` | Autorise le téléchargement automatique. |
| `pullTimeoutMs` | Timeout du téléchargement. |
| `unloadOtherModels` | Décharge les autres modèles avant génération. |
| `keepAlive` | Durée de maintien du modèle chargé. |
| `temperature` | Variation des réponses. |
| `maxOutputBytes` | Taille maximale de chaque réponse HTTP bufferisée, 50 Mio par défaut. |
