---
title: Configuration locale ou globale
description: Choisir entre configuration globale utilisateur et configuration locale propre à un projet.
seo:
  title: "Config locale ou globale : laquelle prime"
  description: Choisir entre une configuration globale utilisateur et une configuration locale au projet, et savoir laquelle l'emporte.
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

0. `--config <chemin>`, s’il est fourni ;
1. `./palabre.config.json` ;
2. `./chicane.config.json` (historique) ;
3. `~/.palabre/palabre.config.json` ;
4. `~/.palabre/chicane.config.json` (historique).

Vous pouvez forcer un fichier :

```bash
palabre run -s "Sujet" --config ./palabre.config.json
palabre agents --config ./palabre.config.json
```

## Approbation

Une configuration peut lancer des commandes et contacter ses serveurs Ollama. L'approbation lie chemin canonique et empreinte SHA-256 dans `~/.palabre/trusted-configs.json` ; une modification externe invalide l'empreinte. `init` approuve le fichier créé. Les écritures ultérieures de PALABRE ne rafraîchissent qu'une approbation existante.

La garde générale exige cette approbation pour une configuration de projet implicite. Relay et `relay allow-repo` l'exigent pour le fichier résolu, **local ou global**. La commande d'approbation explicite fonctionne aussi pour un fichier global ; cela ne signifie pas que chaque autre commande contrôle automatiquement son empreinte.

Vous relisez le fichier puis lancez `palabre config --config <fichier> --trust-config`. Un agent ne doit pas l'approuver pour s'accorder des droits. Pour une configuration projet non approuvée, `doctor` reste disponible et ne contacte pas ses URLs Ollama.

La politique Relay suit le fichier résolu : `palabre relay allow-repo proprietaire/depot` affiche le chemin choisi et demande votre confirmation au clavier. Toute nouvelle configuration doit s'appeler `palabre.config.json`.
