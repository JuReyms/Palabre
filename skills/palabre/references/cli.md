# Palabre — référence CLI

## Commandes de lancement

```bash
# Agents par défaut
palabre -s "Sujet du débat" -t 4 --terminal

# Avec un preset (paire d'agents)
palabre codex-claude -s "Analyse CheckoutPanel.vue et propose les corrections prioritaires" --files src/components/CheckoutPanel.vue -t 4 --terminal

# Agents explicites
palabre run --subject "Sujet" --agent-a codex --agent-b claude -t 4 --terminal

# Réponses indépendantes de plusieurs agents
palabre ask "Comparer ces approches" --agents codex claude opencode --terminal

# Lister les presets disponibles
palabre presets --json
```

Utiliser `--role-a` et `--role-b` pour des rôles temporaires en débat, ou `--ask-role` pour un rôle commun en Ask. Les rôles ne modifient pas la configuration.

## Options de session

- `-s, --subject <text>` : sujet (alias `--topic`).
- `-t, --turns <1-20>` : nombre total de réponses (4 = bon défaut, 6-8 pour un sujet complexe).
- `--agent-a <name>` / `--agent-b <name>` : agents explicites du débat.
- `--preset <name>` : paire d'agents (ex. `codex-claude`).
- `--mode debate|ask` ou `palabre ask` : choisir le mode. Ask accepte `--agents <noms...>` (1 à 4 agents).
- `--role-a` / `--role-b` / `--ask-role` : rôles temporaires.
- `--files <paths...>` : injecter des fichiers précis (préférer à `--context` pour rester pertinent).
- `--context <paths...>` : scanner des fichiers/dossiers texte (preview : `palabre context scan [paths] --json`).
- `--summary-agent <name>` : agent qui rédige la synthèse ; `--no-summary` la désactive.
- `--model-a` / `--model-b` / `--summary-model` : forcer un modèle.
- `--no-early-stop` : aller au bout des tours demandés.
- `--pull-models` : autoriser Ollama à télécharger un modèle manquant.
- `--show-prompt` : afficher le prompt du premier tour sans appeler d'agent.
- `--dry-run` : prévisualiser la session résolue sans appeler d'agent ni écrire d'export.
- `--terminal` : utiliser un rendu brut, préférable depuis un agent ou un script.
- `--language fr|en` : langue de Palabre et des prompts.

## Configuration

```bash
palabre init                                  # config globale + détection des agents
palabre init --local                          # config dans le dossier courant
palabre config --set-defaults codex claude    # agents par défaut
palabre config -t 4                           # nb de réponses par défaut
palabre config --summary-agent claude         # agent de synthèse par défaut
palabre config --ask-agents codex claude opencode # agents Ask par défaut
palabre config --language fr                  # langue
palabre config --ollama-models --json         # état Ollama
palabre config --set-ollama-model <model>     # modèle Ollama
```

## Dépannage

- **Agent non détecté** → vérifier qu'il marche seul dans le terminal, puis `palabre config --sync-agents`.
- **Modèle Ollama absent** → `--pull-models` ou `palabre config --sync-ollama-model`.
- **Débat trop court / consensus prématuré** → augmenter `-t` ou ajouter `--no-early-stop`.
- **Diagnostic complet** → `palabre doctor --terminal`.