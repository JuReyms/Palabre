# Référence des commandes

Cette page liste les commandes principales de Palabre.

## Commandes de démarrage

| Commande | Description |
|----------|-------------|
| `palabre init` | Crée la configuration globale et détecte les agents. |
| `palabre init --local` | Crée une configuration dans le dossier courant. |
| `palabre doctor` | Affiche un diagnostic par sections : configuration, outils locaux, agents et points à vérifier. |
| `palabre agents` | Liste les agents déclarés et leur détection locale. |
| `palabre -a` | Raccourci de `palabre agents`. |

## Configuration

| Commande                                     | Description                               |
| -------------------------------------------- | ----------------------------------------- |
| `palabre config`                             | Ouvre l'assistant de configuration.       |
| `palabre config --set-defaults codex claude` | Définit les agents par défaut.            |
| `palabre config -t 4`                        | Définit le nombre de réponses par défaut. |
| `palabre config --summary-agent claude`      | Définit l'agent de synthèse par défaut.   |
| `palabre config --clear-defaults`            | Supprime les paramètres par défaut.       |
| `palabre config --sync-agents`               | Ajoute les agents détectés manquants.     |

## Débats

| Commande | Description |
|----------|-------------|
| `palabre new` | Ouvre l'assistant de création de débat. |
| `palabre -s "Sujet" -t 4` | Lance avec les agents par défaut. |
| `palabre codex-claude "Sujet" -t 4` | Lance avec un preset. |
| `palabre run --subject "Sujet" --agent-a codex --agent-b claude` | Lance avec des agents explicites. |

## Options générales

| Option | Description |
|--------|-------------|
| `-h`, `--help` | Affiche l'aide. |
| `-v`, `--version` | Affiche la version. |
| `--config <path>` | Utilise un fichier de configuration explicite. |
| `--plain` | Utilise un rendu terminal brut. Aussi utile avec `palabre doctor` pour les logs. |

## Options de débat

| Option | Description |
|--------|-------------|
| `-s`, `--subject <text>` | Sujet du débat. |
| `--topic <text>` | Alias compatible de `--subject`. |
| `--preset <name>` | Choisit une paire d'agents. |
| `--agent-a <name>` | Premier agent. |
| `--agent-b <name>` | Second agent. |
| `-t`, `--turns <number>` | Nombre total de réponses, entre 1 et 20. |
| `--no-early-stop` | Désactive l'arrêt anticipé. |
| `--model-a <model>` | Modèle transmis à l'agent A. |
| `--model-b <model>` | Modèle transmis à l'agent B. |
| `--pull-models` | Autorise Ollama à télécharger un modèle manquant. |
| `--summary-agent <name>` | Agent de synthèse. |
| `--summary-model <model>` | Modèle de synthèse. |
| `--no-summary` | Désactive la synthèse finale. |
| `--files <paths...>` | Injecte des fichiers précis. |
| `--context <paths...>` | Scanne fichiers ou dossiers texte. |
| `--show-prompt` | Affiche le prompt sans appeler d'agent. |

## Mise à jour

| Commande | Description |
|----------|-------------|
| `palabre update` | Affiche les instructions de mise à jour. |
| `palabre update --apply` | Applique la mise à jour depuis un checkout git. |
