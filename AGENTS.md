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
docs/roadmap.md           Roadmap projet maintenue
docs/notes.md             Notes personnelles du mainteneur
docs/guide/               Guides utilisateur
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

Un preset choisit une paire d'agents. Il ne choisit pas les modeles :

- `codex-claude`
- `claude-codex`
- `codex-ollama`
- `claude-ollama`
- `gemini-ollama`
- variantes inversees et combinaisons Codex/Claude/Gemini

Les modeles restent ceux des CLIs ou de la config, sauf override explicite par `--model-a` ou `--model-b`.

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
- Exporter chaque session en `.debate.md`.
- Ne pas supposer que Claude/Codex ont une API stable : les CLIs interactives doivent etre isolees derriere un adapter.

## Init et discovery

`palabre init` utilise `src/discovery.ts` pour detecter :

- `codex`
- `claude.exe` puis `claude` sur Windows, `claude` ailleurs
- `gemini`
- `ollama`
- l'API Ollama locale via `GET http://localhost:11434/api/tags`

La config generee conserve les blocs agents connus pour rester editable, mais ajuste `defaults.agentA` et `defaults.agentB` avec une paire detectee quand c'est possible. Si aucune paire fiable n'est detectee, les defaults d'exemple restent en place.

Le defaut produit doit favoriser les agents CLI premium : `codex <-> claude` quand disponible. Ollama reste configure et accessible via presets, mais il est plutot destine aux power users ou aux roles locaux (`critic`, `scout`, `summarizer`).

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

Par defaut local, preferer un modele leger comme `nemotron-3-nano:4b` pour les tests. Eviter les gros modeles dans les tests automatises ou repetes.

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
6. Export Markdown final.

Les futures evolutions possibles :

- intervention humaine ;
- criteres d'arret ;
- modes a trois agents ;
- budgets de tours par role.

### Arret anticipe

Par defaut, `--turns` est une limite haute. `runDebate` peut arreter le debat apres un tour complet quand le dernier message contient un signal d'accord explicite, par exemple `accord complet`, `aucun desaccord`, `rien a trancher` ou `rien a ajouter`.

Le flag `--no-early-stop` force tous les tours demandes. Garder cette heuristique prudente : elle ne doit pas remplacer une vraie evaluation semantique tant que le MVP reste simple.

### Synthese finale

La synthese finale est activee par defaut. Elle utilise `defaults.summaryAgent` quand il existe, sinon `agentB`. `--summary-agent` garde la priorite.

Options :

- `--summary-agent <name>` : agent de config utilise apres le debat, prioritaire sur `defaults.summaryAgent`.
- `--summary-model <model>` : modele brut transmis a l'agent de synthese.
- `--no-summary` : desactive la phase de synthese.

Le prompt de synthese est un mode dedie dans `formatAgentPrompt` (`mode: "summary"`). Il recoit le sujet, les fichiers de contexte et tout le transcript.

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

## Syntaxe CLI courte

Le parser accepte deux formes equivalentes pour lancer un debat :

```bash
palabre run --preset claude-gemini --subject "quel jour sommes nous ?" --turns 4
palabre claude-gemini "quel jour sommes nous ?" -t 4
palabre -s "quel jour sommes nous ?" -t 2
```

`--subject` est le nom long recommande pour le sujet. `-s` est l'alias court, et `--topic` reste accepte pour compatibilite. Si le premier argument positionnel est un preset connu, il devient `--preset`. Le positionnel suivant devient le sujet. Si le premier argument n'est pas un preset ni une commande (`init`, `update`, `help`, etc.), il devient directement le sujet.

## Rendu Console

`src/renderers/console.ts` contient le premier rendu TUI leger :

- `PrettyConsoleRenderer` : en-tete, separateurs, tours, synthese, couleurs ANSI si TTY.
- `PlainConsoleRenderer` : rendu historique compatible logs.
- Etat "agent en cours" pendant les appels longs en rendu pretty.

Le flag `--plain` force le rendu simple. `NO_COLOR` desactive les couleurs sans changer la structure.

Ce n'est pas encore le vrai TUI interactif : pas de split-view, pas de scrolling controle, pas d'input humain pendant le debat.

## Tests et verification

Avant de livrer une modification :

```bash
pnpm check
pnpm build
```

Quand un changement touche l'adapter CLI, faire un smoke test avec une commande locale simple avant de tester Claude/Codex.

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

- `README.md` pour l'etat du MVP, les commandes principales, les limites connues et les liens de documentation.
- `AGENTS.md` pour les decisions d'architecture, les workflows contributeur et les consignes de maintenance.
- `docs/guide/*.md` pour les guides utilisateur.
- `docs/roadmap.md` pour les travaux faits, en cours et prevus.

`docs/notes.md` est reserve aux idees personnelles du mainteneur. Ne pas l'utiliser comme roadmap projet.

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

- `.github/workflows/ci.yml` : type check + build sur chaque push `main` et chaque PR.
- `.github/workflows/release.yml` : type check + build + pack + creation de release GitHub sur chaque tag `v*`.

### Creer une release

```bash
# Bumper la version dans package.json et creer le tag Git
pnpm version patch   # ou minor / major
git push && git push --tags
```

`pnpm version` met a jour `package.json`, cree un commit de version et un tag `vX.Y.Z`. Le push du tag declenche le workflow `release.yml` qui :

1. installe les dependances (`--frozen-lockfile`) ;
2. verifie les types (`pnpm check`) ;
3. compile (`pnpm build`) ;
4. pack un tarball npm (`pnpm pack`) ;
5. cree une release GitHub avec le tarball en artifact et les notes generees depuis les commits ;
6. pousse `public/version.json` dans le repo `JuReyms/Palabre-app` (branche `dev`), ce qui declenche un rebuild Netlify et met a jour le badge de version sur le site de documentation.

## Sync documentation (Palabre-app)

Le repo CLI est prive. Le site de documentation (`JuReyms/Palabre-app`, Nuxt SSG sur Netlify) recoit les mises a jour via deux workflows GitHub Actions qui poussent directement dans la branche `dev` de Palabre-app. Netlify detecte le push et rebuild automatiquement.

Les deux workflows utilisent le secret `DOCS_REPO_TOKEN` (PAT fine-grained, `Contents = Read and write` sur `JuReyms/Palabre-app` uniquement).

### Workflow sync-docs.yml

Declenche sur tout push dans `docs/guide/**` vers `main`.

Pour chaque fichier source, le workflow :

1. extrait le titre depuis le `# H1` ;
2. extrait la description depuis le premier paragraphe de texte (160 caracteres max) ;
3. injecte un frontmatter `title` / `description` ;
4. copie le fichier dans Palabre-app.

Table de correspondance :

| Source (Palabre CLI) | Destination (Palabre-app) |
|---|---|
| `docs/guide/getting-started.md` | `content/1.guide/1.getting-started.md` |
| `docs/guide/running-a-debate.md` | `content/1.guide/2.running-a-debate.md` |
| `docs/guide/configuration.md` | `content/2.reference/1.configuration.md` |

Pour ajouter un guide : creer le fichier dans `docs/guide/`, ajouter la ligne dans `FILE_MAP` de `sync-docs.yml`, et creer le fichier de destination vide dans Palabre-app.

### Workflow release.yml (step de sync)

A chaque release, apres la creation de la release GitHub, le workflow ecrit :

```json
{ "tag_name": "vX.Y.Z" }
```

dans `public/version.json` de Palabre-app. Le composable `useLatestRelease.ts` de Palabre-app lit ce fichier local au lieu d'appeler l'API GitHub — ce qui permet au repo CLI de rester prive sans impacter l'affichage de la version sur le site.

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
