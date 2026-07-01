# Changelog

Toutes les evolutions notables de Palabre CLI sont consignees ici. Format inspire de [Keep a Changelog](https://keepachangelog.com/), versionnage [SemVer](https://semver.org/).

## [Unreleased]

## [0.9.0] - 2026-07-01

### Added

- `palabre agents --json` expose un contrat v1 pour les intégrations avec les agents configurés actifs, leur disponibilité locale et la sélection Ask par défaut ; les agents retirés comme Gemini restent exclus même s'ils existent dans une ancienne config.
- Ollama distant : `--ollama-url`, `OLLAMA_HOST` et `palabre config --ollama-url` permettent de surcharger ou de persister l'adresse du serveur, avec normalisation et validation des URL.
- Configuration TUI : `/ollama-url <url|default>` modifie l'adresse de tous les agents Ollama sans éditer le JSON.
- Accueil TUI : vérification de la dernière version npm à chaque ouverture, avertissement non bloquant et commande `/update` affichant les instructions adaptées.

### Fixed

- Discovery, presets et doctor évaluent chaque agent Ollama avec son propre serveur et ses propres modèles, au lieu de réutiliser la détection de `ollama-local`.

## [0.8.1] - 2026-06-19

### Added

- Premier lancement TUI : `palabre` crée maintenant la configuration globale si aucune config n'existe, puis ouvre directement l'accueil.
- Accueil TUI : synchronisation prudente des agents connus détectés à chaque ouverture, avec ajout des agents manquants et rafraîchissement des commandes connues.
- Configuration TUI : `/ollama`, `/ollama-model <model>` et `/ollama-sync` permettent de consulter et changer le modèle `ollama-local` sans quitter Palabre.
- TUI : `/history` affiche les derniers exports Markdown, avec liens fichier/dossier quand le terminal les supporte.
- TUI : `/home` ramène à l'accueil depuis les vues secondaires et après une session.

### Changed

- `palabre config --sync-agents` persiste aussi les rafraîchissements de commandes connues même lorsqu'aucun nouvel agent n'est ajouté.
- Les guides et l'aide CLI recommandent désormais `palabre` comme entrée de première utilisation, avec `palabre init` réservé au setup explicite ou local.
- Les cartes TUI de session, de fin de session, d'historique et d'aide utilisent un rendu plus homogène et gardent le header Palabre.
- Les synthèses exposent le rôle runtime `summarizer`, même si l'agent configuré possède un autre rôle par défaut.
- Vibe n'utilise plus le mode `plan` par défaut pour éviter des réponses mal adaptées à Palabre.

### Fixed

- Adapters CLI et PTY : un exit code non nul est maintenant rejeté même si l'agent a écrit une sortie partielle.
- Adapter Ollama : la progression de `--pull-models` est écrite sur stderr afin de préserver stdout pour le NDJSON.
- `--context` : les chemins absents ou inaccessibles produisent un warning au lieu d'interrompre la session.
- Parser CLI : `--agents` et `palabre config --ask-agents` conservent toutes les valeurs afin que la validation métier signale correctement le dépassement de 4 agents.
- Débat TUI : les defaults Ask ne contaminent plus le lancement d'un débat.
- Windows : les arguments des agents CLI sont quotés plus strictement quand ils passent par le shell.
- TUI : les messages d'erreur et d'arrêt anticipé sont centrés comme les autres cartes runtime.

## [0.8.0] - 2026-06-17

### Added

- Mode `ask` : plusieurs agents peuvent répondre indépendamment au même sujet avant une synthèse comparative fidèle.
- Interface TUI-first : `palabre` ouvre un accueil interactif avec composer, mode courant, agents, rôles, synthèse, dossier courant et version.
- Configuration TUI native : `/config` permet de régler les agents, rôles, synthèse, tours, mode et interface sans sortir de Palabre.
- Commandes TUI `/agents` et `/roles` avec vue d'aide/wizard quand elles sont lancées sans arguments, et commande rapide quand les valeurs sont fournies directement.
- Affichage des agents disponibles dans la vue `/config`.
- Options CLI `--tui`, `--terminal` et `defaults.interface` pour choisir l'interface par défaut.

### Changed

- Les sessions interactives utilisent la TUI par défaut quand stdout est un terminal.
- Les rôles deviennent plus visibles dans l'accueil, la config et les exports TUI.
- `Ctrl+C` dans les wizards TUI remonte d'un niveau comme `/back`, et un double `Ctrl+C` quitte directement.
- `palabre update` affiche aussi une commande pnpm avec la version npm exacte quand elle est disponible, afin de contourner les cas ou `palabre@latest` reste temporairement sur une ancienne version avec les politiques de securite pnpm recentes.

### Fixed

- Le rendu TUI evite les doublons d'export Markdown en fin de session.
- Les réponses et synthèses TUI utilisent une largeur plus cohérente et des séparateurs colorés par agent.

## [0.7.0] - 2026-06-10

### Added

- Configuration Ollama : `palabre config --ollama-models --json` expose le modele configure, sa disponibilite et les modeles installes pour les integrations.
- Configuration Ollama : `palabre config --set-ollama-model <model>` valide un modele installe puis met a jour l'agent `ollama-local`.
- Configuration Ollama : `palabre config --sync-ollama-model` remplace le modele Ollama configure quand il a disparu et qu'un autre modele installe est disponible.
- Doctor affiche la version du CLI Palabre et signale quand une mise a jour semble disponible.

### Changed

- `palabre config --sync-agents` rafraichit aussi les commandes des agents connus deja presents dans la config quand la detection locale trouve un meilleur executable.
- `palabre presets --json` tient compte du modele Ollama configure absent, afin que les integrations masquent les presets Ollama non utilisables.

### Fixed

- Annulation : `SIGINT` / `SIGTERM` interrompent maintenant les appels adapters en cours et terminent avec le code `130`.
- Adapter CLI/PTTY/Ollama : les annulations sont propagees via `AbortSignal`, ce qui evite qu'un debat continue apres une demande d'arret.

## [0.6.4] - 2026-06-09

### Fixed

- Adapter CLI : les erreurs de modele non supporte sont maintenant classees `unsupported-model` meme quand la CLI termine avec une sortie vide et l'erreur uniquement sur stderr, au lieu d'apparaitre comme un `empty-output` deroutant.
- Suggestions d'erreur : `unsupported-model` conseille aussi de mettre a jour la CLI de l'agent, en plus de verifier le modele, l'abonnement ou les flags `--model-*`.
- Discovery : Antigravity est detecte via `agy` ou `antigravity`, afin que `doctor`, `presets --json`, la generation de config et les integrations consomment la meme source de verite CLI.

## [0.6.3] - 2026-06-09

### Fixed

- Prompts agents : `--language fr|en` ajoute maintenant une consigne explicite de langue de reponse dans le debat et la synthese, pour reduire les syntheses qui basculent ponctuellement dans l'autre langue avec de vraies CLIs IA.
- Parser CLI : un flag booleen (`--plain`, `--no-summary`, `--no-early-stop`, `--json`, `--show-prompt`, `--pull-models`, ...) n'avale plus l'argument positionnel suivant. `palabre --plain codex-claude "sujet"` conserve desormais le preset au lieu de le perdre.
- Arret anticipe du debat : les phrases d'accord suivent la langue d'interface. Ajout de motifs anglais cibles pour que `--language en` puisse declencher l'arret sur accord clair.
- Message systeme par defaut des agents Ollama localise selon la langue d'interface au lieu d'etre fige en francais.
- `palabre doctor` reconnait desormais les commandes d'agent en `.ps1` (normalisation de nom de commande alignee sur le reste du code).
- Erreur actionnable si la config chargee est structurellement invalide (racine non-objet, bloc `agents` absent ou vide), au lieu d'un echec opaque pendant le debat.

### Changed

- Refactor interne : extraction du parseur d'arguments dans `src/args.ts` avec une table centrale d'arite des flags (`boolean` / `single` / `multi`), couverte par des tests dedies (`tests/cli-args.test.ts`).
- Refactor interne : registre d'agents centralise (`src/agentRegistry.ts`) qui unifie la normalisation de nom de commande, le mapping commande -> decouverte et la liste des agents detectes, jusqu'ici duplique dans `index.ts`, `presets.ts`, `doctor.ts`, `new.ts` et `config.ts`. Ajouter un agent CLI connu se fait desormais en un seul endroit.
- Refactor interne : utilitaires d'adapter partages (`src/adapters/cli-shared.ts`, `src/exec.ts`) pour `withModelArgs`, les constantes de timeout/taille de sortie et la resolution d'extensions executables, jusqu'ici dupliques entre `cli.ts`, `cli-pty.ts` et `discovery.ts`.

## [0.6.2] - 2026-06-08

### Fixed

- Nettoyage des sorties parasites `taskkill` Windows dans l'adapter CLI, notamment le bruit localise francais/mojibake que Codex peut emettre apres l'arret de process enfants.

### Added

- Ajout de `pnpm smoke:real-presets`, un smoke test de release qui lance de vrais debats sur les presets prioritaires disponibles et verifie le flux agent -> NDJSON -> export Markdown.

## [0.6.1] - 2026-05-31

### Changed

- Mise a jour de maintenance CLI et documentation associee.

## [0.6.0] - 2026-05-21

### Added

- Contrats d'integration stabilises pour l'extension VS Code : renderer NDJSON v1, `palabre presets --json`, `palabre context scan --json`, erreurs structurees et exports partiels.
- Support des workflows de contexte et des presets exposes dynamiquement aux integrations.
