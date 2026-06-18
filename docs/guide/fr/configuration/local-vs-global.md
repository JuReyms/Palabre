---
title: Configuration locale ou globale
description: Choisir entre configuration globale utilisateur et configuration locale propre à un projet.
---

Palabre peut utiliser une configuration globale pour tous vos projets, ou une configuration locale pour un projet précis.

## Configuration globale

Dans un terminal interactif, `palabre` crée automatiquement cette configuration globale au premier lancement.

```bash
palabre init
```

Fichier créé :

```text
~/.palabre/palabre.config.json
```

Utilisez `palabre init` explicitement si vous voulez préparer la config globale sans ouvrir la TUI, ou si vous voulez les mêmes agents par défaut partout.

## Configuration locale

```bash
palabre init --local
```

Fichier créé :

```text
./palabre.config.json
```

Utilisez cette option si un projet doit avoir ses propres agents, modèles ou dossier d'export.

## Ordre de résolution

Palabre cherche la configuration dans cet ordre :

1. `./palabre.config.json`
2. `~/.palabre/palabre.config.json`

Vous pouvez forcer un fichier :

```bash
palabre run -s "Sujet" --config ./palabre.config.json
palabre agents --config ./palabre.config.json
```
