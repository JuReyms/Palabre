---
title: Référence des commandes
description: Référence des commandes et options disponibles dans la CLI Palabre.
---

Cette page liste les commandes principales de Palabre.

## Commandes de démarrage

| Commande | Description |
|----------|-------------|
| `palabre` | Ouvre l'accueil TUI, crée la configuration globale au premier lancement et rafraîchit les agents connus détectés. |
| `palabre init` | Crée explicitement la configuration globale et détecte les agents. |
| `palabre init --local` | Crée une configuration dans le dossier courant. |
| `palabre doctor` | Affiche un diagnostic par sections : configuration, outils locaux, agents et points à vérifier. |
| `palabre agents` | Liste les agents déclarés et leur détection locale. |
| `palabre -a` | Raccourci de `palabre agents`. |
| `palabre history`, `palabre historique` | Liste les derniers exports Markdown Palabre. |
| `palabre context scan --json` | Prévisualise le contexte projet que Palabre retiendrait. |

## Configuration

L'accueil TUI applique la même synchronisation prudente des agents connus que `palabre config --sync-agents` : il ajoute les agents connus nouvellement détectés et rafraîchit leurs commandes sans toucher aux agents custom ni aux defaults utilisateur.

| Commande                                     | Description                               |
| -------------------------------------------- | ----------------------------------------- |
| `palabre config`                             | Ouvre l'assistant de configuration.       |
| `palabre config --set-defaults codex claude` | Définit les agents par défaut.            |
| `palabre config -t 4`                        | Définit le nombre de tours par défaut. |
| `palabre config --summary-agent claude`      | Définit l'agent de synthèse par défaut.   |
| `palabre config --summary-agent none`        | Retire l'agent de synthèse par défaut.    |
| `palabre config --ask-summary-agent opencode` | Définit l'agent de synthèse par défaut du mode ask. |
| `palabre config --mode ask`                  | Définit le mode par défaut (`debate` ou `ask`). |
| `palabre config --ask-agents codex claude opencode` | Définit les agents par défaut du mode ask, 4 maximum. |
| `palabre config --interface tui`             | Définit l'interface par défaut (`tui` ou `terminal`). |
| `palabre config --language en`               | Définit la langue de Palabre et des prompts agents. |
| `palabre config --clear-defaults`            | Supprime les paramètres par défaut.       |
| `palabre config --sync-agents`               | Ajoute les agents détectés manquants et rafraîchit les commandes connues. |
| `palabre config --ollama-models --json`      | Liste les modèles Ollama installés et l'état du modèle configuré. |
| `palabre config --set-ollama-model <modele>` | Définit le modèle de l'agent `ollama-local`. |
| `palabre config --sync-ollama-model`         | Remplace le modèle Ollama configuré s'il n'est plus installé. |

## Débats

| Commande | Description |
|----------|-------------|
| `palabre new` | Ouvre l'assistant guidé de création d'un débat ou d'une demande Ask. |
| `palabre -s "Sujet" -t 4` | Lance avec les agents par défaut. |
| `palabre codex-claude "Sujet" -t 4` | Lance avec un preset. |
| `palabre run --subject "Sujet" --agent-a codex --agent-b claude` | Lance avec des agents explicites. |
| `palabre ask "Sujet" --agents codex claude` | Lance une demande avec des réponses indépendantes. |

## Commandes TUI

Ces commandes sont disponibles dans l'accueil TUI ou dans `/config` selon le contexte.

| Commande | Description |
|----------|-------------|
| `/ask` | Passe l'accueil TUI en mode Ask. |
| `/debat` | Passe l'accueil TUI en mode débat. |
| `/agents` | Affiche les agents disponibles ou modifie les agents actifs si des noms sont fournis. |
| `/roles` | Affiche les rôles disponibles ou modifie les rôles actifs si des rôles sont fournis. |
| `/config` | Ouvre les réglages TUI. |
| `/history` | Affiche les derniers exports Markdown. Alias : `/historique`. |
| `/update` | Vérifie la version npm et affiche les instructions de mise à jour adaptées. |
| `/ollama` | Affiche le modèle Ollama configuré et les modèles installés depuis `/config`. |
| `/ollama-url <url|default>` | Configure l'adresse de tous les agents Ollama depuis `/config`. |
| `/ollama-model <modele>` | Change le modèle configuré de `ollama-local` depuis `/config`. |
| `/ollama-sync` | Remplace le modèle Ollama configuré par un modèle installé quand le modèle courant est absent. |
| `/language fr`, `/language en` | Change la langue depuis `/config`. Alias : `/lang`, `/langue`. |
| `/interface tui`, `/interface terminal` | Change l'interface par défaut depuis `/config`. |
| `/home` | Revient à l'accueil TUI. Alias : `/back`. |
| `/quit` | Quitte la TUI. |

## Intégrations

| Commande | Description |
|----------|-------------|
| `palabre agents --json` | Liste les agents configurés, leur rôle, leur type et leur disponibilité au format JSON v1. |
| `palabre presets --json` | Liste les presets et leur disponibilité locale. |
| `palabre history --json` | Liste les derniers exports Markdown au format JSON v1. |
| `palabre config --ollama-models --json` | Renvoie l'état Ollama local au format JSON v1 pour les intégrations. |
| `palabre context scan [paths...] --json` | Renvoie les dossiers, fichiers et avertissements du scan `--context` au format JSON v1. |

## Options générales

| Option | Description |
|--------|-------------|
| `-h`, `--help` | Affiche l'aide. |
| `-v`, `--version` | Affiche la version. |
| `--config <path>` | Utilise un fichier de configuration explicite. |
| `--trust-config` | Approuve l'empreinte de la configuration locale après vérification de son contenu. |
| `--language <fr\|en>`, `--lang <fr\|en>` | Force la langue de Palabre et des prompts agents pour la commande. |
| `--tui` | Force l'interface TUI, même si la configuration demande le rendu terminal. |
| `--terminal`, `--no-tui` | Utilise un rendu terminal brut. Aussi utile avec `palabre doctor` pour les logs. |
| `--plain` | Alias historique de `--terminal`. |
| `--renderer <auto\|pretty\|plain\|tui\|ndjson>` | Choisit le renderer terminal ou intégration. `tui` active l'interface terminal plein écran. |

## Options de débat

| Option | Description |
|--------|-------------|
| `-s`, `--subject <text>` | Sujet de la session. |
| `--topic <text>` | Alias compatible de `--subject`. |
| `--preset <name>` | Choisit une paire d'agents. |
| `--agent-a <name>` | Premier agent. |
| `--agent-b <name>` | Second agent. |
| `--mode <debate\|ask>` | Choisit le mode d'orchestration. |
| `--agents <names...>` | Agents du mode ask, 4 maximum. |
| `-t`, `--turns <number>` | Nombre total de réponses, entre 1 et 20. |
| `--no-early-stop` | Désactive l'arrêt anticipé. |
| `--model-a <model>` | Modèle transmis à l'agent A. |
| `--model-b <model>` | Modèle transmis à l'agent B. |
| `--ollama-url <url>` | Surcharge l'adresse de tous les agents Ollama pour cette session. |
| `--pull-models` | Autorise Ollama à télécharger un modèle manquant. |
| `--summary-agent <name>` | Agent de synthèse. |
| `--summary-model <model>` | Modèle de synthèse. |
| `--no-summary` | Désactive la synthèse finale. |
| `--files <paths...>` | Injecte des fichiers précis. |
| `--context <paths...>` | Scanne fichiers ou dossiers texte. |
| `--show-prompt` | Affiche le prompt du premier tour sans appeler d'agent. |

## Mise à jour

| Commande | Description |
|----------|-------------|
| `palabre update` | Affiche les instructions de mise à jour. |
| `palabre update --apply` | Applique la mise à jour depuis un checkout git. |
