---
title: JSON avancé
description: Modifier directement le JSON de configuration pour les usages avancés et les agents personnalisés.
seo:
  title: Éditer palabre.config.json à la main
  description: Modifier directement le JSON de configuration pour définir des agents personnalisés et couvrir les cas non exposés par la CLI.
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
      "args": ["exec", "--skip-git-repo-check", "--color", "never", "--sandbox", "read-only"],
      "promptMode": "stdin",
      "role": "implementer"
    },
    "claude": {
      "type": "cli",
      "command": "claude",
      "args": ["--print", "--output-format", "text", "--no-session-persistence", "--tools", "Read,Glob,Grep"],
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
| `responseFormat` | `text` par défaut, ou `antigravity-json` pour extraire une réponse JSON Antigravity réussie (adapter `cli` uniquement). |
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

## Portée des réglages

Préférez `palabre config` quand une commande existe. Après une édition, relisez et réapprouvez le fichier pour les parcours qui l'exigent (voir [Approbation](/fr/configuration/local-vs-global#approbation)). Modifier `args` peut retirer les restrictions par défaut ; PALABRE ne remplace que d'anciens tableaux de défauts exactement reconnus, jamais vos arguments personnalisés.

Autres champs : `language`, `defaults.mode` (`debate`, `ask`, `chat`), `defaults.askAgents`, `defaults.askSummaryAgent`, `defaults.interface`, `relay` (politique de revue). Un agent porte aussi `tier` (`primary` ou `local`). Les agents CLI ont `type: cli` ou `cli-pty` et l’option `allowEmptyOutput`, désactivée par défaut.

Relay utilise `type` et `command` de la cible pour déterminer sa CLI, puis construit ses propres arguments. Il n'utilise pas `args`, `promptMode`, `model`, `shell` ou `timeoutMs` de l’agent de Débat. La configuration Relay reste nécessaire pour les revues autorisées.

Une commande en chemin absolu reste inchangée lors de la synchronisation, même si elle disparaît ; `doctor` et la disponibilité vérifient ce fichier précis, sans tester sa version ni se rabattre sur le PATH. Pour revenir à la détection, vous remplacez ce chemin par un nom simple puis réapprouvez le fichier si nécessaire.
