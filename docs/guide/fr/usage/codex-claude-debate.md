---
title: Faire débattre Codex et Claude Code
description: Configurer Codex et Claude Code dans Palabre, leur attribuer des rôles complémentaires et obtenir une synthèse exploitable.
seo:
  title: Faire débattre Codex et Claude Code dans le terminal
  description: Lancez un débat entre Codex et Claude Code avec Palabre, ajoutez le contexte de votre projet, attribuez des rôles et obtenez une synthèse Markdown.
---

Palabre peut faire dialoguer Codex CLI et Claude Code sur une décision technique avant que vous ne passiez à l'implémentation. Chaque agent reçoit le même sujet et le même contexte, puis répond à l'analyse précédente.

Ce workflow est utile pour challenger une architecture, relire un plan de migration, comparer deux stratégies ou rechercher les risques oubliés par une première proposition.

## Préparer Codex et Claude Code

Installez et authentifiez les deux CLIs avec leurs mécanismes habituels. Palabre ne remplace pas leurs comptes ni leurs abonnements.

Vérifiez ensuite leur disponibilité :

```bash
codex --version
claude --version
palabre config --sync-agents
palabre doctor
```

La commande suivante doit afficher le preset comme disponible :

```bash
palabre presets --json
```

## Lancer le débat

Le preset `codex-claude` place Codex en premier et Claude Code en second :

```bash
palabre codex-claude "Compare ces deux architectures et recommande la plus robuste" -t 4
```

La variante inverse fait parler Claude Code en premier :

```bash
palabre claude-codex "Relis ce plan de migration et tranche les désaccords" -t 4
```

La position détermine l'ordre de parole. Les rôles restent ceux de votre configuration, sauf override explicite pour la session.

## Donner des rôles complémentaires

Une paire fonctionne mieux lorsque les agents ne reçoivent pas exactement la même mission. Par exemple :

```bash
palabre run \
  --subject "Faut-il séparer ce service en deux ?" \
  --agent-a codex \
  --agent-b claude \
  --role-a architect \
  --role-b critic \
  --turns 4
```

Codex structure alors une proposition d'architecture, tandis que Claude Code cherche les hypothèses fragiles et les conséquences non traitées.

## Ajouter le contexte du projet

Utilisez `--files` pour une sélection stricte et reproductible :

```bash
palabre codex-claude "Évalue cette stratégie de cache" \
  --files src/cache.ts src/config.ts \
  -t 4
```

Utilisez `--context` pour scanner un dossier de manière tolérante :

```bash
palabre codex-claude "Propose une migration progressive" \
  --context src docs/architecture \
  -t 4
```

Palabre marque les fichiers comme des données non fiables dans les prompts. Les limites de taille et les exclusions sont détaillées dans [Contexte et fichiers](/fr/usage/context-and-files).

## Lire la synthèse

Après le transcript, l'agent de synthèse organise :

- les points de consensus ;
- les désaccords et incertitudes ;
- les actions proposées ;
- une conclusion courte.

La session est exportée dans `.palabre/` sous la forme d'un fichier `.debate.md`. Cet export garde les arguments contradictoires, pas seulement la conclusion.

## Choisir Débat ou Ask

Utilisez Débat lorsque les agents doivent répondre aux objections de l'autre. Utilisez [Ask](/fr/usage/ask) si vous voulez d'abord obtenir deux réponses indépendantes sans influence mutuelle.

Pour une vue plus large des workflows disponibles, consultez [Utiliser plusieurs agents IA dans le terminal](/fr/usage/multi-agent-cli) et le [mode Débat](/fr/usage/debate).
