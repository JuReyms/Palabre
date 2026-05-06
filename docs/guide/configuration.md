# Configuration

Cette page présente la configuration de Palabre pour un usage courant : sélectionner les agents par défaut, vérifier les agents détectés, synchroniser une configuration existante, ajuster le nombre de réponses, configurer Ollama et choisir les rôles des agents.

## Emplacement de la configuration

Par défaut, `palabre init` crée une configuration globale :

```bash
palabre init
```

Emplacement global :

```text
~/.palabre/palabre.config.json
```

Pour créer une configuration locale au projet courant :

```bash
palabre init --local
```

Emplacement local :

```text
./palabre.config.json
```

Palabre résout la configuration utilisateur dans cet ordre :

1. `./palabre.config.json`
2. `~/.palabre/palabre.config.json`

Il est aussi possible de forcer un fichier de configuration :

```bash
palabre agents --config ./palabre.config.json
palabre run -s "Sujet" --config ./palabre.config.json
```

## Commandes de configuration

| Commande | Description |
|----------|-------------|
| `palabre config` | Ouvre l'assistant de configuration. |
| `palabre agents` | Affiche les agents déclarés dans la configuration et leur état de détection locale. |
| `palabre -a` | Raccourci de `palabre agents`. |
| `palabre config --set-defaults codex claude` | Définit les deux agents par défaut. |
| `palabre config --set-defaults codex claude -t 4 --summary-agent claude` | Définit les agents, le nombre de réponses et l'agent de synthèse. |
| `palabre config -t 3` | Modifie uniquement le nombre de réponses par défaut. |
| `palabre config --summary-agent claude` | Modifie uniquement l'agent de synthèse par défaut. |
| `palabre config --clear-defaults` | Supprime les agents et options par défaut. |
| `palabre config --sync-agents` | Ajoute les agents détectés mais absents de la configuration, sans écraser l'existant. |

Dans les assistants interactifs, `Ctrl+C` interrompt immédiatement la commande. Dans un prompt, `q`, `quit` ou `exit` quittent sans appliquer de nouveau choix.

## Vérifier les agents disponibles

La commande suivante affiche les agents présents dans la configuration, leur rôle et leur état de détection :

```bash
palabre agents
```

Exemple de sortie :

```text
Agents déclarés:
- claude        cli/reviewer       détecté (claude.exe) | agent B par défaut
  commande: claude.exe
- codex         cli/implementer    détecté (codex) | agent A par défaut
  commande: codex
- opencode      cli/reviewer       détecté (opencode)
  commande: opencode
- ollama-local  ollama/critic      détecté
  modèle: gemma4:e4b

Défauts: codex <-> claude, réponses: 4, synthèse: agent B
```

Si `palabre doctor` détecte un outil qui n'apparaît pas dans `palabre agents`, la configuration est probablement antérieure au support de cet outil. Pour ajouter les agents détectés manquants :

```bash
palabre config --sync-agents
```

Cette commande ajoute uniquement les agents absents de la configuration. Elle ne remplace pas les agents existants et ne modifie pas les valeurs par défaut.

## Définir les agents par défaut

Les agents par défaut sont utilisés lorsqu'un débat est lancé sans `--agent-a` et `--agent-b`.

```bash
palabre config --set-defaults codex claude
```

Après cette configuration, la commande suivante utilise automatiquement `codex` et `claude` :

```bash
palabre run -s "Critique ce plan" -t 4
```

L'assistant interactif permet de configurer ces valeurs étape par étape :

```bash
palabre config
```

Pour supprimer les agents par défaut :

```bash
palabre config --clear-defaults
```

Sans agents par défaut, il faut utiliser un preset ou déclarer les agents explicitement :

```bash
palabre codex-claude "Critique ce plan" -t 4
palabre run -s "Critique ce plan" --agent-a codex --agent-b claude
```

## Configurer le nombre de réponses

`turns` représente le nombre total de réponses du débat, et non le nombre de réponses par agent. Palabre accepte une valeur entre 1 et 20.

Avec `codex` en agent A et `claude` en agent B :

| Valeur | Déroulé |
|--------|---------|
| `-t 2` | codex, puis claude |
| `-t 3` | codex, claude, codex |
| `-t 4` | codex, claude, codex, claude |

Pour modifier la valeur par défaut :

```bash
palabre config -t 3
```

Au lancement d'un débat, `--turns` ou `-t` reste prioritaire :

```bash
palabre run -s "Sujet" -t 2
```

## Configurer la synthèse

Palabre utilise `defaults.summaryAgent` lorsqu'il est défini. Sinon, l'agent B produit la synthèse finale.

Pour définir Claude comme agent de synthèse par défaut :

```bash
palabre config --summary-agent claude
```

Pour choisir l'agent de synthèse uniquement pour une commande :

```bash
palabre run -s "Critique le MVP" --summary-agent claude
```

Pour désactiver la synthèse :

```bash
palabre run -s "Critique le MVP" --no-summary
```

## Structure du fichier JSON

Exemple minimal :

```json
{
  "outputDir": ".",
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

Champs principaux :

| Champ | Description |
|-------|-------------|
| `outputDir` | Dossier de destination des exports `.debate.md`. |
| `defaults.agentA` | Agent qui répond en premier par défaut. |
| `defaults.agentB` | Agent qui répond en second par défaut. |
| `defaults.summaryAgent` | Agent utilisé pour la synthèse finale par défaut. |
| `defaults.turns` | Nombre total de réponses par défaut, entre 1 et 20. |
| `agents` | Agents disponibles pour les débats. |

## Agents CLI

Un agent CLI correspond à un outil lancé en ligne de commande, par exemple Codex CLI, Claude CLI, Gemini CLI, OpenCode ou un wrapper compatible.

Exemple Claude :

```json
"claude": {
  "type": "cli",
  "command": "claude.exe",
  "args": ["--print", "--output-format", "text", "--no-session-persistence"],
  "promptMode": "stdin",
  "shell": false,
  "role": "reviewer"
}
```

Exemple OpenCode :

```json
"opencode": {
  "type": "cli",
  "command": "opencode",
  "args": ["run"],
  "promptMode": "stdin",
  "modelArg": "--model",
  "shell": true,
  "role": "reviewer"
}
```

Options utiles :

| Option | Description |
|--------|-------------|
| `command` | Commande à lancer. |
| `args` | Arguments transmis à la commande. |
| `promptMode` | `stdin` envoie le prompt sur l'entrée standard ; `argument` le transmet en argument. |
| `modelArg` | Flag utilisé pour transmettre un modèle, par exemple `--model`. |
| `model` | Modèle utilisé par défaut pour cet agent, transmis via `modelArg`. |
| `shell` | Sur Windows, `true` est souvent nécessaire pour les wrappers npm comme `codex`, `gemini` ou `opencode`. |
| `role` | Rôle de l'agent dans le débat. |
| `timeoutMs` | Timeout global. |
| `idleTimeoutMs` | Timeout appliqué si l'agent ne produit aucune sortie pendant une période donnée. |

Sur Windows, Claude fonctionne généralement mieux avec `claude.exe` et `shell: false`. Codex, Gemini et OpenCode sont souvent des wrappers npm ou PowerShell ; `shell: true` est recommandé.

## Ollama

Ollama permet d'utiliser un modèle local. Dans Palabre, il est particulièrement adapté aux rôles de critique, d'exploration ou de synthèse légère.

Exemple :

```json
"ollama-local": {
  "type": "ollama",
  "baseUrl": "http://localhost:11434",
  "model": "gemma4:e4b",
  "role": "critic",
  "temperature": 0.2,
  "validateModel": true,
  "unloadOtherModels": true
}
```

Options utiles :

| Option | Description |
|--------|-------------|
| `model` | Nom du modèle Ollama à utiliser, par exemple `gemma4:e4b` ou `nemotron-3-nano:4b`. |
| `baseUrl` | URL de l'API Ollama. Par défaut : `http://localhost:11434`. |
| `validateModel` | Vérifie que le modèle est installé avant de lancer le débat. |
| `autoPullModel` | Autorise Palabre à faire `ollama pull` si le modèle manque. Désactivé par défaut. |
| `pullTimeoutMs` | Timeout du téléchargement du modèle. |
| `unloadOtherModels` | Décharge les autres modèles Ollama avant d'utiliser celui demandé. |
| `keepAlive` | Durée pendant laquelle Ollama garde le modèle chargé après la réponse. |
| `temperature` | Niveau de variation des réponses. |
| `role` | Rôle de l'agent dans le débat. |

Ollama ne lit pas le projet par lui-même. Il ne reçoit que le prompt construit par Palabre. Pour lui transmettre du contexte projet :

```bash
palabre run -s "Critique cette architecture" --agent-a claude --agent-b ollama-local --context src docs
```

Si le modèle n'est pas installé et que le téléchargement doit être autorisé explicitement :

```bash
palabre run -s "Critique ce plan" --agent-a codex --agent-b ollama-local --pull-models
```

Certains modèles peuvent peser plusieurs Go. Pour cette raison, `autoPullModel` et `--pull-models` ne sont pas activés par défaut.

## Rôles disponibles

Le rôle définit l'angle de réponse demandé à l'agent. Il ne change pas le modèle utilisé, mais il influence les consignes envoyées dans le prompt.

| Rôle | Usage recommandé | Effet attendu |
|------|------------------|---------------|
| `implementer` | Proposition de solution | Réponse concrète, actionnable, avec les compromis importants. |
| `reviewer` | Relecture d'une proposition | Risques, régressions possibles, tests manquants, points à vérifier. |
| `critic` | Remise en question d'une idée | Hypothèses faibles, contradictions, objections utiles. |
| `architect` | Structuration technique | Options, frontières du système, dette possible, choix structurants. |
| `scout` | Exploration rapide | Pistes, inconnues à lever, informations à collecter. |
| `summarizer` | Synthèse finale | Synthèse fidèle, décisions, désaccords, actions proposées et conclusion courte en prose. |

Exemple : Codex propose une solution, Claude la relit.

```json
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
```

Avec cette configuration :

```text
codex  -> propose une solution
claude -> identifie les risques et les améliorations possibles
```

Exemple : Ollama comme critique local.

```json
"ollama-local": {
  "type": "ollama",
  "model": "gemma4:e4b",
  "role": "critic",
  "validateModel": true
}
```

Ce rôle est utile pour questionner un plan, relever des angles morts ou produire une objection rapide avec un modèle local.

## Recommandations

- Pour une configuration générale : `codex` en agent A, `claude` en agent B, `claude` en synthèse.
- Pour ajouter OpenCode, Gemini ou Ollama à une ancienne configuration : `palabre config --sync-agents`.
- Pour vérifier l'état de la configuration : `palabre agents`, puis `palabre doctor` en cas de problème.
- Pour éviter tout lancement implicite : `palabre config --clear-defaults`, puis utilisation de presets ou d'agents explicites.
- Pour Ollama : commencer avec un modèle local léger et transmettre le contexte avec `--context` ou `--files`.
