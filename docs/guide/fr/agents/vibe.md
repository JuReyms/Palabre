---
title: Mistral Vibe
description: Configurer Mistral Vibe CLI dans Palabre et l'utiliser comme agent CLI dans une paire de débat.
---

Mistral Vibe est une CLI d'assistance au développement. Palabre l'utilise en mode programmatique avec `--prompt`, puis récupère sa sortie texte.

## À installer avant Palabre

Installez et configurez Mistral Vibe hors de Palabre, puis vérifiez que la commande fonctionne :

```bash
vibe --version
```

Si Mistral Vibe a été installé après votre première configuration Palabre, relancez `palabre` ou synchronisez explicitement :

```bash
palabre config --sync-agents
```

## Windows

Sur Windows, `shell: true` est souvent nécessaire pour les wrappers comme `vibe`.
Palabre évite toutefois de transmettre le prompt via `cmd.exe` : il préfère l'exécutable natif,
puis le shim PowerShell `.ps1` généré par npm ou pnpm. Si aucun de ces chemins sûrs n'est
disponible, le lancement est refusé avec une erreur actionnable.

## Modèle par défaut

Palabre ne choisit pas le modèle Mistral Vibe à votre place. Vibe utilise sa propre configuration par défaut. Si vous passez un modèle avec `--model-a`, `--model-b` ou `--summary-model`, Palabre transmet la valeur via l'option modèle configurée.

## Configuration typique

```json
"vibe": {
  "type": "cli",
  "command": "vibe",
  "args": ["--output", "text", "--trust", "--enabled-tools", "read", "--enabled-tools", "grep", "--prompt"],
  "promptMode": "argument",
  "modelArg": "--model",
  "shell": true,
  "role": "reviewer"
}
```

`--enabled-tools read --enabled-tools grep` désactive les autres outils en mode programmatique.
`--trust` évite uniquement le prompt de confiance du dossier ; il n'autorise pas de nouveaux
outils.

## Utilisation

```bash
palabre codex-vibe "Relis ce plan" -t 4
palabre vibe-claude "Compare ces options" -t 3
```
