# Configuration

La configuration de Palabre peut être locale au projet ou globale à l'utilisateur.

`palabre init` génère par défaut `~/.palabre/palabre.config.json` et détecte les outils disponibles localement. La config garde les blocs agents connus pour rester facile à éditer, mais les `defaults` utilisent une paire détectée quand c'est possible. Palabre ne possède pas de fallback agent codé en dur au lancement : sans preset, sans `--agent-a/--agent-b` et sans `defaults.agentA/defaults.agentB`, il affiche une erreur au lieu de lancer un débat accidentel.

Résolution au lancement : `./palabre.config.json`, puis `./chicane.config.json`, puis `~/.palabre/palabre.config.json`, puis `~/.palabre/chicane.config.json`. Le nom courant pour les nouvelles configs est `palabre.config.json`. Pour créer une config locale volontairement : `palabre init --local`.

Pour gérer les agents par défaut sans éditer le JSON :

Le wizard `palabre config` peut être interrompu avec `Ctrl+C`. Dans un prompt, `q`, `quit` ou `exit` quittent sans appliquer de nouveau choix.

```bash
palabre config
palabre config --set-defaults codex claude --summary-agent claude --turns 4
palabre config -t 3
palabre config --summary-agent claude
palabre config --clear-defaults
```

## Structure générale

```json
{
  "outputDir": ".",
  "defaults": {
    "agentA": "codex",
    "agentB": "claude",
    "summaryAgent": "claude",
    "turns": 4
  },
  "agents": { }
}
```

### `defaults`

| Champ | Description | Valeur par défaut |
|-------|-------------|-------------------|
| `agentA` | Agent qui ouvre le débat | — |
| `agentB` | Agent qui répond en second | — |
| `summaryAgent` | Agent utilisé pour la synthèse finale | `agentB` |
| `turns` | Nombre total de réponses du débat | `4` |

### Racine

| Champ | Description | Valeur par défaut |
|-------|-------------|-------------------|
| `outputDir` | Dossier de destination du `.debate.md` | `.` |

---

## Déclarer un agent CLI

Pour les outils comme Claude, Codex, Gemini ou OpenCode qui s'utilisent en ligne de commande :

```json
"claude": {
  "type": "cli",
  "command": "claude.exe",
  "args": ["--print"],
  "role": "reviewer"
}
```

```json
"codex": {
  "type": "cli",
  "command": "codex",
  "args": ["exec", "--skip-git-repo-check", "--color", "never", "--sandbox", "read-only", "-"],
  "shell": true,
  "role": "implementer"
}
```


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
### Options CLI

| Option | Description |
|--------|-------------|
| `command` | Commande à lancer |
| `args` | Arguments passés à la commande |
| `role` | Rôle de l'agent dans le débat |
| `shell` | `true` si la commande passe par le shell système (nécessaire pour certains wrappers npm sur Windows) |
| `timeoutMs` | Timeout global en ms |
| `idleTimeoutMs` | Timeout si aucune sortie pendant N ms (à utiliser avec prudence pour les IA) |
| `allowEmptyOutput` | Autorise une réponse vide (désactivé par défaut) |
| `modelArg` | Nom du flag modèle si différent de `--model` |

> **Windows** : pour Claude, utilise `claude.exe` avec `"shell": false`. Pour Codex, Gemini et OpenCode (wrappers npm/PowerShell), utilise `"shell": true`.

---

## Déclarer un agent Ollama

Pour les modèles locaux exposés par Ollama :

```json
"ollama-local": {
  "type": "ollama",
  "baseUrl": "http://localhost:11434",
  "model": "nemotron-3-nano:4b",
  "role": "critic",
  "validateModel": true,
  "unloadOtherModels": true
}
```

### Options Ollama

| Option | Description |
|--------|-------------|
| `model` | Modèle Ollama à utiliser |
| `baseUrl` | URL de l'instance Ollama (défaut : `http://localhost:11434`) |
| `role` | Rôle de l'agent |
| `validateModel` | Vérifie que le modèle est installé avant de lancer le débat |
| `autoPullModel` | Télécharge le modèle s'il est absent (désactivé par défaut) |
| `pullTimeoutMs` | Timeout pour le téléchargement (défaut : 30 min) |
| `unloadOtherModels` | Décharge les autres modèles chargés avant de lancer |
| `keepAlive` | Durée de maintien du modèle en mémoire après génération |

> Ollama ne lit jamais le filesystem. Si tu veux lui fournir du contexte projet, utilise `--files` ou `--context`.

---

## Rôles disponibles

| Rôle | Description | Influence dans le prompt |
|------|-------------|--------------------------|
| `implementer` | Propose une solution concrète | Demande une solution exécutable et sobrement justifiée |
| `reviewer` | Cherche les risques et les angles morts | Demande risques, régressions et tests manquants |
| `critic` | Remet en question les hypothèses | Demande de challenger les hypothèses et les preuves |
| `architect` | Structure une direction technique | Demande options, compromis et frontières du système |
| `scout` | Explore rapidement un sujet | Demande pistes utiles et inconnues à lever |
| `summarizer` | Produit une synthèse | Demande une synthèse fidèle sans hypothèses nouvelles |

La synthèse finale utilise toujours un prompt de mode `summary`. Si l'agent choisi n'a pas le rôle `summarizer`, Palabre applique quand même la consigne de synthèse pour cette phase.
