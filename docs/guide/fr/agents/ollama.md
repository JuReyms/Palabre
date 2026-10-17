---
title: Ollama
description: Utiliser Ollama avec Palabre pour faire intervenir des modèles locaux ou compatibles avec votre configuration Ollama.
seo:
  title: Faire débattre des modèles IA en local
  description: Utiliser Ollama avec Palabre pour lancer des débats sur des modèles locaux, réduire les coûts et mixer local et cloud.
---

Ollama exécute des modèles sur votre machine. Avec un serveur et un modèle locaux, les requêtes restent locales ; un serveur distant reçoit les données. La première réponse peut prendre du temps pendant le chargement : `ollama ps` montre les modèles chargés.

## À installer avant Palabre

Installez Ollama depuis la documentation officielle, puis téléchargez un modèle.

Documentation officielle : [https://docs.ollama.com/](https://docs.ollama.com/)

Référence CLI : [https://docs.ollama.com/cli](https://docs.ollama.com/cli)

Vérifiez ensuite que la commande fonctionne :

```bash
ollama list
```
ou :
```bash
ollama ls
```

Si Ollama a été installé après votre première configuration Palabre, relancez `palabre` ou synchronisez explicitement :

```bash
palabre config --sync-agents
```

Si nécessaire, démarrez Ollama :

```bash
ollama serve
```

## Installer un modèle

```bash
ollama pull gemma4:e4b
```

Adaptez le modèle à votre machine. Les gros modèles peuvent être trop lourds pour un usage fluide.

En usage local, les limites principales viennent de votre machine : mémoire, CPU/GPU et temps de réponse. Si vous utilisez une offre cloud, payante ou distante d'Ollama, les quotas et limites associées viennent de cette offre, pas de Palabre.

## Choisir le modèle utilisé par Palabre

Palabre lit le modèle dans l'agent `ollama-local` de votre configuration. Pour voir les modèles installés et savoir si le modèle configuré existe encore :

```bash
palabre config --ollama-models --json
```

Pour changer le modèle par défaut de Palabre :

```bash
palabre config --set-ollama-model gemma4:e4b
```

Si vous avez supprimé le modèle configuré et que vous voulez laisser Palabre choisir un modèle installé disponible :

```bash
palabre config --sync-ollama-model
```

Ces commandes modifient la configuration Palabre. Pour un changement ponctuel sur un débat, utilisez plutôt `--model-a`, `--model-b` ou `--summary-model` selon la place de l'agent Ollama.

## Configuration typique

Extrait du bloc `agents` :

```json
"ollama-local": {
  "type": "ollama",
  "baseUrl": "http://localhost:11434",
  "model": "gemma4:e4b",
  "role": "critic",
  "temperature": 0.2,
  "validateModel": true,
  "unloadOtherModels": true
}
```

## Utiliser un serveur Ollama distant

Pour une seule session, surchargez l'adresse de tous les agents Ollama :

```powershell
palabre codex-ollama "Critique ce plan" --ollama-url gpu-box:11434
```

Vous pouvez aussi définir `OLLAMA_HOST` dans l'environnement du processus :

```powershell
$env:OLLAMA_HOST = "gpu-box:11434"
palabre codex-ollama "Critique ce plan"
```

Palabre accepte les adresses avec ou sans schéma HTTP. La priorité est :

1. `--ollama-url`
2. `OLLAMA_HOST`
3. `baseUrl` dans la configuration de l'agent
4. `http://localhost:11434`

Depuis la TUI, ouvrez `/config`, puis utilisez :

```text
/ollama-url gpu-box:11434
/ollama-url default
```

Cette commande met à jour durablement `baseUrl` pour tous les agents Ollama configurés.
Le flag et la variable d'environnement ne modifient pas le fichier de configuration.

## Télécharger automatiquement un modèle manquant

Par défaut, Palabre n'installe pas de modèle automatiquement. Pour l'autoriser au lancement :

```bash
palabre codex-ollama "Critique ce plan" --pull-models
```

Vous pouvez aussi activer `autoPullModel` dans la configuration de l'agent.

## Donner du contexte à Ollama

Ollama ne lit pas vos fichiers directement. Utilisez :

```bash
palabre codex-ollama "Critique ce module" --files src/module.ts
```

ou :

```bash
palabre codex-ollama "Critique l'architecture" --context src docs
```

## Défauts et diagnostics

À l'initialisation, PALABRE préfère `nemotron-3-nano:4b` s'il est installé, sinon le premier modèle installé ; sans modèle installé, ce même nom sert de repli. `gemma4:e4b` dans l'exemple est un choix explicite, pas le défaut imposé.

`--set-ollama-model` ne modifie que `ollama-local` et exige un modèle installé. Pour un autre agent, modifiez son champ `model`, puis réapprouvez le fichier après relecture. `palabre doctor` vérifie la disponibilité du serveur et du modèle ; `model-unavailable` signale un modèle absent, tandis qu'une panne réseau peut avoir un diagnostic HTTP.

Options avancées : `keepAlive`, `pullTimeoutMs` (30 minutes par défaut) et `maxOutputBytes`. Voir [Configuration](/fr/reference/config-file).
