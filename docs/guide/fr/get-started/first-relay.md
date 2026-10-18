---
title: Premier Relay
description: Confier une tâche à Codex depuis Claude, retrouver sa réponse et continuer avec la même conversation.
seo:
  title: Premier Relay, faire coopérer Claude Code et Codex
  description: Créer une conversation Codex avec Palabre, lui confier une relecture depuis Claude Code et continuer sans copier-coller les échanges.
---

Relay, c'est appeler un équipier qui travaille à côté. Vous lui confiez une tâche ; sa réponse revient là où vous l'avez demandée. Vous gardez la décision.

## Avant de commencer

Installez [PALABRE](/fr/get-started/installation), Claude Code et Codex, puis connectez les deux agents avec leurs outils habituels. Dans un terminal ouvert dans le dossier de votre projet, vérifiez :

```text
palabre doctor
```

Si aucune configuration n'existe, lancez `palabre init`. Vérifiez aussi que `palabre relay --help` propose `--new` ; sinon, [mettez PALABRE à jour](/fr/get-started/installation). Chaque demande utilise le compte et le modèle de l'agent choisi. Ne lui confiez pas de fichier sensible sans vérifier ce que vous partagez.

## Je travaille avec Claude et je veux confier une tâche à Codex

Vous n'avez pas besoin de préparer une conversation Codex. Depuis le dossier du projet, lancez :

```text
palabre relay --new --to codex --from claude "Relis src/prix.js. Signale les erreurs possibles, sans modifier de fichier."
```

Remplacez `src/prix.js` par un fichier de votre projet. PALABRE crée une conversation Codex, lui demande de lire le fichier, puis affiche sa réponse. Il donne aussi l'identifiant de cette conversation, une commande pour continuer et le chemin de l'export `.relay.md`.

`--from claude` indique seulement qui envoie la demande. Vous pouvez l'omettre si vous la lancez vous-même depuis le terminal.

Pour travailler dans un autre dossier, ajoutez `--dir "../autre-projet"` lors de la création. Pour confier plutôt la tâche à Claude Code, remplacez `--to codex` par `--to claude`.

## Continuer avec la même conversation

Gardez l'identifiant rendu et reprenez la commande affichée par PALABRE. Par exemple, en remplaçant `<identifiant>` par cet identifiant :

```text
palabre relay --to codex:<identifiant> "Quel test permettrait de vérifier le premier risque ?"
```

N'ajoutez plus `--new` : Codex retrouve le contexte du premier échange. Chaque commande envoie une demande et attend une seule réponse. Laissez cette conversation fermée dans Desktop et dans les autres outils pendant l'appel.

Un identifiant peut être rendu même si la première demande échoue. Cela ne prouve pas qu'une réponse a été obtenue. Lisez le diagnostic avant de renvoyer quoi que ce soit ; PALABRE ne recommence jamais automatiquement.

## Viser une conversation qui connaît déjà le projet

Vous avez déjà travaillé sur ce projet avec Codex ou Claude Code ? Fermez cette conversation, conservez son identifiant, puis confiez-lui directement la tâche :

```text
palabre relay --to claude:<identifiant> "Relis le plan dont nous avons parlé et signale ce qui manque, sans rien modifier."
```

PALABRE ne choisit jamais « la dernière conversation » à votre place. Pour trouver l'identifiant, consultez [Désigner les conversations](/fr/usage/relay#désigner-les-conversations). Une conversation créée par la CLI n'apparaît pas forcément tout de suite dans Desktop.

## Le faire faire par mon agent

Avec le [skill Palabre installé](/fr/get-started/skill), dites simplement à Claude Code :

> Passe par Palabre pour demander à Codex de relire src/prix.js, sans rien modifier.

Votre agent crée un équipier avec `--new` si vous n'avez pas désigné de conversation, lui transmet la demande et vous rapporte sa réponse. Il garde l'identifiant pour une suite explicite :

> Demande au même Codex quel test ajouter. Ne modifie rien.

Vous n'avez pas à copier-coller les messages entre agents. L'agent doit vous dire ce qui a été vérifié, les limites rencontrées et ce qui attend votre décision. Une copie installée du skill doit être mise à jour manuellement après une évolution du skill fourni avec PALABRE.

## Ce que Relay ne fait pas encore

Ce parcours sert à relire et conseiller, pas à écrire des fichiers. L'option `--open`, distincte de `--new`, vise seulement une conversation Codex ouverte sous Windows ; elle conserve ses permissions et ne garantit pas la lecture seule.

Pour les statuts, les erreurs et les autres possibilités, continuez avec le [guide Relay complet](/fr/usage/relay).
