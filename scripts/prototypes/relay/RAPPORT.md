# Faisabilité de `palabre relay` : reprise de sessions externes Codex et Claude Code

Compte rendu du prototype isolé pour l'issue #96, en quatorze passes :

1. faisabilité ;
2. corrections après la relecture de Codex ;
3. neutralisation des MCP Codex et codes de sortie ;
4. validation stricte de la liste MCP, garantie conditionnelle et découpage d'implémentation ;
5. contrat du lot A0 (`CONTRAT-A0.md`) et issue `command-not-found` (code 7) ;
6. contrat A0 finalisé dans `AGENTS.md`, dossier de travail introuvable distingué de l'exécutable introuvable, et socle A1 dans `src/externalSessions/` ;
7. corrections A1 : libération de l'appelant après un retour forcé, et preuve de persistance qui l'emporte toujours sur un refus annoncé (également corrigée dans `classifyDelivery` du prototype) ;
8. adapter Claude Code (A2) dans `src/externalSessions/claude.ts`, avec le contrat d'adapter commun et des tests sur historiques et CLI simulés ;
9. corrections A2 : une entrée de registre sans session déterminable rend l'attachement invérifiable, et seul un résultat final de forme vérifiée produit une réponse ;
10. adapter Codex (A3) dans `src/externalSessions/codex.ts`, avec une étape préalable commune (`prepare`) pour la liste MCP. Constat : le shim npm `codex.ps1` lancé par Windows PowerShell 5.1 refuse l'argument `-`, retire les guillemets internes et remplace les caractères non ASCII de stdin par `?` (proposition D21 dans `CONTRAT-A0.md`) ;
11. commande `palabre relay` (A4) : résolution de l'exécutable selon D21, confiance de la config sans question, sortie JSON v1, export `.relay.md`, aides et documentation FR/EN. Le smoke réel reste pour A5 ;
12. corrections A4 : parseur strict des options de relay (options courtes, étrangères, répétées ou mal formées refusées et nommées), reconnaissance du shim npm par comparaison ligne à ligne avec le modèle complet, réserves complètes de la garantie dans l'aide FR/EN ;
13. aiguillage de `relay` avant toute validation ou handler général, même précédé d'options (`findFirstPositionalIndex`) ;
14. smoke réel A5 avec de vrais agents sur des sessions jetables (section « Lot A5 »).

Vérifications menées le 7 octobre 2026 sous Windows 11, avec PowerShell 7 et Node 22.17.1. Ce document est à relire avant toute intégration dans `src/` (voir les sections « Décisions retenues » et « Découpage d'implémentation »).

Légende utilisée dans tout le document :

- **[T]** testé sur ce poste, avec une trace locale ;
- **[D]** documenté (aide `--help` ou documentation du fournisseur), sans test direct ;
- **[H]** hypothèse, non vérifiée.

Chaque constat [T] précise l'exécutable et la version utilisés. Les identifiants de session n'apparaissent pas ici. Les sessions de test sont nommées **C1** (Codex), **C1-F** (fork de C1), **K1** (Claude Code) et **K1-F** (fork de K1). Les identifiants réels figurent seulement dans les traces locales `.tmp/relay-probe/traces/`, ignorées par git.

> **Limite produit à retenir : conversations fermées uniquement.** Le périmètre sûr est « cibles inactives seulement » : on ne relaie qu'à une conversation à laquelle aucun processus n'est attaché (aucun TUI, desktop, IDE, `exec` ni `-p` en cours). Ce périmètre **ne permet pas encore de sonner deux agents dont les conversations restent ouvertes**, ce qui est pourtant le cas d'usage de l'issue.
>
> - Une conversation Codex ouverte refuse toute écriture externe.
> - Une conversation Claude ouverte accepte l'écriture, mais perd le tour relayé.
>
> Les seules pistes de délivrance vers une conversation ouverte sont asynchrones et sortent du contrat « un appel, une réponse » :
>
> - `codex queue`, vérifié pour Codex (voir la section 4) ;
> - une messagerie inter-sessions de Claude Code, [H] non examinée.
>
> Le « Relay entre agents ouverts » reste donc un **objectif non résolu** de l'issue (voir « Découpage d'implémentation », partie B).

## Exécutables et versions

| Repère | Exécutable | Version | Utilisé pour |
| --- | --- | --- | --- |
| **X** | `codex.js` du paquet npm `@openai/codex`, lancé par `node`, sans shell | `codex-cli 0.151.0` | Tous les tests Codex |
| **E1** | `%LOCALAPPDATA%\Microsoft\WindowsApps\claude.exe`, premier `claude.exe` du PATH (origine de l'alias non vérifiée) | `2.1.85` | Tous les `claude -p` de la première passe, TUI du scénario « au repos » |
| **E2** | `~/.local/bin/claude.exe` (installation native) | `2.1.251`, mis à jour automatiquement en `2.1.292` pendant la première passe | TUI ouvert manuellement (2.1.251), scénario « en génération » et tests de la seconde passe (2.1.292) |
| **E3** | CLI embarquée par Claude desktop (session appelante) | `2.1.289` | Observation du registre et des variables d'environnement seulement |
| **V** | `codex.exe` de l'extension VS Code `openai.chatgpt` | version non relevée | Observation des verrous seulement (sessions réelles non touchées) |

Mesures d'isolation appliquées :

- Les sessions jetables ont été créées dans `%TEMP%\palabre-relay-probe\<agent>\`, hors du dépôt.
- Aucune session de travail n'a été reprise, forkée ni modifiée. Le seul accès à des sessions réelles a été une ouverture exclusive en lecture, immédiatement refermée, de 4 fichiers de verrou Codex.
- Pour Codex :
  - `--ignore-user-config`, sauf dans deux tests qui demandent la config utilisateur ;
  - `--disable memories`, car la fonctionnalité est active par défaut ;
  - pour le TUI : `--disable hooks`, `check_for_update_on_startup=false` et une confiance du dossier passée par `-c` ;
  - `~/.codex/config.toml` n'a pas été modifié (vérifié).
- Pour Claude : `--model haiku` demandé (voir la section « Modèle annoncé et modèle réel »).
- Les variables d'environnement de l'hôte appelant (`CLAUDECODE`, `CLAUDE_CODE_*`, `CLAUDE_PID`…) sont retirées avant chaque lancement.
- Les hooks témoins de la seconde passe sont déclarés seulement dans les dossiers jetables (`.claude/settings.json` et `.codex/hooks.json`). Le témoin est un script Node qui ajoute une ligne dans `%TEMP%\palabre-relay-probe\hook-witness.log`.
- Le serveur MCP témoin de la troisième passe est déclaré seulement dans la config **projet** du dossier jetable (`%TEMP%\palabre-relay-probe\codex\.codex\config.toml`). Il journalise dans `%TEMP%\palabre-relay-probe\mcp-witness.log` et ne contacte aucun service. Les cas « config utilisateur » lisent ta config réelle sans la modifier : `codex mcp list --json` est en lecture seule, et les désactivations passent par `-c`, le temps d'un seul lancement. Aucun outil utilisateur n'a été sollicité.

## Fichiers du prototype

Rien n'est importé depuis `src/`, et rien dans `src/` n'importe ces fichiers. `pnpm check` reste vert.

- `adapters.ts` : contrats et implémentation, en particulier :
  - `ExternalSessionAdapter` (`send`, `probeTarget`, `findNonce`, `certainRefusal`) ;
  - `TargetProbe` (attachement distinct de l'activité), `assessTarget`, `classifyDelivery` ;
  - `relayOutcome` et `RELAY_EXIT_CODES` (issue et code de sortie) ;
  - parseurs purs `interpretCodexOutput` / `interpretClaudeOutput` (identité, modèles annoncés et observés) ;
  - `run()` sans shell, message sur stdin, timeout dur et kill de l'arbre de processus, timers annulés à la terminaison ;
  - option Codex `neutralizeMcp`.
- `adapters.test.ts` : 51 vérifications hors ligne, avec processus simulés par `node -e` et fixtures.
- `probe.ts` : banc d'essai avec les opérations `create`, `send` (sonde, puis refus ou envoi avec nonce, puis verdict de délivrance et code de sortie), `busy` et `delivery`. Le point d'entrée `main()` est exporté et testable.
- `probe.test.ts` : 36 tests du point d'entrée, qui lancent `probe.ts` dans un sous-processus contre une CLI simulée.
- `CONTRAT-A0.md` : décisions explicites du lot A0 et points à vérifier en A2 à A4. Le texte du contrat est dans `AGENTS.md`, section « Relay externe ».
- `fixtures/fake-cli.cjs` : CLI simulée Claude ou Codex, choisie par `FAKE_MODE`. Elle ne contacte aucun réseau.
- `mcp-witness.cjs` : serveur MCP témoin inoffensif (stdio, un seul outil `witness_ping` qui renvoie un texte fixe), qui journalise son démarrage et chaque requête.
- `mcp-scenario.ts` : cas M1 à M5 et cas `user-*` de neutralisation MCP sur une vraie reprise Codex.
- `tui-scenario.ts` : scénario PTY (`node-pty`) avec un TUI ouvert au repos ou en génération, puis un relay externe ou un `codex queue`.

Pour rejouer :

```powershell
node --experimental-strip-types --test scripts/prototypes/relay/adapters.test.ts scripts/prototypes/relay/probe.test.ts
node --experimental-strip-types scripts/prototypes/relay/probe.ts send claude <session> "<message>" [--fork] [--force] [--cwd <dir>] [--timeout <ms>] [--kill-after-start <ms>]
node --experimental-strip-types scripts/prototypes/relay/probe.ts busy codex <session>
node --experimental-strip-types scripts/prototypes/relay/probe.ts delivery claude <session> "<nonce ou texte>"
node --experimental-strip-types scripts/prototypes/relay/mcp-scenario.ts <session-codex> [M1 M2 M3 M4 M5 user-baseline user-empty user-naive user-neutralized]
node --experimental-strip-types scripts/prototypes/relay/tui-scenario.ts <codex|claude> <session> <idle|generating|queue>
```

Variables d'environnement reconnues :

- Claude : `PROBE_CLAUDE_COMMAND`, `PROBE_CLAUDE_PREFIX_ARGS`, `PROBE_CLAUDE_MODEL`, `PROBE_CLAUDE_PLAN_ONLY=1`, `PROBE_CLAUDE_HOME` ;
- Codex : `PROBE_CODEX_COMMAND`, `PROBE_CODEX_PREFIX_ARGS`, `PROBE_CODEX_USER_CONFIG=1`, `PROBE_CODEX_MODEL`, `PROBE_CODEX_DISABLE_NOTIFY=1`, `PROBE_CODEX_NEUTRALIZE_MCP=1`, `PROBE_CODEX_HOME` ;
- communes : `PROBE_DISABLE_HOOKS=1`, `PROBE_EXTRA_ARGS` (tableau JSON d'arguments), `PROBE_WORKSPACE_ROOT` et `PROBE_TRACE_DIR`.

## Corrections apportées après la relecture de Codex

1. **Timer de kill.** `run()` conserve le timer `killAfterStartMs`, l'annule à `close`, et chaque timer vérifie `closed` avant d'agir. Un PID libéré, puis réattribué, n'est donc jamais tué. Couvert par 4 tests sur processus simulés : aucun kill après une sortie réussie, aucun kill de timeout dur après sortie, kill effectif d'un processus actif, timeout d'un processus silencieux. **[T]** Le premier test échoue sur une copie du module privée de l'annulation, ce qui reproduit le défaut signalé.
2. **Identité Claude.** `interpretClaudeOutput` ne retient jamais le `session_id` d'un résultat `is_error`. Une reprise réussie exige que tous les identifiants rapportés (`init`, `assistant`, `result`) égalent la cible (`same-as-target`), sinon on obtient `mismatch`. Un fork exige un identifiant unique et différent de la cible (`new-session`). La même règle s'applique à Codex via `thread.started`. Couvert par 6 tests. **[T]** E2, 2.1.292 : une reprise réelle rend `same-as-target`.
3. **Attachement séparé de l'activité.** `TargetProbe` expose :
   - `attachment` : `attached`, `detached` ou `unknown` ;
   - `activity` : `busy`, `idle` ou `unknown` ;
   - `processes[]`, avec une vivacité `alive`, `dead` ou `unverifiable` par PID ;
   - `lock`, pour Codex.

   `assessTarget` n'autorise que `detached`. Les règles de vivacité :
   - `ESRCH` = PID mort ;
   - `EPERM` = PID vivant ;
   - tout autre code, ou un PID invalide = `unverifiable` ;
   - une entrée de registre illisible rend l'attachement `unknown`.

   Couvert par 11 tests.
4. **Hooks et commandes automatiques.** Hooks témoins réels, voir la section 8.
5. **Délivrance.** Les statuts `replied`, `not-delivered`, `persisted-no-reply` et `unknown` sont définis, et la persistance est séparée de la visibilité dans la branche active. `not-delivered` est réservé aux refus certains avant envoi. Couvert par 6 tests et vérifié sur les vrais transcripts (section 6).
6. **Qualification par version.** Tous les constats sont désormais rattachés à E1, E2, E3, X ou V. La reprise Claude hors dossier a été retestée sur 2.1.292, et l'écart entre modèle annoncé et modèle réel est documenté.

## Troisième passe : MCP Codex et codes de sortie

### Serveur MCP témoin et neutralisation (X 0.151.0)

Le témoin `witness_project` est déclaré dans la couche **projet** du dossier jetable. Chaque cas reprend C1 en lecture seule (`read-only`, `approval_policy=never`, `--disable hooks`, `-c notify=[]`). Le message demande d'appeler `witness_ping` s'il est disponible. Les colonnes viennent du journal du témoin : démarrage, `tools/list` (outils exposés au modèle) et `tools/call` (outil exécuté).

| Cas | Config | Options testées | Démarré | Outils exposés | Appel exécuté | Réponse |
| --- | --- | --- | --- | --- | --- | --- |
| M1 | sans config utilisateur | projet de confiance (`-c projects=…`) | **oui** | **oui** | non : refusé par Codex | « MCP tool call requires approval, but approval policy is never » |
| M2 | sans config utilisateur | M1 + `-c mcp_servers={}` | **oui** | **oui** | non | idem M1 |
| M3 | sans config utilisateur | M1 + `-c mcp_servers.witness_project.enabled=false` | non | non | non | `AUCUN-OUTIL` |
| M4 | sans config utilisateur | projet **non** déclaré de confiance | non | non | non | `AUCUN-OUTIL` |
| M5 | sans config utilisateur | M1 + `-c mcp_servers.witness_project.default_tools_approval_mode="approve"` | **oui** | **oui** | **oui** | `WITNESS-PONG` |

Cas avec ta config utilisateur réelle et le projet de confiance. Le message demande seulement « OK », sans appel d'outil. Les journaux sont ceux de Codex avec `RUST_LOG=info`.

| Cas | Options | Témoin projet | Serveurs utilisateur nommés dans les journaux | Résultat |
| --- | --- | --- | --- | --- |
| `user-baseline` | aucune neutralisation | démarré, outils exposés | `cua_repl`, `linear`, `node_repl`, `codex_apps` | `OK` |
| `user-empty` | `-c mcp_servers={}` | démarré, outils exposés | `cua_repl`, `linear`, `node_repl`, `codex_apps` | `OK` |
| `user-naive` | `enabled=false` pour **chaque** serveur listé, y compris ceux des plugins | — | — | **exit 1 avant envoi** : `Error loading config.toml: invalid transport in mcp_servers.code-review` |
| `user-neutralized` | `--disable plugins --disable apps` + `enabled=false` pour chaque serveur listé **avec `--disable plugins` dans le `cwd` cible** | **non démarré** | **aucun** | `OK` |
| adapter `neutralizeMcp` | même règle, appliquée automatiquement par `CodexAdapter` (via `probe.ts`) | **non démarré** | **aucun** | `AUCUN-OUTIL`, exit 0 |

Constats :

- **[T]** **`-c mcp_servers={}` ne neutralise rien.** La table vide est fusionnée avec la configuration héritée, pas substituée. C'est vrai pour la couche projet (M2) comme pour la config utilisateur (`user-empty`), et `codex mcp list --json` donne le même résultat.
- **[T]** **`approval_policy=never` n'est pas une garantie.** Il bloque les appels MCP par défaut (M1), mais un serveur configuré avec `default_tools_approval_mode="approve"` voit ses outils exécutés malgré `read-only` (M5). **[D]** La documentation prévoit aussi `auto`, `writes` et des réglages par outil (`tools.<outil>.approval_mode`). Seule l'absence de serveur actif garantit qu'aucun outil MCP n'est appelé.
- **[T]** **Méthode qui marche :**
  1. lancer `codex mcp list --json --disable plugins --disable apps`, avec les mêmes `-c`, **dans le `cwd` de la cible** ;
  2. passer `-c mcp_servers.<nom>.enabled=false` pour chaque serveur listé ;
  3. reprendre avec `--disable plugins --disable apps`.
- **[T]** **La source d'un serveur compte.** Appliquer `enabled=false` à un serveur fourni par un plugin crée une entrée partielle, que Codex refuse au chargement. Ce refus survient avant tout envoi (exit 1). C'est `--disable plugins` qui retire ces serveurs (`code-review`, `codex_app`, `cua_repl` sur ce poste).
- **[T]** **La couche projet dépend du dossier.** Lister depuis le dossier du dépôt Palabre a fait manquer `witness_project`, qui a alors démarré. La liste doit être calculée dans le `cwd` de la cible.
- **[T]** **`codex_apps`**, le serveur intégré des connecteurs, n'apparaît jamais dans `codex mcp list`. Il est absent des journaux dans le cas neutralisé (`--disable plugins --disable apps`). La part propre à chaque flag n'est pas isolée.
- **[T]** Un projet non déclaré de confiance ne charge pas sa couche MCP (M4). C'est la même règle que pour les hooks du projet.

Limites de la neutralisation :

- **Preuve directe seulement pour la couche projet.** Le témoin n'a pas été placé dans `~/.codex/config.toml`, pour ne pas toucher ta config. Pour les serveurs utilisateur, la preuve est indirecte : leurs noms apparaissent dans les journaux sans neutralisation, et disparaissent avec.
- **Fenêtre de course.** La config peut changer entre `codex mcp list` et la reprise. Dans ce cas, un serveur ajouté dans l'intervalle démarrerait.
- **Politiques administrées.** **[D]** `requirements.toml`, les politiques MDM ou cloud peuvent imposer des serveurs ou des valeurs de fonctionnalités. **[H]** `enabled=false` et `--disable plugins` pourraient alors être ignorés ou refusés. Non testé.
- **Liste non fiable.** La sortie de `codex mcp list --json` est validée strictement : il faut un tableau d'objets, et dans chacun un `name` de type chaîne, non vide, exprimable en clé TOML nue (`[A-Za-z0-9_-]+`). Tout le reste donne un refus avant envoi `neutralization-failed` et aucune reprise n'est lancée : `[{}]`, `[{"name":42}]`, `[{"name":null}]`, un nom vide, `[null]`, un objet au lieu d'un tableau, une sortie non JSON, ou un échec de la commande. **[T]** Avant cette correction, `[{}]`, `[{"name":42}]` et `[{"name":null}]` étaient acceptés (le nom devenait `"undefined"`, `"42"` ou `"null"`) et la reprise partait. Les tests de la quatrième passe échouent sur l'ancienne logique.
- **Effet sur le contexte de la cible.** `--disable plugins` retire aussi les skills et outils apportés par les plugins, et `--disable apps` les connecteurs. La cible répond donc avec moins d'outils que dans sa conversation d'origine.
- **Config utilisateur obligatoire.** La neutralisation exige la config utilisateur, car `codex mcp list` n'accepte pas `--ignore-user-config`.

### Codes de sortie de `probe.ts send`

`relayOutcome` déduit une issue unique. Toute issue autre que `replied` sort en non nul :

| Code | Issues | Exemples couverts par `probe.test.ts` (CLI simulée) |
| --- | --- | --- |
| 0 | `replied` | réponse valide et identité `same-as-target` (Claude, Codex) |
| 1 | erreur interne | — (exception inattendue du banc d'essai) |
| 2 | `cli-failure`, `no-valid-reply` | exit non nul sans sortie ; `turn.failed` ; exit 0 sans `result` ni `agent_message` ; échec après persistance (`persisted-no-reply`) |
| 3 | `target-busy`, `target-state-unknown`, `neutralization-failed` | registre vivant `idle` (CLI jamais lancée) ; registre absent ou illisible ; refus Codex « active writer » ; liste MCP invalide (10 formes) ou en échec, sans aucun `exec resume` |
| 4 | `timeout` | CLI bloquée avec `--timeout 800` |
| 5 | `identity-mismatch` | réponse rapportée par une autre session |
| 6 | `session-not-found` | Claude « No conversation found » ; Codex « no rollout found » |
| 7 | `command-not-found` | exécutable Claude ou Codex introuvable au lancement (`ENOENT` avec dossier présent et exécutable absent) ; exécutable Codex introuvable dès `codex mcp list`, sans aucun lancement. Délivrance `not-delivered` dans les trois cas |
| 8 | `invalid-request` (raison `invalid-working-directory`) | Node présent mais dossier de travail absent : Claude, Codex au lancement, Codex à `codex mcp list`. Aucun appel à la CLI simulée, délivrance `not-delivered` |

Ordre de priorité : refus avant envoi (sonde, puis étape préalable), puis exécutable introuvable au lancement, puis timeout, puis refus certain de la CLI, puis cohérence de l'identité et validité de la réponse.

**[T]** Cinquième passe : sur une copie dont la détection `ENOENT` est retirée de `relayOutcome`, 4 tests échouent. Le cas de la liste MCP passe encore, car il suit le chemin des refus préalables.

**[T]** Sixième passe : Codex a montré qu'un `ENOENT` ne prouve pas l'absence de l'exécutable, puisque Node le renvoie aussi pour un dossier de travail absent. `diagnoseLaunchFailure` vérifie maintenant le dossier, puis l'exécutable. Le dossier est contrôlé avant tout lancement et avant `codex mcp list`. Sur une copie qui rétablit l'ancienne règle (« `ENOENT` veut dire exécutable introuvable », sans contrôle du dossier), 6 tests échouent.

**[T]** Les tests ont fait apparaître une règle : un registre Claude absent (`~/.claude/sessions` inexistant) rend l'attachement invérifiable, et le relay est refusé en `target-state-unknown`. C'est voulu, mais une installation Claude qui n'écrit pas ce registre ne pourra jamais être sonnée.

## 1. Commandes exactes, permissions et capture de la réponse

### Codex (X)

Commande de reprise :

```text
codex exec resume [--disable plugins --disable apps -c mcp_servers.<nom>.enabled=false …]
  --json --skip-git-repo-check [--disable hooks] [-c notify=[]] [-m <modèle enregistré>]
  -c sandbox_mode="read-only" -c approval_policy="never" <SESSION_ID> -
```

Le message est passé sur stdin avec `-`. Les options MCP entre crochets viennent de `codex mcp list` (voir « Troisième passe »).

- **[D]** `exec resume` n'accepte ni `-s/--sandbox` ni `-C/--cd`. La politique passe par `-c` et le dossier vient du `cwd` du processus.
- **[T]** Capture : `thread.started`, `turn.started`, `item.completed` (`agent_message`), `turn.completed`. Le succès exige un exit 0, un `turn.completed`, aucun `turn.failed` ni `error`, et au moins un `agent_message`.
- **[T]** L'écriture est bloquée par le bac à sable : `patch rejected: writing is blocked by read-only sandbox`.
- **[T]** En lecture seule, aucune commande shell n'a pu s'exécuter, donc aucune lecture de fichier :
  - sans config utilisateur : `blocked by policy` ;
  - avec config utilisateur : `CreateProcessAsUserW failed` sur le `pwsh.exe` installé depuis le Store.

  Cause non établie [H].

### Claude Code (E1, E2)

Commande de reprise :

```text
claude -p --output-format stream-json --verbose --permission-mode plan
  --tools Read,Glob,Grep --strict-mcp-config --settings '{"disableAllHooks":true}' --resume <SESSION_ID>
```

Le message est passé sur stdin.

- **[T]** Capture : `system/init`, puis `assistant`, puis `result`. Le succès exige un exit 0, `is_error` à false et une chaîne dans `result.result`.
- **[T]** E1 : `--permission-mode plan` seul laisse `Bash`, `Write`, `Edit` et les outils MCP de l'utilisateur. Le refus d'écrire venait du modèle. Avec `--tools Read,Glob,Grep --strict-mcp-config`, `init` ne liste plus que `Glob Grep Read`, sans serveur MCP.
- **[T]** E1 et E2 : ces options **n'empêchent pas** les hooks de s'exécuter (section 8).

## 2. Conservation du contexte

- **[T]** X, C1 : le mot-code donné au premier tour est restitué après `exec resume`, avec le même identifiant et le même rollout.
- **[T]** E1, K1 : même résultat, avec le même `.jsonl`.

## 3. États de la cible

| État de la cible | Codex (X) | Claude Code |
| --- | --- | --- |
| Inactive | **[T]** Relay accepté | **[T]** E1, E2 : relay accepté |
| Ouverte au repos dans le TUI | **[T]** **Refus** natif : exit 1, `already has an active writer (code -32600)`, rien n'est écrit | **[T]** Relay E1 vers un TUI E1 (scénario PTY) et vers un TUI E2 2.1.251 (onglet manuel) : **accepté**, invisible pour le TUI, perdu dès que celui-ci écrit un tour |
| TUI en cours de génération | **[T]** **Refus** natif identique | **[T]** E2 (TUI et relay en 2.1.292) : **accepté**, puis perdu de la même façon |
| Occupée par un autre `exec` / `-p` | **[T]** **Refus** natif | **[T]** E1 : **accepté**, deux processus écrivent en parallèle et créent deux branches |
| Session inconnue | **[T]** Exit 1, `no rollout found for thread id … (code -32600)` | **[T]** E1 : exit 1, `errors = ["No conversation found …"]` |
| Ouverte dans un desktop ou un IDE | **[T]** V tient le verrou d'écriture des 4 threads chargés. **[H]** `exec resume` serait refusé (non tenté) | **[T]** E3 apparaît dans le registre (`entrypoint=claude-desktop`, `status=busy/idle`). **[H]** Un relay serait accepté puis perdu (non tenté) |

`target-busy` signifie donc **« cible attachée à un processus »**, pas seulement « génération en cours ». Une cible Claude ouverte au repos (`idle`), ou sans champ `status` (E1), est refusée au même titre qu'une cible occupée.

## 4. Visibilité d'un tour ajouté par une CLI

- **[T]** X, TUI ouvert, avec `codex queue --thread <id> --message …` :
  - la commande rend la main en 0,3 s (`Queued message …`) ;
  - le TUI affiche le message, y répond et le garde en contexte ;
  - aucune réponse n'est rendue à l'appelant.
- **[T]** X, TUI ouvert, avec `exec resume` : refusé, donc rien à afficher.
- **[T]** Claude (TUI E1 et E2, relays E1 et E2) : le tour relayé n'apparaît pas à l'écran, et le TUI répond avec un code plus ancien. Dans le transcript, le tour suivant du TUI se rattache à sa propre dernière entrée, ce qui laisse le relay sur une branche abandonnée.
- **[T]** Nuance : un relay vers un TUI ouvert qui est ensuite fermé sans écrire reste sur la branche active (cas `RELAY-IDLE-1`). La perte survient quand le processus ouvert écrit après le relay. Elle n'est pas immédiate, mais elle est imprévisible pour l'appelant.
- Interfaces desktop et IDE : **non vérifié**.

## 5. Identifier une cible attachée

### Codex (X)

**[T]** Le signal est le fichier `~/.codex/thread-writer-locks/<thread>.lock`, **tenu** par l'écrivain actif. Une ouverture exclusive non destructive échoue alors en `EBUSY`.

- Fichier absent, ou présent mais libre (orphelin après un kill) : `detached`.
- Tout autre code, ou une plateforme autre que Windows : `unknown`.
- La CLI refuse aussi elle-même toute seconde écriture, de façon atomique. Un relay qui perd la course contre un écrivain arrivé entre la sonde et le lancement reçoit ce refus. Il est classé `target-busy` et `not-delivered`.
- La sonde ne renseigne pas l'activité : `activity` vaut toujours `unknown`.

### Claude Code

**[T]** Il n'y a pas de verrou. Chaque processus écrit `~/.claude/sessions/<pid>.json` (`sessionId`, `kind`, `entrypoint`, et `status` selon la version) :

| Exécutable | Entrée de registre | Champ `status` |
| --- | --- | --- |
| E1 2.1.85 (TUI et `-p`) | présente | absent |
| E2 2.1.251 / 2.1.292 | présente | `idle` → `busy` → `idle` |
| E3 2.1.289 (desktop) | présente | présent |

- Un `-p` actif s'enregistre aussi (`entrypoint=sdk-cli`).
- Règle retenue : toute entrée **vivante** pour la session donne `attached`, quel que soit `status`.
- Un PID mort est ignoré. Un PID invérifiable, ou une entrée illisible, donne `unknown`.

Limites :

- **[H]** Un PID réattribué à un autre processus est vu comme vivant. C'est un faux positif prudent, qu'on pourrait réduire avec le champ `procStart` du registre (non exploité).
- Il reste une fenêtre de course entre la sonde et l'écriture, car Claude n'a pas de verrou.
- Un écrivain qui ne s'enregistre pas échappe à la sonde. Un verrou Palabre seul ne couvrirait pas ce cas non plus.

## 6. Timeouts et preuve de délivrance

Constats :

- **[T]** X, kill 12 s après `turn.started` : le message utilisateur est dans le rollout, suivi d'un `reasoning`, sans réponse. `turn.started` sur stdout peut précéder l'écriture du message (écart vu jusqu'à 5 s). Ce n'est donc pas une preuve.
- **[T]** X, erreur API 400 (exit 1) : le message est quand même enregistré.
- **[T]** E1, kill 5 s après `system/init` : le message est écrit dès le démarrage. Au `--resume` suivant, Claude ajoute un tour synthétique « No response requested. ».
- **[D]** `--replay-user-messages` (Claude) renvoie le message sur stdout, mais son lien avec la persistance n'est pas vérifié.

Règles du prototype :

| Statut | Condition |
| --- | --- |
| `not-delivered` | Seulement pour un refus **certain avant envoi** : refus de la sonde Palabre (CLI non lancée), `active writer` / `no rollout found` (X), `No conversation found` sans tour joué (E1). Ces refus ont été observés sans aucune écriture. |
| `replied` | Réponse capturée **et** identité cohérente. Une réponse de `mismatch` n'est pas une réponse de la cible. |
| `persisted-no-reply` | Le nonce figure dans une **entrée utilisateur** de l'historique de la cible. |
| `unknown` | Tous les autres échecs. **L'absence du nonce ne prouve pas la non-délivrance** : écriture différée, autre branche, historique illisible ou stockage non couvert. |

`persisted` (le nonce est-il écrit ?) et `inActiveBranch` (la prochaine reprise le verra-t-elle ?) sont rendus séparément.

- La branche active Claude est déterminée par une heuristique conforme aux observations, mais non documentée par le fournisseur : on part de la dernière entrée de conversation écrite (hors `isSidechain`), et on remonte par `parentUuid`, ou par `logicalParentUuid` après une compaction. Une chaîne cassée donne `unknown`.
- Le rollout Codex est traité comme linéaire (un seul écrivain).

**[T]** Vérification sur les vrais transcripts de test, sans appel de modèle (opération `delivery`) :

| Historique | Texte cherché | `persisted` | `inActiveBranch` | Cohérent avec |
| --- | --- | --- | --- | --- |
| K1 | `ORCHIDEE-7`, `NONCE-KILL-7Q2` | true | true | fork K1-F |
| K1 | `RELAY-CONCURRENT-CLAUDE`, `RELAY-IDLE-…`, `RELAY-GENERATING-…` | true | **false** | fork K1-F, qui ne les connaît pas |
| K1 | texte inexistant | false | unknown | — |
| C1 | `MARQUEUR-KILL-CODEX`, `RELAY-QUEUE-…` | true | true | fork C1-F |
| C1 | `RELAY-CONCURRENT` (relay refusé) | false | unknown | refus `active writer` |

## 7. Fork

- **[T]** X : `codex exec fork <id> -` produit un nouvel identifiant (`thread.started`) et un nouveau rollout. Le contexte est hérité et le rollout de C1 reste inchangé.
- **[T]** E1 : `--resume <id> --fork-session` produit un nouveau `session_id`. Le contexte hérité est celui de la branche active, et le transcript de K1 reste inchangé.
- Le fork reste hors MVP.

## 8. Lecture seule : hooks, commandes automatiques et garanties exactes

### Hooks témoins

Hooks `SessionStart`, `UserPromptSubmit` et `Stop` déclarés dans le projet jetable, plus une commande `notify` témoin passée par `-c` pour Codex :

| Cas | Exécutable | Options | Témoins exécutés |
| --- | --- | --- | --- |
| H1 | E1 2.1.85 | `plan` + `--tools Read,Glob,Grep --strict-mcp-config` | **SessionStart, UserPromptSubmit, Stop** |
| H2 | E1 2.1.85 | H1 + `--settings '{"disableAllHooks":true}'` | aucun |
| H3 | E2 2.1.292 | comme H1 | **SessionStart, UserPromptSubmit, Stop** |
| H4 | E2 2.1.292 | H3 + `disableAllHooks` | aucun |
| H5 | E2 2.1.292 | H3 + `--safe-mode` | aucun |
| H6 | X | lecture seule, projet déclaré de confiance par `-c`, hooks non validés | **notify** (hooks ignorés : non validés) |
| H7 | X | H6 + `--dangerously-bypass-hook-trust` (simule des hooks validés) | **SessionStart, UserPromptSubmit, Stop, notify** |
| H9 | X | H7 + `-c notify=[]` | **SessionStart, UserPromptSubmit, Stop** |
| H8 | X | H7 + `--disable hooks` + `-c notify=[]` | aucun |

Ce que ces résultats établissent :

- **[T]** `Read,Glob,Grep` (Claude) et le bac à sable `read-only` (Codex) **ne prouvent pas l'absence de mutation** : les hooks et `notify` s'exécutent hors du bac à sable, avec les droits de l'utilisateur.
- **[T]** Claude : `--permission-mode plan` en `-p` saute le dialogue de confiance, et les hooks du projet de la session cible s'exécutent. **[D]** C'est documenté dans l'aide de `-p`.
- **[T]** Codex : `exec` ignore les hooks non validés. **[D]** Il exécute les hooks validés et les hooks gérés (MDM, `requirements.toml`). La config utilisateur de ce poste définit une commande `notify`, qui s'exécuterait à chaque relay sans `-c notify=[]`.
- **[T]** `--disable hooks` (X) neutralise les hooks. Le test H9 montre que `-c notify=[]` ne les coupe pas : il ne coupe que `notify`.

### Garanties exactes avec les options retenues

Options retenues :

- Claude : `plan`, `--tools Read,Glob,Grep`, `--strict-mcp-config`, `disableAllHooks` ;
- Codex : `read-only`, `approval_policy=never`, `--disable hooks`, `notify=[]`, et neutralisation MCP (`--disable plugins --disable apps`, plus `enabled=false` pour chaque serveur listé dans le `cwd` cible).

| Surface | Claude (E1, E2) | Codex (X) |
| --- | --- | --- |
| Outils d'écriture du modèle | **[T]** Absents (`init` : `Glob Grep Read`) | **[T]** Patch et shell bloqués par le bac à sable |
| Hooks du projet et de l'utilisateur | **[T]** Hooks du projet coupés. **[H]** Hooks utilisateur et de plugins coupés aussi (non testés, pour ne pas toucher `~/.claude`) | **[T]** Hooks du projet coupés. **[H]** Hooks utilisateur coupés aussi (non testés, pour ne pas toucher `~/.codex`) |
| Hooks gérés (politique d'administration) | **[D]** Non désactivables (`--safe-mode` : « managed settings still apply ») | **[D]** Non désactivables par l'utilisateur |
| Serveurs MCP | **[T]** Aucun avec `--strict-mcp-config` | **[T]** Neutralisation vérifiée **sur les configurations testées** : aucun démarrage ni outil exposé pour le témoin du projet, les serveurs utilisateur, les plugins et `codex_apps`. Elle tient **sous réserve** d'une config inchangée entre l'inspection (`codex mcp list`) et la reprise. Les politiques administrées ne sont pas couvertes. Pour la couche utilisateur, la preuve est indirecte. **[T]** Sans neutralisation, un outil pré-approuvé s'exécute malgré `read-only` et `approval_policy=never` (M5). **[T]** `-c mcp_servers={}` est inopérant. |
| Commande `notify` | sans objet | **[T]** Coupée par `-c notify=[]` |
| Autres commandes de réglages (`apiKeyHelper`, `statusLine`…) | **[H]** Non examinées. `--safe-mode` (2.1.292 seulement) les désactiverait, mais retire aussi CLAUDE.md et les skills du contexte de la cible | sans objet connu |
| État propre à la CLI | **[T]** Écrit toujours : transcript, registre `sessions/`, dossier `memory/` vide créé par dossier de travail | **[T]** Écrit toujours : rollout, verrou (laissé après un kill), base d'état. La fonctionnalité `memories` est active par défaut et coupée seulement dans le prototype |

La garantie qu'on peut annoncer est conditionnelle :

> **« La cible ne dispose d'aucun outil d'écriture. Les hooks et la commande `notify` non gérés sont neutralisés. La neutralisation des serveurs MCP a été vérifiée sur les configurations testées, sous réserve que la configuration ne change pas entre l'inspection et la reprise. Elle ne couvre pas les politiques administrées. »**

On ne peut annoncer ni une absence absolue de serveur MCP ni une absence globale de mutation :

- les hooks, serveurs et réglages imposés par une politique administrée ne sont pas couverts (**[H]** non testés) ;
- la config peut changer entre `codex mcp list` et la reprise ;
- pour la couche utilisateur, la preuve vient des journaux, et non d'un témoin ;
- les CLIs écrivent leur propre état.

## Autres constats

- **Dossier de travail Claude :**
  - **[T]** E1 2.1.85 : la reprise hors du dossier d'origine échoue (« No conversation found », exit 1) ;
  - **[T]** E2 2.1.292 : elle réussit, le tour est ajouté au transcript d'origine et sur la branche active, mais avec le **nouveau dossier comme `cwd`**, si bien que les outils de lecture s'y exécutent ;
  - **[D]** selon Codex, la recherche élargie est documentée depuis 2.1.223. Les versions entre 2.1.85 et 2.1.292 ne sont pas testées.

  Le relay doit donc toujours lancer Claude dans le `cwd` lu dans le transcript. **[T]** Codex (X) reprend par identifiant depuis n'importe quel dossier.
- **Modèle annoncé et modèle réel (Claude)** : **[T]** toutes les traces annoncent `claude-haiku-4-5-20251001` dans `init`, mais les tours ont été servis par `claude-sonnet-4-6` (E1) et `claude-sonnet-5-5` (E2), d'après `assistant.message.model` et `modelUsage`. La cause n'est pas établie [H]. Le champ `init.model` ne prouve donc pas le modèle utilisé. Le prototype rapporte `declaredModel` et `observedModels`. Les constats précédents restent valables, mais ils ont été faits avec Sonnet, pas avec Haiku.
- **Changement de modèle Codex** : **[T]** reprendre avec un autre modèle que celui enregistré injecte `<model_switch>`, et un tour en échec suffit à changer le modèle enregistré. Il faut réutiliser le modèle du dernier `turn_context`.
- **Identifiant de l'expéditeur** : **[T]** E3 expose `CLAUDE_CODE_SESSION_ID` aux commandes de l'agent. Ce n'est pas vérifié pour E1, E2 ni Codex.
- **Mise à jour automatique** : **[T]** le TUI E2 s'est mis à jour pendant la première passe (2.1.251 → 2.1.292).

## Matrice des capacités

| Capacité | Codex (X 0.151.0) | Claude Code |
| --- | --- | --- |
| Reprise non interactive par identifiant | **[T]** `exec resume <id> -` | **[T]** E1, E2 : `-p --resume <id>` |
| Contexte conservé | **[T]** Oui | **[T]** E1 : oui (branche active) |
| Réponse capturable, identité vérifiée | **[T]** `agent_message` + `thread.started` | **[T]** E1, E2 : `result` + identifiants de `init`, `assistant` et `result` |
| Aucun outil d'écriture | **[T]** Oui. Shell entièrement bloqué sur ce poste | **[T]** E1 : oui avec `--tools` ; **non** avec `plan` seul |
| Hooks et `notify` neutralisables | **[T]** `--disable hooks` + `-c notify=[]` | **[T]** E1, E2 : `disableAllHooks` ; E2 : aussi `--safe-mode` |
| MCP neutralisés | **[T]** Sur les configurations testées : `--disable plugins --disable apps` + `enabled=false` par serveur listé (liste validée strictement) dans le `cwd` cible. Sous réserve d'une config inchangée ; politiques administrées non couvertes. `mcp_servers={}` est inopérant | **[T]** `--strict-mcp-config` |
| Dossier de travail requis | **[T]** Non | **[T]** E1 : obligatoire. E2 : reprise possible ailleurs, mais avec un `cwd` faux |
| Refus natif d'une cible attachée | **[T]** Oui, atomique | **[T]** E1, E2 : non |
| Sonde d'attachement | **[T]** Verrou tenu (EBUSY), orphelin possible | **[T]** Registre avec PID vivant ; `status` seulement en E2 et E3 |
| Délivrance à une conversation ouverte | **[T]** `codex queue`, asynchrone, sans réponse | **[T]** Non : tour invisible puis orphelin |
| Message persisté avant un échec | **[T]** Possible (kill, erreur API) | **[T]** E1 : possible (kill) |
| Preuve de persistance et de branche | **[T]** Nonce dans le rollout | **[T]** Nonce + chaîne `parentUuid` (heuristique) |
| Fork | **[T]** `exec fork <id> -` | **[T]** E1 : `--resume <id> --fork-session` |
| Desktop / IDE | Non vérifié. Verrou tenu par V **[T]** | Non vérifié. Registre E3 détectable **[T]** |

## Points non vérifiés

- Les conversations ouvertes dans Claude desktop, Codex desktop ou l'extension VS Code (seuls les verrous et le registre ont été observés).
- La neutralisation des hooks utilisateur et de plugins (Claude) et des hooks utilisateur (Codex). Seuls les hooks du projet ont été testés.
- La neutralisation d'un serveur MCP témoin placé dans la config **utilisateur**. Elle n'a été prouvée que pour la couche projet ; pour les serveurs utilisateur réels, la preuve vient seulement des journaux.
- L'effet des politiques administrées (`requirements.toml`, MDM, cloud) sur `enabled=false`, `--disable plugins` et `--disable apps`.
- La part respective de `--disable plugins` et de `--disable apps` dans l'arrêt de `codex_apps`.
- Les commandes `apiKeyHelper`, `statusLine` et autres réglages exécutables de Claude.
- La cause de l'écart entre modèle annoncé et modèle réel chez Claude, et l'effet de `--model` sur une session enregistrée avec un autre modèle.
- La lecture de fichiers par Codex en lecture seule quand le shell fonctionne.
- La règle exacte du fournisseur pour choisir la branche reprise par Claude (heuristique observée seulement).
- `--replay-user-messages` comme accusé de persistance.
- Les versions de Claude Code entre 2.1.85 et 2.1.251/2.1.292, et les plateformes autres que Windows.
- La messagerie inter-sessions de Claude Code, comme piste de délivrance vers une conversation ouverte.

## Contrat MVP révisé

```text
palabre relay --from <agent>:<session> --to <agent>:<session> ("<message>" | --message-file <f>)
              [--timeout <secondes>] [--json] [--no-export]
```

Les étapes, toutes non interactives :

1. **Valider.** Les deux sessions sont explicites ; aucune sélection de la plus récente. `--to` désigne `codex` ou `claude`. L'expéditeur peut être actif ; seul l'état de la cible est contrôlé.
2. **Résoudre la cible** à partir de son identifiant seul :
   - Codex : rollout, `session_meta.cwd`, modèle du dernier `turn_context` ;
   - Claude : transcript, et `cwd` lu dans ses entrées ;
   - historique introuvable : erreur `session-not-found`, avec `not-delivered`.
3. **Sonder l'attachement :**
   - `attached` : erreur `target-busy`, avec `not-delivered` ;
   - `unknown` : erreur `target-state-unknown`, avec `not-delivered` ;
   - `target-busy` veut dire « cible attachée », que le processus soit en génération ou au repos ;
   - aucune relance automatique.
4. **Envelopper** le message avec l'expéditeur, la cible et un nonce.
5. **Neutraliser les MCP (Codex)** : lancer `codex mcp list --json --disable plugins --disable apps` avec les mêmes `-c`, dans le `cwd` de la cible, puis valider strictement la sortie : un tableau d'objets, avec dans chacun un `name` de type chaîne, non vide et exprimable en clé TOML nue. Toute autre sortie, ou un échec de la commande, donne `neutralization-failed` : refus avant envoi, `not-delivered`, aucune reprise lancée.
6. **Lancer la CLI** sans shell, avec l'environnement de l'hôte nettoyé, le message sur stdin, dans le `cwd` de la cible et avec un timeout dur :
   - Codex : `exec resume --disable plugins --disable apps -c mcp_servers.<nom>.enabled=false … -c sandbox_mode="read-only" -c approval_policy="never" --disable hooks -c notify=[] -m <modèle enregistré>` ;
   - Claude : `-p --resume … --permission-mode plan --tools Read,Glob,Grep --strict-mcp-config --settings '{"disableAllHooks":true}'`, sans `--model`.
7. **Interpréter le résultat :**
   - succès avec identité `same-as-target` : `replied` ;
   - refus Codex `active writer` (course perdue) : `target-busy`, avec `not-delivered` ;
   - tout autre échec : recherche du nonce, qui donne `persisted-no-reply` (avec `inActiveBranch`) ou `unknown`.
8. **Sortir le résultat :**
   - JSON : `status`, `delivery` (`status`, `persisted`, `inActiveBranch`), `from`, `to`, `reply`, `identity`, `observedModels`, `error` (`kind`, `message`), `exportPath` ;
   - export `.relay.md` ;
   - code de sortie selon le tableau ci-dessous.

Issues et codes de sortie, dans un adapter « session externe » distinct des adapters de débat. Ils ont été validés dans le prototype par `probe.test.ts`, sauf `usage-limit`, qui reste à reprendre des adapters existants. Le contrat complet, avec `output-too-large` (2), `invalid-request` (8) et `cancelled` (130), est dans `AGENTS.md`, section « Relay externe ».

| Code | Issue |
| --- | --- |
| 0 | `replied` |
| 2 | `cli-failure`, `no-valid-reply`, `usage-limit` |
| 3 | `target-busy`, `target-state-unknown` (y compris registre Claude absent ou illisible), `neutralization-failed` |
| 4 | `timeout` |
| 5 | `identity-mismatch` |
| 6 | `session-not-found` |
| 7 | `command-not-found` (proposé ; 127 écarté, car un shell le rend déjà quand `palabre` est introuvable) |

Chaque issue porte le statut de délivrance. Les trois refus avant envoi (code 3) sont toujours `not-delivered`.

**Hors MVP :**

- le fork ;
- `codex queue` ;
- la détection automatique de l'expéditeur ;
- toute compatibilité desktop ou IDE ;
- toute délivrance vers une conversation ouverte.

**Prérequis avant d'annoncer « lecture seule » :**

- ~~neutraliser et tester les MCP Codex~~ : vérifié sur les configurations testées, pour la couche projet (preuve par le témoin) et la config utilisateur (preuve par les journaux), avec une validation stricte de la liste ;
- employer la formulation conditionnelle de la section 8, jamais une garantie absolue ;
- documenter que la neutralisation retire à la cible ses plugins, ses connecteurs et ses MCP.

**Limite produit inchangée : conversations fermées uniquement.** Aucun de ces travaux ne permet de sonner une conversation ouverte.

## Décisions retenues après la relecture de Codex

1. **Attachement Claude inconnu** : refus conservé (`target-state-unknown`), y compris quand le registre est absent ou illisible.
2. **Heuristique de branche Claude** : diagnostic seulement. `inActiveBranch` est rapporté, mais le statut de délivrance ne dépend que de la persistance du nonce. La valeur devient `unknown` dès que la chaîne est incomplète.
3. **Architecture** : un adapter « session externe » distinct des adapters de débat (`generate(prompt)`), avec `src/exec.ts` réutilisé et aucun cas spécial dans l'orchestrateur.
4. **Échec de neutralisation** : refus avant envoi (`neutralization-failed`, code 3, `not-delivered`), implémenté et testé dans le prototype.
5. **Garantie** : formulation conditionnelle (section 8).

Points arbitrés après la quatrième relecture de Codex (détail dans `CONTRAT-A0.md`, partie 2) :
- la perte des plugins, connecteurs et MCP pendant la reprise est acceptée et documentée dans le contrat ;
- `command-not-found` a son propre code de sortie (7 proposé), distinct de l'erreur interne ;
- la commande est résolue depuis la config Palabre approuvée, le registre `KNOWN_CLI_AGENTS` et `src/exec.ts`, sans réutiliser les arguments de débat (proposé).

## Découpage d'implémentation

Deux objectifs distincts.

### A. Première version : relay vers une conversation fermée (implémentable)

Périmètre : `palabre relay --from <agent>:<session> --to <agent>:<session>` vers une conversation Codex ou Claude Code **à laquelle aucun processus n'est attaché**. Un appel, une réponse, lecture seule conditionnelle. Le refus est structuré dans tous les autres cas.

Chaque lot fait l'objet d'une PR courte, avec ses tests sous `tests/`, sa JSDoc, et sa documentation quand une surface utilisateur change (règles d'`AGENTS.md`).

| Lot | Contenu | Fichiers indicatifs | Critères de sortie |
| --- | --- | --- | --- |
| A0 — Contrat | Section « Relay » d'`AGENTS.md` : syntaxe, schéma JSON v1 de `--json`, issues et codes de sortie, statuts de délivrance, garantie conditionnelle, limite « conversations fermées » | `AGENTS.md` | Contrat relu par le mainteneur et par Codex |
| A1 — Socle | Types partagés (`ExternalSession`, `TargetProbe`, `DeliveryEvidence`, issues), lancement sans shell avec timers annulés à la fin, environnement de l'hôte nettoyé, enveloppe avec nonce, `classifyDelivery`, `relayOutcome` | `src/externalSessions/{types,process,envelope,outcome}.ts`, `src/exec.ts` (réutilisé) | Tests timers et kill (dont la mutation), issues, délivrance |
| A2 — Adapter Claude | Transcript et `cwd`, registre (attachement et activité), options de lecture seule renforcées, interprétation et identité, nonce et branche (diagnostic) | `src/externalSessions/claude.ts` | Tests fixtures, sonde et CLI simulée |
| A3 — Adapter Codex | Rollout, `cwd` et modèle enregistré, verrou d'écriture, neutralisation MCP avec validation stricte, hooks et `notify`, refus certains | `src/externalSessions/codex.ts` | Tests sonde, liste MCP (formes invalides), CLI simulée |
| A4 — Commande | `palabre relay` : arité dans `src/args.ts`, aide, i18n FR/EN, sortie texte et `--json`, export `.relay.md` dans `outputDir`, codes de sortie. Documentation dans la même PR : README, `docs/guide/{fr,en}`, `ROUTE_MAP`, CHANGELOG | `src/commands/relay.ts`, `src/messages/relay.ts`, `src/args.ts`, `src/output.ts` | Tests du point d'entrée avec CLI simulée, comme `probe.test.ts` |
| A5 — Smoke réel | Script hors `pnpm test` : sessions jetables, cas inactif, cible attachée et neutralisation MCP, sur vrais agents | `scripts/smoke_real_relay.ts` | Lancé avant release, comme `smoke:real-presets` |

Hors de la première version :
- le fork ;
- `codex queue` ;
- la détection automatique de l'expéditeur ;
- les desktops et IDE ;
- l'intégration Palabre-vscode, qui consommera plus tard `--json` sans recalculer l'état.

### B. Relay entre agents ouverts : objectif de l'issue #96, **non résolu**

Le besoin initial de l'issue (deux agents qui travaillent chacun dans une conversation ouverte et se sonnent sans facteur humain) **n'est pas couvert par la version A**. Constats établis :

- **Codex** : une conversation ouverte refuse toute écriture externe (« active writer »). `codex queue` délivre le message à la conversation ouverte, mais ne rend pas la réponse.
- **Claude Code** : une conversation ouverte accepte l'écriture externe, mais le tour est invisible pour le processus ouvert et devient orphelin dès qu'il écrit.

Pistes à étudier, toutes **[H]** et hors périmètre A :

1. **Relay asynchrone Codex** : `codex queue`, puis récupération de la réponse dans le rollout (identifiant du message mis en file, puis réponse suivante). Cela change le contrat (« déposer, puis consulter ») et suppose un relevé ou un suivi du rollout.
2. **Protocole app-server Codex** : un client du serveur qui détient la conversation, au lieu d'un second écrivain.
3. **Messagerie inter-sessions de Claude Code** : socket de messagerie observé dans l'environnement desktop (`CLAUDE_CODE_MESSAGING_SOCKET`), fonctionnalité annoncée dans des versions récentes. Non examinée.
4. **Boîte aux lettres livrée par hook** : Palabre dépose le message, et un hook `UserPromptSubmit` ou `SessionStart` de l'agent ouvert l'injecte au tour suivant. Il n'y a alors pas d'écrivain concurrent, mais la délivrance dépend du prochain tour de la conversation ouverte.

Suivi retenu après la quatrième relecture de Codex :
- l'issue #96 garde B, les conversations ouvertes ;
- A est suivie dans une sous-issue liée, car A ne résout pas #96 ;
- l'étude de B n'attend pas la livraison de A.

Le contrat « un appel, une réponse » devra probablement être révisé pour les conversations ouvertes.

## Lot A5 : smoke réel (`pnpm smoke:real-relay`)

Script : `scripts/smoke_real_relay.ts`, hors `pnpm test`, lancé après `pnpm build`.
- Il crée deux sessions **jetables**, une Claude Code et une Codex, dans un dossier temporaire `%TEMP%\palabre-relay-smoke-<horodatage>\`.
- Il passe par la CLI compilée (`dist/index.js relay`), ou par les modules compilés pour les vérifications de journaux.
- Aucune session de travail n'est touchée. Les identifiants figurent seulement dans `.tmp/relay-smoke/<horodatage>.json`.

Exécutables et versions, relevés par le smoke (résolution D21) :

| CLI | Version | Lancement |
| --- | --- | --- |
| Claude Code | `2.1.85` | alias natif `WindowsApps\claude.exe` (E1, premier du PATH) |
| Codex | `codex-cli 0.151.0` | `node.exe …\npm\node_modules\@openai\codex\bin\codex.js` (shim npm reconnu, D21) |
| Node | `v22.17.1` | Windows 11 |

Résultats du second passage (18/19), 7 octobre 2026 :

| Cas | Résultat |
| --- | --- |
| Liste MCP Codex stricte dans le dossier de la cible | **[T]** 2 serveurs déclarés en config : `linear`, `node_repl` |
| Codex fermé | **[T]** `replied`, code 0, délivrance `replied` (`persisted: true`), identité `same-as-target`, **contexte conservé** (nom de projet retrouvé) |
| Claude fermé | **[T]** `replied`, code 0, délivrance `replied`, identité `same-as-target`, export écrit. **Contexte non restitué** : la cible refuse de répondre (voir les limites) |
| Neutralisation MCP Codex | **[T]** Reprise témoin non neutralisée (`RUST_LOG=info`) : `linear`, `node_repl` et `codex_apps` mentionnés dans les journaux. Échange du relay : aucun, et réponse `OK` |
| Outillage Claude pendant le relay | **[T]** `system/init` : outils `Glob, Grep, Read`, aucun serveur MCP |
| Claude attaché (TUI ouvert dans un pseudo-terminal) | **[T]** sonde `attached` (entrée de registre vivante, `kind=interactive`), refus `target-busy` code 3, `not-delivered`, transcript inchangé (17 → 17 entrées) |
| Codex attaché (TUI ouvert dans un pseudo-terminal) | **[T]** sonde `attached` (verrou tenu, `EBUSY`), refus `target-busy` code 3, `not-delivered`, rollout inchangé (45 → 45 entrées) |

Limites observées :

1. **Claude traite le message relayé comme une injection de prompt [T].**
   - Avec 2.1.85 (réponses de `claude-sonnet-4-6`), la cible refuse de communiquer un élément de sa conversation à « un expéditeur externe », même neutre (un nom de projet). Avec un « mot de code », au premier passage, le refus était identique.
   - Comparaison sur des sessions jetables neuves, une par variante :

     | Enveloppe | Réponse |
     | --- | --- |
     | actuelle (en-tête, expéditeur, consigne de réponse) | refus « injection de prompt » |
     | sans la consigne de réponse | refus |
     | sans en-tête ni expéditeur | **répond** |
     | actuelle + `--append-system-prompt` : cadre opérateur indiquant que des questions d'un autre agent de l'utilisateur peuvent arriver par `palabre relay` | **répond** (identité `same-as-target`) |

   - Retirer l'en-tête masquerait la provenance du message, ce que le contrat exclut. Le cadre opérateur garde l'enveloppe transparente. Il est proposé comme décision **D22** (`CONTRAT-A0.md`), à valider avant toute modification des arguments Claude.
2. **Modèle Claude [T].** Avec 2.1.85, une création avec `--model haiku` produit des réponses de `claude-sonnet-4-6`, et la reprise sans `--model` aussi. Le contrat ne choisit pas de modèle pour Claude ; le modèle effectif reste celui que la CLI retient.
3. **Modèle Codex enregistré refusé par le compte [T].**
   - Au premier passage, la config Codex désignait `gpt-6.1-sol`. La création comme la reprise ont échoué avec « The 'gpt-6.1-sol' model is not supported when using Codex with a ChatGPT account » (400), après écriture du message.
   - Le relay rend alors `cli-failure` avec une délivrance `persisted-no-reply`, conformément au contrat.
   - Le second passage a créé la session Codex avec `-m gpt-5.6-sol` (`PALABRE_SMOKE_CODEX_MODEL`). Le relay a repris ce modèle enregistré et répondu.
4. **E2 (`~/.local/bin/claude.exe`, 2.1.292) n'a pas été exercé en A5** : le PATH résout d'abord l'alias `WindowsApps` (2.1.85). Les constats 2.1.292 restent ceux des passes précédentes.
5. **Bruit node-pty [T].** `pty.kill()` lance un agent de liste de console qui échoue (`AttachConsole failed`) une fois le TUI terminé. Le smoke arrête désormais l'arbre de processus sans `pty.kill()`. Ce point concerne le smoke, pas le relay.

### A5, suite : cadre opérateur D22 et critères du smoke corrigés

**D22 implémentée.**
- L'adapter Claude ajoute `--append-system-prompt` avec un texte fixe, `relayMessages.<langue>.operatorFrame`, dans la langue du relay.
- L'enveloppe et toutes les restrictions sont inchangées.
- Aucun contenu du message n'entre dans le cadre : un test de bout en bout le vérifie sur les arguments réellement reçus.

**Portée selon la version [T]**, avec une sonde : une consigne système stricte, ajoutée seulement à la reprise, qui exige un marqueur de fin.

| Version | Consigne ajoutée à la reprise appliquée ? |
| --- | --- |
| 2.1.85 | oui |
| 2.1.292 | **non**, deux sondes, dont une consigne « réponds uniquement par le marqueur » : le prompt enregistré avec la session prévaut |

Le cadre n'est pas écrit dans le transcript, ni en 2.1.85 ni en 2.1.292.

**Décompte des questions relayées sur le contexte [T]** (sessions jetables neuves, question neutre « comment s'appelle le projet de test ») :

| Version | Sans cadre | Avec le cadre D22 |
| --- | --- | --- |
| 2.1.85 (`claude-sonnet-4-6`) | 5 refus « injection de prompt » sur 5, dont un cite le nom du projet sans accepter la demande ; plus 1 refus sur 1 avec un « mot de code » | 2 réponses sur 2 |
| 2.1.292 (`claude-opus-5-5`, `claude-sonnet-5-5`) | 2 réponses sur 2 | 2 réponses sur 2 (cadre non appliqué, d'après la sonde) |

Les cinq questions neutres sans cadre ont été refusées avec 2.1.85 ; les deux essais avec cadre ont reçu la réponse attendue. Avec 2.1.292, aucun refus n'a été observé dans ces essais ; les sondes indiquent que le cadre ajouté à la reprise n'est pas appliqué. Ces petits échantillons ne garantissent ni l'acceptation des prochaines questions ni l'effet du cadre sur d'autres versions.

**Correction du bilan par Codex (7 octobre 2026).** Le témoin de la trace `2026-10-07T17-53-53-509Z` avait été compté comme une réponse parce que son texte contenait le nom du projet. La lecture de la réponse complète confirme un refus explicite qui cite ce nom. Le smoke exige désormais le seul nom attendu, après `trim()`, pour les vérifications de contexte Claude et Codex. Son observation sans cadre conserve la réponse complète et sépare réponse attendue et simple mention ; elle n'infère plus automatiquement un refus, ni la nécessité du cadre. Les deux traces finales ont été revérifiées hors ligne avec ce critère strict : leurs quatre réponses de contexte le satisfont. Aucun nouvel appel à un agent réel n'a été effectué pour cette correction.

**Critères du smoke corrigés** (revue A5) :
- Claude : il faut un `system/init` présent, avec des listes `tools` non vide et `mcp_servers`, plus un échange `replied` sur la bonne session. Une absence d'`init` échoue.
- Codex : il faut un témoin exploitable (reprise réussie et serveurs mentionnés), puis un échange du relay `replied`, de la bonne session et avec une réponse valide. Les journaux restent présentés comme un **indice**.
- `PALABRE_SMOKE_CLAUDE_COMMAND` permet de viser une autre installation de Claude Code.
- Une observation « sans cadre » est faite sur une session neuve ; une citation dans un refus ne compte pas comme la réponse attendue.

**Résultats du smoke corrigé** :

| Exécution | Vérifications |
| --- | --- |
| Claude Code 2.1.85 (alias `WindowsApps`) + Codex 0.151.0 | **19/19** |
| Claude Code 2.1.292 (`~/.local/bin/claude.exe`) + Codex 0.151.0 | **19/19** |

Dans les deux cas :
- Claude et Codex fermés : `replied`, contexte conservé, identité `same-as-target` ;
- outillage Claude `Glob, Grep, Read`, sans serveur MCP ;
- témoin Codex exploitable, et échange neutralisé `replied` sans mention de serveur ;
- cibles attachées refusées (`target-busy`) sans écriture dans l'historique.

Modèles observés : création avec `--model haiku`, mais réponses de `claude-sonnet-4-6` en 2.1.85 et de `claude-sonnet-5-5` en 2.1.292.

## Annexe : traces locales

Les fichiers sont dans `.tmp/relay-probe/traces/`, ignoré par git. Ils contiennent les identifiants, les flux bruts et les écrans TUI nettoyés.

| Vérification | Traces |
| --- | --- |
| Création C1 / K1 | `*-codex-create.json`, `*-claude-create.json` |
| Contexte et permissions | `*-09-34-52-*-codex-send.json`, `*-09-35-*`, `*-09-36-28-*` |
| TUI au repos, en génération, `queue` | `*-codex-tui-*.json`, `*-claude-tui-*.json` |
| Concurrence et kill | `*-09-46-46-*`, `*-09-46-52-*` (Codex) ; `*-09-47-*` (Claude) |
| Forks | `*-codex-fork.json`, `*-claude-fork.json` |
| Dossier de travail (E1), session inconnue, lecture Codex | `*-09-52-5*`, `*-09-53-*`, `*-09-54-*` |
| Hooks H1 à H5 (Claude) | `*-10-14-23-*` à `*-10-14-35-*` |
| Hooks H6 à H9 (Codex) | `*-10-14-56-*`, `*-10-15-05-*`, `*-10-15-13-*`, `*-10-15-39-*` |
| Reprise hors dossier (E2 2.1.292) | `*-10-15-45-*-claude-send.json` |
| MCP M1 à M4 (témoin qui démarre, `mcp_servers={}` inopérant, neutralisation par nom, projet non validé) | `*-10-27-17-*-codex-mcp.json` |
| MCP `user-baseline`, `user-empty`, `user-naive` | `*-10-29-05-*-codex-mcp.json` (version précédente : `*-10-27-46-*`) |
| MCP `user-neutralized` (neutralisation effective) | `*-10-29-29-*-codex-mcp.json` |
| MCP M5 (outil pré-approuvé exécuté malgré `read-only`) | `*-10-30-06-*-codex-mcp.json` |
| Neutralisation de bout en bout via l'adapter (`PROBE_CODEX_NEUTRALIZE_MCP=1`) | `*-10-34-09-*-codex-send.json` |

Les sessions et fichiers jetables restent sur le poste pour contre-vérification :

- Codex : C1 et C1-F dans `~/.codex/sessions/2026/10/07/`, supprimables avec `codex delete <id>` ;
- Claude : K1 et K1-F dans `~/.claude/projects/C--Users-jurey-AppData-Local-Temp-palabre-relay-probe-claude/`, plus un dossier projet vide créé par la reprise hors dossier (`…-palabre-relay-probe-codex/`) ;
- hooks témoins, `hook-witness.log`, `mcp-witness.log`, `lisible.txt`, ainsi que `codex\.codex\config.toml` (témoin MCP) et `codex\.codex\hooks.json`, dans `%TEMP%\palabre-relay-probe\`.
