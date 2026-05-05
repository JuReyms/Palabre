# Roadmap PALABRE

Cette roadmap est la source projet partagee. `docs/notes.md` reste reserve aux idees personnelles du mainteneur.

## Fait

- MVP CLI Node.js/TypeScript avec `pnpm`.
- Config JSON avec detection locale pendant `palabre init`.
- Defaults orientes agents CLI premium : `codex <-> claude`.
- Presets Codex, Claude, Gemini, OpenCode et Ollama.
- Adapter CLI batch pour Codex, Claude, Gemini et OpenCode.
- Adapter Ollama HTTP local.
- Validation Ollama via `/api/tags`.
- Pull Ollama explicite via `--pull-models` ou `autoPullModel`.
- Dechargement des autres modeles Ollama via `/api/ps` et `keep_alive: 0`.
- Contexte explicite via `--files`.
- Contexte projet borne via `--context`.
- Contexte de session explicite dans les prompts : date locale, fuseau horaire, dossier courant et debut de session.
- Preview de prompt via `--show-prompt`.
- Synthese finale configurable via `defaults.summaryAgent`, `--summary-agent`, `--summary-model` et `--no-summary`.
- Arret anticipe sur accord clair, desactivable avec `--no-early-stop`.
- Rendu console pretty/plain avec etat "agent en cours".
- Export `.debate.md` avec en-tete de session en table Markdown.
- Installation globale locale testee avec `pnpm link --global`.
- Commande `palabre update` avec instructions et `--apply` pour checkout git.
- Syntaxe courte de lancement : `palabre preset "sujet" -t 4` et `palabre -s "sujet" -t 2`.
- Assistant interactif `palabre new` pour composer un debat pas a pas, afficher la commande equivalente et lancer ou previsualiser.
- Renommage produit de Chicane vers Palabre, avec fallback de config legacy.
- Config globale `~/.palabre/palabre.config.json`, avec config locale prioritaire et `palabre init --local`.
- Guides utilisateur versionnes dans `docs/guide/`.
- Reference CLI utilisateur dans `docs/guide/cli-reference.md`.
- Roles injectes dans les prompts avec consignes dediees par role.

## P0 - Stabilisation CLI

- Ajouter des JSDoc sur les API internes publiques du projet : types partages, adapters, orchestrateur, contexte, discovery et update.
- Afficher le modele utilise quand Palabre peut le connaitre.
- Ajouter un smoke test local reproductible pour les adapters CLI mock.

## P1 - Experience utilisateur

- Ameliorer les messages d'erreur init/update quand le PATH, pnpm global ou Ollama posent probleme.
- Afficher un recap clair avant debat dans le mode direct : agents, roles, modeles connus, contexte, synthese.

## P2 - Historique et reprise

- Stabiliser le format `.debate.md`.
- Ajouter `palabre history`.
- Ajouter une reprise depuis un transcript existant.
- Ajouter un index local optionnel des debats.

## P3 - Providers

- Ajouter un adapter `openai-compatible` pour LM Studio, LocalAI, vLLM et serveurs locaux compatibles.
- Garder Ollama comme provider local simple, avec roles `critic`, `scout` ou `summarizer` par defaut.

## P4 - TUI et integrations

- Remplacer le rendu console leger par un vrai TUI interactif.
- Ajouter scrolling, pause, reprise, intervention humaine et choix de synthese.
- Explorer une extension VS Code apres stabilisation du CLI.

## Plus tard

- Internationalisation francais/anglais.
- Modes multi-agents au-dela de deux participants.
- Selection intelligente de contexte et resume automatique des gros fichiers.
