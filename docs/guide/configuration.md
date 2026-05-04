# Configuration

La configuration de Palabre se fait dans `palabre.config.json` à la racine de ton projet.

`palabre init` génère ce fichier et détecte les outils disponibles localement. La config garde les blocs agents connus pour rester facile à éditer, mais les `defaults` utilisent une paire détectée quand c'est possible.

Si tu viens d'une ancienne installation, `chicane.config.json` reste lisible comme fallback. Le nom courant pour les nouvelles configs est `palabre.config.json`.

## Structure générale

```json
{
  "outputDir": ".",
  "defaults": {
    "agentA": "codex",
    "agentB": "claude",
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
| `turns` | Nombre de tours d'échange | `4` |

### Racine

| Champ | Description | Valeur par défaut |
|-------|-------------|-------------------|
| `outputDir` | Dossier de destination du `.debate.md` | `.` |

---

## Déclarer un agent CLI

Pour les outils comme Claude, Codex ou Gemini qui s'utilisent en ligne de commande :

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

> **Windows** : pour Claude, utilise `claude.exe` avec `"shell": false`. Pour Codex et Gemini (wrappers npm), utilise `"shell": true`.

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

| Rôle | Description |
|------|-------------|
| `implementer` | Propose une solution concrète |
| `reviewer` | Cherche les risques et les angles morts |
| `critic` | Remet en question les hypothèses |
| `architect` | Structure une direction technique |
| `scout` | Explore rapidement un sujet |
| `summarizer` | Produit une synthèse |

