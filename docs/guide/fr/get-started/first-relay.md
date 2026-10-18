---
title: Premier Relay
description: Confier une tâche à un équipier depuis votre agent, garder la décision et retrouver le travail réalisé.
seo:
  title: Premier Relay, confier une tâche à Claude Code ou Codex
  description: "Faire coopérer vos agents avec PALABRE : avis, relecture ou correction avec accord ponctuel, depuis Desktop, le terminal ou en arrière-plan."
---

Relay, c'est confier une tâche à un équipier. Votre agent transmet le travail à l'autre agent et vous rend compte du résultat. Vous n'avez plus à copier-coller les échanges ; vous gardez la décision.

## Comment ça marche

L'agent à qui vous parlez est le **chef de mission**. Celui qui reçoit la tâche est l'**équipier**. Ils peuvent travailler de trois façons :

| Votre façon de travailler | Sens des échanges et possibilités actuelles |
| --- | --- |
| Deux applications Desktop | Claude Code peut confier une tâche à une conversation Codex ouverte, sous Windows, avec `--open`. Elle agit avec ses permissions habituelles. L'envoi vers une conversation Claude Code ouverte n'est pas encore disponible. |
| Deux terminaux CLI | Même direction vers Codex ouvert sous Windows avec `--open`, mais ce parcours reste pilote et peu testé. L'envoi vers Claude Code ouvert n'est pas disponible. |
| Un équipier en arrière-plan, sans fenêtre à ouvrir | Claude Code et Codex peuvent se confier des avis ou relectures dans les deux sens. Codex peut aussi corriger et tester sous Windows avec `--new --write`, après votre accord pour la tâche. Claude Code ne peut pas encore agir ainsi sous Windows natif. |

Vous pouvez confier du travail en arrière-plan depuis Desktop comme depuis un terminal. Pour un avis ou une relecture sans modification, PALABRE crée une conversation avec `--new`, ou reprend une conversation existante fermée. Pour agir dans une conversation Codex déjà ouverte, `--open` conserve ses permissions : le message ne lui donne aucun droit supplémentaire.

Si Codex est chef de mission, son environnement peut vous demander d'autoriser l'appel réseau vers Claude Code. Cette autorisation ne remplace jamais l'accord pour écrire.

## Les mots de Relay

- **Chef de mission** : l'agent à qui vous parlez. Il confie la tâche et vous rend compte.
- **Équipier** : l'agent qui reçoit la tâche.
- **Conversation ouverte** : une conversation affichée en ce moment, dans Codex desktop ou dans un terminal. L'équipier y travaille avec ses réglages habituels, comme si vous lui écriviez vous-même.
- **Conversation fermée** : une conversation déjà existante, mais qu'aucune fenêtre n'affiche. PALABRE la rouvre le temps d'un échange, puis la referme.
- **Arrière-plan** : l'équipier travaille sans fenêtre. PALABRE le lance pour une seule tâche, attend sa réponse, puis s'arrête.
- **Identifiant de conversation** : le numéro qui désigne une conversation précise. Gardez-le pour continuer avec le même équipier.
- **Délivrance** : savoir si le message est bien arrivé. Un message arrivé ne veut pas dire tâche réussie.
- **Accord ponctuel** : votre confirmation au clavier pour une seule tâche d'écriture. Elle ne sert qu'une fois.
- **Worktree** : une copie séparée de votre projet, où l'équipier peut modifier des fichiers sans toucher à l'original.

## Préparer une fois

Installez [PALABRE](/fr/get-started/installation), Claude Code et Codex, puis connectez les agents avec leurs outils habituels. Dans le dossier du projet, lancez `palabre init` si aucune configuration n'existe, puis vérifiez :

```text
palabre doctor
palabre relay --help
```

L'aide doit proposer `--new` et `--write` pour suivre tout ce guide. Sinon, utilisez une version de PALABRE qui les contient ; voir [Installation et mise à jour](/fr/get-started/installation).

Installez aussi le [skill Palabre](/fr/get-started/skill) pour votre agent habituel. Copiez le dossier complet, références comprises, puis ouvrez une nouvelle conversation pour qu'il le voie. Après une évolution du skill, sa copie installée doit être mise à jour manuellement.

Chaque appel utilise le compte et le modèle de l'agent choisi. Vérifiez ce que vous partagez avant de lui confier des fichiers sensibles.

## Confier une tâche par votre agent

Depuis votre conversation habituelle avec Claude Code, dites par exemple :

> Passe par PALABRE pour confier à Codex la correction du calcul dans src/prix.js et le lancement des tests existants. Prépare la tâche et montre-moi ce que je dois confirmer.

Sous Windows, votre agent prépare une tâche `--new --write`. Vous relisez la tâche, le projet et la copie de travail annoncée, puis vous confirmez vous-même dans votre terminal avec `approve-write`. Votre agent peut ensuite lancer `run-write`, une seule fois. Il ne confirme jamais à votre place.

Codex travaille dans une copie Git séparée, appelée **worktree**, à partir du commit annoncé. Vos changements non commités n'y sont pas inclus. Votre projet principal garde ses fichiers ; le travail de l'équipier est conservé, même en échec.

Pour une relecture sans modification, dites plutôt :

> Passe par PALABRE pour confier à Claude Code la relecture de ce plan, sans rien modifier.

Le skill choisit le parcours adapté. Sans conversation désignée, il en crée une ; sinon, il garde la cible que vous avez choisie. Pour une suite d'avis ou de relecture :

> Continue avec le même Codex pour relire le résultat, sans rien modifier.

Le chef de mission garde l'identifiant et vous dit ce qui a été fait, les tests réellement exécutés, les blocages et ce qui attend votre décision. Une nouvelle tâche d'écriture en arrière-plan exige une nouvelle conversation et un nouvel accord ponctuel.

### Où retrouver le travail

- L'échange appartient à la propre conversation de l'équipier, dont PALABRE donne l'identifiant. Son apparition dans Desktop n'est pas garantie immédiatement.
- Les fichiers modifiés restent dans le worktree indiqué par le compte rendu.
- Ils se retrouvent sur GitHub après un commit et un push, autorisés séparément, puis peuvent être relus dans une PR.

Rien ne remonte tout seul dans la conversation de l'agent qui a confié la tâche. Le chef de mission lit la réponse et le compte rendu rendus par PALABRE, puis vous les restitue. Pour intégrer et ranger le travail, suivez [Récupérer le résultat](/fr/usage/relay#récupérer-le-résultat).

## Sans agent

Vous pouvez aussi piloter Relay vous-même. Pour une correction avec Codex sous Windows, placez-vous à la racine d'un dépôt Git ayant au moins un commit :

```text
palabre relay --new --write --to codex "Corrige le calcul dans src/prix.js et lance les tests existants, sans installer de dépendance."
```

Cette commande prépare la demande, sans lancer de modèle. Remplacez `<demande>` ci-dessous par l'identifiant affiché, puis confirmez vous-même :

```text
palabre relay approve-write <demande>
```

Après confirmation, lancez une seule fois :

```text
palabre relay run-write <demande> --json
```

Pour un avis sans modification, un seul appel suffit, vers Claude Code ou Codex :

```text
palabre relay --new --to claude "Relis le plan et signale les risques, sans modifier de fichier."
```

Pour viser une conversation déjà ouverte avec `--open`, suivez le [guide Relay complet](/fr/usage/relay#conversation-codex-ouverte-open).

## Bon à savoir

- Gardez l'identifiant rendu pour continuer explicitement un avis ou une relecture avec `--to codex:<identifiant>` ou `--to claude:<identifiant>`, sans `--new`. Ne choisissez jamais « la dernière conversation » à la place de la cible.
- Sans `--open`, une conversation existante doit être fermée pendant l'appel. Avec `--open`, seul Codex sous Windows est pris en charge ; le parcours à deux terminaux reste à éprouver davantage.
- Un identifiant reçu ne prouve pas que la tâche a réussi. Lisez le statut, la délivrance et les preuves du compte rendu. En cas d'échec, ne renvoyez pas automatiquement la demande.
- `--write` ne permet ni commit, ni push, ni fusion, ni installation de dépendances par l'équipier. Un test bloqué reste signalé ; PALABRE n'élargit pas les permissions pour le faire passer. L'accord est consommé même en échec.
- Pour créer l'équipier dans un autre projet, utilisez `--dir "../autre-projet"` avec `--new`. L'écriture exige la racine d'un dépôt Git.

Les détails, les statuts et les limites de chaque parcours sont dans le [guide Relay complet](/fr/usage/relay).
