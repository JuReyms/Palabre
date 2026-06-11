---
title: Skill Palabre
description: Installer le skill Palabre pour lancer des débats directement depuis un agent IA compatible skills.
---

Palabre fournit un skill prêt à l'emploi qui apprend à un agent IA quand et comment orchestrer un débat avec la CLI Palabre. L'agent sait alors cadrer un sujet, choisir une paire d'agents, injecter le contexte et récupérer la synthèse exportée.

Le skill suit le standard ouvert [agentskills.io](https://agentskills.io) : il est donc portable entre Hermes Agent, Claude, Codex, Gemini CLI et tout agent compatible skills.

Le skill ne remplace pas la CLI : il pilote `palabre` en local. Palabre CLI reste la source de vérité pour les agents, les presets et les exports.

## Installer le skill

Dans **Hermes Agent** :

```bash
hermes skills install JuReyms/Palabre/skills/palabre
```

Pour les autres agents (Claude desktop, Claude Code…), suivez la procédure d'installation de skills propre à l'agent en pointant vers [`skills/palabre`](https://github.com/JuReyms/Palabre/tree/main/skills/palabre) dans le dépôt.

## Prérequis

- Palabre CLI installé sur la même machine (`npm install -g palabre`) ;
- au moins deux agents compatibles configurés ou détectés par Palabre ;
- un agent hôte compatible avec le standard agentskills.io.

Vérifiez l'installation depuis un terminal :

```bash
palabre --version
palabre doctor
palabre agents
```

## Ce que le skill apporte

- déclenchement automatique du débat quand l'utilisateur demande de confronter deux approches, d'obtenir une relecture critique ou une seconde opinion contradictoire ;
- choix d'une paire d'agents complémentaires (proposeur / reviewer) ;
- injection ciblée du contexte via `--files` ou `--context` ;
- récupération de la synthèse et du transcript exporté dans `.palabre/<slug>.debate.md`.
