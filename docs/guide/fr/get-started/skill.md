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
- au moins un agent compatible configuré ou détecté par Palabre ; deux ou plus sont recommandés pour les comparaisons ;
- un agent hôte compatible avec le standard agentskills.io.

Vérifiez l'installation depuis un terminal :

```bash
palabre --version
palabre doctor
palabre agents
```

## Ce que le skill apporte

- déclenchement automatique du débat quand l'utilisateur demande de confronter deux approches, d'obtenir une relecture critique ou une seconde opinion contradictoire — l'agent lance `palabre` sans redemander, en déduisant le sujet du contexte ;
- choix d'une paire d'agents complémentaires (proposeur / reviewer) et injection ciblée du contexte via `--files` ou `--context` ;
- garde-fou confidentialité : l'agent prévient avant d'injecter du code sensible et peut proposer une paire 100 % locale (Ollama) ;
- mode économique : recommandation d'un modèle local Ollama quand le sujet ne justifie pas deux agents premium ;
- gestion de la langue (`fr`/`en`) selon la langue de l'utilisateur ;
- restitution : proposition d'afficher le transcript complet directement dans la conversation, ou la synthèse seule ;
- suite du débat : transformer les actions en tâches, appliquer le consensus (uniquement les points d'accord), approfondir un désaccord, ou exporter en commentaire de PR / ADR ;
- compatibilité avec les intégrations qui maintiennent leur propre index de débats, par exemple un index d'extension VS Code dans `.palabre/`.
