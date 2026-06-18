---
title: OpenCode
description: Configurer OpenCode dans Palabre et l'utiliser comme agent CLI dans une paire de débat.
---

OpenCode est une CLI d'assistance au développement. Selon votre configuration locale, elle peut utiliser différents modèles et providers.

Palabre peut l'utiliser comme agent CLI au même titre que Codex, Claude ou Gemini.

## À installer avant Palabre

Installez OpenCode depuis la documentation officielle, puis vérifiez que la commande fonctionne :

Documentation officielle : [https://opencode.ai/docs/](https://opencode.ai/docs/)

Référence CLI : [https://opencode.ai/docs/cli/](https://opencode.ai/docs/cli/)

```bash
opencode --version
```

Si OpenCode a été installé après votre première configuration Palabre, relancez `palabre` ou synchronisez explicitement :

```bash
palabre config --sync-agents
```

## Windows

Sur Windows, `shell: true` est souvent nécessaire pour les wrappers npm ou PowerShell comme `opencode`.

## Offres et limites

OpenCode peut utiliser des providers gratuits, payants ou locaux selon votre configuration. Les quotas, abonnements et limites d'usage dépendent donc du provider configuré dans OpenCode, pas de Palabre.

## Modèle par défaut

Palabre ne choisit pas le modèle OpenCode à votre place. OpenCode utilise son propre modèle par défaut, sauf si vous configurez un argument modèle dans l'agent Palabre. Si vous passez un modèle avec `--model-a`, `--model-b` ou `--summary-model`, Palabre transmet la valeur à OpenCode via l'option modèle configurée ; OpenCode reste responsable de valider ce modèle.

## Configuration typique

```json
"opencode": {
  "type": "cli",
  "command": "opencode",
  "args": ["run"],
  "promptMode": "stdin",
  "shell": true,
  "role": "reviewer"
}
```

## Utilisation

```bash
palabre codex-opencode "Relis ce MVP" -t 4
palabre opencode-claude "Compare ces options" -t 3
```
