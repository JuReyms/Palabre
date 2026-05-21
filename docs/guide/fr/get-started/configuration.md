---
title: Première configuration
description: Créer une configuration Palabre, détecter les agents installés et définir des paramètres par défaut utiles.
---

## Initialiser Palabre

```bash
palabre init
```

Cette commande crée une configuration globale dans :

```text
~/.palabre/palabre.config.json
```

Elle détecte aussi les outils disponibles localement : Codex, Claude, Gemini, Antigravity, OpenCode et Ollama.
Après la création, Palabre affiche la langue active et la commande rapide pour basculer vers l'autre langue.

## Choisir la langue

Par défaut, Palabre utilise le français. Pour passer l'interface et les prompts envoyés aux agents en anglais :

```bash
palabre config --language en
```

Pour revenir au français :

```bash
palabre config --language fr
```

Vous pouvez aussi choisir la langue directement à l'initialisation :

```bash
palabre init --language en
```

## Vérifier l'installation

```bash
palabre doctor
```

`doctor` ne lance aucun agent IA. Il vérifie la configuration, les commandes disponibles, Ollama et les modèles locaux déclarés.

## Voir les agents déclarés

```bash
palabre agents
```

ou :

```bash
palabre -a
```

Cette commande affiche les agents présents dans votre configuration et indique s'ils sont détectés sur votre machine.

## Choisir des agents par défaut

Le plus simple est d'utiliser l'assistant :

```bash
palabre config
```

Vous pouvez aussi définir directement les agents par défaut :

```bash
palabre config --set-defaults codex claude --summary-agent claude -t 4
```

Ici :

- `codex` répond en premier ;
- `claude` répond en second ;
- `claude` produit la synthèse finale ;
- `-t 4` demande quatre réponses au total.

## Ajouter des agents détectés plus tard

Si vous installez Antigravity, OpenCode, Gemini ou Ollama après avoir créé la configuration :

```bash
palabre config --sync-agents
```

Cette commande ajoute les agents détectés manquants sans écraser vos réglages existants.

## Étape suivante

Vous pouvez maintenant [lancer un premier débat](/fr/get-started/first-debate).
