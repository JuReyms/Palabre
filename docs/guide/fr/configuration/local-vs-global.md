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

Une configuration locale peut lancer les commandes déclarées dans ses agents et contacter les
serveurs Ollama configurés. Palabre demande donc une approbation avant sa première utilisation et
enregistre son empreinte dans `~/.palabre/trusted-configs.json`. Toute modification externe du
fichier invalide cette approbation. Dans un flux non interactif, vérifiez le fichier puis utilisez
`--trust-config` une fois pour enregistrer sa nouvelle empreinte.

`palabre doctor` reste utilisable avant l'approbation pour examiner la configuration. Dans ce cas,
il n'appelle pas les URLs Ollama déclarées par le fichier non fiable.

## Ordre de résolution

Palabre cherche la configuration dans cet ordre :

1. `./palabre.config.json`
2. `~/.palabre/palabre.config.json`

Vous pouvez forcer un fichier :

```bash
palabre run -s "Sujet" --config ./palabre.config.json
palabre agents --config ./palabre.config.json
```
