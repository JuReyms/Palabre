---
title: Antigravity
description: Configurer Antigravity CLI dans Palabre avec une réponse JSON qui conserve les espaces et les paragraphes.
seo:
  title: "Configurer Antigravity CLI : JSON et --print-timeout"
  description: Configurer Google Antigravity CLI avec Palabre, comprendre le format JSON et résoudre les réponses invalides ou les timeouts de la commande agy.
---

Antigravity CLI peut être utilisé comme agent Palabre via la commande `agy`.

Palabre utilise `agy --output-format json --print` sans pseudo-terminal. Il ne garde que le texte de la réponse, avec ses espaces et paragraphes ; les informations de conversation et d'usage ne sont pas ajoutées à votre échange.

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
  "type": "cli",
  "command": "agy",
  "args": ["--print-timeout", "5m0s", "--output-format", "json", "--print"],
  "responseFormat": "antigravity-json",
  "promptMode": "argument",
  "shell": true,
  "role": "reviewer",
  "tier": "primary",
  "timeoutMs": 300000
}
```

## Exemples

L'exemple utilise `shell: true` pour la résolution prudente sous Windows (faux ailleurs dans la configuration générée). Le natif et les shims reconnus sont lancés sans shell ; un wrapper restant est refusé avec le prompt en argument.

```bash
palabre codex-antigravity "Compare cette approche d'architecture" -t 4
palabre antigravity-ollama "Critique ce plan de migration" -t 3
```

## Limites et quota

Documentation officielle : [Antigravity CLI — mode non interactif](https://antigravity.google/docs/cli/headless/).

Une sonde sur Antigravity 1.4.9 sous Windows a confirmé la capture JSON et la conservation des paragraphes. Les autres versions et plateformes restent à qualifier. Le format doit contenir un objet JSON unique, `status: "SUCCESS"` et un champ `response` non vide. Une erreur, un JSON inconnu ou incomplet est refusé, même si `allowEmptyOutput` est activé : aucun repli automatique vers le texte ou le PTY. Vérifiez `agy --help` et les arguments ci-dessus en cas de refus. Un quota reconnu sur stderr reste classé `usage-limit` ; les statuts JSON d'erreur ne sont pas encore qualifiés plus finement.

L'ancien défaut exact (`cli-pty`, commande `agy` ou `antigravity`, arguments `["--print-timeout", "5m0s", "--print"]`, `promptMode: "argument"`, sans dimensions PTY, `shell`, délai d'inactivité ni format personnalisés, sans wrapper explicite `.cmd`/`.bat`/`.ps1`) est converti en mémoire au chargement. `palabre config --sync-agents` l'écrit sur demande ; un conflit avec une édition externe empêche l'écriture. Les arguments ou transports personnalisés sont conservés : adaptez-les vous-même à l'exemple si vous souhaitez utiliser le JSON. Le PTY historique peut perdre des espaces ou paragraphes en nettoyant les mouvements de curseur. `palabre doctor` signale un `responseFormat` inconnu ou incompatible ; sur PTY, ce champ est refusé avant lancement.

Le prompt passe en argument et peut dépasser la taille d'une ligne de commande, surtout sous Windows. Le défaut Palabre borne l'appel à 5 minutes (`timeoutMs` et `--print-timeout`) ; ajustez les deux ensemble. Ce changement de format ne limite pas les outils, plugins ou permissions d'Antigravity. Antigravity n'est pas une cible Relay.
