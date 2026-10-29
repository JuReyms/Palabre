# Orchestration, contexte et reprise

Référence de développement extraite d’`AGENTS.md`. Lire [les règles communes](../../AGENTS.md) et ce document avant de modifier Débat, Ask, Chat, les checkpoints, le contexte ou les prompts. Les chemins de code entre backticks sont relatifs à la racine du dépôt. Les qualifications datées décrivent un essai, pas une garantie pour toutes les versions.

## Orchestration

Les appels batch peuvent recevoir un callback générique `onWaiting`, transmis en Débat, Ask, Chat, consultation et synthèse. Il décrit l'attente locale, jamais l'avancement du modèle. L'identité de la configuration effective accompagne la factory pour les adapters capables de relire un résultat précis. Après un délai dépassé, consulter cette référence n'envoie rien et ne réinjecte pas automatiquement la réponse dans un checkpoint ; ne pas lancer `resume` pour tenter de retrouver une réponse. Le contrat qualifié et les refus de récupération sont dans [Adapters](adapters.md).

Les sessions Débat et Ask peuvent activer des checkpoints avec `--checkpoint`. Cet opt-in écrit un état JSON v1 sous `.palabre/sessions/` avant le premier appel, après chaque réponse complète acceptée et lors de la terminaison. L'écriture est atomique et conserve l'empreinte canonique de la configuration, les références de contexte, le transcript complet validé, la synthèse et les diagnostics structurés. Les sorties brutes et réponses partielles ne sont jamais persistées. Chat reste hors périmètre.

`palabre resume <session-id>` valide le checkpoint, exige une configuration toujours approuvée avec la même empreinte, recharge chaque fichier de contexte avec la même empreinte et refuse toute dérive avant un appel agent. La commande affiche la phase à reprendre et demande confirmation en TTY ; `--yes` est obligatoire en non-interactif. Elle réutilise le même identifiant et le même writer atomique, ne rejoue aucune réponse complète, reprend le prochain tour Débat, les agents Ask restants ou la synthèse seule, puis produit un nouvel export Markdown complet. Une session terminée est refusée.

`palabre sessions` liste par défaut les 20 checkpoints les plus récents du workspace, avec une limite configurable de 1 à 100. Un checkpoint corrompu apparaît comme invalide sans bloquer les autres et sans exposer son contenu ni un chemin absolu dans le contrat JSON v1. `palabre sessions delete <session-id>` valide strictement l'identifiant, affiche le fichier ciblé en TTY et exige une confirmation ; `--yes` est obligatoire en non-interactif. La suppression ne touche ni les exports Markdown ni les checkpoints voisins. Aucune rétention automatique n'est appliquée.

Cette section décrit les trois modes de session Débat, Ask et Chat ; Relay est un autre mode produit, avec ses transports distincts. Le moteur d'orchestration historique garde deux modes :

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

## Prompt Preview

`--show-prompt` affiche le prompt exact du premier tour en mode `debate`, ou le prompt indépendant du premier agent en mode `ask`, puis termine sans appeler d'agent. En mode `debate`, les tours suivants ne peuvent pas etre connus sans executer le debat, car ils dependent du transcript reel. En mode `ask`, la synthese ne peut pas etre connue sans les reponses reelles des agents.
