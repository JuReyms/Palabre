---
title: Codex
description: Configurer Codex CLI dans Palabre, choisir éventuellement un modèle et reconnaître les erreurs fréquentes.
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

Palabre transmet seulement le prompt. Si vous indiquez `--model-a` ou `--model-b`, la valeur est transmise à la CLI via son argument modèle configuré.

## Configuration typique

```json
"codex": {
  "type": "cli",
  "command": "codex",
  "args": ["exec", "--skip-git-repo-check", "--color", "never", "--sandbox", "read-only"],
  "promptMode": "stdin",
  "shell": true,
  "role": "implementer"
}
```

Sur Windows, `shell: true` est souvent nécessaire pour les wrappers installés via npm ou PowerShell comme `codex`. Claude est différent dans beaucoup d'installations Windows : `claude.exe` est généralement appelé directement avec `shell: false`.

## Utilisation

```bash
palabre codex-claude "Critique cette architecture" -t 4
palabre codex-opencode "Compare ces deux approches" -t 3
```
