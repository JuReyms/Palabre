---
title: Codex
description: Configurer Codex CLI dans Palabre, choisir éventuellement un modèle et reconnaître les erreurs fréquentes.
seo:
  title: Utiliser Codex CLI comme agent de débat
  description: Configurer Codex CLI dans Palabre, choisir un modèle, l'opposer à Claude Code et reconnaître les erreurs les plus fréquentes.
---

Codex CLI permet d'utiliser Codex depuis le terminal.

Palabre peut le lancer comme agent de débat, souvent en agent A pour proposer une première solution.

## À installer avant Palabre

Installez et configurez Codex CLI hors de Palabre. Consultez la documentation officielle, puis vérifiez la commande :

Documentation officielle : [https://help.openai.com/en/articles/11096431-openai-codex-cli-getting-started](https://help.openai.com/en/articles/11096431-openai-codex-cli-getting-started)

Dépôt GitHub : [https://github.com/openai/codex](https://github.com/openai/codex)

```bash
codex --version
```

Si Codex a été installé après votre première configuration Palabre, relancez `palabre` ou synchronisez explicitement :

```bash
palabre config --sync-agents
```

## Compte, modèle et limites

Codex garde sa propre configuration : fournisseur, modèle par défaut, sandbox, approbations et limites d'usage.

PALABRE transmet le prompt avec les arguments configurés, en lecture seule par défaut (`--sandbox read-only`). Si vous indiquez `--model-a` ou `--model-b`, la valeur est transmise à la CLI via son argument modèle configuré.

## Configuration typique

Extrait du bloc `agents` :

```json
"codex": {
  "type": "cli",
  "command": "codex",
  "args": ["exec", "--skip-git-repo-check", "--color", "never", "--sandbox", "read-only"],
  "promptMode": "stdin",
  "shell": true,
  "tier": "primary",
  "role": "implementer"
}
```

Voir [Windows : lancement des agents](/fr/agents/overview#windows).

## Utilisation

```bash
palabre codex-claude "Critique cette architecture" -t 4
palabre codex-opencode "Compare ces deux approches" -t 3
```

## Codex et Relay

Conversation fermée : reprise en lecture seule, sans plugins, connecteurs ni MCP, avec le modèle enregistré dans la conversation. Conversation ouverte : `--open` (pilote Windows, macOS et Linux), avec les outils et permissions propres à la cible ; sur POSIX, `python3` sonde le verrou, et l'affichage immédiat n'est pas garanti. Voir [Relay](/fr/usage/relay).

Avec `--open`, une limite structurée donne `usage-limit` et `retryAfter` si l'heure est fournie. Sans `--open`, `CreateProcessAsUserW failed: 5` au démarrage d'une commande remplit `readAccess` : une commande aboutie ensuite donne `partial` et conserve `replied`; sans réussite ultérieure ni événement ambigu, `blocked` donne `read-unavailable`; une réussite explicite donne priorité à `partial`, même si un autre événement est ambigu ; sans réussite explicite, un événement ambigu donne `unverified`. La tâche review refuse de publier sur les trois statuts. Voir [Dépannage](/fr/troubleshooting).

L'exemple de configuration est celui de Windows (`shell: true`) ; ailleurs, la configuration générée utilise `false`.
