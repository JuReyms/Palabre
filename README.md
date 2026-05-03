# Chicane

Chicane est un orchestrateur de debat entre agents IA installes localement : CLIs comme Codex ou Claude, et modeles locaux exposes par Ollama.

L'objectif du projet est de permettre a un utilisateur deja a l'aise avec le terminal de faire dialoguer plusieurs assistants sur un sujet technique, sans imposer une API payante au jeton. Chicane pilote les outils deja configures sur la machine et exporte la session en Markdown.

## Etat actuel

Le projet contient un premier MVP technique :

- CLI Node.js/TypeScript avec `pnpm`.
- Configuration JSON des agents.
- Adapter CLI minimal via `child_process`.
- Adapter Ollama via HTTP local.
- Orchestration ping-pong avec limite de tours.
- Injection explicite de fichiers texte via `--files`.
- Selection bornee de contexte projet via `--context`.
- Rendu console pretty, avec fallback `--plain`.
- Etat vivant pendant qu'un agent genere sa reponse.
- Export `.debate.md`.

Le preset CLI actuel vise les modes non interactifs : `codex exec` et `claude --print`. Le prochain gros chantier reste l'adapter PTY robuste pour les vraies sessions interactives.

## Prerequis

- Node.js 20 ou plus.
- pnpm 10.
- Pour les agents CLI : les commandes visees doivent deja etre installees et authentifiees, par exemple `codex` ou `claude`.
- Gemini CLI est aussi supporte en mode batch si `gemini` est installe et authentifie.
- Pour Ollama : Ollama doit tourner localement, par defaut sur `http://localhost:11434`, avec le modele configure deja disponible.

## Installation

```bash
pnpm install
pnpm build
```

## Configuration

```bash
pnpm start -- init
```

Cette commande cree `chicane.config.json` si le fichier n'existe pas encore. Pendant l'init, Chicane detecte `codex`, `claude`, `gemini` et l'API locale Ollama, puis choisit une paire par defaut detectee quand c'est possible. Le fichier d'exemple versionne est [chicane.config.example.json](./chicane.config.example.json).

Extrait de configuration :

```json
{
  "defaults": {
    "agentA": "codex",
    "agentB": "ollama-local",
    "turns": 4
  },
  "agents": {
    "codex": {
      "type": "cli",
      "command": "codex",
      "args": ["exec", "--skip-git-repo-check", "--color", "never", "--sandbox", "read-only", "-"],
      "role": "implementer"
    },
    "ollama-local": {
      "type": "ollama",
      "baseUrl": "http://localhost:11434",
      "model": "nemotron-3-nano:4b",
      "role": "critic",
      "validateModel": true,
      "unloadOtherModels": true
    }
  }
}
```

## Agents et roles

Chicane se base sur des adapters :

- `cli` : lance une commande locale, injecte le prompt, capture la sortie.
- `ollama` : appelle l'API HTTP locale d'Ollama.

Les presets CLI fournis utilisent les modes batch quand ils existent :

- Codex : `codex exec ... -`, prompt via `stdin`.
- Claude : `claude --print`, prompt via `stdin`.
- Gemini : `gemini --prompt -`, prompt via `stdin`.

Sur Windows, les wrappers npm comme `codex` et `gemini` peuvent necessiter `"shell": true` dans la config agent. Claude fonctionne mieux via `claude.exe` avec `"shell": false`.

Les roles documentent l'intention de l'agent dans le debat :

- `implementer` : propose une solution concrete.
- `reviewer` ou `critic` : cherche les risques, angles morts et contradictions.
- `architect` : arbitre ou structure une direction technique.
- `scout` : explore rapidement un sujet.
- `summarizer` : produit une synthese.

Ollama est pense par defaut comme `critic`, `scout` ou `summarizer`, car les machines utilisateur font souvent tourner des modeles modestes. Un utilisateur peut quand meme le promouvoir en agent principal dans sa config.

## Lancer un debat

```bash
pnpm start -- run --topic "Refacto de l'auth Nuxt" --agent-a codex --agent-b ollama-local --turns 4
```

Autres exemples :

```bash
pnpm start -- run --topic "Comparer deux strategies de cache" --agent-a claude --agent-b codex
pnpm start -- run --topic "Critique rapide du plan de migration" --agent-a codex --agent-b ollama-local --turns 2
```

Presets disponibles :

```bash
pnpm start -- run --preset codex-claude --topic "Debattez du prochain jalon"
pnpm start -- run --preset claude-ollama --topic "Critique le MVP batch"
pnpm start -- run --preset gemini-ollama --topic "Gemini est-il un bon reviewer ?"
```

Un preset choisit seulement les deux agents. Il ne change pas les modeles par defaut configures dans les CLIs. Pour demander un modele explicitement, Chicane transmet la string brute sans valider ni lister les modeles :

```bash
pnpm start -- run --preset codex-claude --model-a 5.5 --model-b opus --topic "Compare les approches"
pnpm start -- run --preset codex-ollama --model-b gemma4:e4b --topic "Critique locale plus profonde"
```

Pour Ollama, Chicane valide par defaut que le modele est installe localement. Il ne telecharge rien sans accord explicite. Pour autoriser un telechargement Ollama si le modele manque :

```bash
pnpm start -- run --preset codex-ollama --model-b nemotron-3-nano:4b --pull-models --topic "Critique locale"
```

Equivalent dans la config agent :

```json
{
  "type": "ollama",
  "model": "nemotron-3-nano:4b",
  "autoPullModel": true
}
```

Pour inspecter le prompt du premier tour sans appeler d'agent :

```bash
pnpm start -- run --preset codex-claude --topic "Preview" --context src docs --show-prompt
```

Par defaut, Chicane produit une synthese finale avec l'agent B. Tu peux choisir un autre agent, un modele specifique, ou desactiver la synthese :

```bash
pnpm start -- run --preset codex-claude --topic "Critique le MVP" --summary-agent claude
pnpm start -- run --preset codex-claude --topic "Critique le MVP" --summary-agent ollama-local --summary-model nemotron-3-nano:4b
pnpm start -- run --preset codex-claude --topic "Critique le MVP" --no-summary
```

Le rendu console est un premier TUI leger : en-tete, separateurs, tours, synthese lisible et etat "agent en cours" pendant les generations longues. Pour revenir au rendu brut :

```bash
pnpm start -- run --preset codex-claude --topic "Critique le MVP" --plain
```

Les couleurs sont automatiquement desactivees si `NO_COLOR` est defini.

La session genere un fichier `.debate.md` dans le dossier configure par `outputDir`.

## Contexte projet

Chicane distingue deux modes de contexte :

- `--files` : selection explicite et stricte de fichiers texte.
- `--context` : scan tolerant de fichiers ou dossiers texte avec exclusions et warnings.

`--files` est utile quand tu sais exactement quels fichiers doivent etre envoyes :

```bash
pnpm start -- run --topic "Critique le MVP batch" --files README.md src/adapters/cli.ts --agent-a claude --agent-b ollama-local --turns 2
```

Si un chemin `--files` pointe vers un dossier, un fichier binaire ou un fichier trop gros, Chicane arrete la commande avec une erreur claire.

`--context` est utile pour donner une vue projet plus large sans tout envoyer aveuglement :

```bash
pnpm start -- run --preset codex-ollama --topic "Critique l'architecture" --context src docs --turns 2
pnpm start -- run --preset codex-claude --topic "Preview contexte" --context . --show-prompt
```

Le scan `--context` :

- parcourt recursivement les dossiers passes ;
- ignore par defaut `.git`, `.gitignore`, `.tmp`, `.pnpm-store`, `node_modules` et `dist` ;
- applique les regles simples de `.gitignore` du projet ;
- garde seulement les extensions texte connues (`.ts`, `.md`, `.json`, `.yaml`, etc.) ;
- ignore les fichiers binaires, trop gros ou au-dela de la limite totale avec un warning.

Les fichiers retenus, qu'ils viennent de `--files` ou de `--context`, sont envoyes a tous les agents, y compris Ollama. Ils sont aussi listes dans l'export `.debate.md`.

Les agents CLI sont lances depuis le dossier courant. Selon leur propre fonctionnement et leurs permissions, Codex, Claude ou Gemini peuvent donc inspecter le workspace par leurs outils internes. Ce comportement depend de chaque CLI et ne doit pas etre considere comme un contrat garanti par Chicane.

Ollama ne lit pas le filesystem par lui-meme. L'adapter Ollama recoit uniquement le prompt construit par Chicane : sujet, role, instructions, fichiers retenus par `--files` ou `--context`, et historique du debat. Si aucun contexte n'est passe, Ollama ne voit pas le contenu du projet.

Limites actuelles :

- chaque fichier est limite a 64 KiB ;
- le contexte total est limite a 192 KiB ;
- les fichiers binaires sont refuses avec `--files` et ignores avec warning via `--context` ;
- le support `.gitignore` reste volontairement simple pour le MVP.

## Scripts

```bash
pnpm check
pnpm build
pnpm start -- help
pnpm start -- -h
pnpm start -- -v
```

## Validation locale actuelle

Tests effectues sur Windows :

- `ollama ↔ ollama` avec `gemma4:e4b` : OK.
- `codex exec ↔ ollama` : OK.
- `claude --print ↔ ollama` : OK avec `claude.exe` et `"shell": false`.
- `gemini --prompt - ↔ ollama` : OK.
- `codex exec ↔ claude --print` : OK.
- `--show-prompt` avec `--files` : OK.
- `--show-prompt` avec `--context docs` : OK.
- `init` avec detection locale des agents : OK.
- etat "agent en cours" pendant les generations : OK.
- synthese finale avec agent B : OK.
- `--no-summary` : OK.
- rendu console pretty et `--plain` : OK.

Reglages importants observes :

- Codex via le wrapper npm Windows necessite `"shell": true`.
- Gemini via le wrapper npm Windows fonctionne avec `"shell": true` et `--prompt -`.
- Claude capture correctement `stdin` avec `command: "claude.exe"` et `"shell": false`.
- `idleTimeoutMs` ne doit pas etre active par defaut pour les CLIs IA en batch, car elles peuvent rester silencieuses pendant la generation.

## Limites connues

- L'adapter CLI actuel est volontairement minimal. Il marche mieux avec des commandes non interactives ou des CLIs qui acceptent un prompt via `stdin`.
- `chicane init` detecte les outils locaux et ajuste seulement les defaults ; les blocs agents exemples restent dans la config pour faciliter l'edition.
- Les adapters exposent un contrat (`capabilities` et `guarantees`) pour documenter timeout, sortie vide, stderr, exit code, model override, filesystem et streaming.
- `--files` est explicite et strict ; `--context` scanne des dossiers texte de facon bornee et best-effort.
- `--show-prompt` affiche le prompt exact du premier tour seulement. Les tours suivants dependent du transcript reel.
- `--model-a` et `--model-b` transmettent une string brute aux adapters ; Chicane ne maintient pas de catalogue de modeles.
- L'adapter Ollama detecte les modeles installes via `/api/tags` quand `validateModel` est actif.
- L'adapter Ollama peut telecharger un modele manquant via `/api/pull` seulement si `--pull-models` ou `autoPullModel` est actif.
- L'adapter Ollama decharge les autres modeles charges via `/api/ps` puis `keep_alive: 0` quand `unloadOtherModels` est actif.
- Chicane affiche un warning si Ollama participe sans contexte fourni, car Ollama ne lit pas le filesystem.
- La synthese finale est activee par defaut et utilise l'agent B, sauf `--summary-agent` ou `--no-summary`.
- Le rendu console pretty est volontairement leger. Il affiche deja l'agent en cours, mais le split-view, le scrolling interactif et l'input humain arriveront avec le vrai TUI.
- Une sortie CLI vide est consideree comme une erreur, sauf si `allowEmptyOutput` est active explicitement.
- `idleTimeoutMs` doit etre utilise avec prudence : les CLIs IA peuvent rester silencieuses pendant la generation.
- Les CLIs interactives auront besoin d'un vrai PTY, probablement via `node-pty`.
- La detection de fin de reponse est encore heuristique avec `idleTimeoutMs`.
- La TUI et l'extension VS Code sont prevues apres stabilisation du coeur CLI.

## Documentation projet

- Spec produit : [docs/Chicane-Specification.md](./docs/Chicane-Specification.md)
- Guide agents/contributeurs : [AGENTS.md](./AGENTS.md)
