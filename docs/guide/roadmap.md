# Roadmap

Cette page donne une vue d'ensemble des évolutions prévues pour Palabre. Elle aide les utilisateurs à comprendre où va le projet, sans promettre de date de livraison.

## Disponible aujourd'hui

Palabre permet déjà de lancer des débats entre deux agents installés sur votre machine : Claude Code, Codex CLI, Gemini CLI, OpenCode ou Ollama.

Les fonctionnalités principales sont disponibles :

- configuration globale ou locale ;
- détection des agents installés ;
- assistant interactif `palabre new` ;
- presets comme `codex-claude`, `claude-gemini` ou `opencode-ollama` ;
- ajout de contexte avec `--files` ou `--context` ;
- synthèse finale avec consensus, désaccords, actions proposées et conclusion ;
- export Markdown `.debate.md` avec nom basé sur le sujet ;
- affichage des modèles connus dans le terminal, `--show-prompt` et l'export ;
- diagnostic avec `palabre doctor` ;
- premiers tests automatisés de l'adapter CLI sans appeler de vrais services IA.

## Prochaines améliorations

### Diagnostic plus utile

`palabre doctor` est le premier réflexe quand quelque chose ne fonctionne pas. Il affiche un diagnostic lisible par sections et garde `--plain` pour les logs. Les prochaines améliorations continueront à rendre ses messages plus actionnables pour les problèmes courants : agent introuvable, configuration incomplète, modèle Ollama manquant, PATH incorrect ou quota atteint côté provider.

### Configuration plus simple

La commande `palabre config` va continuer à évoluer pour rendre les réglages courants plus faciles : agents par défaut, nombre de réponses, agent de synthèse, synchronisation des agents installés après l'initialisation.


### Conversation après le débat

Après la synthèse finale, Palabre pourrait proposer de continuer brièvement la discussion avec les mêmes agents. L'objectif serait de demander une précision, de creuser un désaccord ou de faire réagir un agent à la synthèse, puis d'ajouter cette suite dans une section distincte de l'export Markdown.

### Tests et stabilité

Les premiers tests de fumée reproductibles couvrent déjà l'adapter CLI : prompt via `stdin`, prompt en argument, erreurs de sortie vide, exit non-zero et limite d'usage. La suite consiste à élargir progressivement cette couverture aux autres comportements sensibles, sans appeler de vrais services IA pendant les tests automatisés.

## Ensuite

Ces sujets sont envisagés après stabilisation du CLI :

- historique local des débats ;
- reprise d'un débat depuis un transcript existant ;
- provider compatible OpenAI local pour LM Studio, LocalAI, vLLM ou équivalent ;
- documentation en français et en anglais ;
- vrai TUI interactif avec scrolling, pause et reprise.

## Philosophie

Palabre restera centré sur un principe simple : piloter les outils IA que vous avez déjà installés, sans remplacer leurs comptes, leurs modèles, leurs abonnements ou leurs règles de confidentialité.
