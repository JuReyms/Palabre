---
title: Skill Palabre
description: Installer le skill Palabre pour qu'un agent IA compatible skills sache quand utiliser Chat, Débat, Ask ou Relay.
seo:
  title: Utiliser Palabre depuis un agent à skills
  description: Installer le skill Palabre pour que Claude Code, Codex ou un autre agent compatible skills choisisse entre Chat, Débat, Ask et Relay.
---

Palabre fournit un skill prêt à l'emploi. Il apprend à un agent IA que Palabre est disponible, quand l'utiliser et comment choisir le bon parcours :

| Parcours | Quand l'agent le choisit |
|----------|--------------------------|
| [Chat](/fr/usage/chat) | Avancer avec un agent, demander un second avis ponctuel, poursuivre après une synthèse. |
| [Débat](/fr/usage/debate) | Confronter deux positions et travailler les désaccords. |
| [Ask](/fr/usage/ask) | Recueillir jusqu'à quatre avis indépendants avant de les comparer. |
| [Relay](/fr/usage/relay) | Interroger une conversation Claude Code ou Codex fermée qui possède déjà le contexte. |

Le skill suit le standard ouvert [agentskills.io](https://agentskills.io) : il est donc portable entre Claude Code, Codex, Hermes Agent et tout agent compatible skills.

Le skill ne remplace pas la CLI : il pilote `palabre` en local. Palabre CLI reste la source de vérité pour les agents, les presets, les sessions et les exports.

## Installer le skill

Le skill est un dossier : [`skills/palabre`](https://github.com/JuReyms/Palabre/tree/main/skills/palabre) dans le dépôt, et `skills/palabre` dans le paquet npm installé. Copiez ce dossier entier, références comprises, à l'emplacement attendu par votre agent.

| Agent | Pour tous vos projets | Pour un seul projet |
|-------|-----------------------|---------------------|
| Claude Code | `~/.claude/skills/palabre/` | `.claude/skills/palabre/` |
| Codex | `~/.codex/skills/palabre/` | `.agents/skills/palabre/` |
| Hermes Agent | `hermes skills install JuReyms/Palabre/skills/palabre` | — |

Pour Claude desktop ou un autre agent, suivez sa procédure d'installation de skills en pointant vers ce dossier.

Après une mise à jour de Palabre, recopiez le dossier : la copie installée n'est pas mise à jour automatiquement.

## Quand l'agent voit le skill

Un agent charge la liste des skills quand une session démarre ou reprend. Après l'installation, ouvrez une nouvelle session ou reprenez-en une : une session déjà en cours ne voit pas forcément le skill.

| Agent | Session neuve | Session reprise après l'installation |
|-------|---------------|--------------------------------------|
| Claude Code 2.1.85 et 2.1.292 | Skill visible | Skill visible |
| Codex 0.151.0 | Skill visible | Skill visible |

Ces comportements ont été vérifiés en mode non interactif (`claude -p`, `codex exec`), avec un skill de projet et des sessions jetables. Ils peuvent changer avec d'autres versions. Si l'agent ne mentionne pas Palabre, rappelez-lui que le skill `palabre` est disponible.

Une seule copie du skill doit rester active. Si une ancienne version est aussi installée, par exemple un skill `palabre` ajouté à votre compte Claude puis synchronisé, l'agent peut suivre l'ancienne : mettez-la à jour ou retirez-la.

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

- **Choix du parcours** : Chat, Débat, Ask ou Relay selon le besoin, sans lancer Palabre pour une tâche simple ni imposer un Débat à chaque demande de second avis.
- **Chat piloté proprement** : l'agent utilise le [flux NDJSON](/fr/integrations/ndjson) et les commandes JSON sur stdin (`chat-send`, `chat-consult`, `chat-use`, `chat-agents`, `chat-end`), jamais une imitation de la TUI. Il connaît la mémoire bornée de Chat : six messages récents, aucune reprise après arrêt.
- **Trois reprises distinguées** : la session de l'agent hôte, les [checkpoints Palabre](/fr/reference/cli#reprendre-une-session) de Débat et Ask, et la reprise d'une conversation externe par Relay.
- **Relay prudent** : cible désignée par vous, conversation fermée, expéditeur non authentifié, historique de la cible modifié, aucun renvoi automatique selon le statut de délivrance.
- **Contexte maîtrisé** : `--files` ou `--context`, avec un avertissement avant d'envoyer du contenu sensible ; Ollama pour rester en local.
- **Vous gardez la main** : installation, authentification, configuration, approbation de config et mises à jour restent vos décisions. Le rôle `implementer` est une consigne de proposition, pas une autorisation d'écrire.
- **Restitution** : l'agent lit l'export (`.chat.md`, `.debate.md`, `.ask.md` ou `.relay.md`) et vous rend décisions, désaccords, limites et prochaines étapes.
