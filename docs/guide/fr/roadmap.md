---
title: Roadmap
description: Découvrir ce qui est déjà disponible dans Palabre et les améliorations envisagées pour les prochaines versions.
---

Cette page donne une vue d'ensemble des évolutions prévues pour Palabre. Elle aide les utilisateurs à comprendre où va le projet, sans promettre de date de livraison.

## Disponible aujourd'hui

Palabre permet déjà de lancer des débats entre deux agents installés sur votre machine : Claude Code, Codex CLI, Gemini CLI, Antigravity CLI, OpenCode, Mistral Vibe ou Ollama.

Les fonctionnalités principales sont disponibles :

- configuration globale ou locale ;
- détection des agents installés ;
- assistant interactif `palabre new` ;
- presets comme `codex-claude`, `claude-gemini`, `codex-antigravity` ou `opencode-ollama` ;
- interface et prompts en français ou en anglais avec `--language`, `--lang`, `PALABRE_LANGUAGE` ou la configuration ;
- ajout de contexte avec `--files` ou `--context` ;
- prévisualisation du scan de contexte avec `palabre context scan --json` pour les intégrations ;
- synthèse finale avec consensus, désaccords, actions proposées et conclusion ;
- export Markdown `.debate.md` avec nom basé sur le sujet ;
- export partiel conservé si un agent plante pendant le débat ou la synthèse ;
- diagnostic avec `palabre doctor` ;
- sortie machine-readable avec `palabre presets --json`, `palabre context scan --json` et le renderer NDJSON ;
- erreurs structurées pour les intégrations, avec une politique de versioning NDJSON ;
- parser CLI plus robuste pour les flags booléens comme `--terminal`, `--json` ou `--no-summary` ;
- tests automatisés de l'adapter CLI, du parser, du renderer NDJSON, des presets, du scan de contexte, des prompts et de la configuration de sortie, sans appeler de vrais services IA.

## Prochaines améliorations

### Diagnostic plus utile

`palabre doctor` est le premier réflexe quand quelque chose ne fonctionne pas. Il affiche un diagnostic lisible par sections et garde `--terminal` pour les logs. Les prochaines améliorations continueront à rendre ses messages plus actionnables pour les problèmes courants : agent introuvable, configuration incomplète, modèle Ollama manquant, PATH incorrect ou quota atteint côté provider.

### Intégrations plus robustes

Palabre expose déjà des contrats JSON pour les presets, le scan de contexte et le rendu NDJSON des débats. Les prochaines améliorations viseront à garder ces contrats stables, mieux documentés et plus faciles à consommer par l'extension VS Code ou d'autres intégrations.

### Configuration plus simple

La commande `palabre config` couvre déjà les réglages courants : agents par défaut, nombre de réponses, agent de synthèse et synchronisation des agents installés après l'initialisation. Les prochaines améliorations viseront surtout des messages plus clairs, de meilleures validations et une expérience plus guidée.


### Conversation après le débat

Après la synthèse finale, Palabre pourrait proposer de continuer brièvement la discussion avec les mêmes agents. L'objectif serait de demander une précision, de creuser un désaccord ou de faire réagir un agent à la synthèse, puis d'ajouter cette suite dans une section distincte de l'export Markdown.

### Tests et stabilité

Les tests reproductibles couvrent déjà l'adapter CLI, le renderer NDJSON, la disponibilité des presets et la résolution du dossier d'export. La suite consiste à élargir progressivement cette couverture aux autres comportements sensibles, sans appeler de vrais services IA pendant les tests automatisés.

## Ensuite

Ces sujets sont envisagés après stabilisation du CLI :

- historique local des débats ;
- reprise d'un débat depuis un transcript existant ;
- provider compatible OpenAI local pour LM Studio, LocalAI, vLLM ou équivalent ;
- maintenance continue de la documentation française et anglaise ;
- interface CLI multilingue français/anglais à continuer d'affiner, avec un futur choix interactif de langue pendant l'initialisation ;
- vrai TUI interactif avec scrolling, pause et reprise ;
- affichage fiable des modèles quand Palabre pourra les connaître sans bruit inutile.

## Philosophie

Palabre restera centré sur un principe simple : piloter les outils IA que vous avez déjà installés, sans remplacer leurs comptes, leurs modèles, leurs abonnements ou leurs règles de confidentialité.
