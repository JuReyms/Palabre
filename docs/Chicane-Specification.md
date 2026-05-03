# CHICANE Spec: IA-Debat CLI & VS Code Extension

Concept d'un orchestrateur de dialogue entre plusieurs instances d'IA (Claude, Codex, Ollama, etc.) directement dans le terminal, avec une interface utilisateur riche (TUI) et une intégration VS Code.

## 1. Vision du Produit
Un outil "meta-CLI" qui permet de faire débattre deux intelligences artificielles sur un projet technique. L'outil exploite les abonnements existants de l'utilisateur en pilotant les CLIs officielles (Claude Code, Codex/OpenAI) au lieu de forcer l'usage d'APIs payantes au jeton. Il peut aussi intégrer des modèles locaux via Ollama, avec un rôle adapté aux limites matérielles courantes.

## 2. Architecture Technique

### A. Le Core (Package CLI)
* **Nom suggéré :** `chicane`
* **Langage :** Node.js (pour la compatibilité VS Code) ou Python (pour la puissance de manipulation de processus).
* **Gestion des processus :** Utilisation de `spawn` pour lancer les CLIs cibles dans des terminaux virtuels (PTY) afin de capturer les flux `stdout` et injecter des commandes dans `stdin`.
* **Adapters :** Chaque IA est pilotée via un adapter interchangeable.
    * `cli-pty` pour Claude CLI, Codex CLI ou tout autre outil interactif installé localement.
    * `ollama` pour les modèles locaux exposés par l'API HTTP locale d'Ollama.
    * `api` plus tard si l'utilisateur veut connecter des APIs directes.
* **Moteur d'orchestration :** Un script qui gère le tour de rôle (Ping-Pong).
    1. Récupère la sortie de l'IA A.
    2. Nettoie le texte (suppression des artefacts CLI).
    3. Formate le prompt pour l'IA B ("Voici la proposition de A, qu'en penses-tu ?").
    4. Injecte le résultat dans l'IA B.

### A.1. Rôles des agents
Chicane ne considère pas tous les modèles comme équivalents. Chaque agent a un rôle configurable :

* **Primary / Implementer :** agent principal capable de proposer ou modifier une solution technique.
* **Reviewer / Critic :** agent chargé de trouver les risques, incohérences et alternatives.
* **Architect :** agent premium utilisé pour arbitrer ou concevoir une direction globale.
* **Scout :** agent léger qui explore rapidement un sujet ou prépare les questions.
* **Summarizer :** agent qui produit une synthèse finale locale.

Ollama est configuré par défaut comme `scout`, `critic` ou `summarizer`, car les utilisateurs font souvent tourner des modèles locaux modestes (par exemple Qwen/Gemma autour de quelques milliards de paramètres). Un mode avancé permet de l'utiliser comme agent primaire si la machine ou le serveur Ollama distant le permet.

### B. L'Interface Terminal (TUI)

#### Proposition 1

* **Layout :** Panneaux scindés (Split-view).
    * **Panneau Gauche :** Historique Claude (ou une autre IA).
    * **Panneau Droit :** Historique Codex (ou une autre IA).
    * **Zone de Statut :** État du débat (Qui parle ?).
    * **Zone d'Input :** Champ pour l'intervention humaine ("Trancher", "Pause", "Changer de sujet", "Arrêter").
* **Librairie suggérée :** `Ink` (React pour CLI) ou `Blessed` / `Textual`.

#### Proposition 2

* **Layout :** Vue en cascade (Cascade-view).
    * Les messages s'affichent dans une seule colonne, avec des couleurs différentes pour chaque IA.
    * Un indicateur visuel (icône ou couleur) montre qui parle.
    * Commandes d'intervention humaine accessibles via des raccourcis clavier (ex: `Ctrl+T` pour trancher).
    * Simple et épuré, inspiré des interfaces de chat modernes.

### C. L'Extension VS Code (Wrapper)
* **Rôle :** Interface graphique simplifiée pour lancer le package CLI.
* **Fonctionnalités :**
    * Bouton "Start Debate" dans l'explorateur de fichiers.
    * Sélection de contexte simplifiée (clic droit sur un dossier > "Débattre sur ce dossier", ou ajout du context via le ou les fichiers de ouverts, ou nommer/selectioner le fichier avec @).
    * Terminal intégré dédié affichant la TUI du package.

## 3. Workflow Utilisateur

1. **Installation :** `npm install -g chicane`.
2. **Configuration :** `chicane setup` (choix des agents, chemins vers les exécutables CLI locaux, modèle Ollama éventuel, limite de messages, style de réponses détaillées ou rapides, rôles des agents).
3. **Lancement :** `chicane --topic "Refacto de l'auth Nuxt" --files ./server/auth.ts`.
4. **Action :** Les IA commencent à discuter. L'utilisateur observe et peut participer ou taper une commande à tout moment pour arrêter le débat et générer le plan d'action final.

### Exemples de débats

```bash
chicane run --agent-a codex --agent-b claude --topic "Refacto de l'auth Nuxt"
chicane run --agent-a claude-sonnet --agent-b claude-opus --topic "Architecture multi-tenant"
chicane run --agent-a codex-5.4 --agent-b codex-5.5 --topic "Comparaison d'approches"
chicane run --agent-a codex --agent-b ollama-local --topic "Critique rapide du plan"
```

Les presets simplifient les paires fréquentes :

```bash
chicane run --preset codex-claude --topic "Debattez du prochain jalon"
chicane run --preset claude-ollama --topic "Critique le MVP batch"
chicane run --preset gemini-ollama --topic "Gemini est-il un bon reviewer ?"
```

Un preset choisit les agents, pas les modèles. Les modèles par défaut restent ceux configurés dans les CLIs ou dans `chicane.config.json`. L'utilisateur peut transmettre une string brute sans que Chicane maintienne un catalogue de modèles :

```bash
chicane run --preset codex-claude --model-a 5.5 --model-b opus --topic "Compare les approches"
chicane run --preset codex-ollama --model-b gemma4:e4b --topic "Critique locale plus profonde"
```

Pour Ollama, Chicane peut valider qu'un modèle est installé via l'API locale `/api/tags`. Il ne choisit pas automatiquement un modèle à la place de l'utilisateur. Le téléchargement d'un modèle manquant peut être autorisé explicitement via `--pull-models` ou `autoPullModel: true`, en utilisant `/api/pull`. Quand un changement de modèle local est demandé, Chicane peut aussi décharger les autres modèles déjà chargés via `/api/ps` et `keep_alive: 0`, afin d'éviter de garder inutilement un gros modèle en mémoire.

Le mode diagnostic permet d'afficher le prompt du premier tour sans appeler d'agent :

```bash
chicane run --preset codex-claude --topic "Preview" --files README.md --show-prompt
```

La synthèse finale est produite après les tours de débat. Par défaut elle utilise l'agent B, mais l'utilisateur peut choisir un autre agent ou la désactiver :

```bash
chicane run --preset codex-claude --topic "Critique le MVP" --summary-agent claude
chicane run --preset codex-claude --topic "Critique le MVP" --summary-agent ollama-local --summary-model nemotron-3-nano:4b
chicane run --preset codex-claude --topic "Critique le MVP" --no-summary
```

### Contexte projet

Chicane doit distinguer le workspace courant et le contexte explicitement injecté. Les agents CLI sont lancés depuis le dossier courant et peuvent éventuellement inspecter le workspace selon leurs propres capacités et permissions. Ollama, en revanche, ne lit pas le filesystem : il ne reçoit que le sujet, les instructions, les rôles, les fichiers explicitement passés et l'historique textuel transmis par Chicane.

Le support explicite minimal est `--files`, qui injecte une sélection contrôlée de fichiers texte dans le prompt de tous les agents :

```bash
chicane run --topic "Critique le MVP" --files README.md src/adapters/cli.ts
```

Le support plus large `--context .` viendra plus tard. Cette évolution devra gérer les limites de taille, les fichiers ignorés, les formats binaires et la synthèse automatique des gros fichiers.

## 4. MVP

Le premier jalon doit rester volontairement étroit :

* CLI Node.js installable localement.
* Fichier de configuration JSON ou YAML décrivant les agents.
* Adapter Ollama via HTTP local.
* Adapter CLI minimal, puis remplacement par PTY robuste.
* Orchestration tour par tour avec limite de tours.
* Injection explicite de fichiers texte via `--files`.
* Presets de paires d'agents via `--preset`.
* Overrides de modèles via `--model-a` et `--model-b`, sans catalogue de modèles côté Chicane.
* Preview du prompt via `--show-prompt`.
* Synthèse finale via `--summary-agent`, désactivable avec `--no-summary`.
* Vue cascade simple dans le terminal.
* Export `.debate.md`.
* Extension VS Code reportée après stabilisation du CLI.

## 5. Sortie (Output)
Chaque session génère un fichier `.debate.md` à la racine du projet contenant :
* Le résumé du sujet.
* L'intégralité des échanges formatés.
* Le consensus final ou les points de désaccord restant.

---
*Document généré pour la spécification du projet IA-Debat - 2026* nom de code "Chicane".
