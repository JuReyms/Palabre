---
title: Référence du fichier de configuration
description: Référence du format palabre.config.json, des agents, des defaults et des options avancées.
seo:
  title: Référence de palabre.config.json
  description: "Référence complète du format palabre.config.json : agents, defaults et options avancées."
---

Cette page sert de référence rapide pour `palabre.config.json`.

Pour une explication progressive, commencez par [Configuration](/fr/configuration/overview).

## Exemple complet

```json
{
  "language": "fr",
  "outputDir": ".palabre",
  "defaults": {
    "mode": "debate",
    "agentA": "codex",
    "agentB": "claude",
    "askAgents": ["codex", "claude"],
    "summaryAgent": "claude",
    "askSummaryAgent": "claude",
    "turns": 4,
    "interface": "tui"
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
      "command": "claude.exe",
      "args": ["--print", "--output-format", "text", "--no-session-persistence", "--tools", "Read,Glob,Grep"],
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
| `language` | `fr` ou `en` | Langue de Palabre et des prompts envoyés aux agents. Peut être forcée ponctuellement avec `--language` ou `PALABRE_LANGUAGE`. |
| `outputDir` | string | Dossier des exports `.debate.md`, `.relay.md`, `.ask.md`, `.chat.md` ; défaut `.palabre`, `.` traité comme `.palabre`. |

## `defaults`

| Champ | Type | Description |
|-------|------|-------------|
| `mode` | `debate`, `chat` ou `ask` | Mode lancé par défaut quand aucun mode n'est fourni. |
| `agentA` | string | Agent qui répond en premier en Débat et agent actif initial en Chat. |
| `agentB` | string | Agent qui répond en second. |
| `askAgents` | string[] | Agents par défaut du mode ask, 4 maximum. |
| `summaryAgent` | string | Agent de synthèse finale du mode débat, et fallback du mode ask. |
| `askSummaryAgent` | string | Agent de synthèse finale spécifique au mode ask. |
| `turns` | number | Nombre total de réponses, entre 1 et 20. |
| `interface` | `tui` ou `terminal` | Interface par défaut pour les sessions interactives. |

## Agent CLI

| Champ | Type | Description |
|-------|------|-------------|
| `type` | `cli` ou `cli-pty` | Type de l'agent. |
| `command` | string | Commande à lancer. |
| `args` | string[] | Arguments transmis. |
| `promptMode` | `stdin` ou `argument` | Manière de transmettre le prompt. |
| `shell` | boolean | Active la résolution prudente des wrappers Windows ; les natifs et shims reconnus restent lancés sans shell. Ignoré par Relay. |
| `role` | string | Rôle de l'agent. |
| `tier` | `primary` / `local` | Classe de l’agent ; sans effet sur la consigne de rôle. |
| `model` | string | Modèle par défaut optionnel. |
| `modelArg` | string | Flag modèle optionnel. |
| `timeoutMs` | number | Délai global en millisecondes, 180 000 par défaut pour CLI/PTY. |
| `idleTimeoutMs` | number | Timeout d'inactivité. |
| `maxOutputBytes` | number | Taille maximale cumulée de stdout et stderr, 50 Mio par défaut. |
| `allowEmptyOutput` | boolean | Autorise exceptionnellement une réponse CLI vide. |
| `cols` / `rows` | number | Dimensions du pseudo-terminal pour `cli-pty`. |

## Agent Ollama

| Champ | Type | Description |
|-------|------|-------------|
| `type` | `ollama` | Type de l'agent. |
| `baseUrl` | string | URL de l'API Ollama. |
| `model` | string | Modèle local. |
| `role` | string | Rôle de l'agent. |
| `tier` | `primary` / `local` | Classe de l’agent ; sans effet sur la consigne de rôle. |
| `validateModel` | boolean | Vérifie que le modèle existe. |
| `autoPullModel` | boolean | Télécharge le modèle si absent. |
| `pullTimeoutMs` | number | Timeout de téléchargement. |
| `unloadOtherModels` | boolean | Décharge les autres modèles. |
| `keepAlive` | string | Maintien du modèle chargé. |
| `temperature` | number | Variation des réponses. |
| `maxOutputBytes` | number | Taille maximale de chaque réponse HTTP bufferisée, 50 Mio par défaut. |

## `relay`

`view` est facultatif : `auto` (défaut) ou `background`. Un bloc `{ "view": "background" }` est valide sans autoriser de revue. En `auto`, PALABRE suit le verrou d'une conversation Codex existante ; les parcours exclus restent en arrière-plan. Ce réglage peut changer les permissions d'un tour : seul le propriétaire le modifie avec `palabre config --relay-view <auto|background>`, après affichage du fichier et confirmation clavier TTY, sans `--yes` ni `--trust-config`. Voir [Mode Relay](/fr/usage/relay).

| Champ | Type | Description |
| --- | --- | --- |
| `allowedTasks` | string[] | Tâche préautorisable : `review` seulement. |
| `reviewRepositories` | string[] | Dépôt GitHub.com exact `proprietaire/depot` ou motif `proprietaire/*`. |

Utilisez `palabre relay allow-repo proprietaire/depot` : confirmation au clavier dans votre terminal, jamais par un agent. Si `review` est autorisé, la liste de dépôts ne peut pas être vide.

`tier` (`primary` / `local`) est optionnel pour les agents CLI et Ollama. `timeoutMs` est exprimé en millisecondes (180 000 par défaut pour CLI/PTY, 300 000 dans le défaut Antigravity). `shell` est ignoré par Relay ; les adapters refusent un wrapper shell restant pour un prompt en argument. `outputDir` vaut `.palabre` par défaut ; `.` est traité comme `.palabre`. Il reçoit aussi `.relay.md` ; Mission garde `.palabre/missions/<id>/`, indépendamment de ce réglage. L'exemple ci-dessus est une configuration complète avec deux agents, pas la totalité des agents générés.
