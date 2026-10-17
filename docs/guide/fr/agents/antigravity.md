---
title: Antigravity
description: Configurer Antigravity CLI dans Palabre avec l'adapter PTY expérimental.
seo:
  title: "Configurer Antigravity CLI : PTY et --print-timeout"
  description: Configurer Google Antigravity CLI avec Palabre, comprendre cli-pty et --print-timeout, puis résoudre les timeouts et sorties vides de la commande agy.
---

Antigravity CLI peut être utilisé comme agent Palabre via la commande `agy`.

Antigravity nécessite l'adapter `cli-pty` : lors des tests, `agy --print` répond dans une vraie console, mais ne produit pas de stdout capturable quand il est lancé avec de simples pipes Node.

## Installation

Installez Antigravity CLI depuis la documentation officielle de Google, puis vérifiez que la commande est disponible :

```bash
agy --help
```

Si Antigravity a été installé après votre première configuration Palabre, relancez `palabre` ou synchronisez explicitement :

```bash
palabre config --sync-agents
```

## Transition Gemini

Google a annoncé la transition de Gemini CLI vers Antigravity CLI pour les utilisateurs individuels, tandis que les clients Enterprise conservent un accès selon leurs licences.

Référence officielle : [Transitioning Gemini CLI to Antigravity CLI](https://developers.googleblog.com/an-important-update-transitioning-gemini-cli-to-antigravity-cli/)

Palabre ne génère plus Gemini CLI dans les nouvelles configurations et ne le propose plus dans les presets. Les anciennes notes Gemini sont conservées dans [notes Gemini](https://github.com/JuReyms/Palabre/blob/main/docs/archive/gemini-fr.md) pour contexte.

## Configuration JSON

La configuration générée par Palabre ressemble à ceci :

Extrait du bloc `agents` :

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

## Limites et quota

Documentation officielle : [Antigravity CLI — mode non interactif](https://antigravity.google/docs/cli/headless/).

Un message de quota autonome comme « Individual quota reached », dans une sortie courte, est classé `usage-limit` même avec un code 0. Il n'est pas pris pour une réponse normale. Le prompt passe en argument et peut dépasser la taille d'une ligne de commande, surtout sous Windows. Le défaut PALABRE borne l'appel à 5 minutes (`timeoutMs` et `--print-timeout`) ; ajustez les deux ensemble. Le pseudo-terminal fusionne stdout et stderr. Antigravity n'est pas une cible Relay.
