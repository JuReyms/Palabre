---
title: OpenCode
description: Configurer OpenCode dans Palabre et l'utiliser comme agent CLI dans une paire de débat.
seo:
  title: Utiliser OpenCode comme agent de débat
  description: Configurer OpenCode dans Palabre et l'associer à Claude Code, Codex ou un modèle Ollama local dans un débat.
---

OpenCode est une CLI d'assistance au développement. Selon votre configuration locale, elle peut utiliser différents modèles et providers.

Palabre peut l'utiliser comme agent CLI au même titre que Codex, Claude ou Antigravity.

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

Voir [Lancement des agents sous Windows](/fr/agents/overview#windows).

## Offres et limites

OpenCode peut utiliser des providers gratuits, payants ou locaux selon votre configuration. Les quotas, abonnements et limites d'usage dépendent donc du provider configuré dans OpenCode, pas de Palabre.

## Modèle par défaut

OpenCode garde son propre modèle par défaut. La configuration générée contient `modelArg: "--model"` : `--model-a`, `--model-b` ou `--summary-model` transmettent la valeur à OpenCode, qui la valide.

## Configuration typique

Extrait du bloc `agents` :

```json
"opencode": {
  "type": "cli",
  "command": "opencode",
  "args": ["run", "--pure"],
  "promptMode": "stdin",
  "modelArg": "--model",
  "shell": true,
  "tier": "primary",
  "role": "reviewer"
}
```

`--pure` empêche le chargement de plugins externes. OpenCode ne fournit pas encore, via cette
commande, une allowlist d'outils équivalente à celles de Claude ou Vibe.

## Utilisation

```bash
palabre codex-opencode "Relis ce MVP" -t 4
palabre opencode-claude "Compare ces options" -t 3
```

Dans l'exemple Windows, `shell` vaut `true` ; il vaut `false` ailleurs. `--pure` empêche les plugins externes mais n'interdit pas tous les outils d'écriture : les permissions OpenCode restent à vérifier dans sa propre configuration. Le [pilote Relay OpenCode sur copie](/fr/usage/relay#demander-un-avis-à-une-copie-opencode) utilise un parcours distinct, avec l'environnement habituel conservé, pour Windows et OpenCode CLI 2.0.32 seulement.
