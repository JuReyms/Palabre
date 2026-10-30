---
title: Skill Palabre
description: Installer le skill Palabre pour qu'un agent IA compatible skills sache quand utiliser Débat, Relay, Ask ou Chat.
seo:
  title: Utiliser Palabre depuis un agent à skills
  description: Installer le skill Palabre pour que Claude Code, Codex ou un autre agent compatible skills choisisse entre Débat, Relay, Ask et Chat.
---

Palabre fournit un skill prêt à l'emploi. Il apprend à un agent IA que Palabre est disponible, quand l'utiliser et comment choisir le bon parcours :

| Parcours | Quand l'agent le choisit |
|----------|--------------------------|
| [Débat](/fr/usage/debate) | Confronter deux positions et travailler les désaccords. |
| [Relay](/fr/usage/relay) | Faire communiquer des conversations précises : Claude Code ou Codex chef de mission, avis/relecture vers une cible fermée, action dans Codex ouvert sous Windows avec ses permissions. |
| [Ask](/fr/usage/ask) | Recueillir jusqu'à quatre avis indépendants avant de les comparer. |
| [Chat](/fr/usage/chat) | Avancer avec un agent, demander un second avis ponctuel, poursuivre après une synthèse. |

Le skill suit le standard ouvert [agentskills.io](https://agentskills.io) : il est donc portable entre Claude Code, Codex, Hermes Agent et tout agent compatible skills.

Le skill ne remplace pas la CLI : il pilote `palabre` en local. Palabre CLI reste la source de vérité pour les agents, les presets, les conversations et les exports.

## Installer le skill

Le skill est un dossier : [`skills/palabre`](https://github.com/JuReyms/Palabre/tree/main/skills/palabre) dans le dépôt, et `skills/palabre` dans le paquet npm installé. Copiez ce dossier entier, références comprises, à l'emplacement attendu par votre agent.

| Agent | Pour tous vos projets | Pour un seul projet |
|-------|-----------------------|---------------------|
| Claude Code | `~/.claude/skills/palabre/` | `.claude/skills/palabre/` |
| Codex | `~/.agents/skills/palabre/` | `.agents/skills/palabre/` |
| Hermes Agent | `hermes skills install JuReyms/Palabre/skills/palabre` | — |

Pour Codex, `~/.agents/skills/` est l'emplacement utilisateur indiqué par la [documentation de Codex](https://learn.chatgpt.com/docs/build-skills#where-codex-loads-local-skills). L'ancien emplacement `~/.codex/skills/` reste lu par Codex 0.151.0.

Pour Claude desktop ou un autre agent, suivez sa procédure d'installation de skills en pointant vers ce dossier.

Pour installer le skill correspondant à votre CLI, sans téléchargement GitHub :

```text
palabre skill --install codex
palabre skill --install claude
```

Exécutez seulement la commande correspondant à l'agent voulu. Le plan affiche la cible et demande confirmation. Pour les copies déjà installées, `palabre skill --sync` utilise le skill du paquet exécuté, sans réseau. `palabre skill` affiche seulement l'état ; `--check` et `--dry-run` n'écrivent rien, même avec `--sync` ou `--install`. `--yes` vaut accord explicite après lecture du plan ; un agent ne l'ajoute pas sans votre accord.

`palabre doctor` compare tous les fichiers livrés avec chaque copie détectée, en normalisant les fins de ligne. Une différence peut signaler un ancien skill ou une personnalisation. Les ajouts privés sont conservés et ne servent pas à dater le skill. Une copie illisible ou comportant un lien interne reste non vérifiée et son remplacement est refusé.

`palabre update` inclut le rafraîchissement des copies détectées dans son plan et sa confirmation unique. Après mise à jour, il utilise le skill du nouveau paquet, y compris avec un store pnpm différent. Si la CLI est déjà à jour, le rafraîchissement d'un skill différent reste proposé. Une copie absente n'est jamais installée implicitement.

Avant remplacement, chaque copie physique est sauvegardée sous `~/.palabre/skill-backups/`, avec date et suffixe unique, hors des dossiers chargés par les agents. Les jonctions racines restent en place ; un même dossier visé par Claude et Codex n'est sauvegardé qu'une fois. Les fichiers personnalisés livrés sont remplacés après cet accord ; les fichiers supplémentaires sont conservés. Une édition depuis l'affichage du plan fait refuser le rafraîchissement. L’agent peut ensuite relire les consignes du paquet sans redémarrer, comme expliqué ci-dessous.

Ces commandes suivent le paquet de la CLI, pas GitHub `main`. Un outil externe comme `npx skills add/update` suit le dépôt et peut donc fournir un skill différent de la version CLI installée. Sur une ancienne CLI sans commande `skill`, la copie manuelle du dossier embarqué reste possible.

Vous n'avez pas à connaître les modes ni les options. Dites par exemple « J'hésite entre ces deux approches » : avec le skill chargé, l'assistant devrait vous proposer un avis indépendant d'un autre outil pour repérer un angle mort, ou un débat pour confronter les deux options, en expliquant pourquoi. Il gère ensuite les commandes et les conversations, puis vous rend un résultat clair. Vous pouvez toujours demander le détail technique. Cette aide ne donne aucun droit supplémentaire et ne rend pas disponible une fonction absente ; les accords nécessaires restent les vôtres.

Avant de vous proposer un équipier, l'assistant vérifie qu'il est disponible. Si aucun ne l'est, il avance seul quand c'est possible, ou explique une seule action utile sans insister. Pour une décision importante, il présente le bénéfice et le coût d'un second avis ; une tâche simple ne déclenche pas une consultation. La relecture indépendante revient à un autre outil que celui de l’auteur, pas à un alias ou nouveau chat du même outil. Ces consignes guident l'agent sans garantir qu'il les applique : le résultat et ses preuves restent à vérifier.

Pour désigner explicitement un outil et un parcours, vous pouvez aussi dire : « Passe par PALABRE pour demander à l’autre agent de relire le plan dans docs/plan.md, sans modifier de fichier. Garde la conversation pour la suite. » Vous choisissez le chef de mission. Depuis Codex desktop, chaque commande vers Claude demande une autorisation ponctuelle de l’hôte ; suivez [Premier Relay](/fr/get-started/first-relay).

Une copie non vérifiable est affichée avec un avertissement et laissée intacte : elle ne bloque ni la mise à jour CLI ni les autres copies du skill. Si aucune copie n'est différente, `--sync` et `--install` ne demandent pas d'accord et n'écrivent rien. Si la CLI est mise à jour mais que le rafraîchissement du skill échoue ensuite, le message distingue les deux résultats : relancez Palabre, puis `palabre skill --sync` pour examiner le nouveau plan.

**Après une mise à jour directe de la CLI** (npm, pnpm, Yarn ou Bun), les copies installées restent intactes. En terminal interactif, l’aide, la version et l’accueil de Palabre signalent les copies différentes ou non comparables. Votre assistant peut relire les consignes actuelles du paquet et poursuivre le travail sans vous demander de synchroniser des fichiers ni de redémarrer la conversation ; le parcours est expliqué ci-dessous. Si vous souhaitez aussi aligner les copies installées, `palabre skill --check` montre leur état et `palabre skill --sync` présente un plan à confirmer. Une différence peut être une personnalisation. Aucun rappel sans copie détectée, si toutes sont identiques, en sortie machine ou hors terminal ; une copie identique ne prouve pas ce que l’agent a lu.

## Quand l'agent voit le skill

Une mise à jour des fichiers ne garantit pas qu'une conversation en cours a relu ses consignes. Avant de préparer une tâche, le skill demande désormais à l'agent de comparer sa révision déclarée avec celle du paquet Palabre exécuté. Si elle est absente ou différente, il lit les consignes actuelles et leurs références utiles, puis poursuit dans le cadre déjà autorisé. Vous n'avez pas à synchroniser un dossier ni redémarrer la conversation pour cette lecture. Une copie installée ancienne ou personnalisée reste intacte.

Ce contrôle est local. La commande technique `palabre skill --read --json` fournit le texte du skill et les chemins de ses références depuis le paquet exécuté, sans configuration, réseau, installation ni appel à un agent. L'inventaire `agents --json` et la vérification `relay --check --json` peuvent comparer la révision que l'agent dit avoir lue. Une révision identique ne prouve pas sa mémoire interne. Une ancienne conversation doit encore rencontrer ce diagnostic ou relire le skill pour bénéficier du parcours ; Palabre ne pilote pas le rechargement interne des applications.

Si le paquet est incomplet ou illisible, l'agent explique la limite lorsqu'elle bloque le travail. Une ancienne CLI qui ne connaît pas ce contrôle ne doit pas être présentée comme compatible : consulter son aide et distinguer la lecture des consignes d'une mise à jour de logiciel. Aucun renvoi Relay automatique pour réparer un skill.

Les observations suivantes concernent la découverte native des skills par les applications, distincte de cette lecture par l'agent :

Un agent charge la liste des skills quand une conversation démarre ou reprend. Après l'installation, ouvrez une nouvelle conversation ou reprenez-en une : une conversation déjà en cours ne voit pas forcément le skill.

| Agent | Nouvelle conversation | Conversation reprise après l'installation |
|-------|---------------|--------------------------------------|
| Claude Code 2.1.85 et 2.1.292 | Skill visible | Skill visible |
| Codex 0.151.0 | Skill visible | Skill visible |

Ces comportements ont été vérifiés en mode non interactif (`claude -p`, `codex exec`), avec un skill de projet et des conversations jetables. Les emplacements utilisateur, la TUI, les applications de bureau et les IDE n'ont pas été vérifiés. Ces comportements peuvent changer avec d'autres versions. Si l'agent ne mentionne pas Palabre, rappelez-lui que le skill `palabre` est disponible.

Une seule copie du skill doit rester active. Si une ancienne version est aussi installée, par exemple un skill `palabre` ajouté à votre compte Claude puis synchronisé, l'agent peut suivre l'ancienne : mettez-la à jour ou retirez-la.

## Prérequis

- Palabre CLI installé sur la même machine (`npm install --global palabre`) ;
- au moins un agent compatible configuré ou détecté par Palabre ; deux ou plus sont recommandés pour les comparaisons ;
- un agent hôte compatible avec le standard agentskills.io.

Vérifiez l'installation depuis un terminal :

```bash
palabre --version
palabre doctor
palabre agents
```

## Ce que le skill apporte

Le point d'entrée présente les décisions et garde-fous communs ; l'agent charge ensuite la référence du parcours utile. Relay distingue les bases, l'ouverture/suivi Desktop, le pilote OpenCode et les fonctions gelées. Les détails des autres parcours ne sont pas chargés par défaut.

Pour poursuivre un avis, l'agent vérifie la conversation avant l'envoi et respecte votre préférence. Sans préférence enregistrée, il peut poursuivre avec Codex déjà utilisé, dans le cadre autorisé, en expliquant ses permissions habituelles : pas d'identifiant à recopier ni de fenêtre à fermer. Un choix explicite d'arrière-plan ou d'outils limités reste respecté. Une relecture reste sans modification quel que soit le parcours. Aucun basculement après refus d'envoi ; ouvrir pour consulter et envoyer restent distincts. Voir [Mode Relay](/fr/usage/relay).

Ici, un agent Palabre est une entrée configurée reliée à un outil IA (par exemple Claude Code ou Codex) ou à Ollama, pas un modèle ni un sous-agent. Les rôles complètent Débat, Ask et Chat ; ils ne règlent pas Relay et n'accordent aucun droit.

### Nommer les tâches PALABRE

Votre agent nomme chaque tâche PALABRE `Palabre <mode> : <objet>`, par exemple `Palabre Relay : envoyer la relecture à Codex`. C'est le skill qui le lui demande ; l'application de votre agent décide de ce qu'elle affiche réellement.

Dans un terminal, PALABRE affiche son nom et son mode dans le titre de la fenêtre, par exemple `Palabre · Relay`. Il remet l'ancien titre à la fin quand le terminal le permet. Rien n'est ajouté quand PALABRE est lancé par un programme ou avec `--json`. Sous Windows, le Gestionnaire des tâches continue d'afficher `node`.

### Choisir et suivre le parcours

- **Choix du parcours** : Débat, Relay, Ask ou Chat selon le besoin, sans lancer Palabre pour une tâche simple ni imposer un Débat à chaque demande de second avis.
- **Chat piloté proprement** : l'agent utilise le [flux NDJSON](/fr/integrations/ndjson) et les commandes JSON sur stdin (`chat-send`, `chat-consult`, `chat-use`, `chat-agents`, `chat-end`), jamais une imitation de la TUI. Il connaît la mémoire bornée de Chat : six messages récents, aucune reprise après arrêt.
- **Trois reprises distinguées** : la conversation de l'agent hôte, les [checkpoints Palabre](/fr/reference/cli#reprendre-une-session) de Débat et Ask, et la reprise d'une conversation externe par Relay.
- **Relay prudent** : cible désignée par vous ; en-tête PALABRE, avertissement ℹ️ et « 🤖 Message pour l'agent » ; objet facultatif `--subject`, expéditeur non authentifié, historique modifié, aucun renvoi automatique ; diagnostic `usage-limit` conservé, et `readAccess` distingue un repli partiel d'un blocage sans effacer réponse ni délivrance.
- **Contexte maîtrisé** : `--files` ou `--context`, avec un avertissement avant d'envoyer du contenu sensible ; Ollama pour rester en local.
- **Vous gardez la main** : installation, authentification, configuration, approbation de config et mises à jour restent vos décisions. Le rôle `implementer` est une consigne de proposition, pas une autorisation d'écrire.
- **Restitution** : l'agent lit l'export (`.chat.md`, `.debate.md`, `.ask.md` ou `.relay.md`, ainsi que `.mission.md` pour l’option Mission) et vous rend décisions, désaccords, limites et prochaines étapes. Après un Relay, le compte rendu reste simple : ce que l'équipier a fait, ce qui bloque, la décision attendue et, si besoin, une seule action à faire (par exemple la commande pour ouvrir la conversation dans Codex Desktop). L'agent garde lui-même l'identifiant de la conversation : dites « continue » ou « demande au même Codex » pour poursuivre. Il ne vous montre l'identifiant, le dossier, l'export ou la commande `palabre relay` que si vous les demandez, ou pour expliquer un échec.

L’option Mission et `--task review` sont gelés. `--write` est expérimental, gelé et hors parcours par défaut : le skill ne le propose que sur demande explicite de l’humain. Ces fonctions restent documentées ; seuls les correctifs de sécurité sont acceptés.

L'agent ne modifie ni n'approuve lui-même une politique qui lui accorde des droits : il vous montre la commande `relay allow-repo` ou d'approbation et attend votre action. Pour retrouver le skill du paquet installé : `npm root -g` (ou `pnpm root -g`), puis le sous-dossier `palabre/skills/palabre`.
