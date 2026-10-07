# Palabre — référence CLI (Débat, Ask et commun)

Chat et Relay ont leur propre référence : `references/chat.md` et `references/relay.md`.

## Agents et disponibilité

```bash
palabre agents --json    # agents configurés, rôle, available, unavailableReason, defaults.askAgents
palabre presets --json   # paires disponibles (available, missingAgents, unavailableReasons)
palabre doctor --terminal
```

Lire ces contrats plutôt que deviner : la disponibilité est calculée par le CLI.

## Débat

Deux agents se répondent avec le sujet, le contexte et l'historique ; synthèse finale par défaut (consensus, désaccords, actions, conclusion).

```bash
palabre run --mode debate -s "Sujet du débat" -t 4 --terminal                                      # agents par défaut
palabre codex-claude --mode debate -s "Critique ce plan" --files docs/plan.md -t 4 --terminal   # preset
palabre run --mode debate --subject "Sujet" --agent-a codex --agent-b claude -t 4 --terminal   # agents explicites
palabre run --mode debate --subject "Sujet" --agent-a codex --agent-b claude --dry-run --json  # prévisualisation, aucun appel
```

- **Toujours passer `--mode debate`** : sans lui, `palabre -s`, `palabre run` et les presets suivent `defaults.mode` de l'utilisateur, qui peut être Ask ou Chat. `palabre ask` et `palabre chat` fixent déjà leur parcours.
- `-t, --turns <1-20>` : **total** de réponses, pas par agent (4 = bon défaut, 6-8 pour un sujet complexe).
- Arrêt anticipé possible après un tour complet si un accord explicite est détecté ; `--no-early-stop` va au bout.
- `--role-a`, `--role-b` : rôles temporaires (`implementer`, `reviewer`, `architect`, `scout`, `critic`, `summarizer`).

## Ask

Le même sujet et le même contexte vont à 1 à 4 agents, qui répondent sans voir les autres réponses ; synthèse ensuite, sauf `--no-summary`.

```bash
palabre ask "Comparer ces approches" --agents codex claude opencode --terminal
palabre ask "Question" --agents codex claude --ask-role critic --dry-run --json
```

- Sans `--agents` : `defaults.askAgents`, puis la paire de débat par défaut. `--turns` ne s'applique pas.
- Les agents sont aujourd'hui appelés l'un après l'autre : ne pas promettre de simultanéité, seulement l'indépendance des réponses.

## Options communes

- `-s, --subject <texte>` (alias `--topic`) ; un sujet positionnel doit contenir plusieurs mots.
- `--files <chemins...>` : fichiers précis (strict : 64 Kio par fichier, 192 Kio au total, binaires refusés).
- `--context <chemins...>` : fichiers ou dossiers texte, tolérant (avertissements) ; aperçu sans appel : `palabre context scan <chemins> --json`.
- `--summary-agent <agent>`, `--summary-model <modèle>`, `--no-summary`.
- `--model-a`, `--model-b` : modèle brut transmis à la CLI ou à Ollama.
- `--pull-models` : autorise Ollama à télécharger un modèle manquant (plusieurs Go possibles : demander d'abord).
- `--show-prompt` : prompt du premier appel, sans appel.
- `--dry-run` : session résolue, sans appel ni export ; avec `--json`, un objet JSON.
- `--terminal` : rendu brut, adapté à un agent ; `--renderer ndjson` (ou `--json`) : flux d'événements JSON v1.
- `--language fr|en`, `--config <chemin>`, `--ollama-url <url>`.

Ollama ne lit pas le workspace : il ne voit que le prompt, les fichiers transmis et le transcript.

## Checkpoints (Débat et Ask)

```bash
palabre codex-claude --mode debate -s "Décision importante" --checkpoint --terminal   # Débat
palabre ask "Question importante" --agents codex claude --checkpoint --terminal    # Ask
palabre sessions --json                 # 20 plus récents ; --limit <1-100>
palabre resume <session-id> --yes --terminal
palabre sessions delete <session-id> --yes   # seulement à la demande de l'utilisateur
```

La reprise vérifie la config approuvée et l'empreinte du contexte, ne rejoue aucune réponse complète et refuse une session terminée. `--yes` est obligatoire hors TTY. Chat n'a pas de checkpoint ; Relay reprend une conversation de fournisseur, pas un checkpoint Palabre.

## Configuration (décisions de l'utilisateur)

Ne modifier la configuration qu'à la demande de l'utilisateur :

```bash
palabre init                                   # config globale + détection des agents
palabre init --local                           # config dans le dossier courant
palabre config --set-defaults codex claude     # paire par défaut
palabre config --summary-agent claude          # synthèse par défaut
palabre config --ask-agents codex claude opencode
palabre config --language fr
palabre config --sync-agents                   # ajoute les agents connus détectés
```

Une config de projet doit être approuvée (empreinte SHA-256). En TTY, Palabre demande confirmation ; `--trust-config` l'approuve sans question : à n'utiliser que sur décision de l'utilisateur.

## Dépannage

- **Agent non détecté** → vérifier qu'il fonctionne seul dans le terminal, puis proposer `palabre config --sync-agents`.
- **Limite d'usage** (`usage-limit`) → changer d'agent ou attendre ; ne pas relancer en boucle.
- **Modèle Ollama absent** → proposer `--pull-models` ou `palabre config --sync-ollama-model`.
- **Débat trop court / consensus prématuré** → augmenter `-t` ou ajouter `--no-early-stop`.
- **Diagnostic complet** → `palabre doctor --terminal`.
