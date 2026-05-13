# AGENTS.md

Ce fichier guide les agents et contributeurs qui travaillent dans ce depot.

## Vision

Palabre est un meta-CLI qui orchestre un debat entre plusieurs agents IA. Le produit cible des utilisateurs deja a l'aise avec le terminal, ayant installe et configure leurs outils IA locaux : Codex CLI, Claude CLI, Ollama, ou equivalents.

Le principe d'architecture important : Palabre orchestre des adapters. Claude, Codex et Ollama ne doivent pas etre codes comme des cas speciaux dans le moteur de debat.

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
src/index.ts              CLI entrypoint
src/new.ts                Assistant interactif `palabre new`
src/config.ts             Chargement et generation de config
src/discovery.ts          Detection locale des CLIs et d'Ollama pendant init
src/types.ts              Contrats partages
src/prompt.ts             Rendu des prompts agent
src/orchestrator.ts       Boucle de debat ping-pong
src/output.ts             Export Markdown
src/renderers/console.ts  Rendu console pretty/plain
src/adapters/index.ts     Factory d'adapters
src/adapters/cli.ts       Adapter CLI minimal
src/adapters/ollama.ts    Adapter Ollama HTTP
docs/roadmap.md           Roadmap interne locale non versionnee
docs/notes.md             Notes personnelles du mainteneur
docs/guide/fr/            Guides utilisateur francais organises par parcours
docs/archive/             Documents historiques
```

## Concepts

### Agent

Un agent est une entree nommee dans une config Palabre. La resolution cherche `./palabre.config.json`, puis `./chicane.config.json`, puis `~/.palabre/palabre.config.json`, puis `~/.palabre/chicane.config.json`. Toute nouvelle doc ou nouvelle config doit utiliser `palabre.config.json`.

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
- `ollama` : appelle `POST /api/chat` sur une instance Ollama.

Types envisages :

- `cli-pty` : adapter robuste pour les CLIs interactives.
- `api` : adapter HTTP direct pour les utilisateurs qui veulent connecter une API payante.

Chaque adapter expose aussi un `contract` :

- `capabilities` : mode (`batch`, `http`, `pty`), support du model override, acces filesystem, streaming, exit code, stderr.
- `guarantees` : rejet des sorties vides, des timeouts, des exit codes non nuls, retour du raw output.

L'orchestrateur doit s'appuyer sur ce contrat plutot que sur des exceptions implicites par adapter. Les erreurs connues doivent utiliser `AdapterError` avec un `kind` stable.

### Preset

Un preset choisit une paire d'agents. Il ne choisit pas les modeles. La source de verite est `src/presets.ts`.

Presets CLI ↔ CLI (12) :

- `codex-claude`, `claude-codex`
- `codex-gemini`, `gemini-codex`
- `codex-opencode`, `opencode-codex`
- `claude-gemini`, `gemini-claude`
- `claude-opencode`, `opencode-claude`
- `gemini-opencode`, `opencode-gemini`

Presets CLI ↔ Ollama local (8) :

- `codex-ollama`, `ollama-codex`
- `claude-ollama`, `ollama-claude`
- `gemini-ollama`, `ollama-gemini`
- `opencode-ollama`, `ollama-opencode`

Total : 20 presets. Toute paire X-Y a sa variante inversee Y-X. La variante inversee differe surtout par "qui parle en premier" — les roles restent ceux configures dans la config utilisateur, pas determines par la position.

Les modeles restent ceux des CLIs ou de la config, sauf override explicite par `--model-a` ou `--model-b`.

A chaque ajout de preset dans `src/presets.ts`, refleter dans cette section. L'extension VS Code (`Palabre-vscode`) consomme `palabre presets --json` au demarrage et n'a donc plus besoin d'etre synchronisee manuellement.

### Commande `palabre presets`

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

Les roles ne sont pas decoratifs. Ils ajoutent une consigne de role dans les prompts et pourront guider plus tard les modes d'orchestration.

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
- Garder le coeur CLI simple avant de construire la TUI.
- Garder la config en JSON pour le MVP. YAML peut venir plus tard.
- Eviter les dependances UI tant que l'orchestration n'est pas stable.
- Exporter chaque session en `.debate.md` dans un dossier `.palabre/` par défaut pour éviter de polluer la racine du projet.
- Ne pas supposer que Claude/Codex ont une API stable : les CLIs interactives doivent etre isolees derriere un adapter.

## Init et discovery

`palabre init` utilise `src/discovery.ts` pour detecter :

- `codex`
- `claude.exe` puis `claude` sur Windows, `claude` ailleurs
- `gemini`
- `ollama`
- l'API Ollama locale via `GET http://localhost:11434/api/tags`

La config generee conserve les blocs agents connus pour rester editable, mais ajuste `defaults.agentA` et `defaults.agentB` avec une paire detectee quand c'est possible. Au lancement, Palabre ne doit pas utiliser de fallback agent code en dur : sans preset, sans agents explicites et sans defaults de config, il doit afficher une erreur actionnable.

Le defaut produit doit favoriser les agents CLI premium : `codex <-> claude` quand disponible. Ollama reste configure et accessible via presets, mais il est plutot destine aux power users ou aux roles locaux (`critic`, `scout`, `summarizer`). Les defaults utilisateur se gerent par `palabre config`, `palabre config --set-defaults <agentA> <agentB>` et `palabre config --clear-defaults`.

## New

`palabre new` est l'assistant interactif de composition d'un debat. Il detecte les outils locaux via `src/discovery.ts`, liste les agents de la config en mettant les agents detectes en premier, demande le sujet, puis laisse lancer avec les defaults ou ouvrir les options avancees.

Le mode avance couvre les options courantes : tours, modeles bruts, synthese, contexte, fichiers, `--show-prompt` et `--plain`. Garder le wizard comme une couche UX fine au-dessus du parser existant : il doit remplir les memes flags que la CLI directe, pas creer un second chemin d'execution.

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

- Codex : `codex exec ... -`
- Claude : `claude --print`
- Gemini : `gemini --prompt -`

Sur Windows, garder `"shell": true` pour les wrappers npm ou executables shimmes quand `spawn` retourne `EPERM` ou `EINVAL`. Pour Claude Code, preferer `claude.exe` avec `"shell": false`, car `stdin` est capture correctement dans ce mode.

Il supporte :

- `command`
- `args`
- `promptMode: "stdin" | "argument"`
- `timeoutMs`
- `idleTimeoutMs`
- `shell`
- `allowEmptyOutput`

`idleTimeoutMs` doit rester optionnel pour les CLIs IA en mode batch. Certains modeles peuvent rester silencieux longtemps avant d'ecrire leur reponse ; dans ce cas, le timeout dur `timeoutMs` est le garde-fou principal.

Erreurs connues classees :

- `command-not-found`
- `spawn-failed`
- `timeout`
- `idle-timeout`
- `empty-output`
- `non-zero-exit`

Il ne supporte pas encore :

- sessions interactives persistantes ;
- PTY ;
- detection fiable de fin de reponse ;
- confirmations interactives ;
- capture propre des interfaces riches.

La prochaine evolution importante est de creer un adapter PTY distinct plutot que de gonfler l'adapter minimal.

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

Au `palabre init`, si Ollama expose déjà des modèles installés via `/api/tags`, la config générée choisit le modèle installé en priorité (en conservant `nemotron-3-nano:4b` s'il est présent). Sinon, elle retombe sur `nemotron-3-nano:4b` comme fallback léger. Eviter les gros modeles dans les tests automatises ou repetes.

Erreurs connues classees :

- `model-unavailable`
- `model-pull-failed`
- `http-error`
- `empty-output`

## Orchestration

Le moteur actuel alterne simplement entre deux agents pendant `turns` tours :

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

### Arret anticipe

Par defaut, `--turns` est une limite haute entre 1 et 20 reponses. `runDebate` peut arreter le debat apres un tour complet quand le dernier message contient un signal d'accord explicite, par exemple `accord complet`, `aucun desaccord`, `rien a trancher` ou `rien a ajouter`.

Le flag `--no-early-stop` force tous les tours demandes. Garder cette heuristique prudente : elle ne doit pas remplacer une vraie evaluation semantique tant que le MVP reste simple.

### Synthese finale

La synthese finale est activee par defaut. Elle utilise `defaults.summaryAgent` quand il existe, sinon `agentB`. `--summary-agent` garde la priorite.

Options :

- `--summary-agent <name>` : agent de config utilise apres le debat, prioritaire sur `defaults.summaryAgent`.
- `--summary-model <model>` : modele brut transmis a l'agent de synthese.
- `--no-summary` : desactive la phase de synthese.

Le prompt de synthese est un mode dedie dans `formatAgentPrompt` (`mode: "summary"`). Il recoit le sujet, les fichiers de contexte et tout le transcript. Il demande quatre sections: consensus, desaccords/incertitudes, actions proposees, puis une conclusion courte en prose.

### Contexte de session

Chaque prompt recoit un bloc `Contexte de session Palabre` construit au lancement :

- source explicite : fourni par Palabre et visible par tous les agents ;
- date locale ;
- fuseau horaire ;
- dossier courant ;
- horodatage de debut de session.

Ce contexte doit rester petit et factuel. Il sert a eviter que les agents comparent des contextes implicites differents, par exemple sur la date, le fuseau horaire ou le dossier courant.

## Contexte projet

Le MVP fournit deux entrees de contexte :

- `--files <paths...>` : fichiers texte explicites, mode strict.
- `--context <paths...>` : fichiers ou dossiers texte, mode tolerant avec warnings.

Important :

- Les agents `cli` sont executes depuis le dossier courant. Codex, Claude ou Gemini peuvent donc inspecter le workspace si leur CLI le permet.
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

`--show-prompt` affiche le prompt exact du premier tour, puis termine sans appeler d'agent. Les tours suivants ne peuvent pas etre connus sans executer le debat, car ils dependent du transcript reel.

## Internationalisation

La langue de l'interface CLI est resolue via `src/i18n.ts` avec la precedence suivante :

1. `--language <fr|en>` ou alias `--lang <fr|en>` ;
2. variable d'environnement `PALABRE_LANGUAGE` ;
3. champ racine `language` dans `palabre.config.json` ;
4. fallback `fr`.

`language` controle l'interface Palabre, pas encore la langue demandee aux agents. Garder cette separation nette : une future option `debateLanguage` pourra guider les prompts sans forcer la langue de l'interface.

Les messages traduisibles vivent dans `src/messages/`, decoupes par domaine (`common`, `doctor`, `help`, `init`, `agents`, `config`, `presets`, `update`, etc.). Ajouter les nouvelles surfaces par lots coherents plutot que melanger traduction et refactor large. `palabre doctor`, `palabre help`, `palabre init`, `palabre agents`, `palabre config`, `palabre presets` et `palabre update` sont migrees vers le dictionnaire FR/EN.

## Syntaxe CLI courte

Le parser accepte deux formes equivalentes pour lancer un debat :

```bash
palabre run --preset claude-gemini --subject "quel jour sommes nous ?" --turns 4
palabre claude-gemini "quel jour sommes nous ?" -t 4
palabre -s "quel jour sommes nous ?" -t 2
```

`--subject` est le nom long recommande pour le sujet. `-s` est l'alias court, et `--topic` reste accepte pour compatibilite. Si le premier argument positionnel est un preset connu, il devient `--preset`. Le positionnel suivant devient le sujet. Si le premier argument n'est pas un preset ni une commande (`init`, `update`, `help`, etc.), il devient directement le sujet, sauf s'il ressemble fortement a une commande connue (`nex` pour `new`, par exemple), auquel cas Palabre affiche une erreur de commande inconnue.

## Rendu Console

`src/renderers/console.ts` contient le premier rendu TUI leger :

- `PrettyConsoleRenderer` : en-tete, separateurs, tours, synthese structuree, couleurs ANSI si TTY.
- `PlainConsoleRenderer` : rendu historique compatible logs.
- Etat "agent en cours" pendant les appels longs en rendu pretty.

Le flag `--plain` force le rendu simple. `NO_COLOR` desactive les couleurs sans changer la structure.

Ce n'est pas encore le vrai TUI interactif : pas de split-view, pas de scrolling controle, pas d'input humain pendant le debat.

## Renderer NDJSON

`src/renderers/ndjson.ts` fournit un renderer machine-readable pour les integrations out-of-process : extension VS Code Palabre-vscode, plugin Obsidian, scripts shell, replay. Le rendu humain reste assure par les renderers console.

### Activation

Trois facons equivalentes :

```bash
palabre run --preset codex-claude -s "..." --renderer ndjson
palabre run --preset codex-claude -s "..." --json
palabre codex-claude "..." --json -t 4
```

Precedence des flags : `--renderer` > `--json` > `--plain` > defaut (pretty si TTY, plain sinon). `--renderer <kind>` accepte `auto | pretty | plain | ndjson`. Une valeur inconnue leve une erreur listant les choix supportes.

### Contrat de sortie

- toute la sortie va sur **stdout** ;
- une ligne = un evenement JSON valide, termine par `\n` ;
- chaque evenement porte un champ `v` (entier) pour le versioning ; la version courante est `v=1` ;
- stderr reste libre pour les messages bas niveau (Node, shell, erreurs adapter remontees comme exceptions) que les consommateurs agregent comme ils veulent.

### Schema v1

Types d'evenements emis aujourd'hui :

| Type | Quand | Champs |
| --- | --- | --- |
| `start` | une fois, au demarrage du debat | `topic`, `turns`, `agents[]` (`name`, `role`, `type`), `summaryEnabled`, `summaryAgent`, `earlyStop`, `filesCount`, `session` (`startedAt`, `localDate`, `timeZone`, `cwd`) |
| `notice` | message informatif | `message` |
| `warning` | avertissement | `message` |
| `turn-start` | debut d'un tour | `turn`, `totalTurns`, `agent`, `role` |
| `thinking-start` | agent en cours de generation | `agent`, `role` |
| `thinking-end` | fin de generation | (aucun) |
| `message` | contenu d'un message de debat | `turn`, `agent`, `role`, `content` |
| `summary-start` | debut de la synthese finale | `agent`, `role` |
| `summary-message` | contenu de la synthese | `agent`, `role`, `content` |
| `done` | export du `.debate.md` ecrit | `outputPath` |

Exemple de session minimale :

```json
{"v":1,"type":"start","topic":"...","turns":2,"agents":[{"name":"codex","role":"implementer","type":"cli"},{"name":"claude","role":"reviewer","type":"cli"}],"summaryEnabled":true,"summaryAgent":"claude","earlyStop":true,"filesCount":0,"session":{"startedAt":"...","localDate":"...","timeZone":"...","cwd":"..."}}
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

### Politique de versioning

- ajout d'un nouveau type d'evenement ou d'un nouveau champ optionnel : **compatible v1**, pas de bump de `v` ;
- suppression d'un type ou d'un champ obligatoire, renommage, changement de semantique : **breaking**, bump `v` a `2`, documenter la migration ici ;
- les consommateurs doivent ignorer les champs inconnus et les types inconnus plutot que crasher.

### Limites actuelles

- pas d'evenement `agent-chunk` : le rendu Palabre est par message complet, pas par token. Le streaming token-par-token necessitera un changement de contrat `DebateRenderer` cote orchestrateur, pas seulement le renderer.
- pas d'evenement `error` : les erreurs d'adapter remontent comme exceptions non capturees par le renderer. Les consommateurs out-of-process recuperent l'exit code != 0 + stderr.
- pas d'evenement `early-stop` distinct : la fin du debat se voit par l'absence de nouveaux `turn-start` avant le `summary-start` ou le `done`.

Ces points sont a evaluer au cas par cas si un consommateur reel les demande. Eviter de speculer.

## Tests et verification

Avant de livrer une modification :

```bash
pnpm check
pnpm test
pnpm build
```

Quand un changement touche l'adapter CLI, lancer `pnpm test`. Ces tests compilent `src/` et `tests/` via `tsconfig.test.json` dans `.tmp/test-dist`, puis utilisent `node:test` avec des CLIs mockees. Garder les tests automatises sous `tests/` et completer par un smoke test manuel avec une vraie CLI seulement quand le comportement depend d'un outil externe.

Les erreurs CLI doivent rester actionnables. En particulier, les limites d'usage et quotas Codex/Claude/Gemini doivent etre classees comme `usage-limit` et ne pas recopier tout le prompt ou les logs bruts dans le message utilisateur.

Quand un changement touche Ollama, verifier que l'erreur est lisible si Ollama n'est pas lance ou si le modele manque.

Combinaisons validees localement :

- `ollama ↔ ollama` avec `gemma4:e4b`
- changement Ollama `nemotron-3-nano:4b` vers `gemma4:e4b` avec dechargement de l'ancien modele
- `codex exec ↔ ollama`
- `claude --print ↔ ollama`
- `gemini --prompt - ↔ ollama`
- `codex exec ↔ claude --print`
- `--show-prompt` avec `--files`
- `--show-prompt` avec `--context docs`
- `palabre new` simule par entree standard avec `--show-prompt` pour verifier le wizard sans appeler d'agent
- contexte de session visible dans `--show-prompt`
- arret anticipe sur accord clair
- syntaxe courte `palabre preset "sujet" -t 4`
- alias sujet `palabre -s "sujet" -t 2`
- detection des limites d'usage CLI type Codex/Claude/Gemini par simulation stderr
- `init` avec config globale et `init --local` dans un dossier temporaire pour verifier la detection locale
- `update` en mode instructions
- etat "agent en cours" en rendu pretty
- synthese finale avec `defaults.summaryAgent`, fallback agent B
- `--no-summary`
- erreurs adapter `empty-output`, `non-zero-exit`, `model-unavailable`
- warning Ollama sans contexte
- rendu console pretty et `--plain`

Ces tests ont confirme que le mode batch est deja exploitable avant l'adapter PTY.

## Documentation

La documentation doit rester a jour dans le meme changement que le code. Avant de finaliser une modification, verifier les fichiers concernes :

Le script `scripts/sync_docs.py` valide et copie les pages `docs/guide/fr` et `docs/guide/en` vers les formats numerotes `content/fr` et `content/en` de Palabre-app. Ne pas recreer de logique qui devine les descriptions depuis le contenu : elles doivent etre explicites dans le frontmatter.

- `README.md` pour l'etat du MVP, les commandes principales, les limites connues et les liens de documentation.
- `AGENTS.md` pour les decisions d'architecture, les workflows contributeur et les consignes de maintenance.
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

## Releases

Les releases sont gerees via des tags Git. Deux workflows GitHub Actions sont en place :

- `.github/workflows/ci.yml` : type check + tests + build sur chaque push `main` et chaque PR.
- `.github/workflows/release.yml` : type check + tests + build + pack + publication npm via Trusted Publishing + creation de release GitHub sur chaque tag `v*`.

### Creer une release

```bash
# Bumper la version dans package.json et creer le tag Git
pnpm version patch   # ou minor / major
git push && git push --tags
```

`pnpm version` met a jour `package.json`, cree un commit de version et un tag `vX.Y.Z`. Le push du tag declenche le workflow `release.yml` qui :

1. installe les dependances (`--frozen-lockfile`) ;
2. verifie les types (`pnpm check`) ;
3. lance les tests automatises (`pnpm test`) ;
4. compile (`pnpm build`) ;
5. pack un tarball npm (`pnpm pack`) ;
6. publie sur npm via Trusted Publishing (`npm publish --access public --provenance`) sans token npm stocke dans GitHub ;
7. cree une release GitHub avec le tarball en artifact et les notes generees depuis les commits ;
8. pousse `public/version.json` dans le repo `JuReyms/Palabre-app` (branche `dev`), ce qui declenche un rebuild Netlify et met a jour le badge de version sur le site de documentation.

### Npm Trusted Publishing

Le package npm `palabre` doit etre configure cote npm avec un Trusted Publisher GitHub Actions :

- Repository owner: `JuReyms`
- Repository name: `Palabre`
- Workflow filename: `release.yml`
- Environment: laisser vide, sauf si le workflow ajoute explicitement `environment: ...`

Ne pas stocker de `NPM_TOKEN` dans GitHub et ne pas publier depuis la machine locale pour les releases normales. Si une publication manuelle d'urgence est faite, supprimer le token local avec `npm config delete //registry.npmjs.org/:_authToken` juste apres.

## Sync documentation (Palabre-app)

Le repo CLI est public. Le site de documentation (`JuReyms/Palabre-app`, Nuxt SSG sur Netlify) recoit les mises a jour via deux workflows GitHub Actions qui poussent directement dans la branche `dev` de Palabre-app. Netlify detecte le push et rebuild automatiquement.

Les deux workflows utilisent le secret `DOCS_REPO_TOKEN` (PAT fine-grained, `Contents = Read and write` sur `JuReyms/Palabre-app` uniquement).

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

## Style de contribution

- Preferer des changements petits et comprehensibles.
- Ne pas melanger TUI, PTY et extension VS Code dans le meme changement.
- Garder les adapters independants du moteur d'orchestration.
- Documenter les limites connues plutot que de masquer les heuristiques.
- Eviter les abstractions prematurees, sauf quand elles gardent les adapters propres.
