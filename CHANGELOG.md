# Changelog

Toutes les evolutions notables de Palabre CLI sont consignees ici. Format inspire de [Keep a Changelog](https://keepachangelog.com/), versionnage [SemVer](https://semver.org/).

## [Unreleased]

### Fixed

- Les shims PowerShell npm/pnpm utilisent un hôte résolu sous `System32` quand le processus appelant possède un PATH réduit, notamment depuis VS Code.

## [0.11.0] - 2026-07-10

### Added

- Rôles de session : `--role-a`, `--role-b` et `--ask-role` appliquent des rôles temporaires sans modifier la configuration. `palabre agent-role <agent> <role>` actualise explicitement le rôle durable pour un agent.
- Le contrat v1 `palabre agents --json` expose désormais `roles`, le catalogue canonique utilisable par les intégrations.

### Changed

- Les configurations Codex historiques sont migrées en mémoire vers le mode `exec` lecture seule actuel lors du chargement.

### Fixed

- Sous Windows, les alias Codex de `WindowsApps` ne sont plus préférés au shim PowerShell npm/pnpm, ce qui évite les erreurs `spawn EPERM`.
- Les sorties CLI encodées en Windows-1252 sont décodées correctement lorsque UTF-8 est invalide, notamment pour Mistral Vibe.

## [0.10.2] - 2026-07-07

<!-- social: Safer local configs, hardened Windows agent launches, bounded Ollama responses, and protected terminal output. -->

### Changed

- Les configs projet implicites exigent désormais une approbation liée à leur chemin et à leur empreinte ; les configs générées par Palabre sont approuvées automatiquement.
- Les agents Claude, OpenCode et Vibe générés par défaut utilisent des capacités de lecture plus contraintes, et les prompts identifient explicitement le contexte et les transcripts comme données non fiables.
- La résolution des exécutables Windows est centralisée et réutilise les binaires natifs ou les shims PowerShell sûrs pour les prompts transmis en argument.

### Fixed

- Les adapters CLI et PTY refusent les lancements Windows susceptibles de réinterpréter un prompt ou un modèle via `cmd.exe`, sans casser Vibe lorsqu'un shim PowerShell est disponible.
- Les réponses Ollama et la discovery `/api/tags` sont bornées avant parsing ; les erreurs JSON, limites de taille et noms de modèles sont classés et assainis de façon cohérente.
- Les sorties agents, erreurs distantes, métadonnées d'historique et diagnostics `doctor` ne peuvent plus injecter de séquences de contrôle dans le terminal.
- Les caractères UTF-8 produits par les agents CLI restent intacts lorsqu'ils sont répartis sur plusieurs blocs `stdout` ou `stderr`.
- `palabre doctor` peut examiner une config projet non approuvée sans contacter les URLs Ollama qu'elle déclare.

## [0.10.1] - 2026-07-02

<!-- social: Smoother TUI navigation, a clearer guided setup, and useful next actions after every session. -->

### Changed

- L'assistant `/new` adopte le design du TUI avec un en-tête, des indications plus lisibles et un choix de mode encadré.
- Le logo de l'accueil utilise un violet légèrement plus sombre.
- Le panneau de fin de session présente désormais `/retry`, `/new`, `/history`, `/config`, `/help` et la commande permettant de basculer vers l'autre mode.
- Les guides d'installation documentent npm, pnpm, Yarn et Bun, ainsi que l'absence d'installation officielle via `pip` ou `curl`.

### Fixed

- Un premier `Ctrl+C` depuis `/help`, `/history`, `/update` ou le composer revient à l'accueil ; un second `Ctrl+C` rapide ferme toujours la TUI.
- L'annulation de `/new` depuis la TUI revient à l'accueil au lieu de fermer Palabre.

## [0.10.0] - 2026-07-02

<!-- social: A redesigned TUI, inline context from the composer, localized adapter errors, and safer Antigravity quota detection. -->

### Added

- Le composer de l'accueil TUI accepte `--context <chemins...>` et `--files <chemins...>` à la fin du sujet, puis confirme les fichiers injectés dans l'en-tête de session.

### Changed

- Le rendu TUI adopte un design unifié avec logo d'accueil, écrans spécialisés, cadres cohérents, couleurs sémantiques et blocs de conversation alignés à gauche.
- Le renderer TUI historique est découpé en modules dédiés au thème, aux écrans, aux prompts et aux événements de session.
- Les messages des adapters et de `palabre config --ollama-models` utilisent désormais les dictionnaires FR/EN.
- Les duplications de l'orchestrateur, des adapters et du point d'entrée CLI sont factorisées sans modifier les contrats publics.

### Fixed

- L'adapter PTY classe les diagnostics autonomes de quota Antigravity en `usage-limit`, y compris avec un exit code 0, sans confondre une réponse normale qui explique les rate limits.
- Le repli `PALABRE_ASCII=1` utilise uniquement des glyphes ASCII, y compris pour le marqueur de succès.

## [0.9.1] - 2026-07-01

<!-- social: A cleaner CLI architecture with centralized summary resolution and stronger regression coverage. -->

### Changed

- Le point d'entrée CLI délègue maintenant les commandes leaf, la résolution des options de session et le contrôleur TUI à des modules dédiés, sans modifier les contrats publics.
- L'agent de synthèse est résolu une seule fois à la frontière CLI puis transmis comme option obligatoire aux renderers et à l'orchestrateur.
- La résolution des options de débat et du mode Ask dispose désormais de tests directs couvrant les priorités entre flags, presets et defaults.

## [0.9.0] - 2026-07-01

<!-- social: Remote Ollama support, agent availability for integrations, and smoother TUI update and configuration flows. -->

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
