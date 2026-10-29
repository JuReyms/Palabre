---
title: Premier Relay
description: Réussir un premier échange Relay entre Codex et Claude Code, reconnaître le résultat et continuer avec le même équipier.
seo:
  title: Premier Relay, faire communiquer Claude Code et Codex
  description: "Demander un avis à Claude Code depuis Codex, ou l'inverse, recevoir la réponse sans copier-coller et continuer la même conversation."
---

Avec le mode Relay, l'agent à qui vous parlez demande un avis à un autre outil IA, appelé équipier, puis vous rapporte sa réponse dans votre conversation, sans copier-coller. Cette page vous guide pour un premier échange et sa suite ; le [guide Relay complet](/fr/usage/relay) détaille le reste.

## Avant de commencer

- [PALABRE installé](/fr/get-started/installation), ainsi que Codex et Claude Code, chacun connecté avec son compte habituel.
- Une [configuration approuvée](/fr/get-started/configuration#autres-réglages-et-approbation) : `palabre init` la crée et l'approuve ; `palabre doctor` vérifie l'ensemble sans interroger de modèle.
- Le [skill Palabre](/fr/get-started/skill) installé dans l'agent à qui vous parlez, puis rechargé, ou une nouvelle conversation ouverte.

Ces préparations vous reviennent : un agent peut vous guider, mais c'est vous qui décidez et confirmez l'installation, la connexion et l'approbation. Votre demande et les fichiers lus partent vers l'outil choisi ; évitez les données sensibles pour cet essai.

## 1. Demander un avis

Depuis une conversation Codex ouverte dans le dossier de votre projet, envoyez par exemple :

> Passe par PALABRE pour demander à Claude Code son avis sur ce plan fictif, sans modifier de fichier. Plan fictif : 1) publier la nouvelle page Tarifs du site ; 2) vérifier tous ses liens ; 3) tester son formulaire de contact. Je veux un risque principal et une amélioration. Crée une nouvelle conversation et garde-la pour la suite.

Ce plan fictif est dans le message : aucun site ni fichier à préparer. Depuis Claude Code, envoyez le même texte en remplaçant « Claude Code » par « Codex ».

Depuis Codex Desktop, Codex demande d'autoriser la commande PALABRE hors de son bac à sable. Relisez-la et acceptez **cette fois seulement** : ni accès total, ni règle permanente. Chaque commande suivante demande sa propre autorisation. Le réglage « approuver à ma place » peut accepter sans vous montrer la demande : laissez-le désactivé si vous voulez valider vous-même, car une commande lancée ne prouve pas que vous avez cliqué. Ce parcours a été vérifié sous Windows ; pour les autres configurations, voir le [parcours depuis Codex](/fr/usage/relay#codex-chef-de-mission).

L'échange peut prendre un moment : la durée dépend des outils, des modèles et de vos quotas.

## 2. Reconnaître la réussite

Votre agent vous rend compte dans la conversation de départ :

- **l'avis de l'équipier** : un risque et une amélioration, rapportés en mots simples ;
- **le mode** : arrière-plan. L'équipier a travaillé sans fenêtre ; PALABRE demande la lecture seule et limite ses outils pendant l'appel, selon les [conditions décrites dans le guide](/fr/usage/relay#ce-que-fait-la-reprise) ;
- **la réception, distincte du résultat** : une réponse reçue ne prouve pas que l'avis est juste ni que la tâche est réussie. L'agent sépare ce qui est arrivé, ce que l'équipier conclut et les éléments qui l'appuient. Une réponse peut aussi être un refus ;
- **la trace** : un fichier `.relay.md` dans le dossier des [exports](/fr/usage/exports) (`.palabre/` par défaut). Demandez « Montre-moi l'export de cet échange » pour le consulter.

## 3. Continuer avec le même équipier

> Continue avec le même équipier : détaille le risque principal et propose une vérification simple, sans modifier de fichier.

L'agent reprend la conversation créée à l'étape 1 : pas de nouvelle conversation, rien à recopier. Si l'équipier est Claude et que vous avez ouvert sa conversation pour la lire, fermez-la d'abord : l'envoi vers une conversation Claude ouverte n'est pas disponible.

Dans une nouvelle conversation, votre agent n'a plus ce fil. Dites « Retrouve l'échange Relay récent sur la page Tarifs » : il consulte les exports et vous fait confirmer l'échange avant de continuer ([Retrouver un échange récent](/fr/usage/relay#retrouver-un-échange-récent)).

## Si ça bloque

- **Configuration non approuvée** (`config-untrusted`) : rien n'est envoyé. Relisez le fichier indiqué, puis approuvez-le vous-même avec `palabre config --config <fichier> --trust-config`, en remplaçant `<fichier>` par le chemin indiqué (entre guillemets s'il contient des espaces), avant de redemander. L'agent ne l'approuve pas à votre place.
- **Délivrance inconnue ou message sans réponse** (`unknown`, `persisted-no-reply`) : ne renvoyez pas la demande, elle est peut-être déjà arrivée. Vérifiez d'abord la conversation de l'équipier ou l'export ; PALABRE ne renvoie jamais automatiquement. Voir [Issue et délivrance](/fr/usage/relay#issue-et-délivrance).
- **L'équipier attend une autorisation** : votre agent ne peut pas la donner. Il vous dit où valider et s'arrête ; continuer sera une nouvelle demande de votre part.

## Choisir où travaille l'équipier

**L'arrière-plan est le défaut** : l'équipier répond sans fenêtre, avec les outils limités décrits plus haut. Pour un avis sans modification comme celui-ci, votre agent le garde explicitement (`--background`).

Vous pouvez aussi désigner une conversation Codex que vous avez ouverte et demander d'y travailler. Ce choix explicite (`--open`) garde les outils et permissions de cette conversation, y compris l'écriture si elle est autorisée. Si une relecture en arrière-plan vise une conversation ouverte, rien n'est envoyé et votre agent ne bascule pas de lui-même vers ce parcours plus permissif : vous fermez la conversation, ou vous choisissez `--open` en connaissance de cause. En faire votre habitude est un réglage que vous confirmez vous-même, expliqué dans le [guide Relay complet](/fr/usage/relay).

## Aller plus loin

Le [guide Relay complet](/fr/usage/relay) décrit l'ouverture des conversations dans les applications, les [commandes sans agent](/fr/usage/relay#démarrer-une-nouvelle-conversation), le [parcours depuis Codex](/fr/usage/relay#codex-chef-de-mission), les systèmes vérifiés, les statuts et les fonctions expérimentales ou gelées (`--write`, Mission, revue). Sur une nouvelle machine, commencez par [Changer de machine](/fr/get-started/change-machine).
