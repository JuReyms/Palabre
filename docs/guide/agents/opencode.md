# OpenCode

Palabre peut l'utiliser comme agent CLI au même titre que Codex, Claude Code ou Gemini.

## À installer avant Palabre

Installez OpenCode depuis la documentation officielle de OpenCode, puis authentifiez la CLI dans votre terminal.

Documentation officielle : [https://opencode.ai/](https://opencode.ai/)

Vérifiez ensuite que la commande fonctionne :

```bash
opencode --version
```

Si OpenCode a été installé après `palabre init`, synchronisez la configuration :

```bash
palabre config --sync-agents
```

## Modèle par défaut

Palabre ne choisit pas le modèle OpenCode à votre place. OpenCode utilise son propre modèle par défaut, sauf si vous configurez un argument modèle dans l'agent Palabre.

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
