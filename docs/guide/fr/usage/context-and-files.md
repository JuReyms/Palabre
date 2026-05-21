---
title: Contexte et fichiers
description: Ajouter du contexte à un débat avec --files ou --context tout en gardant le contrôle sur les données transmises.
---

Palabre peut envoyer du contexte projet aux agents. C'est indispensable pour demander une critique de code, d'architecture ou de documentation.

## Deux modes

| Option | Usage |
|--------|-------|
| `--files` | Vous choisissez explicitement les fichiers. Un chemin invalide arrête la commande. |
| `--context` | Palabre scanne des fichiers ou dossiers texte avec des limites et des exclusions. |

## Fichiers explicites

```bash
palabre codex-claude "Relis ce module" --files src/auth.ts README.md
```

Utilisez `--files` quand vous savez exactement quels fichiers doivent être envoyés.

## Scan de contexte

```bash
palabre codex-claude "Critique cette architecture" --context src docs
```

`--context` ignore les dossiers techniques courants comme `.git`, `node_modules` et `dist`. Il garde les fichiers texte connus et affiche des avertissements pour les fichiers ignorés.

## Prévisualiser le scan en JSON

```bash
palabre context scan src docs --json
```

Cette commande expose le même scan que `--context`, sans lancer de débat. Elle renvoie un JSON versionné avec la racine scannée, les chemins demandés, les dossiers et fichiers retenus, ainsi que les avertissements. Les intégrations comme l'extension VS Code doivent utiliser cette commande au lieu de réimplémenter les règles d'exclusion ou de limite.

## Ollama et les fichiers

Ollama ne lit pas le filesystem par lui-même. Il reçoit seulement le prompt construit par Palabre.

Si un agent Ollama participe à un débat sur votre projet, ajoutez explicitement du contexte :

```bash
palabre codex-ollama "Critique ce module" --context src
```

## Voir le prompt envoyé

```bash
palabre codex-claude "Sujet" --context src --show-prompt
```

Cette commande ne lance aucun agent. Elle permet de vérifier ce que Palabre enverra au premier tour.
