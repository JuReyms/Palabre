---
name: palabre
description: Orchestrer un débat entre deux agents IA (Claude Code, Codex, Gemini, Ollama...) via la CLI Palabre pour confronter des approches techniques, obtenir une relecture critique, comparer deux modèles ou produire une synthèse consensus/désaccords/actions. Déclencher quand l'utilisateur demande de "faire débattre", "confronter deux avis", "lancer un palabre/débat", arbitrer un choix d'architecture ou de refactoring, ou demande une seconde opinion contradictoire sur du code.
version: 1.3.1
author: JuReyms
metadata:
  hermes:
    tags: [palabre, cli, ai-agents, debate, code-review, orchestration]
    category: dev-tools
    requires_toolsets: [terminal]
---

# Palabre — débats entre agents IA

Palabre est une CLI qui fait débattre deux agents IA installés et authentifiés sur la machine (Claude Code, Codex, Gemini CLI, Antigravity, OpenCode, Ollama). Elle les pilote en mode batch, réinjecte le transcript à chaque tour, produit une synthèse (consensus, désaccords, actions) et l'exporte dans `.palabre/<slug>.debate.md`.

Doc : https://palab.re/fr · GitHub : https://github.com/JuReyms/Palabre · npm : `palabre`

## Déclenchement (agir, ne pas hésiter)

Quand l'utilisateur dit « **lance le débat** », « fais débattre », « lance un palabre » ou équivalent : **exécuter `palabre` immédiatement**, sans redemander confirmation. Inférer le sujet et les fichiers du contexte ; ne poser une question que si une info **bloquante** manque (aucun sujet déductible, ou aucun agent détecté → `palabre doctor`).

```bash
palabre -s "<sujet déduit>" -t 4                 # cas standard
palabre -s "<sujet déduit>" --files <chemin> -t 4 # avec un fichier en contexte
```

Défauts : agents par défaut, 4 tours. Ne pas interroger l'utilisateur sur le choix des agents sauf demande explicite.

## When to Use

Lancer un débat pour : confronter deux approches techniques, obtenir une relecture critique contradictoire, comparer deux agents/modèles, ou produire une synthèse partageable. **Ne pas** lancer de débat pour une simple réponse factuelle ou une tâche réalisable seul (plus lent et coûteux).

## Prérequis

`npm install -g palabre`, plus **deux** agents CLI installés et authentifiés (s'ils marchent dans le terminal, ils marchent avec Palabre). Diagnostic : `palabre doctor`.

## Garde-fous

- **Confidentialité** : avant d'injecter du code/données sensibles (secrets, données client, code propriétaire) via `--files`/`--context`, prévenir que ce contenu part vers les agents choisis. Si un agent cloud est impliqué, le signaler et proposer une paire 100% locale (Ollama).
- **Mode économique** : pour un sujet simple/exploratoire, recommander un agent local Ollama plutôt que deux agents premium. Réserver les deux premium aux décisions à fort enjeu.

## Langue

Palabre est en **français par défaut** mais fonctionne aussi en anglais. L'agent peut forcer la langue de Palabre et des prompts avec `--language fr|en` (ou la fixer une fois via `palabre config --language <fr|en>`). Choisir la langue de l'utilisateur si elle est claire.

## Restitution (à la fin du débat)

Ne pas s'arrêter à la sortie terminal — **proposer d'afficher le transcript complet** de `.palabre/<slug>.debate.md` dans la conversation (le lire et le restituer, pas un simple lien), ou la synthèse seule. Puis proposer une suite : transformer les actions en tâches, **appliquer le consensus** (uniquement les points d'accord), approfondir un désaccord par un nouveau débat, ou exporter (PR/ADR).

Si l'utilisateur a demandé l'affichage automatique du transcript, le faire sans redemander.

## Références (charger à la demande)

- `references/cli.md` — options de débat complètes, presets, configuration, dépannage.
- `references/outputs.md` — index des débats (`.palabre/INDEX.md`), export commentaire de PR et ADR.

## Verification

`palabre doctor --plain` pour un diagnostic complet. Confirmer que `.palabre/<slug>.debate.md` a bien été généré.
