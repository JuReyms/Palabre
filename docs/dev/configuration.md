# Configuration, découverte et mises à jour

Référence de développement extraite d’`AGENTS.md`. Lire [les règles communes](../../AGENTS.md) et ce document avant de modifier init, discovery, new, update ou la synchronisation des skills. Les chemins de code entre backticks sont relatifs à la racine du dépôt. Les qualifications datées décrivent un essai, pas une garantie pour toutes les versions.

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

La config generee conserve les blocs agents connus pour rester editable, mais ajuste `defaults.agentA` et `defaults.agentB` avec une paire detectee quand c'est possible. A chaque ouverture de l'accueil TUI, Palabre synchronise prudemment les agents connus detectes : il ajoute les agents connus manquants et rafraichit les noms de commande connus, sans toucher aux agents custom, aux roles, aux modeles ni aux defaults utilisateur. `palabre config --sync-agents` applique la meme logique explicitement, comme l'action « synchroniser » de l'assistant `palabre config`.

Les trois parcours passent par `persistAgentSync` (`src/config.ts`) : le fichier relu au depart doit correspondre a la configuration chargee et migree, puis rester identique octet pour octet jusqu'a l'ecriture. Sinon rien n'est ecrit (`conflict`, message `config.syncConflict`) et on ne reconstruit jamais depuis le fichier modifie : non approuve, il verrait son approbation rafraichie par `writeConfig`. L'accueil TUI garde alors la configuration chargee pour la session ; l'assistant et `--sync-agents` sortent avec le code 1. Le dernier controle et le remplacement du fichier ne sont pas atomiques. L'accueil TUI, automatique, n'ecrit pas pour un ancien defaut d'arguments seul (`persistLegacyArgs: false`) ; les parcours explicites l'ecrivent.

Au lancement, Palabre ne doit pas utiliser de fallback agent code en dur : sans preset, sans agents explicites et sans defaults de config, il doit afficher une erreur actionnable.

Le defaut produit doit favoriser les agents CLI premium : `codex <-> claude` quand disponible. Ollama reste configure et accessible via presets, mais il est plutot destine aux power users ou aux roles locaux (`critic`, `scout`, `summarizer`). Les defaults utilisateur se gerent par `palabre config`, `palabre config --set-defaults <agentA> <agentB>`, `palabre config --mode <chat|debate|ask>`, `palabre config --interface <tui|terminal>`, `palabre config --ask-agents <agents...>`, `palabre config --summary-agent <agent|none>`, `palabre config --ask-summary-agent <agent|none>` et `palabre config --clear-defaults`. Les roles persistants se gerent par `palabre agent-role <agent> <role>` ou par edition JSON explicite.

## New

`palabre new` est l'assistant interactif de composition d'un debat ou d'une demande ask. Il detecte les outils locaux via `src/discovery.ts`, liste les agents de la config en mettant les agents detectes en premier, demande le mode, les agents puis le sujet, et laisse lancer avec les defaults ou ouvrir les options avancees.

Le mode avance couvre les options courantes : tours, modeles bruts, synthese, contexte, fichiers, `--show-prompt` et le rendu terminal brut via `--terminal`. Garder le wizard comme une couche UX fine au-dessus du parser existant : il doit remplir les memes flags que la CLI directe, pas creer un second chemin d'execution.

Le wizard affiche une commande equivalente avant execution. Cette sortie est intentionnelle : elle aide l'utilisateur a apprendre la syntaxe directe et sert de recap leger avant de lancer.

## Update

`src/skillSync.ts` compare les fichiers livrés sous `skills/palabre` à côté du module de la CLI exécutée, jamais avec le cwd, une branche Git ou GitHub. `doctorArrival.ts` conserve les chemins détectés par #176 et expose leur comparaison (CRLF/LF normalisés) ; un écart est « ancien ou personnalisé », pas une preuve de version ancienne. Aucun réseau ni écriture pour cette comparaison. Le JSON `{ ok, output }` de doctor reste inchangé.

`palabre skill` affiche l'état sans écrire ; `--sync` rafraîchit les copies projet/personnelles détectées, `--install codex|claude` choisit explicitement un emplacement personnel. Le plan est affiché avant l'accord unique, y compris avec `--yes`. `--check` et `--dry-run` sont prioritaires et sans effet de bord. L'agent ne change pas ses instructions sans accord humain. Pas de config ni de registre de confiance consommé dans cette commande.

`update` intègre ces mêmes cibles dans son plan et sa confirmation unique, y compris dans la TUI. Les cibles et empreintes sont figées avant accord et vérifiées avant application ; les éditions concurrentes et liens internes sont refusés. Après update CLI, le skill vient du nouveau paquet (via le chemin global stable si pnpm change de store), pas d'un import mis en cache. Une CLI déjà à jour peut encore proposer le rafraîchissement du skill sans appeler le gestionnaire de paquets. Une absence de copie ne provoque pas d'installation implicite.

Chaque copie physique remplacée est sauvegardée en entier dans `~/.palabre/skill-backups/palabre-<date>-<suffixe>`, hors des dossiers de skills. Les jonctions racines restent en place, leurs alias ne sont sauvegardés qu'une fois, les ajouts privés restent dans la copie. La comparaison porte sur tous les fichiers livrés ; elle ne certifie pas le chargement dans l'agent. Une copie non vérifiable (source/copie illisible ou lien interne) reste affichée avec avertissement, exclue de l'application ; elle ne bloque ni la CLI ni les autres copies. Sans copie différente, `skill --sync` et `--install` ne demandent pas d'accord et n'écrivent rien. Une sauvegarde impossible refuse le remplacement. Si le skill échoue après installation CLI réussie, le message distingue les résultats et propose `palabre skill --sync`. Tests exclusivement sur profils fictifs via `scripts/test.mjs`.

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
