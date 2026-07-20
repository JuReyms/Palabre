# AGENTS.md

Ce fichier guide les agents et contributeurs qui travaillent dans ce depot.

## Vision

Palabre est un meta-CLI qui orchestre un debat entre plusieurs agents IA. Il aide a mieux decider avant d'agir : un harnais d'intelligence collective orchestree qui organise des avis contradictoires, rend les arbitrages explicites et peut preparer une action sous controle utilisateur. Le produit cible des utilisateurs deja a l'aise avec le terminal, ayant installe et configure leurs outils IA locaux : Codex CLI, Claude CLI, Ollama, ou equivalents.

Le principe d'architecture important : Palabre orchestre des adapters. Claude, Codex, Antigravity et Ollama ne doivent pas etre codes comme des cas speciaux dans le moteur de debat.

Toute evolution produit doit appartenir a l'une de ces intentions, sans creer de silo :

- consulter : discussion avec un agent, Ask ou debat ;
- decider : synthese, suivi, plan ou revue de plan ;
- agir : operation explicitement confirmee, comme une mutation de config ou l'execution deleguee a une CLI.

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

## Stack

- Runtime : Node.js 20+
- Package manager : pnpm
- Langage : TypeScript
- Module system : ESM (`type: module`)
- Build : `tsc`
- Shell de developpement : PowerShell (machines Windows). Toutes les commandes shell doivent etre ecrites en syntaxe PowerShell.

Commandes utiles :

```bash
pnpm install
pnpm check
pnpm test
pnpm build
pnpm start -- help
pnpm start -- -h
pnpm start -- -v
```

## Structure

```text
src/index.ts              CLI entrypoint et dispatch principal
src/commands/             Commandes leaf extraites (agents, context, history, init, presets, update)
src/runOptions.ts         Resolution centralisee des options completes d'une session
src/tuiController.ts      Controleur des flows de configuration TUI
src/args.ts               Parseur d'arguments CLI (table d'arite des flags)
src/new.ts                Assistant interactif `palabre new`
src/config.ts             Chargement, generation et validation de config
src/discovery.ts          Detection locale des CLIs et d'Ollama pendant init
src/agentRegistry.ts      Source de verite des agents CLI connus (mapping commande -> decouverte)
src/exec.ts               Resolution d'extensions executables partagee
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
approbation existante. `palabre doctor` reste accessible sur une config projet non approuvee, mais
n'en contacte pas les URLs Ollama et assainit toutes les valeurs avant affichage terminal.

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

Les CLIs custom declarees par l'utilisateur (non listees dans le registre) restent considerees disponibles : Palabre ne peut pas connaitre leur semantique sans les lancer.

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

- `codex-ollama`, `ollama-codex`
- `claude-ollama`, `ollama-claude`
- `opencode-ollama`, `ollama-opencode`
- `vibe-ollama`, `ollama-vibe`
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
`defaults.askAgents`. La disponibilité vient de la même logique CLI que les
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

## Decisions actuelles

- Utiliser `pnpm`, pas npm ou yarn.
- Palabre devient TUI-first : `palabre` ouvre l'accueil TUI, les commandes directes utilisent la TUI par defaut en TTY, et `--terminal` sert a retrouver le rendu brut.
- Garder la config en JSON pour le MVP. YAML peut venir plus tard.
- Eviter une dependance UI lourde tant que l'orchestration TUI native n'est pas stabilisee ; un framework comme Ink pourra etre evalue ensuite.
- Exporter chaque session en `.debate.md` dans un dossier `.palabre/` par défaut pour éviter de polluer la racine du projet.
- Ne pas supposer que Claude/Codex ont une API stable : les CLIs interactives doivent etre isolees derriere un adapter.

## Init et discovery

`palabre` est l'entree recommandee de premiere utilisation. Quand il ouvre l'accueil TUI et qu'aucune configuration n'existe, Palabre cree automatiquement la config globale, detecte les agents locaux et continue dans la TUI. `palabre init` reste disponible pour un setup explicite, et `palabre init --local` cree une config de projet.

`palabre init` et le premier lancement TUI utilisent `src/discovery.ts` pour detecter :

- `codex`
- `claude.exe` puis `claude` sur Windows, `claude` ailleurs
- `agy` (Antigravity CLI)
- `vibe` (Mistral Vibe CLI)
- `ollama`
- l'API Ollama locale via `GET http://localhost:11434/api/tags`

La config generee conserve les blocs agents connus pour rester editable, mais ajuste `defaults.agentA` et `defaults.agentB` avec une paire detectee quand c'est possible. A chaque ouverture de l'accueil TUI, Palabre synchronise prudemment les agents connus detectes : il ajoute les agents connus manquants et rafraichit les noms de commande connus, sans toucher aux agents custom, aux roles, aux modeles ni aux defaults utilisateur. `palabre config --sync-agents` applique la meme logique explicitement.

Au lancement, Palabre ne doit pas utiliser de fallback agent code en dur : sans preset, sans agents explicites et sans defaults de config, il doit afficher une erreur actionnable.

Le defaut produit doit favoriser les agents CLI premium : `codex <-> claude` quand disponible. Ollama reste configure et accessible via presets, mais il est plutot destine aux power users ou aux roles locaux (`critic`, `scout`, `summarizer`). Les defaults utilisateur se gerent par `palabre config`, `palabre config --set-defaults <agentA> <agentB>`, `palabre config --mode <chat|debate|ask>`, `palabre config --interface <tui|terminal>`, `palabre config --ask-agents <agents...>`, `palabre config --summary-agent <agent|none>`, `palabre config --ask-summary-agent <agent|none>` et `palabre config --clear-defaults`. Les roles persistants se gerent par `palabre agent-role <agent> <role>` ou par edition JSON explicite.

## New

`palabre new` est l'assistant interactif de composition d'un debat ou d'une demande ask. Il detecte les outils locaux via `src/discovery.ts`, liste les agents de la config en mettant les agents detectes en premier, demande le mode, les agents puis le sujet, et laisse lancer avec les defaults ou ouvrir les options avancees.

Le mode avance couvre les options courantes : tours, modeles bruts, synthese, contexte, fichiers, `--show-prompt` et le rendu terminal brut via `--terminal`. Garder le wizard comme une couche UX fine au-dessus du parser existant : il doit remplir les memes flags que la CLI directe, pas creer un second chemin d'execution.

Le wizard affiche une commande equivalente avant execution. Cette sortie est intentionnelle : elle aide l'utilisateur a apprendre la syntaxe directe et sert de recap leger avant de lancer.

## Update

`palabre update` affiche les etapes de mise a jour adaptees au mode d'installation.

Depuis un checkout git, `palabre update --apply` execute :

```bash
git pull --ff-only
pnpm install
pnpm build
pnpm link --global
```

Pour une installation package, la commande affiche les commandes `pnpm add --global palabre@latest` ou `npm install --global palabre@latest`. Garder ce mode explicite : une mise a jour peut toucher le reseau, le store global pnpm et le lien global.

## Adapter CLI actuel

`src/adapters/cli.ts` est volontairement minimal. Il sert d'abord les modes batch des CLIs :

- Codex : `codex exec ...`
- Claude : `claude --print --tools Read,Glob,Grep`
- OpenCode : `opencode run --pure`
- Mistral Vibe : `vibe --output text --trust --enabled-tools read --enabled-tools grep --prompt <prompt>`

Antigravity utilise un adapter separe :

- Antigravity : `agy --print <prompt>` via `cli-pty`

Sur Windows, garder `"shell": true` uniquement pour les wrappers npm qui lisent le prompt sur
stdin. L'adapter resout et lance directement les executables natifs sans shell ; il refuse un
prompt en argument ou un model override contenant des metacaracteres quand un wrapper shell reste
necessaire. Pour Claude Code, preferer `claude.exe` avec `"shell": false`, car `stdin` est
capture correctement dans ce mode.

Pour les CLIs qui exigent un prompt en argument, Palabre tente ensuite le shim PowerShell `.ps1`
frere genere par npm/pnpm et le lance sans `cmd.exe`. CLI et PTY partagent la resolution PATH mise
en cache dans `src/exec.ts`; sans executable natif ni shim PowerShell, le lancement est refuse.

Les defaults Palabre appliquent une politique d'outils en lecture seule quand la CLI l'expose :
Claude est limite a `Read,Glob,Grep`, Vibe a `read,grep`, et OpenCode utilise `--pure` pour
neutraliser les plugins externes. Les fichiers de contexte et messages du transcript restent
explicitement marques comme donnees non fiables dans les prompts. Les migrations ne remplacent
que les tableaux `args` exactement identiques aux anciens defaults ; toute personnalisation
utilisateur est preservee.

Il supporte :

- `command`
- `args`
- `promptMode: "stdin" | "argument"`
- `timeoutMs`
- `idleTimeoutMs`
- `maxOutputBytes`
- `shell`
- `allowEmptyOutput`

`idleTimeoutMs` doit rester optionnel pour les CLIs IA en mode batch. Certains modeles peuvent rester silencieux longtemps avant d'ecrire leur reponse ; dans ce cas, le timeout dur `timeoutMs` est le garde-fou principal.

`maxOutputBytes` protege le CLI contre les agents qui produisent une sortie enorme ou partent en boucle. Par defaut, les adapters CLI et PTY coupent a 50 Mio et levent `AdapterError("output-too-large")`. Le budget couvre stdout et stderr cumules : les deux flux sont bufferises en memoire par Palabre, et le flux PTY les fusionne de toute facon. C'est une protection memoire du process, pas seulement une limite sur la taille de la reponse.

Une valeur `maxOutputBytes` invalide ne desactive jamais la protection : CLI, PTY et Ollama
retombent tous sur la limite par defaut.

Les adapters CLI et PTY doivent rejeter tout exit code non nul, meme si la CLI a ecrit une sortie partielle sur stdout ou dans le PTY. Une sortie partielle issue d'un process en erreur ne doit pas etre traitee comme une reponse valide.

Erreurs connues classees :

- `command-not-found`
- `spawn-failed`
- `timeout`
- `idle-timeout`
- `output-too-large`
- `empty-output`
- `non-zero-exit`

Il ne supporte pas encore :

- sessions interactives persistantes ;
- detection fiable de fin de reponse ;
- confirmations interactives ;
- capture propre des interfaces riches.

## Adapter CLI PTY

`src/adapters/cli-pty.ts` lance une CLI dans un pseudo-terminal via `node-pty`. Il sert les outils qui exigent une vraie console. Antigravity CLI en a besoin : en console directe, `agy` affiche une reponse ; lance depuis Node avec stdout/stderr pipes, il sort avec code 0 sans contenu capturable.

Le premier usage supporte est `agy --print-timeout 5m0s --print <prompt>` avec `promptMode: "argument"`. L'adapter nettoie les sequences ANSI/OSC via `src/adapters/terminal.ts` et retourne le raw PTY output dans `raw`.

Le flux PTY fusionne stdout et stderr : une sortie courte (moins de 400 caracteres) qui matche un signal de quota connu (ex. "Individual quota reached" d'Antigravity) est classee `usage-limit`, quel que soit l'exit code, plutot que retournee comme reponse valide ou classee `empty-output`/`non-zero-exit`. La detection est partagee avec l'adapter CLI via `extractUsageLimitMessage` dans `cli-shared.ts`.

Limites actuelles :

- pas encore de sessions persistantes ;
- pas encore de confirmations interactives ;
- fin de reponse basee sur la sortie du process et le timeout dur ;
- stdout/stderr sont fusionnes dans le flux PTY.

## Adapter Ollama

`src/adapters/ollama.ts` appelle l'API locale :

```text
POST http://localhost:11434/api/chat
```

Le mode actuel utilise `stream: false` pour simplifier le MVP. Le streaming pourra etre ajoute ensuite pour la TUI.

Options Ollama supportees :

- `model` : modele a utiliser.
- `validateModel` : detecte les modeles installes via `GET /api/tags` avant generation.
- `autoPullModel` : autorise le telechargement d'un modele manquant via `POST /api/pull`.
- `pullTimeoutMs` : timeout dedie au telechargement, par defaut 30 minutes.
- `unloadOtherModels` : detecte les modeles charges via `GET /api/ps` et decharge les autres modeles avec `POST /api/generate` + `keep_alive: 0`.
- `keepAlive` : transmis a Ollama sous forme `keep_alive`.
- `maxOutputBytes` : plafonne chaque corps HTTP bufferise, 50 Mio par defaut, comme les adapters CLI/PTY.


L'adresse effective du serveur Ollama est resolue dans cet ordre :

1. `--ollama-url <url>` pour la session courante ;
2. variable d'environnement `OLLAMA_HOST` ;
3. `baseUrl` de l'agent ;
4. `http://localhost:11434`.

La discovery Ollama conserve `discovery.ollama` pour l'agent principal et expose `discovery.ollamaAgents[name]` pour les configs multi-serveurs. Les appels `/api/tags` sont dedupliques par URL effective ; disponibilite, presets et `doctor` doivent utiliser l'entree propre a chaque agent.

Au `palabre init` et au premier lancement TUI, si Ollama expose déjà des modèles installés via `/api/tags`, la config générée choisit le modèle installé en priorité (en conservant `nemotron-3-nano:4b` s'il est présent). Sinon, elle retombe sur `nemotron-3-nano:4b` comme fallback léger. Eviter les gros modeles dans les tests automatises ou repetes.

La progression d'un pull Ollama (`--pull-models` ou `autoPullModel`) doit rester sur stderr. Stdout appartient aux renderers, notamment NDJSON, et ne doit jamais recevoir de lignes non JSON pendant un flux machine-readable.

La discovery limite chaque `/api/tags` a 1 Mio avant parsing, y compris avant l'approbation d'une
config. Les noms de modeles sont valides et nettoyes par `src/ollamaModels.ts`.

Erreurs connues classees :

- `model-unavailable`
- `model-pull-failed`
- `http-error`
- `empty-output`

## Orchestration

Palabre supporte trois modes de session. Le moteur d'orchestration historique garde deux modes :

- `debate` : alterne entre deux agents pendant `turns` tours.
- `ask` : fait répondre plusieurs agents indépendamment au même sujet, puis synthétise leurs réponses.

Le mode `chat` utilise un controleur separe (`ChatSession`) au-dessus des memes adapters. Il converse avec un agent actif sans exiger d'agent B, reinjecte au maximum les six messages recents dans chaque appel batch, permet une consultation explicite avec `/consult`, et exporte avec `/end`. Apres un debat ou un Ask, la TUI peut transmettre au Chat le sujet et la synthese finale, ou les six echanges recents en l'absence de synthese. Chat reste stateless : aucune session interactive persistante ni streaming token par token n'est promis par les adapters.

Le mode `debate` alterne simplement entre deux agents pendant `turns` tours :

1. Render du prompt avec le sujet, les fichiers de contexte et l'historique.
2. Appel de l'agent courant.
3. Ajout du message au transcript.
4. Passage a l'autre agent.
5. Arret anticipe optionnel si un accord clair est detecte apres un tour complet.
6. Export Markdown final. Le rendu export separe la synthese finale du transcript avec une ligne horizontale et une table de metadonnees. Il corrige aussi `:**` en `&#58;**` dans les contenus agents pour eviter l'interpretation en emoji dans certains apercus Windows.

Les futures evolutions possibles :

- intervention humaine ;
- criteres d'arret ;
- modes a trois agents ;
- budgets de tours par role.

### Mode ask

`palabre ask "Sujet"` ou `palabre run --mode ask --agents <agents...> -s "Sujet"` lance une demande parallèle logique : chaque agent reçoit le même sujet et le même contexte, sans transcript des autres agents. Le MVP exécute les agents séquentiellement pour garder l'annulation, les logs et les quotas simples.

Limites actuelles :

- 1 à 4 agents via `--agents`.
- Sans `--agents`, Palabre utilise `defaults.askAgents` si défini, sinon la paire `agentA/agentB`.
- `--ask-role <role>` applique un role commun temporaire a tous les agents Ask sans modifier la config. Dans la TUI, `/roles critic` en mode Ask applique aussi `critic` a tous les agents Ask actifs ; fournir plusieurs roles reste possible pour les cas avances.
- `palabre config --mode ask` peut faire d'ask le mode par defaut, et `palabre config --ask-agents codex claude opencode` definit la liste ask par defaut.
- La synthese utilise `--summary-agent`, puis `defaults.askSummaryAgent`, puis `defaults.summaryAgent`, puis le dernier agent ask.
- Le rendu console affiche par défaut la synthèse et les réponses complètes de chaque agent.
- L'export Markdown utilise l'extension `.ask.md`.

### Arret anticipe

Par defaut, `--turns` est une limite haute entre 1 et 20 reponses. `runDebate` peut arreter le debat apres un tour complet quand le dernier message contient un signal d'accord explicite, par exemple `accord complet`, `aucun desaccord`, `rien a trancher` ou `rien a ajouter`.

Le flag `--no-early-stop` force tous les tours demandes. Garder cette heuristique prudente : elle ne doit pas remplacer une vraie evaluation semantique tant que le MVP reste simple.

### Synthese finale

La synthese finale est activee par defaut. En mode `debate`, elle utilise `defaults.summaryAgent` quand il existe, sinon `agentB`. En mode `ask`, elle utilise `defaults.askSummaryAgent` quand il existe, sinon `defaults.summaryAgent`, sinon le dernier agent ask. `--summary-agent` garde toujours la priorite pour le lancement courant.

Options :

- `--summary-agent <name>` : agent de config utilise apres le debat, prioritaire sur `defaults.summaryAgent`.
- `--summary-model <model>` : modele brut transmis a l'agent de synthese.
- `--no-summary` : desactive la phase de synthese.

Config :

- `defaults.summaryAgent` : agent de synthese par defaut du mode `debate`, et fallback du mode `ask`.
- `defaults.askSummaryAgent` : agent de synthese par defaut specifique au mode `ask`.

Le prompt de synthese est un mode dedie dans `formatAgentPrompt` (`mode: "summary"`). Il recoit le sujet, les fichiers de contexte et tout le transcript. Il demande quatre sections: consensus, desaccords/incertitudes, actions proposees, puis une conclusion courte en prose.

### Contexte de session

Chaque prompt recoit un bloc `Contexte de session Palabre` construit au lancement :

- source explicite : fourni par Palabre et visible par tous les agents ;
- date locale ;
- fuseau horaire ;
- dossier courant ;
- horodatage de debut de session ;
- progression du debat (`tour courant / tours demandes`).

Ce contexte doit rester petit et factuel. Il sert a eviter que les agents comparent des contextes implicites differents, par exemple sur la date, le fuseau horaire ou le dossier courant.

Les integrations peuvent declarer leur provenance au CLI avec
`PALABRE_CLIENT` et, optionnellement, `PALABRE_CLIENT_VERSION`. Ces valeurs
sont diagnostiques, nettoyees et bornees ; elles ne constituent pas une
frontiere de confiance et aucun registre ferme de clients ne doit etre ajoute.
Sans declaration, Palabre utilise `direct-cli`. Les exports `.debate.md`,
`.ask.md` et `.chat.md` inscrivent la version du CLI, la source d'execution
et la version du client quand elle est fournie.

## Contexte projet

Le MVP fournit deux entrees de contexte :

- `--files <paths...>` : fichiers texte explicites, mode strict.
- `--context <paths...>` : fichiers ou dossiers texte, mode tolerant avec warnings.

`palabre context scan --json [paths...]` expose le scan tolerant sous forme JSON pour les integrations. L'extension VS Code doit consommer cette commande pour afficher une selection de contexte, plutot que reimplementer les regles de scan. Le contrat JSON courant est v1 : `root`, `scanned`, `items[]` (`kind`, `path`, `absolutePath`, `sizeBytes` ou `filesCount`) et `warnings[]`.

Important :

- Les agents `cli` et `cli-pty` sont executes depuis le dossier courant. Codex, Claude, Antigravity, OpenCode ou Mistral Vibe peuvent donc inspecter le workspace si leur CLI le permet.
- Ce comportement appartient aux CLIs externes, pas au contrat Palabre.
- L'adapter `ollama` ne lit jamais le filesystem directement. Il ne voit que le prompt, les fichiers retenus par `--files` ou `--context`, et le transcript fournis par Palabre.
- Si aucun contexte n'est fourni a Palabre, Ollama ne voit pas le contenu du projet.
- L'orchestrateur affiche un warning visible quand un agent Ollama participe sans contexte fourni.

Comportement `--files` :

- 64 KiB max par fichier.
- 192 KiB max au total.
- fichiers binaires refuses avec erreur.
- dossiers refuses avec erreur.

Comportement `--context` :

- Accepte des fichiers et dossiers.
- Parcourt les dossiers recursivement.
- Transforme les chemins absents ou inaccessibles en warnings, sans interrompre la session.
- Ignore par defaut `.git`, `.gitignore`, `.tmp`, `.pnpm-store`, `node_modules` et `dist`.
- Applique les regles simples du `.gitignore` racine : lignes vides/commentaires ignores, negations non supportees, glob `*` basique.
- Garde seulement les extensions texte connues.
- Ignore les fichiers binaires, trop gros ou au-dela de la limite totale avec warning.

Le code vit dans `src/context.ts`. Garder `--files` strict pour les workflows reproductibles, et garder `--context` best-effort pour l'exploration.

Evolution prevue :

- Resume automatique ou selection plus intelligente pour eviter de saturer le contexte.
- Support plus complet des patterns `.gitignore` si le besoin devient reel.

## Modeles

Palabre ne liste pas les modeles disponibles. Les catalogues changent trop vite et appartiennent aux providers ou CLIs.

Exception utile : pour Ollama, l'adapter peut detecter les modeles installes localement afin de valider une config ou un override. Il ne choisit pas automatiquement un modele a la place de l'utilisateur.

Le telechargement automatique Ollama est desactive par defaut. Il doit etre active par `--pull-models` ou `autoPullModel: true`, car un modele peut peser plusieurs Go.

`--model-a` et `--model-b` transmettent simplement une string brute :

- adapter `cli` : ajoute `--model <value>` via `modelArg` (par defaut `--model`) ;
- adapter `ollama` : remplace la valeur `model` de la config runtime.

Si une CLI utilise un nom d'option different, ajouter `modelArg` dans la config agent.

## Prompt Preview

`--show-prompt` affiche le prompt exact du premier tour en mode `debate`, ou le prompt indépendant du premier agent en mode `ask`, puis termine sans appeler d'agent. En mode `debate`, les tours suivants ne peuvent pas etre connus sans executer le debat, car ils dependent du transcript reel. En mode `ask`, la synthese ne peut pas etre connue sans les reponses reelles des agents.

## Internationalisation

La langue de l'interface CLI est resolue via `src/i18n.ts` avec la precedence suivante :

1. `--language <fr|en>` ou alias `--lang <fr|en>` ;
2. variable d'environnement `PALABRE_LANGUAGE` ;
3. champ racine `language` dans `palabre.config.json` ;
4. fallback `fr`.

`language` controle l'interface Palabre et la langue des prompts envoyes aux agents. Pour le MVP, garder cette regle simple : interface en francais, agents guides en francais ; interface en anglais, agents guides en anglais. Une future option `debateLanguage` ne doit etre ajoutee que si un besoin reel apparait pour decoupler les deux.

L'extension VS Code peut detecter la langue de VS Code et transmettre `--language fr` ou `--language en` au CLI. Garder le contrat CLI limite a `fr|en` tant que les dictionnaires, exports et prompts ne supportent pas officiellement d'autres langues. Les locales VS Code non supportees, par exemple portugais, doivent donc etre mappees cote integration vers une langue supportee, aujourd'hui `en` par defaut.

Decision a garder en tete : `--language <fr|en>` doit etre compris comme une consigne forte pour les agents. Si `--language en` est passe avec un sujet en francais, les agents doivent etre guides pour repondre en anglais ; si `--language fr` est passe avec un sujet en anglais, ils doivent etre guides pour repondre en francais. La detection automatique appartient aux integrations, mais l'application stricte de la langue appartient aux prompts du CLI.

Les messages traduisibles vivent dans `src/messages/`, decoupes par domaine (`common`, `doctor`, `help`, `init`, `agents`, `config`, `presets`, `update`, `preview`, `new`, `renderers`, `context`, `limits`, `orchestrator`, `output`, `adapter-errors`, `prompt`, etc.). Ajouter les nouvelles surfaces par lots coherents plutot que melanger traduction et refactor large. `palabre doctor`, `palabre help`, `palabre init`, `palabre agents`, `palabre config`, `palabre presets`, `palabre update`, `--show-prompt`, `palabre new`, les renderers console, les erreurs/warnings de contexte, les erreurs de limites `--turns`, les notices/erreurs runtime de l'orchestrateur, l'habillage de l'export Markdown, les suggestions et messages d'erreurs adapter (usage-limit, modeles, Ollama), la sortie `palabre config --ollama-models` et les prompts agents sont migres vers le dictionnaire FR/EN. Les adapters resolvent leur langue via `prompt.language` a chaque `generate`.

Toutes les donnees affichees dans un renderer humain doivent passer par
`sanitizeTerminalText` avant d'etre combinees aux couleurs ANSI generees par Palabre. Les sorties
CLI/PTY et Ollama, erreurs HTTP distantes, sujets, noms d'agents, chemins et labels de liens OSC
sont traites comme non fiables. Le nettoyage retire ANSI, OSC, DCS et les controles invisibles,
mais preserve les espaces et retours ligne utiles. `cleanTerminalOutput` ajoute le trim attendu
par les adapters.

## Syntaxe CLI courte

Le parser accepte deux formes equivalentes pour lancer un debat :

```bash
palabre run --preset claude-antigravity --subject "quel jour sommes nous ?" --turns 4
palabre claude-antigravity "quel jour sommes nous ?" -t 4
palabre -s "quel jour sommes nous ?" -t 2
```

`--subject` est le nom long recommande pour le sujet. `-s` est l'alias court, et `--topic` reste accepte pour compatibilite. Si le premier argument positionnel est un preset connu, il devient `--preset`. Le positionnel suivant devient le sujet. Si le premier argument n'est pas un preset ni une commande (`init`, `update`, `help`, etc.), il devient directement le sujet, sauf s'il ressemble fortement a une commande connue (`nex` pour `new`, par exemple), auquel cas Palabre affiche une erreur de commande inconnue.

## Aide CLI

L'aide principale (`palabre -h`, `palabre help`) doit rester minimaliste, inspiree de l'aide Ollama : description courte, usage, demarrage rapide, commandes principales, flags essentiels, lien vers la documentation publique localisee (`https://palab.re/fr` ou `/en`) et mention `palabre [command] --help`.

Ne pas transformer l'aide principale en reference complete. Les details doivent aller dans l'aide de commande (`palabre config --help`, `palabre init --help`, etc.) ou dans la documentation du site.

## Rendu Console

`src/renderers/console.ts` contient le rendu console historique. Le rendu TUI leger, utilise par defaut quand stdout est un TTY, est decoupe en quatre modules : `src/renderers/tui-theme.ts` (primitives visuelles : couleurs, boites, largeurs, liens), `src/renderers/tui-screens.ts` (ecrans plein terminal : accueil, aide, agents, roles, historique, config), `src/renderers/tui-prompts.ts` (entrees readline et commandes slash) et `src/renderers/tui-renderer.ts` (renderer des evenements de debat). `src/renderers/tui.ts` reste le point d'entree public qui re-exporte cette API ; les imports externes ne doivent viser que lui.

- `PrettyConsoleRenderer` : en-tete, separateurs, tours, synthese structuree, couleurs ANSI si TTY.
- `PlainConsoleRenderer` : rendu historique compatible logs.
- `TuiRenderer` : accueil `palabre`, composer slash commands, `/config`, `/history`, `/home`, tableau de bord plein terminal, statut d'agent en cours et sections lisibles sans dependance UI externe. Depuis `/config`, `/ollama`, `/ollama-url <url|default>`, `/ollama-model <modele>` et `/ollama-sync` exposent l'adresse et le choix du modele Ollama sans sortir de la TUI. Le composer de l'accueil accepte `--context <chemins...>` et `--files <chemins...>` en fin de sujet (`parseComposerTopic`) : les chemins sont retires du sujet et injectes comme contexte ; les chemins avec espaces ne sont pas supportes dans cette syntaxe inline.
- Etat "agent en cours" pendant les appels longs en rendu pretty.

Le flag `--terminal` force le rendu simple. `--plain` reste accepte comme alias historique. `NO_COLOR` desactive les couleurs sans changer la structure.

Le design TUI suit quelques regles fixes definies dans `tui-theme.ts` :

- toute la sortie est ancree a gauche avec une gouttiere fixe (pas de centrage dependant de la largeur du terminal) ;
- une seule famille de boites (cadre ferme, titre optionnel integre a la bordure haute), tracee en Unicode (`┌─┐│└┘`) avec repli ASCII automatique quand le terminal ne le supporte pas ou si `PALABRE_ASCII=1` est defini — les tests TUI forcent ce repli pour rester deterministes ;
- le logo 5 lignes est reserve a l'accueil ; les autres ecrans utilisent `brandHeader`, une ligne de titre accentuee suivie d'une regle horizontale ;
- les blocs label/valeur passent par `rows()` (colonne de labels adaptative) quand un label peut depasser 16 caracteres ;
- les couleurs semantiques passent par les tokens `success`/`warning`/`danger` du theme, et les marqueurs d'etat par `glyphs().check`/`glyphs().cross` ;
- le spinner utilise les frames braille avec repli ASCII ;
- les messages de debat/ask utilisent `accentBar` : en-tete du tour (titre souligne) et contenu dans un meme bloc, delimite par la seule barre laterale gauche a la couleur de l'agent — pas de cadre ferme pour les blocs qui s'enchainent ;
- la zone de saisie integre le fil d'Ariane dans la regle violette (`labeledRule`) et reduit la ligne de saisie au marqueur `❯` ;
- tout le contenu est aligne a gauche, y compris dans les boites — pas de centrage partiel.

Le TUI actuel reste leger : pas encore de split-view, pas de scrolling controle, pas d'input humain pendant le debat. Garder la logique produit dans le CLI et eviter que les integrations compensent ces limites.

## Renderer NDJSON

`src/renderers/ndjson.ts` fournit un renderer machine-readable pour les integrations out-of-process : extension VS Code Palabre-vscode, plugin Obsidian, scripts shell, replay. Le rendu humain reste assure par les renderers console.

### Activation

Trois facons equivalentes :

```bash
palabre run --preset codex-claude -s "..." --renderer ndjson
palabre run --preset codex-claude -s "..." --json
palabre codex-claude "..." --json -t 4
```

Precedence des flags : `--renderer` > `--json` > `--tui` / `--terminal` > `defaults.interface` > defaut (`tui` si TTY, `plain` sinon). `--plain` reste un alias legacy de `--terminal`. `--renderer <kind>` accepte `auto | pretty | plain | tui | ndjson`. Une valeur inconnue leve une erreur listant les choix supportes.

### Contrat de sortie

- toute la sortie va sur **stdout** ;
- une ligne = un evenement JSON valide, termine par `\n` ;
- chaque evenement porte un champ `v` (entier) pour le versioning ; la version courante est `v=1` ;
- stderr reste libre pour les messages bas niveau (Node, shell, erreurs adapter remontees comme exceptions) que les consommateurs agregent comme ils veulent.

### Schema v1

Types d'evenements emis aujourd'hui :

| Type | Quand | Champs |
| --- | --- | --- |
| `start` | une fois, au demarrage de la session | `mode` (`chat`, `debate` ou `ask`), `topic`, `agents[]` (`name`, `role`, `type`), `filesCount`, `session` (`startedAt`, `localDate`, `timeZone`, `cwd`) ; les champs Debate/Ask `turns`, `summaryEnabled`, `summaryAgent` et `earlyStop` restent présents dans ces modes |
| `notice` | message informatif | `message` |
| `warning` | avertissement | `message` |
| `turn-start` | debut d'un tour | `turn`, `totalTurns`, `agent`, `role` |
| `ask-response-start` | debut d'une reponse agent en mode `ask` | `response`, `totalResponses`, `agent`, `role` |
| `thinking-start` | agent en cours de generation | `agent`, `role` |
| `thinking-end` | fin de generation | (aucun) |
| `message` | contenu d'un message de debat | `turn`, `agent`, `role`, `content` |
| `ask-response` | contenu d'une reponse agent en mode `ask` | `response`, `agent`, `role`, `content` |
| `summary-start` | debut de la synthese finale | `agent`, `role` |
| `summary-message` | contenu de la synthese | `agent`, `role`, `content` |
| `chat-agents` | reponse a `/agents` pendant Chat | `agents[]` (`name`, `role`) |
| `chat-user-message` | message utilisateur accepte par Chat | `agent` (`user`), `role`, `content`, `createdAt` |
| `chat-message` | reponse de l'agent actif | `agent`, `role`, `content`, `createdAt` |
| `chat-consultation-start` | debut d'une consultation explicite | `agent`, `role` |
| `chat-consultation` | avis ajoute au transcript | `agent`, `role`, `content`, `createdAt` |
| `chat-agent-changed` | changement d'agent actif via `/use` | `agent`, `role` |
| `error` | erreur runtime structurée pendant le debat, ask ou la synthese | `phase` (`debate`, `ask` ou `summary`), `kind`, `message`, optionnels `agent`, `role`, `turn`, `details` |
| `done` | fin de session ; export ecrit quand demande | `outputPath` (`null` si Chat se termine sans `/end`) |

Exemple de session minimale :

```json
{"v":1,"type":"start","mode":"debate","topic":"...","turns":2,"agents":[{"name":"codex","role":"implementer","type":"cli"},{"name":"claude","role":"reviewer","type":"cli"}],"summaryEnabled":true,"summaryAgent":"claude","earlyStop":true,"filesCount":0,"session":{"startedAt":"...","localDate":"...","timeZone":"...","cwd":"..."}}
{"v":1,"type":"turn-start","turn":1,"totalTurns":2,"agent":"codex","role":"implementer"}
{"v":1,"type":"thinking-start","agent":"codex","role":"implementer"}
{"v":1,"type":"thinking-end"}
{"v":1,"type":"message","turn":1,"agent":"codex","role":"implementer","content":"..."}
{"v":1,"type":"turn-start","turn":2,"totalTurns":2,"agent":"claude","role":"reviewer"}
{"v":1,"type":"message","turn":2,"agent":"claude","role":"reviewer","content":"..."}
{"v":1,"type":"summary-start","agent":"claude","role":"summarizer"}
{"v":1,"type":"summary-message","agent":"claude","role":"summarizer","content":"..."}
{"v":1,"type":"done","outputPath":"./debate-2026-05-11.debate.md"}
```

Si un agent plante, Palabre emet `error`, ecrit tout de meme l'export Markdown partiel avec une section `Interruption`, emet `done`, puis termine avec un exit code non nul.

### Politique de versioning

Le renderer NDJSON est une API publique d'integration. Toute integration officielle doit le traiter comme un contrat versionne, pas comme un detail d'affichage interne.

- ajout d'un nouveau type d'evenement ou d'un nouveau champ optionnel : **compatible v1**, pas de bump de `v` ;
- suppression d'un type ou d'un champ obligatoire, renommage, changement de semantique : **breaking**, bump `v` a `2`, documenter la migration ici ;
- les consommateurs doivent ignorer les champs inconnus et les types inconnus plutot que crasher.
- Palabre-vscode doit continuer a supporter v1 tant que sa version minimale de CLI le demande. S'il recoit une version majeure inconnue, il doit afficher une erreur actionnable demandant de mettre a jour l'extension ou d'aligner les versions CLI/extension, sans tenter d'interpreter le flux.

### Limites actuelles

- pas d'evenement `agent-chunk` : le rendu Palabre est par message complet, pas par token. Le streaming token-par-token necessitera un changement de contrat `DebateRenderer` cote orchestrateur, pas seulement le renderer.
- pas d'evenement `early-stop` distinct : la fin du debat se voit par l'absence de nouveaux `turn-start` avant le `summary-start` ou le `done`.

Ces points sont a evaluer au cas par cas si un consommateur reel les demande. Eviter de speculer.

## Tests et verification

Avant de livrer une modification :

```bash
pnpm check
pnpm test
pnpm build
```

Avant de publier une version CLI ou extension, lancer en plus le smoke test reel des presets depuis le repo CLI apres `pnpm build` :

```bash
pnpm smoke:real-presets -- --mode both --keep-going
```

Ce script compile `scripts/smoke_real_presets.ts`, lit `palabre presets --json`, lance les 10 paires CLI prioritaires actives avec de vrais agents, puis verifie les contrats NDJSON `debate` et `ask`, les syntheses, les exports `.debate.md` / `.ask.md`, les messages agents non vides et l'absence de bruit connu comme les sorties `taskkill` Windows. Il est volontairement hors `pnpm test`, car il peut consommer des quotas Codex/Claude/Antigravity/OpenCode/Mistral Vibe et depend de l'authentification locale.

Options utiles :

- `--include-ollama` : inclut les presets Ollama disponibles.
- `--mode <debate|ask|both>` : choisit les modes reels a tester ; utiliser `both` avant une publication.
- `--all-available` : teste toutes les paires disponibles en premiere direction seulement ; ajouter `--all-directions` pour tester aussi les variantes inversees.
- `--no-summary` : economise du quota quand la synthese n'est pas dans le perimetre du smoke.
- `--turns <n>` et `--topic <texte>` : ajustent la duree et le sujet du debat de smoke.

Quand un changement touche l'adapter CLI, lancer `pnpm test`. Ces tests compilent `src/` et `tests/` via `tsconfig.test.json` dans `.tmp/test-dist`, puis utilisent `node:test` avec des CLIs mockees. Garder les tests automatises sous `tests/` et completer par un smoke test manuel avec une vraie CLI seulement quand le comportement depend d'un outil externe.

Les erreurs CLI doivent rester actionnables. En particulier, les limites d'usage et quotas Codex/Claude/Antigravity doivent etre classees comme `usage-limit` et ne pas recopier tout le prompt ou les logs bruts dans le message utilisateur.

Quand un changement touche Ollama, verifier que l'erreur est lisible si Ollama n'est pas lance ou si le modele manque.

Combinaisons validees localement :

- `ollama ↔ ollama` avec `gemma4:e4b`
- changement Ollama `nemotron-3-nano:4b` vers `gemma4:e4b` avec dechargement de l'ancien modele
- `codex exec ↔ ollama`
- `claude --print ↔ ollama`
- `agy --print ↔ ollama`
- `codex exec ↔ claude --print`
- `--show-prompt` avec `--files`
- `--show-prompt` avec `--context docs`
- `palabre context scan src --json`
- `palabre new` simule par entree standard avec `--show-prompt` pour verifier le wizard sans appeler d'agent
- contexte de session visible dans `--show-prompt`
- arret anticipe sur accord clair
- syntaxe courte `palabre preset "sujet" -t 4`
- alias sujet `palabre -s "sujet" -t 2`
- detection des limites d'usage CLI type Codex/Claude/Antigravity par simulation stderr
- `init` avec config globale et `init --local` dans un dossier temporaire pour verifier la detection locale
- `update` en mode instructions
- etat "agent en cours" en rendu pretty
- synthese finale avec `defaults.summaryAgent`, fallback agent B
- `--no-summary`
- erreurs adapter `empty-output`, `non-zero-exit`, `model-unavailable`
- erreur adapter `output-too-large`
- evenement NDJSON `error` et export partiel apres interruption
- warning Ollama sans contexte
- rendu console pretty et `--plain`

Ces tests ont confirme que le mode batch est deja exploitable avant l'adapter PTY.

## Documentation

La documentation doit rester a jour dans le meme changement que le code. Avant de finaliser une modification, verifier les fichiers concernes :

Le script `scripts/sync_docs.py` valide et copie les pages `docs/guide/fr` et `docs/guide/en` vers les formats numerotes `content/fr` et `content/en` de Palabre-app. Ne pas recreer de logique qui devine les descriptions depuis le contenu : elles doivent etre explicites dans le frontmatter.

- `README.md` pour l'etat du MVP, les commandes principales, les limites connues et les liens de documentation.
- `AGENTS.md` pour les decisions d'architecture, les workflows contributeur et les consignes de maintenance.
- `CHANGELOG.md` pour les changements notables par version. Toute release CLI doit y ajouter une entree datee avant le bump/tag, avec les sections utiles (`Added`, `Changed`, `Fixed`, `Removed`, `Security`).
- `docs/guide/fr/**.md` pour les guides utilisateur francais. Ces pages utilisent le meme format que Palabre-app/Nuxt Content : frontmatter `title` + `description`, puis contenu sans H1 de page. La traduction anglaise vit dans `docs/guide/en/**.md`.
- `docs/guide/fr/roadmap.md` pour la roadmap publique francaise orientee utilisateurs : disponible aujourd'hui, prochaines ameliorations, philosophie du projet.
- `docs/roadmap.md` pour la roadmap interne locale non versionnee : travaux faits, priorites, dettes techniques et notes de pilotage.

`docs/notes.md` est reserve aux idees personnelles du mainteneur. Ne pas l'utiliser comme roadmap projet. Quand une idee de `docs/notes.md` est implementee ou deplacee dans une roadmap, nettoyer la note correspondante pour garder ce fichier lisible.

Les documents obsoletes ou historiques doivent etre deplaces dans `docs/archive/` plutot que supprimes brutalement quand ils gardent une valeur de contexte.

## JSDoc

Mettre en place et maintenir des JSDoc sur les API internes qui servent de contrat entre modules :

- types et interfaces exportes dans `src/types.ts` ;
- fonctions d'orchestration ;
- adapters ;
- chargement de config ;
- discovery ;
- gestion du contexte ;
- update.

Les commentaires doivent expliquer le contrat, les invariants et les limites utiles. Eviter les commentaires qui paraphrasent simplement le code.

Regle d'entretien : chaque fichier TypeScript modifie doit faire l'objet d'une revue JSDoc dans le meme changement. Au minimum, maintenir une description de module (`@file`) et documenter les types/fonctions exportes ; documenter aussi les fonctions internes quand leur priorite, leurs effets de bord, leurs erreurs ou leurs fallbacks ne sont pas evidents. Si une API documentee change de comportement, sa JSDoc doit etre mise a jour avant le commit.

## Releases

Les releases sont gerees via des tags Git. Deux workflows GitHub Actions sont en place :

- `.github/workflows/ci.yml` : type check + tests + build sur chaque push `main` et chaque PR.
- `.github/workflows/release.yml` : type check + tests + build + pack + publication npm via Trusted Publishing + creation de release GitHub sur chaque tag `v*`.

### Preparer et publier une release

```bash
# Depuis une branche de release, sans creer de tag local
pnpm version patch --no-git-tag-version   # ou minor / major
# Mettre a jour CHANGELOG.md, ouvrir puis fusionner la PR de release
```

Avant le bump, mettre a jour `CHANGELOG.md` avec l'entree datee de la version cible. La PR de release contient au minimum `package.json` et le changelog ; `main` reste protegee et ne recoit pas de commit direct.

Apres fusion de la PR, taguer exactement le commit courant de `main`, puis pousser seulement ce tag :

```bash
git switch main
git pull --ff-only
git tag vX.Y.Z
git push origin vX.Y.Z
```

Le push du tag declenche le workflow `release.yml` qui :

1. installe les dependances (`--frozen-lockfile`) ;
2. verifie les types (`pnpm check`) ;
3. lance les tests automatises (`pnpm test`) ;
4. compile (`pnpm build`) ;
5. pack un tarball npm (`pnpm pack`) ;
6. publie sur npm via Trusted Publishing (`npm publish --access public --provenance`) sans token npm stocke dans GitHub ;
7. cree une release GitHub avec le tarball en artifact et les notes generees depuis les commits ;
8. pousse `public/version.json` dans le repo `JuReyms/Palabre-app` (branche `dev`) ;
9. cree une PR `dev -> main` dans Palabre-app, ou commente la PR deja ouverte, puis expose son lien dans le resume du workflow. La fusion manuelle de cette PR declenche le build Netlify de production et met a jour le badge de version.

### Npm Trusted Publishing

Le package npm `palabre` doit etre configure cote npm avec un Trusted Publisher GitHub Actions :

- Repository owner: `JuReyms`
- Repository name: `Palabre`
- Workflow filename: `release.yml`
- Environment: laisser vide, sauf si le workflow ajoute explicitement `environment: ...`

Ne pas stocker de `NPM_TOKEN` dans GitHub et ne pas publier depuis la machine locale pour les releases normales. Si une publication manuelle d'urgence est faite, supprimer le token local avec `npm config delete //registry.npmjs.org/:_authToken` juste apres.

## Sync documentation (Palabre-app)

Le repo CLI est public. Le site de documentation (`JuReyms/Palabre-app`, Nuxt SSG sur Netlify) recoit les mises a jour via deux workflows GitHub Actions qui poussent directement dans la branche `dev` de Palabre-app. Netlify produit depuis `main` : le workflow de release cree ou rappelle donc une PR `dev -> main`, dont la fusion reste manuelle.

Les deux workflows utilisent le secret `DOCS_REPO_TOKEN` (PAT fine-grained sur `JuReyms/Palabre-app` uniquement). Il exige `Contents = Read and write` pour la synchronisation et `Pull requests = Read and write` pour proposer le deploiement de production.

### Workflow sync-docs.yml

Declenche sur tout push dans `docs/guide/fr/**`, `scripts/sync_docs.py` ou le workflow lui-meme vers `main`.

Les pages source utilisent le meme format que Palabre-app/Nuxt Content : frontmatter `title` + `description`, puis contenu sans H1 de page. Le workflow appelle `scripts/sync_docs.py`, qui valide ce format et copie les pages vers `content/fr/**` dans Palabre-app.

Convention i18n :

- francais actif : `docs/guide/fr/**` -> `content/fr/**` ;
- anglais : `docs/guide/en/**` -> `content/en/**`.

Ne pas recreer de logique qui devine les descriptions depuis le contenu. Les descriptions doivent rester explicites dans le frontmatter.

**Contrainte critique** : ne jamais utiliser `rm -rf palabre-app/content/*` dans le step de copie. `content/index.md` (landing page) n'est pas dans la sync et ne doit pas etre supprime — sans lui, la collection `landing` de Nuxt Content est vide, la route `/` retourne 404 et le build Netlify echoue. Le step de copie doit se limiter a `cp -R dist/content/. palabre-app/content/`.

Pour ajouter une page de documentation, ajouter les versions `fr` et `en` dans le meme changement :

1. Creer le fichier source dans la section adaptee de `docs/guide/fr/`.
2. Ajouter la ligne correspondante dans `FILE_MAP` de `scripts/sync_docs.py`.
3. Verifier localement avec `python scripts/sync_docs.py`.
4. Si la page ajoute une nouvelle section, creer ou adapter la navigation correspondante dans Palabre-app (`content/fr/**/.navigation.yml`).

Attention aux liens internes : ne pas utiliser de liens relatifs (`./autre-page.md`) dans les sources `docs/guide/fr/`. Utiliser des URLs absolutes correspondant aux routes finales du site (`/fr/get-started/...`, `/fr/agents/...`, `/fr/usage/...`, `/fr/configuration/...`, `/fr/reference/...`).
### Workflow release.yml (step de sync)

A chaque release, apres la creation de la release GitHub, le workflow ecrit :

```json
{ "tag_name": "vX.Y.Z" }
```

dans `public/version.json` de Palabre-app. Le composable `useLatestRelease.ts` de Palabre-app lit ce fichier local au lieu d'appeler l'API GitHub — ce qui evite au site de documentation d'appeler l'API GitHub a chaque affichage.

### Nommage des versions

Suivre semver :

- `patch` : correction de bug, ajustement mineur sans impact sur les commandes.
- `minor` : nouvelle fonctionnalite retro-compatible.
- `major` : changement cassant de l'interface CLI ou du format de config.

## Issues GitHub

Toute issue GitHub creee ou mise a jour par un agent doit recevoir exactement un label de type existant :

- `type: bug` pour une regression ou un comportement incorrect reproductible ;
- `type: feature` pour une fonctionnalite, une amelioration produit ou une dette technique planifiee ;
- `type: documentation` pour une documentation, une ADR ou une evolution de contrat documentaire ;
- `type: question` uniquement quand l'objectif est d'obtenir une decision ou une information externe avant toute implementation.

Ajouter aussi un label de zone quand le perimetre est clair : `area: cli`, `area: vscode-extension` ou `area: website`. Ne pas creer de nouveau label sans demande explicite. Ne pas appliquer les anciens labels generiques (`bug`, `enhancement`, `documentation`, `question`) aux nouvelles issues, ni `duplicate`, `invalid`, `wontfix`, `good first issue` ou `help wanted` sans validation explicite du mainteneur.

## Style de contribution

- Preferer des changements petits et comprehensibles.
- Ne pas melanger TUI, PTY et extension VS Code dans le meme changement.
- Garder les adapters independants du moteur d'orchestration.
- Documenter les limites connues plutot que de masquer les heuristiques.
- Eviter les abstractions prematurees, sauf quand elles gardent les adapters propres.
