# AGENTS.md

Ce fichier guide les agents et contributeurs qui travaillent dans ce depot.

## Vision

Chicane est un meta-CLI qui orchestre un debat entre plusieurs agents IA. Le produit cible des utilisateurs deja a l'aise avec le terminal, ayant installe et configure leurs outils IA locaux : Codex CLI, Claude CLI, Ollama, ou equivalents.

Le principe d'architecture important : Chicane orchestre des adapters. Claude, Codex et Ollama ne doivent pas etre codes comme des cas speciaux dans le moteur de debat.

## Stack

- Runtime : Node.js 20+
- Package manager : pnpm
- Langage : TypeScript
- Module system : ESM (`type: module`)
- Build : `tsc`

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
src/config.ts             Chargement et generation de config
src/types.ts              Contrats partages
src/prompt.ts             Rendu des prompts agent
src/orchestrator.ts       Boucle de debat ping-pong
src/output.ts             Export Markdown
src/adapters/index.ts     Factory d'adapters
src/adapters/cli.ts       Adapter CLI minimal
src/adapters/ollama.ts    Adapter Ollama HTTP
docs/                     Specifications produit
```

## Concepts

### Agent

Un agent est une entree nommee dans `chicane.config.json`.

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

Les roles ne sont pas seulement decoratifs. Ils doivent guider les prompts et, plus tard, les modes d'orchestration.

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

## Orchestration

Le moteur actuel alterne simplement entre deux agents pendant `turns` tours :

1. Render du prompt avec le sujet, les fichiers explicites et l'historique.
2. Appel de l'agent courant.
3. Ajout du message au transcript.
4. Passage a l'autre agent.
5. Export Markdown final.

Les futures evolutions possibles :

- intervention humaine ;
- criteres d'arret ;
- modes a trois agents ;
- budgets de tours par role.

### Synthese finale

La synthese finale est activee par defaut. Elle utilise `agentB` sauf override par `--summary-agent`.

Options :

- `--summary-agent <name>` : agent de config utilise apres le debat.
- `--summary-model <model>` : modele brut transmis a l'agent de synthese.
- `--no-summary` : desactive la phase de synthese.

Le prompt de synthese est un mode dedie dans `formatAgentPrompt` (`mode: "summary"`). Il recoit le sujet, les fichiers explicites et tout le transcript.

## Contexte projet

Le MVP fournit `--files` pour injecter explicitement des fichiers texte dans le prompt. Il ne fournit pas encore `--context`.

Important :

- Les agents `cli` sont executes depuis le dossier courant. Codex, Claude ou Gemini peuvent donc inspecter le workspace si leur CLI le permet.
- Ce comportement appartient aux CLIs externes, pas au contrat Chicane.
- L'adapter `ollama` ne lit jamais le filesystem directement. Il ne voit que le prompt, les fichiers passes par `--files` et le transcript fournis par Chicane.
- Si aucun fichier n'est passe a `--files`, Ollama ne voit pas le contenu du projet.

Limites `--files` actuelles :

- 64 KiB max par fichier.
- 192 KiB max au total.
- fichiers binaires refuses.
- dossiers refuses.

Evolution prevue :

- `--context <dir>` pour construire un contexte projet borne.
- limites de taille, exclusions et resume automatique pour eviter de saturer le contexte.

## Modeles

Chicane ne liste pas les modeles disponibles. Les catalogues changent trop vite et appartiennent aux providers ou CLIs.

Exception utile : pour Ollama, l'adapter peut detecter les modeles installes localement afin de valider une config ou un override. Il ne choisit pas automatiquement un modele a la place de l'utilisateur.

Le telechargement automatique Ollama est desactive par defaut. Il doit etre active par `--pull-models` ou `autoPullModel: true`, car un modele peut peser plusieurs Go.

`--model-a` et `--model-b` transmettent simplement une string brute :

- adapter `cli` : ajoute `--model <value>` via `modelArg` (par defaut `--model`) ;
- adapter `ollama` : remplace la valeur `model` de la config runtime.

Si une CLI utilise un nom d'option different, ajouter `modelArg` dans la config agent.

## Prompt Preview

`--show-prompt` affiche le prompt exact du premier tour, puis termine sans appeler d'agent. Les tours suivants ne peuvent pas etre connus sans executer le debat, car ils dependent du transcript reel.

## Tests et verification

Avant de livrer une modification :

```bash
pnpm check
pnpm build
```

Quand un changement touche l'adapter CLI, faire un smoke test avec une commande locale simple avant de tester Claude/Codex.

Quand un changement touche Ollama, verifier que l'erreur est lisible si Ollama n'est pas lance ou si le modele manque.

Combinaisons validees localement :

- `ollama ↔ ollama` avec `gemma4:e4b`
- changement Ollama `nemotron-3-nano:4b` vers `gemma4:e4b` avec dechargement de l'ancien modele
- `codex exec ↔ ollama`
- `claude --print ↔ ollama`
- `gemini --prompt - ↔ ollama`
- `codex exec ↔ claude --print`
- `--show-prompt` avec `--files`
- synthese finale avec agent B
- `--no-summary`

Ces tests ont confirme que le mode batch est deja exploitable avant l'adapter PTY.

## Style de contribution

- Preferer des changements petits et comprehensibles.
- Ne pas melanger TUI, PTY et extension VS Code dans le meme changement.
- Garder les adapters independants du moteur d'orchestration.
- Documenter les limites connues plutot que de masquer les heuristiques.
- Eviter les abstractions prematurees, sauf quand elles gardent les adapters propres.
