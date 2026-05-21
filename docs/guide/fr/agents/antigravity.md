---
title: Antigravity
description: Configurer Antigravity CLI dans Palabre avec l'adapter PTY expérimental.
---

Antigravity CLI peut être utilisé comme agent Palabre via la commande `agy`.

Contrairement aux agents batch comme Gemini CLI, Antigravity nécessite l'adapter `cli-pty` : lors des tests, `agy --print` répond dans une vraie console, mais ne produit pas de stdout capturable quand il est lancé avec de simples pipes Node.

## Installation

Installez Antigravity CLI depuis la documentation officielle de Google, puis vérifiez que la commande est disponible :

```bash
agy --help
```

Si Antigravity a été installé après `palabre init`, synchronisez la configuration :

```bash
palabre config --sync-agents
```

## Transition Gemini

Google indique que Gemini CLI cessera de servir les requêtes des utilisateurs individuels gratuits et Google AI Pro/Ultra le 18 juin 2026, tandis que les clients Enterprise conservent un accès selon leurs licences.

Référence officielle : [Transitioning Gemini CLI to Antigravity CLI](https://developers.googleblog.com/an-important-update-transitioning-gemini-cli-to-antigravity-cli/)

## Configuration JSON

La configuration générée par Palabre ressemble à ceci :

```json
"antigravity": {
  "type": "cli-pty",
  "command": "agy",
  "args": ["--print-timeout", "5m0s", "--print"],
  "promptMode": "argument",
  "role": "reviewer",
  "tier": "primary",
  "timeoutMs": 300000
}
```

## Exemples

```bash
palabre codex-antigravity "Compare cette approche d'architecture" -t 4
palabre antigravity-ollama "Critique ce plan de migration" -t 3
```
