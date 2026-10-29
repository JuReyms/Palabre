---
title: Premier Relay
description: Confier une tâche à un équipier depuis votre agent, garder la décision et retrouver le travail réalisé.
seo:
  title: Premier Relay, faire communiquer Claude Code et Codex
  description: "Confier une tâche depuis Claude Code ou Codex, retrouver une conversation précise et recevoir sa réponse sans copier-coller."
---

Relay permet à votre agent de confier une tâche à un autre agent (Claude Code, Codex) et de vous rapporter sa réponse, sans copier-coller : dans une nouvelle conversation, ou dans une conversation précise que vous avez déjà eue avec lui. Chacun garde ses propres permissions, et vous décidez de la suite.

Vous choisissez le **chef de mission** : Claude Code ou Codex. Votre agent peut devenir chef de mission dans n'importe quelle conversation, même celle que vous venez d'ouvrir : il faut seulement que PALABRE soit installé sur la machine et que l'agent dispose du skill PALABRE.

## Comment ça marche

Le chef de mission est l'agent à qui vous parlez. L'**équipier** est celui qui reçoit la tâche. PALABRE transmet le message et rapporte la réponse ; ce sont les agents qui réalisent le travail, avec leurs permissions.

| Votre façon de travailler | Sens des échanges et possibilités actuelles |
| --- | --- |
| Deux applications Desktop | Claude Code peut joindre une conversation Codex ouverte sous Windows, macOS ou Linux avec `--open` (`python3` requis sur POSIX). Codex desktop peut joindre une conversation Claude fermée, avec une autorisation ponctuelle de son hôte par commande. Vers Claude ouvert : pas encore disponible. |
| Deux terminaux CLI | Claude vers Codex ouvert avec `--open` reste un parcours pilote, peu testé. Codex CLI vers Claude fermée reste à éprouver. |
| Un équipier en arrière-plan, sans fenêtre à ouvrir | Une nouvelle conversation ou une conversation existante fermée peut recevoir une demande d’avis ou de relecture. Le parcours Codex desktop vers Claude fermée et le parcours Claude vers Codex fermée ont été vérifiés sous Windows. |

Dans une conversation Codex ouverte, l'équipier peut agir avec ses permissions habituelles. Les appels ordinaires vers une conversation fermée servent aux avis et relectures, avec des outils limités pendant l'appel. Relay n'accorde aucun droit supplémentaire. Le verrou Codex est pris en charge sous Windows et, avec `python3`, sous macOS/Linux.

## Les mots de Relay

- **Chef de mission** : l'agent à qui vous parlez. Il confie la tâche et vous rend compte.
- **Équipier** : l'agent qui reçoit la tâche.
- **Conversation ouverte** : une conversation que Codex desktop ou son terminal garde chargée, même si vous l'avez quittée. Elle peut ne pas être affichée. L'équipier y travaille avec les outils et permissions de cette conversation ; le message Relay ne vaut pas autorisation humaine.
- **Conversation fermée** : une conversation existante à laquelle aucun processus n'est attaché, selon les contrôles propres à l'outil. L'absence de fenêtre ne suffit pas à le prouver. PALABRE la reprend pour un échange en arrière-plan.
- **Arrière-plan** : l'équipier travaille sans fenêtre. PALABRE le lance pour une seule tâche, attend sa réponse, puis s'arrête.
- **Identifiant de conversation** : le numéro qui désigne une conversation précise. Gardez-le pour continuer avec le même équipier.
- **Délivrance** : savoir si le message est bien arrivé. Un message arrivé ne veut pas dire tâche réussie.
- **Accord ponctuel** : votre confirmation au clavier pour une seule tâche d'écriture. Elle ne sert qu'une fois.
- **Worktree** : une copie séparée de votre projet, où l'équipier peut modifier des fichiers sans toucher à l'original.

## Préparer une fois

Sur une autre machine ou un ancien PC à remettre à niveau, commencez par [Changer de machine](/fr/get-started/change-machine). Les conversations et approbations de l'ancien ordinateur ne sont pas transportées par PALABRE.

Installez [PALABRE](/fr/get-started/installation), Claude Code et Codex, puis connectez les agents avec leurs outils habituels. Dans le dossier du projet, lancez `palabre init` si aucune configuration n'existe, puis vérifiez :

```text
palabre doctor
palabre relay --help
```

L'aide doit proposer `--new`. Sinon, utilisez une version de PALABRE qui le contient ; voir [Installation et mise à jour](/fr/get-started/installation).

Installez aussi le [skill Palabre](/fr/get-started/skill) avec `palabre skill --install codex` pour Codex, ou `palabre skill --install claude` pour Claude Code. Palabre affiche le plan avant votre confirmation. Pour rafraîchir les copies déjà installées, utilisez `palabre skill --sync` ; `palabre update` inclut aussi ce rafraîchissement dans son plan. Rechargez ensuite le skill ou ouvrez une nouvelle conversation pour que l'agent le voie.

Chaque appel utilise le compte et le modèle de l'agent choisi. Vérifiez ce que vous partagez avant de lui confier des fichiers sensibles.

## Confier une tâche par votre agent

Depuis votre conversation avec Claude Code, dites par exemple :

> Passe par PALABRE pour demander à Codex de relire le plan dans docs/plan.md et de signaler les risques, sans modifier de fichier. Crée une conversation et garde son identifiant pour la suite.

Le skill crée une conversation si vous n'en avez pas désigné une. Si vous choisissez une conversation existante, il garde cette cible précise, jamais « la dernière ».

Pour travailler dans une conversation Codex déjà ouverte sous Windows, macOS ou Linux, désignez-la et dites le travail attendu. L'arrière-plan est le défaut et refuse une cible ouverte. Votre agent explique comment envoyer dans cette conversation avec `--open` : elle garde ses outils et permissions, y compris l'écriture si elle est autorisée. Ce choix peut rester ponctuel ou devenir votre préférence après votre confirmation. Sur POSIX, `python3` doit être disponible. Le message n'accorde aucun droit supplémentaire.

### Codex chef de mission

Depuis une conversation Codex desktop ouverte dans le dossier du projet, dites par exemple :

> Passe par PALABRE pour demander à Claude Code de relire le plan dans docs/plan.md, sans modifier de fichier. Crée une conversation et garde son identifiant pour la suite.

Codex demande l'autorisation d'exécuter chaque commande PALABRE **hors de son bac à sable**. Relisez la commande affichée, puis acceptez **cette fois seulement**. N'accordez ni accès total, ni droit permanent, ni « toujours autoriser ». La commande de suivi demande sa propre autorisation.

Cette autorisation permet à la CLI Claude d'utiliser sa connexion et d'enregistrer l'échange dans son historique. Elle n'accorde aucun droit supplémentaire à l'équipier. Le réglage **« approuver à ma place »** de Codex desktop peut accorder ces sorties sans afficher de demande : laissez-le désactivé si vous voulez confirmer chaque commande vous-même.

Ce parcours a été vérifié sous Windows depuis Codex desktop. Depuis Codex CLI et sur macOS, il reste à éprouver.

### Continuer et retrouver le résultat

> Continue avec le même Claude pour préciser le risque principal, sans modifier de fichier.

Le chef de mission réutilise l'identifiant, lit la réponse et vous en rend compte simplement, sans vous demander de recopier l'identifiant ni une commande. L'échange reste dans la conversation de l'équipier et dans l'export `.relay.md`, que l'agent vous indique si vous le demandez. Avec les versions Codex vérifiées, une conversation créée par `--new` n'est pas listée dans Codex Desktop, mais Relay peut continuer à la joindre. Pour la suivre dans l'application, lancez la commande d'ouverture que votre agent vous donne (bouton Run quand l'application en affiche un), ou demandez-lui simplement de l'ouvrir ; une fois ouverte dans Desktop, l'agent la joint dans l'app, avec les permissions de cette conversation. La réponse revient à l'appelant, sans être ajoutée automatiquement à la conversation de l'expéditeur. L'ouverture de ce lien Desktop est vérifiée sous Windows seulement ; macOS et Linux restent à vérifier.

Avec les versions vérifiées, une conversation **Codex créée par Relay** (`--new`) reste en lecture seule, même ouverte dans Desktop : l'ouvrir sert à consulter, pas à lui donner le droit de modifier des fichiers. Pour confier des modifications à Codex, créez vous-même sa conversation dans Codex Desktop avec les permissions que vous choisissez, puis désignez cette conversation à votre chef de mission.

Si l'équipier modifie des fichiers dans une conversation ouverte disposant de ces permissions, ils restent dans son dossier de travail. Ils apparaissent sur GitHub seulement après un commit et un push autorisés séparément. Une réponse reçue ne prouve pas que le travail ou les tests ont réussi.

Pour **Codex**, l'agent utilise `palabre relay open --to codex:<identifiant>` :
un lancement, puis vérification du verrou, sans message. Ouvrir n'autorise aucun
envoi ni écriture ; l'affichage reste à confirmer dans l'app. Explorer peut renvoyer
le code 1 malgré l'ouverture : Relay le marque non vérifié et contrôle le verrou,
sans relancer. L'arrivée au dernier message n'est pas garantie. Un échange Relay
séparé peut être traité sans quitter la conversation d'origine (essai Windows).

Pour **Claude**, dites aussi « ouvre la conversation » : l'agent utilise
`claude --desktop --resume <identifiant>` depuis le dossier du relais, avec la même
installation Claude, dans un terminal TTY sans redirection. L'identifiant reste
géré par l'agent ; un bouton « Ouvrir dans Claude » peut être proposé par l'hôte.
Cette ouverture sert à consulter, sans nouveau message. Elle a été vérifiée sous
Windows avec l'app installée et un abonnement Claude (CLI 2.1.285+ requis ; macOS
non vérifié). Vérifiez les permissions dans l'app avant de continuer vous-même.
Pour un nouvel envoi Relay vers Claude, fermez d'abord cette conversation :
l'envoi vers Claude ouverte reste indisponible. Voir le [parcours d'ouverture](../usage/relay#ouvrir-la-conversation-de-lequipier).

## Sans agent

Vous pouvez piloter Relay vous-même depuis le dossier du projet :

```text
palabre relay --new --to claude "Relis le plan dans docs/plan.md et signale les risques, sans modifier de fichier."
```

Gardez l'identifiant rendu pour continuer, sans `--new` :

```text
palabre relay --to claude:<identifiant> "Précise le risque principal, sans modifier de fichier."
```

Pour viser une conversation Codex déjà ouverte, suivez le [guide Relay complet](/fr/usage/relay#conversation-codex-ouverte-open).

## Parcours expérimental : écriture en arrière-plan

`--new --write` vers Codex sous Windows est **expérimental et gelé**, hors parcours par défaut. Une demande ordinaire ne l'active jamais : il faut le demander explicitement à votre agent. Il prépare alors la tâche ; vous devez la relire et la confirmer vous-même avec `approve-write` avant l'unique appel `run-write`.

Ce parcours conserve une copie Git séparée, ou **worktree**, sans vos changements non commités. L'accord ponctuel ne sert qu'une fois. Les étapes et restrictions restent documentées dans [Confier une tâche qui modifie des fichiers](/fr/usage/relay#confier-une-tâche-qui-modifie-des-fichiers), puis [Récupérer le résultat](/fr/usage/relay#récupérer-le-résultat).

## Bon à savoir

Mission et `--task review` sont gelés : conservés et documentés, sans extension de périmètre ; seuls les correctifs de sécurité sont acceptés.

- Gardez l'identifiant rendu pour continuer explicitement un avis ou une relecture avec `--to codex:<identifiant>` ou `--to claude:<identifiant>`, sans `--new`. Ne choisissez jamais « la dernière conversation » à la place de la cible.
- En arrière-plan, aucun autre processus ne doit utiliser la conversation visée : afficher ou masquer sa fenêtre ne suffit pas à le savoir. Codex peut être joint dans son application avec `--open`, sous Windows, macOS ou Linux (`python3` sur POSIX) ; le parcours à deux terminaux reste à éprouver davantage.
- Un identifiant reçu ne prouve pas que la tâche a réussi. Lisez le statut, la délivrance et les preuves du compte rendu. En cas d'échec, ne renvoyez pas automatiquement la demande.
- « Cette conversation est déjà utilisée par Claude » : rien n'a été envoyé. Pour répondre à une demande reçue, répondez dans le même tour ; sinon transmettez la passation via l'humain. Le fichier `.handoff.md` annoncé n'informe pas Claude. Voir [Conversation Claude déjà utilisée](/fr/usage/relay#conversation-claude-déjà-utilisée).
- « Encore utilisée par Codex » : rien n'a été envoyé. Fermer la fenêtre peut laisser la conversation chargée. Votre agent vous propose un nouvel envoi `--open` avec les permissions de cette conversation, ou de la libérer vous-même pour rester en arrière-plan ; redonner le même identifiant ne change ni le mode ni les permissions. Voir le [guide Relay complet](/fr/usage/relay).
- Dans le parcours expérimental, `--write` ne permet ni commit, ni push, ni fusion, ni installation de dépendances par l'équipier. Un test bloqué reste signalé ; PALABRE n'élargit pas les permissions pour le faire passer. L'accord est consommé même en échec.
- Pour créer l'équipier dans un autre projet, utilisez `--dir "../autre-projet"` avec `--new`. Le parcours expérimental d'écriture exige la racine d'un dépôt Git.

Les détails, les statuts et les limites de chaque parcours sont dans le [guide Relay complet](/fr/usage/relay).


Demandez simplement la suite de la relecture. L'agent vérifie comment joindre la même conversation et respecte votre préférence ; vous n'avez pas à choisir un mode ou fermer une fenêtre. Sans préférence enregistrée, il peut poursuivre avec Codex déjà utilisé pour la tâche autorisée, après vérification et explication de ses permissions habituelles. Une relecture reste sans modification. Si vous avez explicitement choisi l'arrière-plan, une dérogation vous est demandée une fois pour le lot ; si vous exigez des outils limités en lecture seule, `--background` reste obligatoire. Aucun renvoi automatique après refus d'envoi. Le CLI seul garde **Arrière-plan par défaut**. Le réglage habituel facultatif **Privilégier la conversation ouverte** reste une décision du propriétaire : commande `palabre config --relay-view auto`, confirmation clavier en terminal visible, configuration déjà approuvée, aucun `--yes` ni `--trust-config`. Retour : `palabre config --relay-view background`. L'agent ne change ni ne confirme ce réglage. Voir [Mode Relay](/fr/usage/relay).
