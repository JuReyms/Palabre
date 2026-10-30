# Adapters, exécution et modèles

Référence de développement extraite d’`AGENTS.md`. Lire [les règles communes](../../AGENTS.md) et ce document avant de modifier un adapter, les shims, les limites d'exécution ou la sélection des modèles. Les chemins de code entre backticks sont relatifs à la racine du dépôt. Les qualifications datées décrivent un essai, pas une garantie pour toutes les versions.

## Diagnostic de connexion OpenCode (#261)

Sur le profil batch qualifié OpenCode, un exit non nul avec la ligne `Upstream request failed: Invalid credential` (ou `Invalid credential`), ou un événement JSON `type: error` portant `provider.auth`/ce message, reçoit une action localisée. Les priorités quota/modèle non supporté restent inchangées. Le kind demeure `non-zero-exit` : aucun nouveau champ machine ni succès sur sortie partielle. Sans modèle explicite, expliquer la différence possible entre défaut CLI et choix d’interface ; sinon expliquer le refus du modèle demandé. Aucun modèle déduit, changé ou retenté. Alias reconnus par le profil, pas par leur nom ; une CLI générique ou une mention libre ne reçoit pas ce diagnostic spécifique.

## Adapter CLI actuel

`src/adapters/cli.ts` est volontairement minimal. Il sert d'abord les modes batch des CLIs :

- Codex : `codex exec ...`
- Claude : `claude --print --tools Read,Glob,Grep`
- OpenCode : `opencode run` (environnement habituel, voir plus bas)
- Mistral Vibe : `vibe --output text --trust --enabled-tools read --enabled-tools grep --prompt <prompt>`

Antigravity utilise aussi l'adapter batch, avec un format explicite :

- Antigravity : `agy --print-timeout 5m0s --output-format json --print <prompt>`, `type: cli`, `responseFormat: antigravity-json`.

Ce format accepte un seul objet JSON UTF-8 avec `status: SUCCESS` et `response` texte non vide, même avec `allowEmptyOutput`. Extraction avant tout nettoyage ; seuls les contrôles terminal sont assainis dans le texte extrait, sans trim ni suppression de paragraphes. Métadonnées exclues de `content`, stdout original dans `raw`. JSON invalide, statut inconnu/erreur ou structure inconnue : `unknown` (diagnostic FR/EN), réponse vide : `empty-output`, format configuré inconnu ou placé sur PTY : `spawn-failed` avant lancement, également signalé par `doctor`. Aucun repli vers texte/PTY. Exit non nul, annulation et budgets gardent leur priorité ; quota stderr reconnu reste classé en erreur. Aucun changement d'outils/permissions. Sonde Windows 1.4.9 du 28 octobre 2026 : succès et espaces/paragraphes conservés ; schémas d'erreur et autres versions/plateformes non qualifiés.

Sur Windows, garder `"shell": true` uniquement pour les wrappers npm qui lisent le prompt sur
stdin. L'adapter resout et lance directement les executables natifs sans shell ; il refuse un
prompt en argument ou un model override contenant des metacaracteres quand un wrapper shell reste
necessaire. Pour Claude Code, preferer `claude.exe` avec `"shell": false`, car `stdin` est
capture correctement dans ce mode.

Sous Windows, l'ordre de lancement (CLI et PTY) est : executable natif ; shim PowerShell `.ps1` frere
genere par npm ou par pnpm, reconnu ligne a ligne et lance directement, sans PowerShell (Node et le
script du paquet, ou l'executable natif du paquet pour la variante native npm) ; autre shim
PowerShell (shim modifie, forme inconnue), lance par PowerShell sans `cmd.exe` ; sinon wrapper
shell, refuse pour un prompt en argument. Avec Windows PowerShell 5.1, le shim refuse l'argument
`-`, retire les guillemets internes et remplace les caracteres non ASCII de stdin par `?` ; le repli
PowerShell garde ces limites. CLI et PTY partagent la resolution PATH mise en cache dans
`src/exec.ts`.

Shims pnpm (#109), dans `src/npmShim.ts` :
- modele `PNPM_SHIM_TEMPLATE` releve sur pnpm 10 (paquets globaux et `pnpm link --global`), copie
  conforme exigee ; seuls varient la valeur Windows de `NODE_PATH`, sa valeur POSIX et le script ;
- valeurs litterales seulement (ni `$`, ni accent grave, ni guillemet droit ou typographique double,
  ni caractere de controle) ; `NODE_PATH` Windows forme de dossiers absolus avec lettre de lecteur ;
  script relatif en `/`, avec des `..` seulement en tete, termine par `.js`, `.cjs` ou `.mjs` ;
- `NODE_PATH` reproduit comme le shim par `withShimNodePath`, sur une copie de l'environnement du
  processus lance : valeur du shim si la valeur heritee est absente ou vide, sinon
  `<valeur du shim>;<valeur heritee>` ;
- lien global (script hors du dossier du shim) accepte seulement si le chemin est litteral et si la
  cible resolue existe et est un fichier JavaScript : Palabre lance exactement ce que le shim
  lancerait ;
- non pris en charge, donc repli PowerShell : script sans extension JavaScript (par exemple `tsc`
  ou `vsce`), cible native, `pnpx`, shim modifie.

Relay (D21) reste limite a la forme npm Node + script : un shim pnpm y donne
`unsupported-executable`. Exception explicite OpenCode `--copy` : variante native npm
reconnue ligne à ligne par `npmNativeShimLaunch`, cible .exe/.com interne existante
lancée directement ; jamais de PowerShell, pnpm ou wrapper modifié. Reprises Codex/Claude inchangées.

Les defaults Palabre appliquent une politique d'outils en lecture seule quand la CLI l'expose :
Claude est limite a `Read,Glob,Grep` et Vibe a `read,grep`. OpenCode n'en expose pas : decision du
proprietaire du 28 octobre 2026, Debat/Ask/Chat (syntheses comprises) utilisent son environnement
habituel, comme Relay sur copie. Plugins, MCP et permissions configures restent actifs ; aucune
neutralisation ni lecture seule n'est promise. OpenCode 2 n'a plus `--pure` (absent des 2.0.0) et aucun
remplacant n'est qualifie (`--standalone` charge toujours les plugins ; une liste de plugins vide ou
une politique injectee ne donnent pas de garantie universelle). La migration ne remplace que
l'ancien defaut exact `["run", "--pure"]` par `["run"]` (en memoire a chaque chargement ; `--sync-agents`,
via `persistAgentSync`, l'ecrit aussi quand seul le fichier garde l'ancien tableau ; fichier modifie depuis son chargement :
conflit, aucune ecriture) ; le refus exact `Unrecognized flag: --pure in command opencode run` donne un
`non-zero-exit` avec la marche a suivre. Les fichiers de contexte et messages du transcript restent
explicitement marques comme donnees non fiables dans les prompts. Les migrations ne remplacent
que les tableaux `args` exactement identiques aux anciens defaults ; toute personnalisation
utilisateur est preservee.

Il supporte :

- `command`
- `args`
- `promptMode: "stdin" | "argument"`
- `responseFormat: "text" | "antigravity-json"` (batch uniquement, texte par défaut)
- `timeoutMs`
- `idleTimeoutMs`
- `maxOutputBytes`
- `shell`
- `allowEmptyOutput`

`idleTimeoutMs` doit rester optionnel pour les CLIs IA en mode batch. Certains modeles peuvent rester silencieux longtemps avant d'ecrire leur reponse ; dans ce cas, le timeout dur `timeoutMs` est le garde-fou principal.

Attente et lecture tardive. `cliRuntimeProfile` (registre) donne 15 min à toute config OpenCode sans `timeoutMs` valide, arguments personnalisés compris. Il active la sortie `--format json` seulement pour le défaut exact `["run"]` sur stdin, sans `responseFormat`. Aucune écriture de config. La factory transmet ce profil et `configIdentity`, liée par `matchingConfigIdentity` dans `index.ts` au fichier approuvé et à l’objet effectivement chargé, y compris après les écritures TUI. Chat transmet les mêmes options aux réponses et consultations ; les reprises utilisent l’identité validée du checkpoint.

`CliAdapter` appelle `AgentPrompt.onWaiting` toutes les 60 s ; le CLI l'écrit sur stderr. À l'échéance, pour ce profil, seul le client lancé est arrêté ; ailleurs, l'arbre est arrêté comme avant. `localExit` n'est confirmé que par `exit`/`close` sous 5 s, avec `remoteWork: unknown` et `resent: false`. Les handles locaux sont libérés même sans arrêt confirmé : aucun descendant ou service n’est tué pour libérer les pipes. `recovery` porte une référence opaque base64url (`opencodeJson.encodeRecoveryReference` : config canonique et SHA-256, commande, cwd, session et dernier message observés, empreinte du prompt, modèle ou `null`), ou une raison nommée.

`palabre result --reference` (`src/commands/result.ts`) revérifie identité et approbation sans les accorder, puis la commande, le profil et le dossier. Il ne fait qu'une lecture `session export` bornée : UTF-8 strict, client seul arrêté. JSON `agent-result` v1 distinct, `sent: false`.

Sortie `run` et export sont validés strictement : session unique, identifiants cohérents, dernier message annoncé, `idle` et `info.outcome` `succeeded`, `finish: stop`, `time.completed`, sans erreur. Seuls les messages `system` d'instructions sont tolérés. Tests : `tests/agent-wait-recovery.test.ts`, sur des CLIs simulées.

Compatibilité ciblée des projections 2.2.3 : le code officiel [reconcile / projectedPartID](https://github.com/anomalyco/opencode/blob/v2.2.3/packages/cli/src/run/noninteractive.ts) reconstruit parfois des événements absents du flux live. Le lecteur accepte les IDs projetés seulement s’ils sont liés au même message, au type exact et, pour un outil, au même appel. Les ordinaux texte/raisonnement sont canoniques et sûrs. Un message connu ne redevient pas dernier après réconciliation. L’observateur et le lecteur partagent le même état d’ordre et de blocs, sans conserver le texte dans l’observateur.

Refus conservateurs : mélange de textes live/projetés du même message (le rang live ne prouve pas l’ordinal), trou ou doublon projeté, nouveau message uniquement projeté après d’autres messages live. Un bloc vide absent avant text-1 peut donc être refusé aussi. Les blocs entièrement projetés restent acceptés dans l’ordre 0,1,... ; un step_finish projeté du même message peut compléter un texte live. Ces cas ont des tests simulés issus des sources officielles ; ils ne constituent pas une qualification réelle complète 2.2.3 et ne prouvent pas la cause du flux historique perdu.

Qualification Windows du 29 octobre 2026, OpenCode 2.0.32 : DeepSeek gratuit a lu un fichier de sonde et rendu le texte final attendu via `step_start`, `tool_use`, `step_finish`, `text`. Dans `tool_use`, `part.id` est l'identifiant opaque de l'appel d'outil et `part.partID` celui de la part (`prt_…`) ; les autres événements utilisent `part.id` pour la part. Une consultation antérieure terminée a aussi été relue par `result` avec correspondance exacte du prompt et du texte final, sans nouvel envoi ni appel de modèle. Cela ne qualifie pas les autres versions ou plateformes.

Qualification complémentaire Windows du 30 octobre 2026, OpenCode 2.2.3 : treize réponses batch avec opencode-go/deepseek-v4.1-flash, participants Débat/Ask et synthèses, correspondent exactement à leurs exports natifs terminés. La revue distincte DeepSeek Pro utilise le même transport. Les cas Codex bloqués par quota, un échec Antigravity et un faux négatif du smoke pour le diagnostic stderr d’attente restent distingués dans le [bilan 0.22.1](../release-0.22.1-qualification.md). Cette observation ne lève pas les refus conservateurs ci-dessus et ne qualifie pas Relay sur copie.

`maxOutputBytes` protege le CLI contre les agents qui produisent une sortie enorme ou partent en boucle. Par defaut, les adapters CLI et PTY coupent a 50 Mio et levent `AdapterError("output-too-large")`. Le budget couvre stdout et stderr cumules : les deux flux sont bufferises en memoire par Palabre, et le flux PTY les fusionne de toute facon. C'est une protection memoire du process, pas seulement une limite sur la taille de la reponse.

Une valeur `maxOutputBytes` invalide ne desactive jamais la protection : CLI, PTY et Ollama
retombent tous sur la limite par defaut.

Les adapters CLI et PTY doivent rejeter tout exit code non nul, meme si la CLI a ecrit une sortie partielle sur stdout ou dans le PTY. Une sortie partielle issue d'un process en erreur ne doit pas etre traitee comme une reponse valide. Pour l'adapter CLI uniquement, si stderr est vide et stdout non vide, le message `non-zero-exit` peut reprendre un extrait nettoye et borne de stdout comme diagnostic. Cet extrait ne devient jamais une reponse et ne sert pas a classifier une erreur connue ; stderr garde la priorite.

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

`src/adapters/cli-pty.ts` lance une CLI dans un pseudo-terminal via `node-pty`. Il reste disponible pour les configurations personnalisées qui exigent une vraie console. Antigravity utilisait ce transport pour sa sortie texte, vide avec des pipes dans les anciens essais ; son défaut utilise maintenant JSON batch. Sous ConPTY, des sauts de ligne peuvent être remplacés par des mouvements de curseur : leur suppression au nettoyage peut coller les paragraphes. Ce lot ne répare pas le décodeur PTY générique.

L'adapter nettoie les séquences ANSI/OSC via `src/adapters/terminal.ts` et retourne le raw PTY output dans `raw`.

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

## Modeles

Palabre ne liste pas les modeles disponibles. Les catalogues changent trop vite et appartiennent aux providers ou CLIs.

Exception utile : pour Ollama, l'adapter peut detecter les modeles installes localement afin de valider une config ou un override. Il ne choisit pas automatiquement un modele a la place de l'utilisateur.

Le telechargement automatique Ollama est desactive par defaut. Il doit etre active par `--pull-models` ou `autoPullModel: true`, car un modele peut peser plusieurs Go.

`--model-a` et `--model-b` transmettent simplement une string brute :

- adapter `cli` : ajoute `--model <value>` via `modelArg` (par defaut `--model`) ;
- adapter `ollama` : remplace la valeur `model` de la config runtime.

Si une CLI utilise un nom d'option different, ajouter `modelArg` dans la config agent.
