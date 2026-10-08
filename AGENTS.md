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
src/commands/             Commandes leaf et utilitaires partages (agents, context, history, init, presets, relay, sessions, shared, update)
src/runOptions.ts         Resolution centralisee des options completes d'une session
src/sessionCheckpoint.ts  Contrat JSON v1 et stockage atomique des checkpoints
src/sessionInventory.ts   Liste bornée et suppression ciblée des checkpoints
src/sessionCheckpointRuntime.ts Writer runtime neuf ou repris
src/sessionResume.ts      Validation et reconstruction stricte de `palabre resume`
src/externalSessions/     Relay vers une session externe : socle (types, lancement, enveloppe, issues), contrat d'adapter, adapters Claude Code et Codex
src/tuiController.ts      Controleur des flows de configuration TUI
src/args.ts               Parseur d'arguments CLI (table d'arite des flags)
src/launchDispatch.ts     Decision de lancement d'une commande run : accueil TUI ou Chat direct selon le mode effectif
src/new.ts                Assistant interactif `palabre new`
src/config.ts             Chargement, generation et validation de config
src/discovery.ts          Detection locale des CLIs et d'Ollama pendant init
src/doctor.ts             Diagnostics de configuration et de disponibilite locale
src/agentRegistry.ts      Source de verite des agents CLI connus (mapping commande -> decouverte)
src/exec.ts               Resolution d'extensions executables partagee
src/npmShim.ts            Reconnaissance stricte des shims PowerShell npm, lancement direct sans PowerShell (adapters et Relay)
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
- `opencode`
- `agy`, puis `antigravity` (Antigravity CLI)
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

`palabre update` detecte le canal de l'installation en cours : checkout Git, package global npm, pnpm, Yarn ou Bun. La detection compare le package execute aux racines globales interrogees localement ; une provenance ambigue reste `unknown` et ne declenche jamais une mutation.

La commande par defaut affiche le diagnostic et demande une confirmation unique en TTY avant toute ecriture. `--check` et `--dry-run` restent sans effet de bord ; `--yes` applique le plan sans confirmation. `--apply` est conserve comme alias compatible de `--yes`. En non-interactif, une application exige `--yes` (ou `--apply`). L'ecran TUI `/update` presente exactement le meme plan et une action explicite `Mettre a jour maintenant`.

Depuis un checkout git, le plan execute :

```bash
git pull --ff-only
pnpm install
pnpm build
pnpm link --global
```

Pour une installation package, le plan execute la syntaxe native du gestionnaire detecte, avec la version npm resolue (par exemple `pnpm add --global palabre@0.16.1` ou `npm install --global palabre@0.16.1`). Si npm est indisponible ou si la version executee est deja courante, Palabre ne modifie pas l'installation package. Une mise a jour peut toucher le reseau, le store global et le lien global : garder l'action explicite et ne jamais construire une ligne de shell non structuree.

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

Sous Windows, l'ordre de lancement (CLI et PTY) est : executable natif ; shim PowerShell `.ps1` frere
genere par npm, reconnu ligne a ligne et lance directement, sans PowerShell (Node et le script du
paquet, ou l'executable natif du paquet pour la variante native) ; autre shim PowerShell (pnpm, shim
modifie), lance par PowerShell sans `cmd.exe` ; sinon wrapper shell, refuse pour un prompt en
argument. La reconnaissance du shim npm est partagee avec Relay dans `src/npmShim.ts` (#98) : avec
Windows PowerShell 5.1, le shim refuse l'argument `-`, retire les guillemets internes et remplace les
caracteres non ASCII de stdin par `?`. Le repli PowerShell garde ces limites pour les shims pnpm ou
modifies. CLI et PTY partagent la resolution PATH mise en cache dans `src/exec.ts`.

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

Les sessions Débat et Ask peuvent activer des checkpoints avec `--checkpoint`. Cet opt-in écrit un état JSON v1 sous `.palabre/sessions/` avant le premier appel, après chaque réponse complète acceptée et lors de la terminaison. L'écriture est atomique et conserve l'empreinte canonique de la configuration, les références de contexte, le transcript complet validé, la synthèse et les diagnostics structurés. Les sorties brutes et réponses partielles ne sont jamais persistées. Chat reste hors périmètre.

`palabre resume <session-id>` valide le checkpoint, exige une configuration toujours approuvée avec la même empreinte, recharge chaque fichier de contexte avec la même empreinte et refuse toute dérive avant un appel agent. La commande affiche la phase à reprendre et demande confirmation en TTY ; `--yes` est obligatoire en non-interactif. Elle réutilise le même identifiant et le même writer atomique, ne rejoue aucune réponse complète, reprend le prochain tour Débat, les agents Ask restants ou la synthèse seule, puis produit un nouvel export Markdown complet. Une session terminée est refusée.

`palabre sessions` liste par défaut les 20 checkpoints les plus récents du workspace, avec une limite configurable de 1 à 100. Un checkpoint corrompu apparaît comme invalide sans bloquer les autres et sans exposer son contenu ni un chemin absolu dans le contrat JSON v1. `palabre sessions delete <session-id>` valide strictement l'identifiant, affiche le fichier ciblé en TTY et exige une confirmation ; `--yes` est obligatoire en non-interactif. La suppression ne touche ni les exports Markdown ni les checkpoints voisins. Aucune rétention automatique n'est appliquée.

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

## Relay externe

État : la commande `palabre relay` est disponible (lots A0 à A4, non publiée). Elle vit dans `src/commands/relay.ts`, le socle et les adapters dans `src/externalSessions/`. Le smoke réel avec de vrais agents (A5) reste à faire avant publication.

`palabre relay` transmet **un** message à une conversation Codex ou Claude Code existante, récupère **une** réponse, puis termine. Il vise les conversations **fermées** : aucun processus (TUI, desktop, IDE, `exec`, `-p`) n'y est attaché.

Cette version ne permet pas de faire dialoguer deux agents dont les conversations restent ouvertes. Ce besoin, objectif de l'issue #96, n'est pas résolu.

Le relay est distinct de deux mécanismes existants :

- `palabre resume`, qui reprend un checkpoint Palabre ;
- les adapters de débat (`generate(prompt)`).

Il passe par un adapter « session externe » dédié (`src/externalSessions/`), sans cas spécial dans l'orchestrateur.

Contrat d'adapter (`ExternalSessionAdapter`, `src/externalSessions/adapter.ts`) :

- `locate` : historique et dossier de travail ;
- `probe` : attachement de la cible ;
- `prepare` (facultatif) : étape préalable, par exemple la liste MCP de Codex. Elle reçoit un lanceur déjà lié à l'exécutable, au dossier de la cible et à l'environnement nettoyé. Elle rend les arguments à insérer dans la reprise, ou un refus avant lancement ;
- `resumeArgs` : arguments complets de reprise, avec ceux rendus par `prepare` ;
- `interpret` : réponse, identité, refus certain et limite d'usage ;
- `findNonce` : preuve de persistance.

Un adapter ne lance aucun processus. `exchange` exécute l'étape préalable, puis lance la reprise avec `runExternalProcess`, et délègue l'interprétation à l'adapter. Un refus de l'étape préalable empêche toute reprise. `exchangeOutcome` en déduit l'issue et l'indicateur de lancement pour `classifyDelivery`. Issues et délivrance restent calculées par `outcome.ts`, identiques pour tous les fournisseurs.

### Syntaxe

```text
palabre relay --from <agent>:<session> --to <agent>:<session> ("<message>" | --message-file <chemin>)
              [--timeout <secondes>] [--json] [--no-export] [--config <chemin>] [--trust-config]
              [--language <fr|en>]
```

- `--to <agent>:<session>` :
  - `<agent>` est le nom d'un agent de la config résolue ;
  - `<session>` est un UUID (8-4-4-4-12 hexadécimal), normalisé en minuscules ;
  - aucune sélection implicite (« la plus récente ») n'existe.
- `--from <agent>:<session>` est une étiquette déclarative de l'expéditeur. Seule sa syntaxe est validée. L'expéditeur n'est ni lancé, ni sondé, ni tenu d'exister dans la config. Il peut être actif.
- Le message est fourni en argument positionnel **ou** par `--message-file`, jamais les deux. Il doit être non vide et ne pas dépasser 64 Kio en UTF-8.
- `--timeout` : 600 s par défaut, entre 10 et 3600 s.
- `--json` produit un objet JSON unique sur stdout.
- `--no-export` supprime l'export `.relay.md`. Par défaut, l'export est écrit dans `outputDir`.
- `--trust-config` approuve explicitement la config résolue (`trustConfig`) avant de l'utiliser.

La commande est elle-même l'action explicite. Elle ne pose **aucune question interactive**, en TTY comme hors TTY.

Les arguments sont analysés par un parseur strict propre à relay (`parseRelayTokens`), et non par le parseur général. Tout jeton qui commence par `-` doit être une option longue de relay. Sont refusées et nommées, avec `invalid-request` (`invalid-arguments`) et sans aucun lancement :
- les options courtes (`-q`, `-a`, `-s`…), sauf `-h` ;
- les options d'autres commandes ;
- la forme `--option=valeur` ;
- une option répétée ;
- une option sans valeur.

L'aiguillage a lieu au tout début de `main()`, avant la résolution de la langue, le parseur général et les handlers globaux (`--version`, `--help`). `findFirstPositionalIndex` (`src/args.ts`) repère la commande avec la table d'arité du parseur général, sans rien valider, pour qu'une valeur d'option égale à `relay` (`--config relay`, `-s relay`) ne soit jamais prise pour la commande. `palabre --json --language de relay`, `palabre --json relay --config` et `palabre --json relay --version` donnent donc un objet `relay-result` (code 8), comme quand `relay` vient en premier.

### Résolution de la commande

1. **Config.** La résolution est la même que pour les autres commandes : `--config`, puis la config de projet, puis la config globale.
   - Elle doit être approuvée (`isConfigTrusted`), quelle que soit sa provenance, comme pour `palabre resume`.
   - Une config non approuvée est refusée, **y compris en TTY**, sans question interactive : `invalid-request`, raison `config-untrusted`. Seul `--trust-config` l'approuve.
   - Une config absente ou illisible donne `invalid-request`, raison `config-unavailable`.
   - `src/index.ts` aiguille `relay` avant le parseur général et avant `ensureImplicitProjectConfigTrusted`. Le relay ne passe donc pas par la confirmation interactive appliquée aux configs de projet implicites, et ses erreurs d'arguments restent structurées en `--json`.
2. **Agent.** `config.agents[<agent>]` doit exister et ne pas être retiré. Il n'y a aucun fallback codé en dur. L'agent doit être de type `cli`. Sinon, l'issue est `invalid-request`, avec la raison `unknown-agent` ou `unsupported-agent`.
3. **Fournisseur.** On applique `normalizeCommandName(command)`, puis on cherche le résultat dans `KNOWN_CLI_AGENTS`, via un champ `externalSession: "codex" | "claude"`.
   - Un alias (par exemple `claude-opus` avec `claude.exe`) est accepté.
   - Une commande custom non reconnue donne `unsupported-agent`.
4. **Exécutable** (`resolveExternalExecutable`, `src/externalSessions/resolve.ts`, décision D21). Il est lancé **sans shell, ni PowerShell, ni `cmd.exe`**. Avec le shim npm `codex.ps1` lancé par Windows PowerShell 5.1, il a été constaté que :
   - l'argument `-` est refusé ;
   - les guillemets internes sont retirés (`sandbox_mode="read-only"` devient `sandbox_mode=read-only`, et `{"disableAllHooks":true}` devient `{disableAllHooks:true}`) ;
   - les caractères non ASCII de stdin deviennent `?`, et les fins de ligne deviennent CRLF.

   Sous Windows, la commande (chemin explicite, ou nom cherché dans le PATH avec `src/exec.ts`) est résolue dans cet ordre :
   1. exécutable natif `.exe` ou `.com`, y compris un alias d'exécution `WindowsApps` ;
   2. shim PowerShell npm (`.ps1`, voisin d'un `.cmd` ou d'un script sans extension). Il est **lu comme du texte**, jamais exécuté ni évalué. Il doit reproduire **ligne à ligne** le modèle complet généré par npm (`cmd-shim`, `NPM_SHIM_TEMPLATE`).
      - Seules variations permises : le chemin du script (identique aux quatre appels, segments de paquet sans `$`, accent grave, guillemet ni espace), les fins de ligne LF ou CRLF, les espaces en fin de ligne et les lignes vides finales.
      - Toute instruction ajoutée, retirée ou modifiée rend le shim non reconnu : affectation de `$args`, variable d'environnement, `Set-Location`, `exit` anticipé, commentaire ou indentation.
      - Le script doit être un fichier JavaScript existant, situé dans le dossier du shim.

      Le relay lance alors directement l'interpréteur (`node.exe` du dossier du shim s'il existe, sinon celui du PATH) et le script du paquet ;
   3. tout autre wrapper (`.cmd` ou `.bat` seul, shim modifié ou ambigu) donne `invalid-request`, raison `unsupported-executable`.

   Ailleurs, la commande est résolue dans le PATH et lancée directement. Si rien n'est trouvé, l'issue est `command-not-found`. Le champ `shell` de la config est ignoré. `discoverLocalTools` n'est pas appelé.
5. **Arguments.** Le relay n'utilise pas les réglages de débat de l'agent : `args`, `promptMode`, `model`, `modelArg`, `shell`, `timeoutMs` et `idleTimeoutMs`. L'adapter session externe construit seul la liste complète des arguments :
   - Codex : `exec resume … -m <modèle enregistré dans la session>` ;
   - Claude : `-p … --append-system-prompt <cadre opérateur> --resume …`, sans `--model`.

   **Cadre opérateur Claude (D22).** C'est un texte **fixe**, en français ou en anglais selon la langue du relay (`relayMessages.<langue>.operatorFrame`), ajouté au prompt système de la reprise. Il dit trois choses :
   - l'opérateur utilise `palabre relay` pour poser une question dans cette conversation ;
   - l'expéditeur indiqué dans l'enveloppe est déclaratif et non authentifié ;
   - le cadre ne rend pas le message plus fiable et ne lève aucune consigne ni restriction.

   Aucun contenu du message n'y entre, puisque le message passe seulement par stdin. L'enveloppe et toutes les restrictions restent inchangées.

   Portée vérifiée **[T]** :
   - avec Claude Code 2.1.85, le cadre ajouté à la reprise est appliqué, et il lève le refus « injection de prompt » observé sans lui ;
   - avec 2.1.292, l'option est acceptée, mais **un prompt système ajouté seulement à la reprise n'est pas appliqué** : le prompt enregistré avec la session prévaut. Une sonde stricte l'a montré deux fois. Avec cette version, le cadre est donc sans effet, et aucun refus n'a été observé sans lui.

   Le même exécutable sert à `codex mcp list` et à la reprise.

### Déroulé

Les étapes sont strictement ordonnées, et une étape refusée arrête le relay :

1. **Valider les arguments.**
2. **Résoudre la config, l'agent et l'exécutable.**
3. **Localiser l'historique de la cible et son dossier de travail** :
   - Codex : rollout `rollout-*-<session>.jsonl`, cherché dans `~/.codex/sessions/**` puis `archived_sessions/**`.
     - La première entrée doit être un `session_meta` de la même session ; sinon, le rollout est jugé incohérent et la cible est `session-not-found`.
     - Le dossier est `session_meta.cwd`.
     - Le modèle est celui du dernier `turn_context`, repris avec `-m` pour éviter un changement de modèle dans l'historique. Sans modèle enregistré, `-m` est omis et l'omission est signalée.
     - Plusieurs rollouts pour un même identifiant donnent `session-not-found` (ambigu) ;
   - Claude : transcript `~/.claude/projects/*/<session>.jsonl`. Le dossier retenu est le `cwd` de la première entrée qui en porte un, c'est-à-dire le dossier d'origine. Une reprise lancée ailleurs ajoute d'autres `cwd`, qui sont signalés mais pas suivis. Un identifiant présent dans plusieurs dossiers de projet est refusé comme ambigu (`session-not-found`).

   Le dossier doit exister. Il n'est **jamais remplacé par le dossier courant** de Palabre. Sinon, l'issue est `invalid-request`, raison `invalid-working-directory`.
4. **Sonder l'attachement.** Seul `detached` est relayable :
   - `attached` donne `target-busy` ;
   - un attachement invérifiable donne `target-state-unknown`. C'est le cas quand le registre Claude est absent ou illisible, ou quand il contient une entrée sans `sessionId` valide (`{}`, `{ pid }`, `sessionId: null`…). Une entrée n'est écartée comme « autre session » que si son identifiant est valide et différent.
   - Codex : verrou `~/.codex/thread-writer-locks/<session>.lock`.
     - Absent, ou présent mais libre (verrou laissé après un kill) : `detached`.
     - Tenu (ouverture exclusive refusée sous Windows) : `attached`.
     - Hors Windows, le verrou est consultatif et ne peut pas être éprouvé : un verrou présent donne `unknown`, donc un refus.
5. **Envelopper le message** avec l'expéditeur et un nonce à usage unique.
6. **Codex : neutraliser les MCP** (`prepare`).
   - La commande `codex mcp list --json --disable plugins --disable apps` est lancée par le même exécutable, dans le dossier de la cible, en 60 s et 1 Mio au plus.
   - La sortie doit être un tableau d'objets dont chaque `name` est une clé TOML nue.
   - Si la liste n'est pas conforme, ou si son lancement échoue, la reprise n'est pas lancée. L'issue est `neutralization-failed`, `command-not-found`, `invalid-request` (`invalid-working-directory`) ou `cancelled`.
   - La reprise reçoit `--disable plugins --disable apps` et `-c mcp_servers.<nom>.enabled=false` pour chaque serveur. Une reprise sans ces options est impossible : c'est une erreur de programmation.
   - La reprise coupe aussi les mémoires, les hooks et `notify`.
7. **Lancer la CLI** (`runExternalProcess`) :
   - sans shell ;
   - avec l'environnement de l'hôte nettoyé (`CLAUDECODE`, `CLAUDE_CODE_*`, `CODEX_THREAD_ID`…), y compris quand un environnement est fourni explicitement ;
   - avec le message sur stdin, dans le dossier de la cible ;
   - avec un timeout dur et un plafond cumulé stdout + stderr (50 Mio par défaut). Le dépassement de l'un ou de l'autre provoque le kill de l'arbre de processus.

   Tous les timers sont annulés à la terminaison, et aucun kill n'est émis après `exit`.
8. **Interpréter la sortie.** On vérifie l'identité, la réponse et les refus certains de la CLI.

   Pour Claude, un succès exige un seul événement `result` de forme vérifiée : `subtype: "success"`, `is_error` strictement `false` et une réponse non blanche après `trim()`. La réponse rendue est le texte original. Toute autre forme est un échec, sans réponse rendue.

   Pour Codex, un succès exige :
   - un exit 0 ;
   - exactement un `turn.completed`, sans `turn.failed` ni `error` ;
   - un dernier `agent_message` textuel non blanc, rendu tel quel ;
   - un `thread.started` égal à la cible.

   Les refus `already has an active writer` (`target-busy`) et `no rollout found` (`session-not-found`) ne sont certains que si aucun `turn.started` n'a été émis.
9. **Chercher le nonce** dans l'historique de la cible.
10. **Rendre le résultat** : texte ou JSON, export, code de sortie.

**Diagnostic d'un lancement impossible** (`diagnoseLaunchFailure`). `ENOENT` ne prouve pas l'absence de l'exécutable, car Node le renvoie aussi quand le dossier de travail est absent. Le diagnostic suit donc cet ordre, à `codex mcp list` comme au lancement :

1. dossier absent : `invalid-working-directory` ;
2. code autre que `ENOENT` : échec de lancement ;
3. exécutable absent : `command-not-found` ;
4. sinon : échec de lancement.

Un échec de lancement donne `cli-failure` pour la reprise, et `neutralization-failed` pour `codex mcp list`. Dans les deux cas, la délivrance est `not-delivered`.

### Engagements et limites

- **Cible fermée seulement.** Le relay est refusé si un processus est attaché à la cible, ou si l'attachement ne peut pas être vérifié. `target-busy` veut dire « cible attachée », pas seulement « génération en cours ».
- **Réponse renvoyée à l'appelant, sans relay inverse.** La réponse sort seulement par le même appel : stdout ou `reply`, plus l'export. Palabre n'écrit rien dans la conversation de l'expéditeur. Un aller-retour est une suite d'appels explicites.
- **Perte d'outils pendant la reprise.** Ces options ne valent que pour le tour relayé, et aucune config n'est modifiée. La réponse peut donc différer de celle de la conversation habituelle.
  - Codex est relancé avec `--disable plugins --disable apps` et `mcp_servers.<nom>.enabled=false` : il perd ses plugins, ses connecteurs et ses serveurs MCP.
  - Claude est relancé avec `--strict-mcp-config` et `--tools Read,Glob,Grep` : il n'a ni MCP ni outil autre que la lecture.
- **Garanties conditionnelles**, y compris pour l'absence d'outils d'écriture. Formulation à reprendre telle quelle dans l'aide et la documentation :

  > « Avec les options imposées par Palabre et sur les versions de CLI vérifiées, la cible ne dispose d'aucun outil d'écriture, et les hooks et la commande `notify` non gérés sont neutralisés. Les serveurs MCP sont neutralisés sous réserve que la configuration ne change pas entre l'inspection et la reprise. Ces garanties ne couvrent ni les politiques administrées, ni les versions de CLI non vérifiées. »

  Les versions vérifiées sont listées dans la documentation et revérifiées par le smoke réel avant chaque release. Une version inconnue n'est pas bloquée, mais la garantie ne lui est pas étendue.
- **Historique du fournisseur modifié, même en lecture seule.**
  - Le relay ajoute à la conversation cible le message enveloppé, la réponse et les éventuels appels d'outils de lecture. Claude peut aussi ajouter un tour synthétique après une interruption.
  - Les CLIs écrivent leur propre état : registre, verrous, base d'état.
  - Ces écritures restent visibles après un échec, et Palabre ne peut pas les annuler. « Lecture seule » ne veut jamais dire « sans effet ».
- **Aucun retry automatique.** Un nonce n'est jamais réutilisé. Le statut de délivrance indique à l'appelant ce qu'il peut faire :
  - `not-delivered` : renvoyer est sans risque de doublon ;
  - `persisted-no-reply` : un renvoi dupliquerait le message ;
  - `unknown` : ne pas renvoyer sans vérification.
- **Limites observées en conditions réelles** (smoke A5, Claude Code 2.1.85 et Codex 0.151.0) :
  - Claude peut traiter le message relayé comme une injection de prompt et refuser de restituer son contexte. Le relay rend alors `replied` avec ce refus.
    - Le cadre opérateur (D22) lève ce refus avec 2.1.85.
    - Avec les versions qui ignorent un prompt système ajouté à la reprise (2.1.292), le cadre est sans effet. Un refus éventuel ne serait alors pas levé ;
  - le relay reprend le modèle enregistré dans la session Codex. Si ce modèle est refusé par le compte, l'issue est `cli-failure` avec `persisted-no-reply` ;
  - Claude Code ne garde pas forcément le modèle de création à la reprise : le modèle effectif est rapporté dans `observedModels`.

### Statuts de délivrance

| Statut | Condition |
| --- | --- |
| `replied` | Réponse capturée et identité `same-as-target` |
| `not-delivered` | Aucun processus lancé, ou issue qui exclut toute écriture : `invalid-request`, `command-not-found`, `session-not-found`, `target-busy`, `target-state-unknown`, `neutralization-failed`. Après lancement, seuls les refus documentés de la CLI donnent ces issues (`active writer`, `no rollout found`, `No conversation found`) |
| `persisted-no-reply` | Pas de réponse valide, mais le nonce figure dans une entrée utilisateur de l'historique |
| `unknown` | Tous les autres cas. L'absence du nonce ne prouve pas la non-délivrance |

**Une preuve de persistance l'emporte toujours.** Si le nonce est trouvé dans l'historique, la délivrance n'est jamais `not-delivered`, même si l'issue annonce un refus (par exemple `target-busy` après lancement). Elle devient `persisted-no-reply` (ou `replied`), et la preuve est conservée. La délivrance indiquée pour chaque issue dans le tableau des codes de sortie s'entend sous cette réserve.

`persisted` et `inActiveBranch` (`true`, `false` ou `unknown`) sont rapportés séparément, tels que lus, sans réécriture. Sans preuve, ils valent `false` si aucun processus n'a été lancé, `unknown` sinon. `inActiveBranch` est un diagnostic (heuristique non documentée pour Claude) et n'influence jamais le statut.

### Issues et codes de sortie

| Code | Issue (`status`) | Délivrance |
| --- | --- | --- |
| 0 | `replied` | `replied` |
| 1 | `internal-error` (défaut de Palabre) | `not-delivered` avant lancement, sinon `unknown` |
| 2 | `cli-failure`, `no-valid-reply`, `usage-limit`, `output-too-large` | `persisted-no-reply` ou `unknown` ; `not-delivered` si aucun processus n'a été lancé |
| 3 | `target-busy`, `target-state-unknown`, `neutralization-failed` | `not-delivered` |
| 4 | `timeout` | `persisted-no-reply` ou `unknown` |
| 5 | `identity-mismatch` | `persisted-no-reply` ou `unknown`. Le texte d'une autre session n'est jamais rendu comme `reply` |
| 6 | `session-not-found` | `not-delivered` |
| 7 | `command-not-found` : exécutable de la CLI cible introuvable | `not-delivered` |
| 8 | `invalid-request`, avec `error.reason` : `invalid-arguments`, `invalid-session-id`, `message-too-large`, `unknown-agent`, `unsupported-agent`, `config-untrusted`, `config-unavailable`, `unsupported-executable`, `invalid-working-directory` | `not-delivered` |
| 130 | `cancelled` (Ctrl+C) | `not-delivered` avant lancement, sinon `unknown` |

- `command-not-found` signale une installation à corriger, pas un défaut de Palabre. Le code 127 est écarté, car un shell le rend déjà quand `palabre` lui-même est introuvable.
- `output-too-large` signale une sortie qui dépasse le plafond cumulé stdout + stderr. La sortie partielle n'est jamais traitée comme une réponse.

La table est la source de `RELAY_EXIT_CODES` (`src/externalSessions/outcome.ts`). Toute modification passe par les deux.

### Sortie `--json` (v1)

Un seul objet JSON est écrit sur stdout, quelle que soit l'issue :

```json
{
  "v": 1,
  "type": "relay-result",
  "status": "replied",
  "exitCode": 0,
  "from": { "agent": "codex", "session": "<uuid>" },
  "to": { "agent": "claude", "session": "<uuid>", "provider": "claude" },
  "reply": "…",
  "delivery": { "status": "replied", "persisted": true, "inActiveBranch": true },
  "identity": "same-as-target",
  "observedModels": ["…"],
  "error": null,
  "exportPath": ".palabre/…relay.md",
  "durationMs": 12345
}
```

- `reply` n'est présent que pour `replied`.
- `error` contient `{ "kind", "message", "reason"? }` pour toute autre issue, et `kind` est égal à `status`.
- `exportPath` vaut `null` avec `--no-export`, ou si l'issue précède toute exécution.
- La politique de version est celle du renderer NDJSON.
- En sortie texte, la réponse va sur stdout. L'issue et les erreurs vont sur stderr, assainies par `sanitizeTerminalText`.
- L'export `.relay.md` contient l'expéditeur, la cible (avec les identifiants de session), le message, la réponse ou l'issue, et la délivrance.

### Hors périmètre de cette version

- Le fork d'une conversation.
- `codex queue`.
- La détection automatique de l'expéditeur.
- Les desktops et IDE.
- Les conversations ouvertes.
- Les chaînes de relay et le retry.
- Palabre-vscode, qui consommera `--json` sans recalculer l'état.

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

`--subject` est le nom long recommande pour le sujet. `-s` est l'alias court, et `--topic` reste accepte pour compatibilite. Si le premier argument positionnel est un preset connu, il devient `--preset`. Le positionnel suivant devient le sujet. Un sujet positionnel doit contenir plusieurs mots ; pour un seul mot, utiliser `-s "mot"` afin d'eviter toute ambiguite avec une commande ou un preset. Une faute qui ressemble fortement a une commande connue (`nex` pour `new`, par exemple) produit une erreur de commande inconnue.

Ces formes courtes suivent le mode effectif, `--mode` puis `defaults.mode`, exactement comme `palabre run` (#104). La décision vit dans `src/launchDispatch.ts` : `isDirectChatLaunch` envoie vers Chat toute commande `run` qui n'ouvre pas l'accueil TUI (`shouldOpenTuiHome`) quand ce mode est `chat`. Le lancement nu garde l'accueil et son mode par défaut. Un preset en mode Chat est refusé avec un diagnostic ciblé (`chat.presetUnsupported`), plutôt qu'ignoré ou signalé comme « mode inconnu ». Les chemins Chat gardent le refus de `--dry-run`.

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
| `error` | erreur runtime structurée pendant le debat, ask, la synthese ou Chat | `phase` (`debate`, `ask`, `summary` ou `chat`), `kind`, `message`, optionnels `agent`, `role`, `turn` (hors Chat), `action` (Chat : `send`, `consult` ou `end`), `retryAfter`, `details` |
| `done` | fin de session ; export ecrit quand demande | `outputPath` (`null` si Chat se termine sans `/end`, ou si l'export partiel échoue après une erreur) |

En mode Chat avec `--renderer ndjson`, les integrations pilotent stdin avec
une ligne JSON par action. Le contrat d'entree v1 accepte :

```json
{"v":1,"type":"chat-send","content":"Message, y compris sur plusieurs lignes"}
{"v":1,"type":"chat-consult","agent":"vibe"}
{"v":1,"type":"chat-use","agent":"codex"}
{"v":1,"type":"chat-agents"}
{"v":1,"type":"chat-end"}
```

Les commandes texte historiques restent acceptees pour les terminaux. Une
integration doit utiliser les entrees structurees afin de conserver les sauts
de ligne et de ne pas confondre le contenu utilisateur avec une commande slash.
`chat-user-message` est emis dès acceptation du message, avant
`thinking-start`, afin que les clients puissent l'afficher immediatement.

Cycle de vie de Chat (#101) :

- une ligne vide ou d'espaces est ignorée (`parseChatInputLine` rend `blank`), en NDJSON comme en terminal : un séparateur accidentel ne ferme jamais Chat. La TUI (`src/tuiChat.ts`) ignore aussi une saisie vide depuis #103 ;
- `chat-end` / `/end` exporte puis émet `done` avec le chemin ; `/exit`, `/quit`, `/home` et la fin de stdin terminent sans export (`done` avec `null`). Aucun export automatique sur EOF ;
- après `start`, une erreur runtime émet `error` (`ChatFailure` : `phase: "chat"`, `action` `send` | `consult` | `end`, `agent`, `role`, `kind`, `message`, `retryAfter`, `details`), puis écrit l'export partiel et émet exactement un `done` avec son chemin, ou `null` sans transcript ou si l'export échoue. `error` précède l'export, qui peut être lent. Code de sortie 1, ou 130 si annulée. L'erreur n'est pas relancée : rien n'est écrit hors du flux. `ChatFailure` est distinct de `DebateFailure` ; les deux partagent la classification `classifyRuntimeError` (`src/runtimeFailure.ts`) ;
- l'annulation interrompt aussi l'attente d'une ligne : l'abort ferme la lecture de stdin (listener retiré en fin de session), puis la même terminaison s'applique avec `kind: "cancelled"`. Au repos, l'erreur ne porte ni `action` ni `agent` : elle n'est jamais attribuée à la dernière action terminée. Ce comportement vaut pour le NDJSON ; le parcours terminal n'est pas modifié ;
- le rôle annoncé pour une consultation (`chat-consultation-start`, `thinking-start`, `error`) vient de `ChatSession.agentConfig`, qui applique les overrides runtime (`--role-a`), et non du rôle brut de la config. L'indicateur d'attente de la TUI utilise la même source depuis #103 ;
- `--dry-run` est refusé en Chat (`chat`, `run --mode chat`, TUI) avant toute lecture de stdin, tout événement, appel agent ou export. Aucune prévisualisation Chat n'existe pour l'instant.

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

Le contrat proposé pour Relay vers une conversation ouverte (#96, B1) et son lecteur hors ligne
vivent dans `scripts/prototypes/relay/CONTRAT-B1.md`, `open-response.ts` (corrélation pure) et
`open-rollout.ts` (lecture positionnelle bornée d'un fichier explicitement fourni). Ils ne sont
pas appelés par la CLI et ne lancent aucun agent. `pnpm test:relay-open` compile et teste ce prototype
avec des historiques en mémoire ou fichiers temporaires factices ; la commande est incluse dans
`pnpm test` et la CI. Elle ne lance pas les sondes locales `open-*.mjs`, qui consomment des quotas.
Le contrat Relay A reste inchangé.

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

Le relay a son propre smoke réel, lui aussi hors `pnpm test`, à lancer après `pnpm build` avant une publication qui touche `palabre relay` :

```bash
pnpm smoke:real-relay
```

`scripts/smoke_real_relay.ts` crée deux sessions **jetables**, une Claude Code et une Codex, dans un dossier temporaire, puis vérifie :
- la réponse d'une cible fermée, avec contexte conservé, délivrance, identité et export ;
- le refus d'une cible attachée, avec un TUI ouvert dans un pseudo-terminal et l'historique inchangé ;
- la neutralisation MCP de Codex (journaux d'une reprise témoin comparés à ceux du relay) ;
- l'outillage de Claude annoncé par `system/init` ;
- les versions des CLIs.

Modèles de création :
- `PALABRE_SMOKE_CLAUDE_MODEL` (haiku par défaut) ;
- `PALABRE_SMOKE_CODEX_MODEL` (modèle de la config Codex par défaut). À fixer si ce modèle est refusé par le compte.

Effets de bord, tous sur des données jetables :
- les sessions créées restent dans l'historique des CLIs ;
- l'approbation de la config temporaire est ajoutée à `~/.palabre/trusted-configs.json` ;
- la reprise témoin démarre les serveurs MCP de l'utilisateur.

La trace, avec les identifiants de session, est écrite dans `.tmp/relay-smoke/`.

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
- `update --check` et `update --dry-run`, avec plan adapte au canal source/npm/pnpm/Yarn/Bun
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

Le script `scripts/sync_docs.py` valide et copie les pages `docs/guide/fr` et `docs/guide/en` vers les formats numerotes `content/fr` et `content/en` de palabre-web. Ne pas recreer de logique qui devine les descriptions depuis le contenu : elles doivent etre explicites dans le frontmatter.

- `README.md` pour l'etat du MVP, les commandes principales, les limites connues et les liens de documentation.
- `AGENTS.md` pour les decisions d'architecture, les workflows contributeur et les consignes de maintenance.
- `CHANGELOG.md` pour les changements notables par version. Toute release CLI doit y ajouter une entree datee avant le bump/tag, avec les sections utiles (`Added`, `Changed`, `Fixed`, `Removed`, `Security`).
- `docs/guide/fr/**.md` pour les guides utilisateur francais. Ces pages utilisent le meme format que palabre-web/Nuxt Content : frontmatter `title` + `description`, puis contenu sans H1 de page. La traduction anglaise vit dans `docs/guide/en/**.md`.
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
- `.github/workflows/release-social.yml` : reprise manuelle ciblée du post Bluesky pour un tag déjà publié, sans republier npm ni recréer la release.

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
8. pousse `public/version.json` dans le repo `JuReyms/palabre-web` (branche `dev`) ;
9. cree une PR `dev -> main` dans palabre-web, ou commente la PR deja ouverte, puis expose son lien dans le resume du workflow. La fusion manuelle de cette PR declenche le build Netlify de production et met a jour le badge de version.

Les workflows de release et de synchronisation documentaire recréent la branche `dev` de `palabre-web` depuis `main` lorsqu'elle a été supprimée après fusion. Si le workflow principal s'interrompt après la publication npm mais avant le post social, ne jamais republier le même tag : déclencher manuellement `release-social.yml` avec le tag existant.

### Npm Trusted Publishing

Le package npm `palabre` doit etre configure cote npm avec un Trusted Publisher GitHub Actions :

- Repository owner: `JuReyms`
- Repository name: `Palabre`
- Workflow filename: `release.yml`
- Environment: laisser vide, sauf si le workflow ajoute explicitement `environment: ...`

Ne pas stocker de `NPM_TOKEN` dans GitHub et ne pas publier depuis la machine locale pour les releases normales. Si une publication manuelle d'urgence est faite, supprimer le token local avec `npm config delete //registry.npmjs.org/:_authToken` juste apres.

## Sync documentation (palabre-web)

Le repo CLI est public. Le site de documentation (`JuReyms/palabre-web`, Nuxt SSG sur Netlify) recoit les mises a jour via deux workflows GitHub Actions qui poussent directement dans la branche `dev` de palabre-web. Netlify produit depuis `main` : le workflow de release cree ou rappelle donc une PR `dev -> main`, dont la fusion reste manuelle.

Les deux workflows utilisent le secret `DOCS_REPO_TOKEN` (PAT fine-grained sur `JuReyms/palabre-web` uniquement). Il exige `Contents = Read and write` pour la synchronisation et `Pull requests = Read and write` pour proposer le deploiement de production.

### Workflow sync-docs.yml

Declenche sur tout push dans `docs/guide/fr/**`, `scripts/sync_docs.py` ou le workflow lui-meme vers `main`.

Les pages source utilisent le meme format que palabre-web/Nuxt Content : frontmatter `title` + `description`, puis contenu sans H1 de page. Le workflow appelle `scripts/sync_docs.py`, qui valide ce format et copie les pages vers `content/fr/**` dans palabre-web.

Convention i18n :

- francais actif : `docs/guide/fr/**` -> `content/fr/**` ;
- anglais : `docs/guide/en/**` -> `content/en/**`.

Ne pas recreer de logique qui devine les descriptions depuis le contenu. Les descriptions doivent rester explicites dans le frontmatter.

**Contrainte critique** : ne jamais utiliser `rm -rf palabre-web/content/*` dans le step de copie. `content/index.md` (landing page) n'est pas dans la sync et ne doit pas etre supprime — sans lui, la collection `landing` de Nuxt Content est vide, la route `/` retourne 404 et le build Netlify echoue. Le step de copie doit se limiter a `cp -R dist/content/. palabre-web/content/`.

Pour ajouter une page de documentation, ajouter les versions `fr` et `en` dans le meme changement :

1. Creer le fichier source dans la section adaptee de `docs/guide/fr/`.
2. Ajouter la ligne correspondante dans `ROUTE_MAP` de `scripts/sync_docs.py`.
3. Verifier localement avec `python scripts/sync_docs.py`.
4. Si la page ajoute une nouvelle section, creer ou adapter la navigation correspondante dans palabre-web (`content/fr/**/.navigation.yml`).

Attention aux liens internes : ne pas utiliser de liens relatifs (`./autre-page.md`) dans les sources `docs/guide/fr/`. Utiliser des URLs absolutes correspondant aux routes finales du site (`/fr/get-started/...`, `/fr/agents/...`, `/fr/usage/...`, `/fr/configuration/...`, `/fr/reference/...`).
### Workflow release.yml (step de sync)

A chaque release, apres la creation de la release GitHub, le workflow ecrit :

```json
{ "tag_name": "vX.Y.Z" }
```

dans `public/version.json` de palabre-web. Le composable `useLatestRelease.ts` de palabre-web lit ce fichier local au lieu d'appeler l'API GitHub — ce qui evite au site de documentation d'appeler l'API GitHub a chaque affichage.

### Nommage des versions

Suivre semver :

- `patch` : correction de bug, ajustement mineur sans impact sur les commandes.
- `minor` : nouvelle fonctionnalite retro-compatible.
- `major` : changement cassant de l'interface CLI ou du format de config.

## Issues GitHub

Les titres, descriptions et commentaires des issues et pull requests doivent etre rediges en francais. Les messages de commit, y compris ceux produits par les workflows automatises, doivent egalement etre en francais. Les identifiants techniques et les noms de branches peuvent rester en anglais.

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
