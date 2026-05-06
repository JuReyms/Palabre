# Référence CLI

Cette page reprend les commandes et options disponibles dans `palabre --help`.

Dans les exemples, [option] signifie facultatif et les crochets ne sont pas à taper. <valeur> signifie qu'il faut remplacer le texte par ta valeur.

## Commandes

| Commande | Description |
|----------|-------------|
| `palabre init` | Crée la config globale `~/.palabre/palabre.config.json` si elle n'existe pas. Détecte Codex, Claude, Gemini, OpenCode et Ollama. |
| `palabre init --local` | Crée une config locale `./palabre.config.json` dans le dossier courant. |
| `palabre update` | Affiche les instructions pour mettre à jour une installation locale. |
| `palabre update --apply` | Exécute la mise à jour si Palabre est lancé depuis un checkout git. |
| `palabre agents` ou `palabre agent` | Liste les agents déclarés dans la config et leur détection locale. |
| `palabre -a` | Raccourci de `palabre agents`. |
| `palabre config` | Ouvre un assistant pour définir ou supprimer les agents par défaut. |
| `palabre config --set-defaults codex claude --summary-agent claude --turns 4` | Définit les agents, la synthèse et les réponses par défaut. |
| `palabre config -t 3` | Modifie seulement le nombre de réponses par défaut si les agents par défaut existent déjà. |
| `palabre config --clear-defaults` | Supprime les agents et options par défaut de la config résolue. |
| `palabre config --sync-agents` | Ajoute les agents détectés mais absents de la config, sans écraser l'existant. |
| `palabre new` | Ouvre un assistant interactif pour choisir agents, sujet et options avant de lancer ou prévisualiser. |
| `palabre run --subject "Sujet"` | Lance un débat avec les agents par défaut de la config. |
| `palabre run --subject "Sujet" --agent-a codex --agent-b claude --turns 4` | Lance un débat en choisissant explicitement agents et tours. |
| `palabre claude-gemini "Sujet" -t 4` | Syntaxe courte avec preset + sujet positionnel. |
| `palabre -s "Sujet" -t 2` | Syntaxe courte avec agents par défaut. |
| `palabre help`, `palabre -h` ou `palabre --help` | Affiche l'aide CLI. |
| `palabre version`, `palabre -v` ou `palabre --version` | Affiche la version installée. |


## Assistant interactif

`palabre new` liste les agents déclarés dans la config, met en avant ceux détectés localement, puis demande le sujet. À ce stade, tu peux lancer immédiatement avec les valeurs par défaut.

Si tu refuses le lancement immédiat, le wizard propose les options courantes : nombre de réponses, modèles bruts, synthèse, contexte, fichiers, `--show-prompt` et `--plain`. Il affiche une commande équivalente avant l'exécution pour aider à passer ensuite au mode direct.

Dans les assistants interactifs, `Ctrl+C` interrompt immédiatement. Dans un prompt, tu peux aussi taper `q`, `quit` ou `exit` pour quitter proprement.

## Options générales

| Option | Description |
|--------|-------------|
| `-h`, `--help` | Affiche l'aide. |
| `-a` | Liste les agents déclarés dans la config. |
| `-v`, `--version` | Affiche la version. |
| `--config <path>` | Utilise un fichier de config explicite. |
| `--local` | Avec `init` ou `setup`, crée une config locale `./palabre.config.json`. |
| `--plain` | Utilise le rendu console simple sans habillage. |

## Sujet et lancement

| Option | Description |
|--------|-------------|
| `-s`, `--subject <text>` | Sujet du débat. C'est le nom recommandé. |
| `--topic <text>` | Alias compatible de `--subject`, conservé pour les anciennes commandes. |
| `--preset <name>` | Choisit une paire d'agents prédéfinie. |
| `--agent-a <name>` | Premier agent. |
| `--agent-b <name>` | Second agent. |
| `-t`, `--turns <number>` | Nombre total de réponses demandées. C'est une limite haute si l'arrêt anticipé est actif. Avec `palabre config`, modifie les réponses par défaut. |
| `--no-early-stop` | Désactive l'arrêt anticipé quand les agents sont clairement d'accord. |

Presets actuels : `codex-claude`, `claude-codex`, `codex-ollama`, `ollama-codex`, `claude-ollama`, `ollama-claude`, `gemini-ollama`, `ollama-gemini`, `codex-gemini`, `gemini-codex`, `claude-gemini`, `gemini-claude`, `codex-opencode`, `opencode-codex`, `claude-opencode`, `opencode-claude`, `gemini-opencode`, `opencode-gemini`, `opencode-ollama`, `ollama-opencode`.

## Modèles

| Option | Description |
|--------|-------------|
| `--model-a <model>` | Modèle brut transmis à l'agent A. |
| `--model-b <model>` | Modèle brut transmis à l'agent B. |
| `--pull-models` | Autorise Ollama à télécharger un modèle manquant. |

Palabre ne liste pas les modèles Codex, Claude, Gemini ou OpenCode : les noms changent souvent. La valeur est transmise telle quelle à la CLI concernée.

## Synthèse

| Option | Description |
|--------|-------------|
| `--summary-agent <name>` | Agent utilisé pour produire la synthèse finale. Prioritaire sur `defaults.summaryAgent`. |
| `--summary-model <model>` | Modèle brut transmis à l'agent de synthèse. |
| `--no-summary` | Désactive la synthèse finale. |

Par défaut, Palabre utilise `defaults.summaryAgent` quand il existe, sinon l'agent B.

## Contexte

| Option | Description |
|--------|-------------|
| `--files <paths...>` | Injecte explicitement des fichiers texte dans le prompt. Strict : les chemins invalides arrêtent la commande. |
| `--context <paths...>` | Scanne des fichiers ou dossiers texte de façon bornée, avec avertissements pour les fichiers ignorés. |
| `--show-prompt` | Affiche le prompt du premier tour sans appeler d'agent. |

Ollama ne lit pas le filesystem par lui-même. Pour qu'un agent Ollama voie le projet, utilise `--files` ou `--context`.

## En cas de problème

Consulte [Dépannage](/guide/troubleshooting) pour les messages WARN et ERREUR de palabre doctor.
