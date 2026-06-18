---
title: Gemini
description: Configurer Gemini CLI dans Palabre et l'utiliser dans des débats avec d'autres agents.
---

Gemini CLI permet d'utiliser les modèles Google Gemini depuis le terminal.

> Archive : cette page est conservée pour contexte historique. Palabre ne génère plus Gemini CLI dans les nouvelles configurations et ne l'expose plus dans les presets actifs. Utilisez Antigravity CLI pour les nouveaux usages Google.

Palabre peut l'utiliser comme agent de relecture, de comparaison ou de synthèse.

Google a annoncé la transition de Gemini CLI vers Antigravity CLI pour les utilisateurs individuels. Palabre conserve Gemini CLI pour les configurations existantes et expose Antigravity via l'adapter `cli-pty`, car `agy --print` nécessite une vraie console pour produire une sortie récupérable.

Référence officielle : [Transitioning Gemini CLI to Antigravity CLI](https://developers.googleblog.com/an-important-update-transitioning-gemini-cli-to-antigravity-cli/)

## À installer avant Palabre

Installez Gemini CLI depuis la documentation officielle de Google, puis authentifiez la CLI dans votre terminal.

Documentation officielle : [https://google-gemini.github.io/gemini-cli/docs/cli/](https://google-gemini.github.io/gemini-cli/docs/cli/)

Vérifiez ensuite que la commande fonctionne :

```bash
gemini --version
```

Si Gemini a été installé après votre première configuration Palabre, relancez `palabre` ou synchronisez explicitement :

```bash
palabre config --sync-agents
```

## Modèles et limites

Les modèles disponibles et les limites d'usage dépendent de votre configuration Gemini CLI et de votre compte Google.

Palabre ne liste pas les modèles Gemini, car ils peuvent évoluer. Par défaut, Gemini CLI utilise le modèle configuré de son côté. Si vous ajoutez `--model-a`, `--model-b` ou `--summary-model`, Palabre transmet cette chaîne à Gemini CLI via l'option modèle configurée. Si le modèle n'existe pas ou n'est pas autorisé, Gemini CLI renverra l'erreur.

## Windows

Sur Windows, `shell: true` est souvent nécessaire pour les wrappers npm ou PowerShell comme `gemini`.

## Configuration typique

```json
"gemini": {
  "type": "cli",
  "command": "gemini",
  "args": [],
  "promptMode": "stdin",
  "shell": true,
  "role": "reviewer"
}
```

## Utilisation

```bash
palabre claude-gemini "Critique cette décision produit" -t 4
palabre gemini-opencode "Compare ces arguments" -t 3
```
