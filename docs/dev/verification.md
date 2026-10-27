# Tests, isolation et qualifications

Référence de développement extraite d’`AGENTS.md`. Lire [les règles communes](../../AGENTS.md) et ce document avant de modifier les tests, le registre de confiance, doctor ou les smoke tests réels. Les chemins de code entre backticks sont relatifs à la racine du dépôt. Les qualifications datées décrivent un essai, pas une garantie pour toutes les versions.

Les smoke tests réels ne sont pas la suite automatisée : leur lancement demande l’accord humain pour leurs quotas, historiques, écritures dans le registre de confiance et éventuels MCP. Ne pas les lancer par réflexe dans un lot documentaire.

### Isolation des tests et entretien du registre de confiance

`pnpm test` passe par `scripts/test.mjs`. Avant l'import des modules, chaque processus de test reçoit un dossier personnel temporaire distinct (`HOME`, `USERPROFILE`, AppData et XDG), hérité par ses sous-processus. Les dossiers temporaires des tests sont également placés dedans et supprimés à la fin du lancement. Cela couvre la config globale, `trusted-configs.json`, les lecteurs de conversations et `~/.palabre/relay-write`, sans ajouter de variable produit ni modifier les règles de confiance. Exports, historique, checkpoints et missions restent rattachés aux projets fictifs ou aux chemins explicitement fournis par les tests.

Le lanceur surveille en lecture seule le vrai `~/.palabre` et compare une empreinte des contenus et métadonnées avant/après. Une création, une modification ou une erreur de surveillance fait échouer la suite ; aucun fichier utilisateur n'est restauré ou réécrit. L'empreinte (contenu, date de modification, mode) détecte les modifications durables ; les événements de surveillance ajoutent les créations, suppressions et renommages transitoires. Sous Windows seulement, un événement « change » seul ne compte pas quand l'empreinte est identique : `fs.watch` le signale aussi pour une simple lecture (heure d'accès), y compris celles du garde-fou. Si des événements arrivent pendant l'empreinte finale, elle est reprise une fois, pour voir une écriture tardive dans un fichier déjà lu ; les deux empreintes comptent, si bien qu'une restauration entre elles n'efface pas un changement déjà vu. Limites résiduelles sous Windows : une écriture qui restaurerait exactement contenu et date de modification, ou une écriture dans un fichier déjà lu pendant la seconde empreinte (possible seulement depuis un processus qui survit aux tests), passerait inaperçue. Ailleurs, tout « change » reste bloquant. Une autre instance PALABRE qui écrit pendant la suite peut donc la faire échouer. Pour une sélection, utiliser `pnpm build:test`, puis `node scripts/test.mjs .tmp/test-dist/tests/config-trust.test.js` ; ne pas lancer les tests compilés directement avec `node --test`. `pnpm test:release-social` utilise la même isolation. Les scripts `smoke:real-*`, explicitement réels et hors `pnpm test`, ne sont pas concernés.

`palabre config --prune-trust --dry-run` affiche les approbations dont le chemin a disparu. `palabre config --prune-trust` exige une confirmation au clavier, vérifie de nouveau le registre sous son verrou existant, conserve les chemins existants/inaccessibles et écrit d'abord une sauvegarde exclusive horodatée des octets d'origine. Un registre illisible ou modifié depuis la liste est refusé. Ni `--yes`, ni `--json`, ni `--trust-config` ne sont admis dans ce parcours. Les agents ne répondent jamais à la place de l'humain. Ne jamais utiliser le vrai registre pour tester le nettoyage.

## Tests et verification

Doctor comme guide d'arrivée (#151, #153) : `doctorArrival.ts` inventorie les chemins et le skill sans les exécuter. PowerShell n'y est pas redétecté : l'action d'arrivée réutilise `inspectWindowsShell` (#175, `inspectWindowsPowerShell`), juste après l'approbation et avant les connexions. Après approbation seulement, les sous-programmes Claude `auth status --json` et Codex `login status` de la commande configurée sont sondés sans shell, sans args de modèle et sans modèle (3 s, sortie cumulée 32 Kio, arrêt borné). Aucun repli vers une autre CLI pour un chemin absolu, aucun login, aucune réparation. Les tests injectent commandes et profils fictifs. Un format inconnu, une erreur de lancement ou un timeout restent non vérifiés ; aucune sortie brute de compte n'est affichée. L'état déclaré ne garantit ni renouvellement de jeton ni quota. Les emplacements multiples dans PATH n'attestent pas des versions différentes ; wrappers voisins et alias de dossier sont regroupés, le diagnostic complet reste #153. Le contrat `{ ok, output }` de doctor est inchangé, aucun champ JSON/NDJSON ajouté.

Relay vers une conversation ouverte (#96, B1, `palabre relay --open`) : le contrat vit dans
`scripts/prototypes/relay/CONTRAT-B1.md` ; le code dans `src/externalSessions/` (`openReader`,
`openRollout`, `codexQueue`, `openRelay`). Les tests `tests/external-sessions-open*.test.ts` et
`tests/relay-command.test.ts` utilisent des historiques factices, une horloge simulée, un faux
`codex queue` et, sous Windows, un verrou tenu par le test : aucun agent réel, aucun quota. Les
sondes locales `open-*.mjs` ne sont pas versionnées ni lancées par `pnpm test`.

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
- la réponse d'une cible fermée, avec contexte conservé, délivrance, identité, export et arrière-plan explicite ;
- le refus d'une cible attachée, avec un TUI ouvert dans un pseudo-terminal : `target-busy`, code 3, `not-delivered`, et historique inchangé (nombre de fichiers et de lignes, segments Codex compris). Le message de refus n'est envoyé que si la sonde établit l'attachement ; sinon le scénario échoue sans rien envoyer ;
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

Tous les appels du smoke imposent `--background` : avec la préférence `relay.view: auto`, une conversation Codex attachée serait jointe en mode ouvert et recevrait le message censé être refusé. Les décisions (arguments, précondition d'attachement, verdicts, empreinte d'historique) vivent dans `scripts/smoke_relay_plan.ts` et sont testées hors ligne par `tests/smoke-relay-plan.test.ts`, sans agent réel. Les scripts `smoke:real-*` compilent un fichier isolé avec `tsc --ignoreConfig` : TypeScript 7 refuse sinon de compiler des fichiers nommés quand un `tsconfig.json` est présent (`TS5112`).

Quand un changement touche l'adapter CLI, lancer `pnpm test`. Ces tests compilent `src/` et `tests/` via `tsconfig.test.json` dans `.tmp/test-dist`, puis utilisent `node:test` avec des CLIs mockees. Garder les tests automatises sous `tests/` et completer par un smoke test manuel avec une vraie CLI seulement quand le comportement depend d'un outil externe.

Quota Relay ouvert (#41, point 3) : `inspectOpenReply` reconnaît `task_complete.error.codex_error_info === "usage_limit_exceeded"` seulement dans le tour lié à l'enveloppe exacte, après la référence. Forme observée avec Codex 0.163.0. `error.message` sert uniquement à `extractRetryAfter` (limité aux 4 096 premières unités UTF-16) après le code machine, jamais à classer la limite. Prose du modèle, événements `token_count`, erreurs étrangères et formats inconnus ne donnent pas ce diagnostic. La cause primaire du dépôt, l'annulation et l'échéance gardent leur priorité. `retryAfter` est un champ optionnel du JSON v1 / export : secondes (nombre), ISO UTC ou HH:mm (texte sans date/fuseau implicites). Aucun renvoi ni minuteur automatique. Mission garde résultat et délivrance, et classe `paused` une limite connue même avec `persisted-no-reply` ; délivrance ou publication inconnue reste `uncertain`. Ce lot ne change pas le transport Mission et n'y ajoute pas `--open`.

Les erreurs CLI doivent rester actionnables. En particulier, les limites d'usage et quotas Codex/Claude/Antigravity doivent etre classees comme `usage-limit` et ne pas recopier tout le prompt ou les logs bruts dans le message utilisateur.

Quand un changement touche Ollama, verifier que l'erreur est lisible si Ollama n'est pas lance ou si le modele manque.

Les anciens essais locaux sont conservés dans [les qualifications historiques](../archive/development-qualifications.md) ; ils ne certifient pas les versions courantes.
