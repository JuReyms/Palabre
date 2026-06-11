# Palabre — référence CLI

## Commandes de lancement

```bash
# Agents par défaut
palabre -s "Sujet du débat" -t 4

# Avec un preset (paire d'agents)
palabre codex-claude -s "Analyse CheckoutPanel.vue et propose les corrections prioritaires" --files src/components/CheckoutPanel.vue -t 4

# Agents explicites
palabre run --subject "Sujet" --agent-a codex --agent-b claude -t 4

# Lister les presets disponibles
palabre presets --json
```

Convention de rôles : `agent-a` = implementer/proposeur, `agent-b` = reviewer/critique.

## Options de débat

- `-s, --subject <text>` : sujet (alias `--topic`).
- `-t, --turns <1-20>` : nombre total de réponses (4 = bon défaut, 6-8 pour un sujet complexe).
- `--agent-a <name>` / `--agent-b <name>` : agents explicites.
- `--preset <name>` : paire d'agents (ex. `codex-claude`).
- `--files <paths...>` : injecter des fichiers précis (préférer à `--context` pour rester pertinent).
- `--context <paths...>` : scanner des fichiers/dossiers texte (preview : `palabre context scan [paths] --json`).
- `--summary-agent <name>` : agent qui rédige la synthèse (`none`/`--no-summary` pour désactiver).
- `--model-a` / `--model-b` : forcer un modèle par agent.
- `--no-early-stop` : aller au bout des tours demandés (utile si consensus prématuré).
- `--pull-models` : autoriser Ollama à télécharger un modèle manquant.
- `--show-prompt` : afficher le prompt du 1er tour sans appeler d'agent (debug).
- `--language fr|en` : langue de Palabre et des prompts.

## Configuration

```bash
palabre init                                  # config globale + détection des agents
palabre init --local                          # config dans le dossier courant
palabre config --set-defaults codex claude    # agents par défaut
palabre config -t 4                           # nb de réponses par défaut
palabre config --summary-agent claude         # agent de synthèse par défaut
palabre config --language fr                  # langue
palabre config --ollama-models --json         # état Ollama
palabre config --set-ollama-model <model>     # modèle Ollama
```

## Dépannage

- **Agent non détecté** → vérifier qu'il marche seul dans le terminal, puis `palabre config --sync-agents`.
- **Modèle Ollama absent** → `--pull-models` ou `palabre config --sync-ollama-model`.
- **Débat trop court / consensus prématuré** → augmenter `-t` ou ajouter `--no-early-stop`.
- **Diagnostic complet** → `palabre doctor --plain` (rendu brut, pratique pour les logs).
