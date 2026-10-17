---
title: Première configuration
description: Créer une configuration Palabre, détecter les agents installés et définir des paramètres par défaut utiles.
seo:
  title: Créer sa config et détecter les agents installés
  description: Créer une configuration Palabre, laisser détecter les CLI IA déjà installées sur votre machine et définir des valeurs par défaut.
---

## Première configuration automatique

Dans un terminal interactif, le plus simple est de lancer :

```bash
palabre
```

Si aucune configuration n'existe encore, Palabre crée la configuration globale :

```text
~/.palabre/palabre.config.json
```

Il détecte les outils disponibles localement, choisit des paramètres utiles quand c'est possible, puis ouvre l'accueil TUI.

## Initialisation explicite

Vous pouvez toujours initialiser Palabre explicitement :

```bash
palabre init
```

Cette commande crée la même configuration globale :

```text
~/.palabre/palabre.config.json
```

Elle détecte aussi les outils disponibles localement : Codex, Claude, Antigravity, OpenCode, Mistral Vibe et Ollama.
Après la création, Palabre affiche la langue active et la commande rapide pour basculer vers l'autre langue.

Pour une configuration propre au projet courant :

```bash
palabre init --local
```

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
- `-t 4` demande jusqu'à quatre réponses au total (deux par agent si toutes sont jouées, hors synthèse).

## Ajouter des agents détectés plus tard

Si vous installez Claude Code, Codex, Antigravity, OpenCode, Mistral Vibe ou Ollama après avoir créé la configuration :

```bash
palabre config --sync-agents
```

Cette commande ajoute les agents connus détectés manquants et rafraîchit les noms de commandes connus sans écraser vos agents custom ni vos defaults existants. L'accueil TUI effectue la même synchronisation prudente automatiquement au démarrage.

Les commandes déjà configurées avec un chemin absolu sont conservées, même si ce chemin est introuvable ; aucun repli silencieux vers une autre installation.

## Étape suivante

Vous pouvez maintenant [lancer une première session](/fr/get-started/first-debate).

## Autres réglages et approbation

```powershell
palabre config --mode ask --ask-agents codex claude opencode
palabre config --interface terminal
palabre config --clear-defaults
```

`--clear-defaults` retire les paramètres par défaut ; il ne désinstalle pas les agents. Voir `palabre config --help`.

`palabre init --local` crée `./palabre.config.json`, prioritaire sur la configuration globale dans ce dossier. Une configuration peut lancer des commandes avec vos droits : PALABRE exige une approbation de son contenu. `init` approuve le fichier qu'il crée ; une modification manuelle invalide cette approbation. Vous relisez le fichier, puis confirmez dans un terminal ou lancez `palabre config --config <fichier> --trust-config`. Un agent ne doit jamais approuver une politique pour s'accorder des droits.

Pour autoriser la seule tâche de revue Relay sur un dépôt, lancez vous-même `palabre relay allow-repo proprietaire/depot` dans votre terminal visible : une confirmation au clavier est requise. Voir [Relay](/fr/usage/relay).
