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
- export Markdown `.debate.md` ;
- diagnostic avec `palabre doctor`.

## Prochaines améliorations

### Diagnostic plus utile

`palabre doctor` doit devenir le premier réflexe quand quelque chose ne fonctionne pas. L'objectif est d'afficher des messages plus actionnables pour les problèmes courants : agent introuvable, configuration incomplète, modèle Ollama manquant, PATH incorrect ou quota atteint côté provider.

### Configuration plus simple

La commande `palabre config` va continuer à évoluer pour rendre les réglages courants plus faciles : agents par défaut, nombre de réponses, agent de synthèse, synchronisation des agents installés après l'initialisation.

### Exports plus faciles à retrouver

Les fichiers `.debate.md` sont déjà exportés automatiquement. Une prochaine amélioration envisagée consiste à générer des noms de fichiers plus lisibles, par exemple avec une partie du sujet du débat.

### Tests et stabilité

Le projet va ajouter des tests de fumée reproductibles pour les adapters CLI. Cela permettra de vérifier les comportements essentiels sans appeler de vrais services IA pendant les tests.

## Ensuite

Ces sujets sont envisagés après stabilisation du CLI :

- historique local des débats ;
- reprise d'un débat depuis un transcript existant ;
- affichage du modèle utilisé quand Palabre peut le connaître ;
- provider compatible OpenAI local pour LM Studio, LocalAI, vLLM ou équivalent ;
- documentation en français et en anglais ;
- vrai TUI interactif avec scrolling, pause et reprise.

## Philosophie

Palabre restera centré sur un principe simple : piloter les outils IA que vous avez déjà installés, sans remplacer leurs comptes, leurs modèles, leurs abonnements ou leurs règles de confidentialité.
