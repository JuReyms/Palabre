---
title: Configuration
description: Comprendre le fichier de configuration Palabre et les commandes disponibles pour le créer ou le modifier.
---

La configuration indique à Palabre quels agents existent, quels agents utiliser par défaut et où écrire les exports. Si `outputDir` n'est pas défini, les fichiers `.debate.md` et `.ask.md` sont créés dans le dossier `.palabre/` par défaut.

## Créer une configuration

Dans un terminal interactif, `palabre` crée automatiquement la configuration globale au premier lancement quand elle n'existe pas encore, puis ouvre l'accueil TUI :

```bash
palabre
```

La commande explicite reste disponible pour les scripts, la CI, ou quand vous voulez créer une config sans entrer dans la TUI :

```bash
palabre init
```

Cette commande crée une configuration globale :

```text
~/.palabre/palabre.config.json
```

Pour une configuration propre au projet courant :

```bash
palabre init --local
```

Cela crée :

```text
./palabre.config.json
```

## Voir la configuration utile

```bash
palabre
palabre agents
palabre doctor
```

Depuis l'accueil TUI, `/config` affiche les réglages courants et `/agents` liste les agents disponibles. Hors TUI, `palabre agents` affiche les agents déclarés et leur détection locale. `palabre doctor` vérifie les erreurs courantes.

Au démarrage de l'accueil TUI, Palabre synchronise prudemment les agents connus détectés : il peut ajouter les agents connus manquants et rafraîchir les noms de commandes connus, mais il n'écrase pas les agents custom, les rôles, les modèles ni les defaults utilisateur.

## Modifier les paramètres courants

```bash
palabre config
```

Dans la TUI, `/config` permet de définir ou supprimer les paramètres par défaut sans quitter Palabre. Les commandes directes ci-dessous permettent aussi de modifier un seul réglage depuis le terminal ou un script.

Commandes directes utiles :

```bash
palabre config --set-defaults codex claude --summary-agent claude -t 4
palabre config --mode ask --ask-agents codex claude opencode --ask-summary-agent opencode
palabre config --interface tui
palabre config --language en
palabre config -t 3
palabre config --summary-agent claude
palabre config --clear-defaults
palabre config --sync-agents
palabre config --ollama-models --json
palabre config --set-ollama-model <modele-ollama-installe>
palabre config --sync-ollama-model
```

Dans la TUI, les mêmes réglages courants sont accessibles depuis `/config` avec des commandes comme `/agents`, `/roles`, `/summary`, `/turns`, `/interface`, `/language`, `/mode`, `/default`, `/ollama`, `/ollama-model <modele>` et `/ollama-sync`.

## Aller plus loin

- [Paramètres par défaut](/fr/configuration/defaults)
- [Configuration locale ou globale](/fr/configuration/local-vs-global)
- [JSON avancé](/fr/configuration/advanced-json)
