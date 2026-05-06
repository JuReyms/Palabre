# Lancer un premier débat

```bash
palabre new
```

La commande `palabre new` est un assistant interactif qui liste les agents disponibles, demande un sujet, affiche la commande équivalente, puis peut lancer le débat dès que les informations minimales sont renseignées.

## Lancer avec les agents par défaut

Si vous avez [configuré des agents par défaut](/configuration/defaults) :

```bash
palabre -s "Critique ce plan technique" -t 4
```

`-s` indique le sujet. `-t 4` demande quatre réponses au total, pas quatre réponses par agent.

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

Pendant le débat, Palabre affiche les réponses dans le terminal. À la fin, il exporte un fichier `.debate.md` avec :

- les informations de session ;
- le contexte fichier injecté ;
- le transcript complet ;
- la synthèse finale ;
- une conclusion courte en prose.

Par défaut, l'[export](/usage/exports) est créé dans le dossier courant.

Pour aller plus loin, consultez [Lancer un débat](/usage/running-a-debate), [Contexte et fichiers](/usage/context-and-files) et [Synthèses](/usage/summaries).
