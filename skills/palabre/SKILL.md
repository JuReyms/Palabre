---
name: palabre
description: Orchestrer un débat entre deux agents IA (Claude Code, Codex, Gemini, Ollama...) via la CLI Palabre pour confronter des approches techniques, obtenir une relecture critique, comparer deux modèles ou produire une synthèse consensus/désaccords/actions. Déclencher quand l'utilisateur demande de "faire débattre", "confronter deux avis", "lancer un palabre/débat", arbitrer un choix d'architecture ou de refactoring, ou demande une seconde opinion contradictoire sur du code.
version: 1.0.0
author: Julien (JuReyms)
metadata:
  hermes:
    tags: [cli, ai-agents, debate, code-review, orchestration]
    category: dev-tools
    requires_toolsets: [terminal]
---

# Palabre — débats entre agents IA

Palabre est une CLI qui orchestre un débat entre deux agents IA déjà installés et authentifiés sur la machine (Claude Code, Codex, Gemini CLI, Antigravity, OpenCode, Ollama). Elle pilote ces CLIs en mode batch, réinjecte le transcript à chaque tour, puis produit une synthèse (consensus, désaccords, actions) et l'exporte dans un fichier `.debate.md`.

Doc : https://palab.re/fr · GitHub : https://github.com/JuReyms/Palabre · npm : `palabre`

## When to Use

Lancer un débat Palabre quand l'utilisateur veut :
- confronter deux approches techniques (architecture, refactoring, choix de lib) ;
- une relecture critique contradictoire d'une idée ou d'un bout de code ;
- comparer deux agents/modèles sur une même question ;
- opposer un modèle local (Ollama) à une CLI cloud pour une session économique ;
- un transcript Markdown partageable avec consensus, désaccords et actions.

Ne PAS lancer de débat pour une simple réponse factuelle ou une tâche réalisable seul : c'est plus lent et coûteux.

## Prérequis (vérifier avant de lancer)

1. Palabre installé : `npm install -g palabre`
2. Au moins **deux** agents CLI installés et authentifiés (s'ils marchent dans le terminal, ils marchent avec Palabre).
3. Diagnostic : `palabre doctor` puis `palabre agents` (alias `palabre -a`).

Palabre s'exécute **localement** et n'envoie rien à un serveur Palabre. La confidentialité dépend des agents choisis — prévenir l'utilisateur avant d'injecter du code sensible.

## Procedure

1. Cadrer le sujet en une phrase claire et arbitrable (un choix, une comparaison, une critique).
2. Identifier les fichiers pertinents et les passer via `--files` (précis) ou `--context` (dossier).
3. Choisir une paire d'agents complémentaires. Convention : `agent-a` = implementer/proposeur, `agent-b` = reviewer/critique.
4. Lancer le débat. 4 tours par défaut ; 6-8 pour un sujet complexe.
5. Récupérer la synthèse à l'écran et le transcript exporté dans `.palabre/<slug>.debate.md`.

### Commandes de lancement

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

### Options de débat utiles

- `-s, --subject <text>` : sujet (alias `--topic`).
- `-t, --turns <1-20>` : nombre total de réponses (4 = bon défaut).
- `--agent-a <name>` / `--agent-b <name>` : agents explicites.
- `--preset <name>` : paire d'agents (ex. `codex-claude`).
- `--files <paths...>` : injecter des fichiers précis.
- `--context <paths...>` : scanner des fichiers/dossiers texte (preview : `palabre context scan [paths] --json`).
- `--summary-agent <name>` : agent qui rédige la synthèse (`none`/`--no-summary` pour désactiver).
- `--model-a` / `--model-b` : forcer un modèle par agent.
- `--no-early-stop` : aller au bout des tours demandés.
- `--pull-models` : autoriser Ollama à télécharger un modèle manquant.
- `--show-prompt` : afficher le prompt du 1er tour sans appeler d'agent (debug).
- `--language fr|en` : langue de Palabre et des prompts.

## Configuration (optionnel)

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

## Pitfalls

- **Agent non détecté** → vérifier qu'il marche seul dans le terminal, puis `palabre config --sync-agents`.
- **Modèle Ollama absent** → `--pull-models` ou `palabre config --sync-ollama-model`.
- **Débat trop court / consensus prématuré** → augmenter `-t` ou ajouter `--no-early-stop`.
- **Contexte manquant** → préférer `--files` (ciblé) à `--context` (scan large) pour rester pertinent.

## Verification

- `palabre doctor --plain` pour un diagnostic complet (rendu brut, pratique pour les logs).
- Confirmer que le fichier `.palabre/<slug>.debate.md` a bien été généré à la fin du débat.
