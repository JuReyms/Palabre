---
title: Lancer une première session
description: Lancer un premier débat ou une demande Ask depuis l'accueil TUI ou une commande courte, puis retrouver l'export Markdown.
---

```bash
palabre
```

Dans un terminal interactif, `palabre` ouvre l'accueil TUI. Au premier lancement, il crée `~/.palabre/palabre.config.json` si aucune config n'existe encore, détecte les agents installés, puis affiche le mode courant, les agents, les rôles, l'agent de synthèse, le dossier courant et les commandes utiles.

À chaque ouverture de l'accueil TUI, Palabre rafraîchit les agents connus détectés dans la config. Il peut ajouter les nouveaux agents connus installés et mettre à jour les noms de commandes connus, tout en conservant les agents custom et les choix utilisateur.

Tapez simplement votre sujet dans le champ `Mode debat > Sujet >`, puis appuyez sur Entrée. Pour obtenir plusieurs réponses indépendantes au lieu d'une conversation, utilisez `/ask` avant de saisir le sujet.

Commandes utiles depuis l'accueil :

- `/ask` passe en mode Ask ;
- `/agents` affiche les agents disponibles et permet de choisir les agents actifs ;
- `/roles` affiche les rôles disponibles et permet de les appliquer ;
- `/config` ouvre les réglages sans sortir de la TUI.

`palabre new` reste disponible si vous préférez un assistant guidé qui affiche aussi la commande équivalente.

## Lancer avec les agents par défaut

Si vous avez [configuré des agents par défaut](/fr/configuration/defaults) :

```bash
palabre -s "Critique ce plan technique" -t 4
```

`-s` indique le sujet. `-t 4` demande quatre réponses au total, pas quatre réponses par agent.

## Lancer une demande Ask

```bash
palabre ask "Compare ces deux approches" --agents codex claude opencode
```

En mode Ask, les agents répondent indépendamment au même sujet, sans voir les réponses des autres. La synthèse résume fidèlement chaque réponse et les compare. L'export utilise l'extension `.ask.md`.

## Lancer avec un preset

```bash
palabre codex-claude "Critique ce plan technique" -t 4
```

La syntaxe courte `codex-claude` choisit la paire d'agents. Le sujet peut être placé directement après le preset.

## Lancer avec des agents explicites

```bash
palabre run --subject "Critique ce plan technique" --agent-a codex --agent-b claude --turns 4
```

Cette forme est plus longue, mais pratique dans des scripts.

## Ajouter du contexte projet

Pour demander aux agents de lire des fichiers ou dossiers texte :

```bash
palabre codex-claude "Critique cette architecture" --context src docs -t 4
```

Pour fournir seulement quelques fichiers précis :

```bash
palabre codex-claude "Relis ce module" --files src/auth.ts README.md -t 2
```

## Lire le résultat

Pendant la session, Palabre affiche les réponses dans le terminal. À la fin, il exporte un fichier `.debate.md` pour un débat ou `.ask.md` pour une demande Ask, avec :

- les informations de session ;
- le contexte fichier injecté ;
- le transcript complet du débat, ou les réponses indépendantes des agents en mode Ask ;
- la synthèse finale ;
- une conclusion courte en prose.

Par défaut, l'[export](/fr/usage/exports) est créé dans un dossier `.palabre/` sous le dossier depuis lequel vous lancez la commande. À la fin du débat, Palabre affiche le chemin complet du fichier exporté dans le terminal.

Pour aller plus loin, consultez [Débat et Ask](/fr/usage/running-a-debate), [Contexte et fichiers](/fr/usage/context-and-files) et [Synthèses](/fr/usage/summaries).
