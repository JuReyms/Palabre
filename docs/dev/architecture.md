# Architecture, agents et contrats

Référence de développement extraite d’`AGENTS.md`. Lire [les règles communes](../../AGENTS.md) et ce document avant de modifier les frontières CLI/intégrations, la configuration d'un agent, le registre ou les presets. Les chemins de code entre backticks sont relatifs à la racine du dépôt. Les qualifications datées décrivent un essai, pas une garantie pour toutes les versions.

## Frontiere CLI / integrations

Palabre CLI est la source de verite produit. Toute fonctionnalite qui doit produire le meme resultat hors VS Code appartient au CLI avant d'etre exposee par une integration.

Appartient au CLI :

- orchestration du debat, tours, roles, synthese, arret anticipe, reprise ou retry ;
- agents, adapters, batch/PTY, timeouts agent, limites de sortie, limites d'usage ;
- presets, disponibilite des agents, resolution de config, diagnostics, `doctor` ;
- scan du contexte, limites fichiers/taille, `.gitignore`, export `.debate.md`, export partiel ;
- taxonomie d'erreurs, codes de sortie, protocole NDJSON et evenements runtime structures.

Appartient aux integrations comme Palabre-vscode :

- UI, commandes, boutons, webview, QuickPick, notifications, Output channel ;
- choix utilisateur transmis a des flags CLI existants ;
- rendu des evenements NDJSON fournis par le CLI, sans en changer le sens ;
- garde-fous techniques minimaux pour proteger l'hote si un vieux CLI ou un flux corrompu se comporte mal.

Regle d'arret : si une integration doit deviner, dupliquer ou compenser un comportement que le CLI n'expose pas encore, corriger d'abord le CLI. L'integration ne doit pas devenir un second cerveau Palabre.

## Structure

```text
src/index.ts              CLI entrypoint et dispatch principal
src/commands/             Commandes leaf et utilitaires partages (agents, context, history, init, presets, relay, sessions, shared, update)
src/runOptions.ts         Resolution centralisee des options completes d'une session
src/sessionCheckpoint.ts  Contrat JSON v1 et stockage atomique des checkpoints
src/sessionInventory.ts   Liste bornée et suppression ciblée des checkpoints
src/sessionCheckpointRuntime.ts Writer runtime neuf ou repris
src/sessionResume.ts      Validation et reconstruction stricte de `palabre resume`
src/externalSessions/     Relay vers une session externe : socle (types, lancement, enveloppe, issues), contrat d'adapter, adapters Claude Code et Codex ; relay --open (B1) : openReader (corrélation pure), openRollout (lectures bornées), codexQueue (dépôt), openRelay (déroulé)
src/tuiController.ts      Controleur des flows de configuration TUI
src/args.ts               Parseur d'arguments CLI (table d'arite des flags)
src/launchDispatch.ts     Decision de lancement d'une commande run : accueil TUI ou Chat direct selon le mode effectif
src/new.ts                Assistant interactif `palabre new`
src/config.ts             Chargement, generation et validation de config
src/discovery.ts          Detection locale des CLIs et d'Ollama pendant init
src/doctor.ts             Diagnostics de configuration et de disponibilite locale
src/agentRegistry.ts      Source de verite des agents CLI connus (mapping commande -> decouverte)
src/exec.ts               Resolution d'extensions executables partagee
src/npmShim.ts            Reconnaissance stricte des shims npm/pnpm, lancement direct sans PowerShell (Relay : npm Node ; --copy OpenCode accepte aussi npm natif)
src/types.ts              Contrats partages
src/prompt.ts             Rendu des prompts agent
src/context.ts            Chargement des fichiers et dossiers de contexte
src/contextScan.ts        Contrat JSON `palabre context scan --json`
src/orchestrator.ts       Boucle de debat ping-pong
src/output.ts             Export Markdown
src/renderers/console.ts  Rendu console pretty/plain
src/adapters/index.ts     Factory d'adapters
src/adapters/cli.ts       Adapter CLI batch minimal
src/adapters/cli-pty.ts   Adapter pseudo-terminal pour CLIs interactives
src/adapters/cli-shared.ts Utilitaires partages CLI/PTY (withModelArgs, constantes timeout/sortie)
src/adapters/ollama.ts    Adapter Ollama HTTP
docs/roadmap.md           Roadmap interne locale non versionnee
docs/notes.md             Notes personnelles du mainteneur
docs/guide/fr/            Guides utilisateur francais organises par parcours
docs/archive/             Documents historiques
```

## Concepts

### Agent

Un agent est une entree nommee dans une config Palabre. La resolution cherche `./palabre.config.json`, puis `./chicane.config.json`, puis `~/.palabre/palabre.config.json`, puis `~/.palabre/chicane.config.json`. Toute nouvelle doc ou nouvelle config doit utiliser `palabre.config.json`.

Une config locale standard peut lancer des commandes avec les droits utilisateur et contacter les
serveurs Ollama qu'elle declare. Avant de la consommer, Palabre exige donc une approbation liee a
son chemin canonique et a son empreinte SHA-256, conservee dans
`~/.palabre/trusted-configs.json`. Une modification externe invalide l'approbation. En TTY,
Palabre demande confirmation ; en non-interactif, `--trust-config` enregistre explicitement
l'empreinte. Toute config creee par `palabre init`, y compris via `--config`, est approuvee avec
son contenu exact. Les ecritures ulterieures effectuees par Palabre rafraichissent uniquement une
approbation existante. `palabre doctor` reste accessible sur toute config non approuvee, mais
n'en contacte pas les URLs configurées, n'exécute aucune commande d'agent, signale le prérequis
et rend le code 1. Toutes les valeurs sont assainies avant affichage terminal.

Exemples :

- `codex`
- `claude`
- `ollama-local`
- `claude-opus`
- `codex-5.5`

### Adapter

Un adapter transforme une config agent en objet capable de repondre a `generate(prompt)`.

Types actuels :

- `cli` : lance une commande locale et capture sa sortie.
- `cli-pty` : lance une commande dans un pseudo-terminal pour les CLIs qui exigent une vraie console.
- `ollama` : appelle `POST /api/chat` sur une instance Ollama.

Types envisages :

- `api` : adapter HTTP direct pour les utilisateurs qui veulent connecter une API payante.

Chaque adapter expose aussi un `contract` :

- `capabilities` : mode (`batch`, `http`, `pty`), support du model override, acces filesystem, streaming, exit code, stderr.
- `guarantees` : rejet des sorties vides, des timeouts, des exit codes non nuls, retour du raw output.

L'orchestrateur doit s'appuyer sur ce contrat plutot que sur des exceptions implicites par adapter. Les erreurs connues doivent utiliser `AdapterError` avec un `kind` stable.

### Registre d'agents connus

`src/agentRegistry.ts` est la source de verite unique reliant un nom de commande a une entree de detection locale (`ToolDiscovery`). Avant ce registre, le mapping `commande -> decouverte` et la liste des agents detectes etaient dupliques dans `index.ts`, `presets.ts`, `doctor.ts`, `new.ts` et `config.ts`, et avaient deja diverge (ex. `doctor` qui ne normalisait pas l'extension `.ps1`).

`KNOWN_CLI_AGENTS` decrit chaque agent CLI connu par trois champs : `configKey` (cle dans `config.agents`), `commandAliases` (noms de commande reconnus apres `normalizeCommandName`) et `discoveryKey` (cle dans `ToolDiscovery`). Ollama n'y figure pas : ce n'est pas une commande CLI, il est traite a part via `discovery.ollama`.

Pour ajouter un agent CLI connu (nouvelle CLI premiere classe), ajouter une seule entree dans `KNOWN_CLI_AGENTS`, ajouter le bloc agent correspondant dans `exampleConfig` (`src/config.ts`), et completer `ToolDiscovery` / `discoverLocalTools` si une nouvelle commande doit etre detectee. Les helpers `normalizeCommandName`, `detectionForCommand`, `detectedAgentNames`, `isAgentDetected` et `applyDetectedCommands` se mettent a jour automatiquement pour tous les consommateurs.

Les CLIs custom declarees par l'utilisateur (non listees dans le registre), sans chemin absolu, restent considerees disponibles : Palabre ne peut pas connaitre leur semantique sans les lancer. Un chemin absolu, connu ou custom, verifie seulement la presence d'un fichier accessible ; son execution n'est pas sondee et aucune autre installation du PATH n'est substituee.

### Preset

Un preset choisit une paire d'agents. Il ne choisit pas les modeles. La source de verite est `src/presets.ts`.

Presets CLI ↔ CLI (20) :

- `codex-claude`, `claude-codex`
- `codex-opencode`, `opencode-codex`
- `codex-vibe`, `vibe-codex`
- `codex-antigravity`, `antigravity-codex`
- `claude-opencode`, `opencode-claude`
- `claude-vibe`, `vibe-claude`
- `claude-antigravity`, `antigravity-claude`
- `opencode-antigravity`, `antigravity-opencode`
- `opencode-vibe`, `vibe-opencode`
- `antigravity-vibe`, `vibe-antigravity`

Presets CLI ↔ Ollama local (10) :

- `opencode-ollama`, `ollama-opencode`
- `vibe-ollama`, `ollama-vibe`
- `codex-ollama`, `ollama-codex`
- `claude-ollama`, `ollama-claude`
- `antigravity-ollama`, `ollama-antigravity`

Total : 30 presets. Toute paire X-Y a sa variante inversee Y-X. La variante inversee differe surtout par "qui parle en premier" — les roles restent ceux configures dans la config utilisateur, pas determines par la position.

Gemini CLI est archive cote Palabre depuis la transition Google vers Antigravity CLI pour les utilisateurs individuels. Les configs utilisateur existantes peuvent encore declarer une CLI custom `gemini`, mais Palabre ne la genere plus, ne la detecte plus comme agent connu et ne l'expose plus dans les presets actifs.

Les modeles restent ceux des CLIs ou de la config, sauf override explicite par `--model-a` ou `--model-b`.

A chaque ajout de preset dans `src/presets.ts`, refleter dans cette section. L'extension VS Code (`Palabre-vscode`) consomme `palabre presets --json` au demarrage et n'a donc plus besoin d'etre synchronisee manuellement.

### Commandes `palabre agents` et `palabre presets`

Liste les agents configurés pour les intégrations :

```bash
palabre agents --json
```

Le schéma JSON v1 exclut les agents retirés encore présents dans les anciennes configs (actuellement Gemini) et expose `agents[]` avec `name`, `type`, `role`,
`available` et `unavailableReason` quand nécessaire, ainsi que
`defaults.askAgents` et `defaults.relayView` (préférence effective `background` par défaut, ou `auto` explicitement enregistré). La disponibilité vient de la même logique CLI que les
presets ; une intégration ne doit pas la recalculer.

Liste les presets disponibles.

```bash
palabre presets             # sortie humaine
palabre presets --json      # sortie JSON pour les integrations
```

Format JSON v1 :

```json
{
  "v": 1,
  "presets": [
    {
      "name": "codex-claude",
      "agentA": "codex",
      "agentB": "claude",
      "available": true,
      "missingAgents": [],
      "unavailableReasons": []
    },
    ...
  ]
}
```

Les champs `available`, `missingAgents` et `unavailableReasons` sont des métadonnées optionnelles du schéma v1. Ils reflètent la config résolue et la détection locale : agent absent de config, CLI connue non détectée, API Ollama non joignable ou modèle Ollama configuré absent. Les intégrations peuvent filtrer `available === true` sans réimplémenter la découverte.

Politique de versioning du champ `v` : ajout de champ optionnel sans bump, suppression / renommage avec bump v2. Memes regles que le renderer NDJSON.

### Role

Les roles ne sont pas decoratifs. Ils ajoutent une consigne de role dans les prompts et pourront guider plus tard les modes d'orchestration. Un role durable se modifie dans la config ou via `palabre agent-role <agent> <role>`. Un role temporaire de session se passe avec `--role-a`, `--role-b` en mode debat ou `--ask-role` en mode Ask ; ces flags ne modifient pas la config.

Roles supportes :

- `implementer`
- `reviewer`
- `architect`
- `scout`
- `critic`
- `summarizer`

Ollama doit rester configure par defaut comme `critic`, `scout` ou `summarizer`, car les modeles locaux courants sont souvent plus petits que les agents Claude/Codex distants. L'utilisateur peut le promouvoir en agent primaire explicitement dans sa config.
