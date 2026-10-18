---
title: Skill Palabre
description: Installer le skill Palabre pour qu'un agent IA compatible skills sache quand utiliser Débat, Relay, Ask ou Chat.
seo:
  title: Utiliser Palabre depuis un agent à skills
  description: Installer le skill Palabre pour que Claude Code, Codex ou un autre agent compatible skills choisisse entre Débat, Relay, Ask et Chat.
---

Palabre fournit un skill prêt à l'emploi. Il apprend à un agent IA que Palabre est disponible, quand l'utiliser et comment choisir le bon parcours :

| Parcours | Quand l'agent le choisit |
|----------|--------------------------|
| [Débat](/fr/usage/debate) | Confronter deux positions et travailler les désaccords. |
| [Relay](/fr/usage/relay) | Faire communiquer des conversations précises : Claude Code ou Codex chef de mission, avis/relecture vers une cible fermée, action dans Codex ouvert sous Windows avec ses permissions. |
| [Ask](/fr/usage/ask) | Recueillir jusqu'à quatre avis indépendants avant de les comparer. |
| [Chat](/fr/usage/chat) | Avancer avec un agent, demander un second avis ponctuel, poursuivre après une synthèse. |

Le skill suit le standard ouvert [agentskills.io](https://agentskills.io) : il est donc portable entre Claude Code, Codex, Hermes Agent et tout agent compatible skills.

Le skill ne remplace pas la CLI : il pilote `palabre` en local. Palabre CLI reste la source de vérité pour les agents, les presets, les sessions et les exports.

## Installer le skill

Le skill est un dossier : [`skills/palabre`](https://github.com/JuReyms/Palabre/tree/main/skills/palabre) dans le dépôt, et `skills/palabre` dans le paquet npm installé. Copiez ce dossier entier, références comprises, à l'emplacement attendu par votre agent.

| Agent | Pour tous vos projets | Pour un seul projet |
|-------|-----------------------|---------------------|
| Claude Code | `~/.claude/skills/palabre/` | `.claude/skills/palabre/` |
| Codex | `~/.agents/skills/palabre/` | `.agents/skills/palabre/` |
| Hermes Agent | `hermes skills install JuReyms/Palabre/skills/palabre` | — |

Pour Codex, `~/.agents/skills/` est l'emplacement utilisateur indiqué par la [documentation de Codex](https://learn.chatgpt.com/docs/build-skills#where-codex-loads-local-skills). L'ancien emplacement `~/.codex/skills/` reste lu par Codex 0.151.0.

Pour Claude desktop ou un autre agent, suivez sa procédure d'installation de skills en pointant vers ce dossier.

Après une mise à jour de Palabre, recopiez le dossier : la copie installée n'est pas mise à jour automatiquement.

Pour commencer, dites à Claude Code ou à Codex : « Passe par PALABRE pour demander à l’autre agent de relire le plan dans docs/plan.md, sans modifier de fichier. Garde la conversation pour la suite. » Vous choisissez le chef de mission. Depuis Codex desktop, chaque commande vers Claude demande une autorisation ponctuelle de l’hôte ; suivez [Premier Relay](/fr/get-started/first-relay).

## Quand l'agent voit le skill

Un agent charge la liste des skills quand une session démarre ou reprend. Après l'installation, ouvrez une nouvelle session ou reprenez-en une : une session déjà en cours ne voit pas forcément le skill.

| Agent | Session neuve | Session reprise après l'installation |
|-------|---------------|--------------------------------------|
| Claude Code 2.1.85 et 2.1.292 | Skill visible | Skill visible |
| Codex 0.151.0 | Skill visible | Skill visible |

Ces comportements ont été vérifiés en mode non interactif (`claude -p`, `codex exec`), avec un skill de projet et des sessions jetables. Les emplacements utilisateur, la TUI, les applications de bureau et les IDE n'ont pas été vérifiés. Ces comportements peuvent changer avec d'autres versions. Si l'agent ne mentionne pas Palabre, rappelez-lui que le skill `palabre` est disponible.

Une seule copie du skill doit rester active. Si une ancienne version est aussi installée, par exemple un skill `palabre` ajouté à votre compte Claude puis synchronisé, l'agent peut suivre l'ancienne : mettez-la à jour ou retirez-la.

## Prérequis

- Palabre CLI installé sur la même machine (`npm install --global palabre`) ;
- au moins un agent compatible configuré ou détecté par Palabre ; deux ou plus sont recommandés pour les comparaisons ;
- un agent hôte compatible avec le standard agentskills.io.

Vérifiez l'installation depuis un terminal :

```bash
palabre --version
palabre doctor
palabre agents
```

## Ce que le skill apporte

### Nommer les tâches PALABRE

Votre agent nomme chaque tâche PALABRE `Palabre <mode> : <objet>`, par exemple `Palabre Relay : envoyer la relecture à Codex`. C'est le skill qui le lui demande ; l'application de votre agent décide de ce qu'elle affiche réellement.

Dans un terminal, PALABRE affiche son nom et son mode dans le titre de la fenêtre, par exemple `Palabre · Relay`. Il remet l'ancien titre à la fin quand le terminal le permet. Rien n'est ajouté quand PALABRE est lancé par un programme ou avec `--json`. Sous Windows, le Gestionnaire des tâches continue d'afficher `node`.

### Choisir et suivre le parcours

- **Choix du parcours** : Débat, Relay, Ask ou Chat selon le besoin, sans lancer Palabre pour une tâche simple ni imposer un Débat à chaque demande de second avis.
- **Chat piloté proprement** : l'agent utilise le [flux NDJSON](/fr/integrations/ndjson) et les commandes JSON sur stdin (`chat-send`, `chat-consult`, `chat-use`, `chat-agents`, `chat-end`), jamais une imitation de la TUI. Il connaît la mémoire bornée de Chat : six messages récents, aucune reprise après arrêt.
- **Trois reprises distinguées** : la session de l'agent hôte, les [checkpoints Palabre](/fr/reference/cli#reprendre-une-session) de Débat et Ask, et la reprise d'une conversation externe par Relay.
- **Relay prudent** : cible désignée par vous ; en-tête PALABRE, avertissement ℹ️ et « 🤖 Message pour l'agent » ; objet facultatif `--subject`, expéditeur non authentifié, historique modifié, aucun renvoi automatique ; diagnostic `usage-limit` ou `read-unavailable` conservé.
- **Contexte maîtrisé** : `--files` ou `--context`, avec un avertissement avant d'envoyer du contenu sensible ; Ollama pour rester en local.
- **Vous gardez la main** : installation, authentification, configuration, approbation de config et mises à jour restent vos décisions. Le rôle `implementer` est une consigne de proposition, pas une autorisation d'écrire.
- **Restitution** : l'agent lit l'export (`.chat.md`, `.debate.md`, `.ask.md` ou `.relay.md`, ainsi que `.mission.md` pour l’option Mission) et vous rend décisions, désaccords, limites et prochaines étapes.

L’option Mission et `--task review` sont gelés. `--write` est expérimental, gelé et hors parcours par défaut : le skill ne le propose que sur demande explicite de l’humain. Ces fonctions restent documentées ; seuls les correctifs de sécurité sont acceptés.

L'agent ne modifie ni n'approuve lui-même une politique qui lui accorde des droits : il vous montre la commande `relay allow-repo` ou d'approbation et attend votre action. Pour retrouver le skill du paquet installé : `npm root -g` (ou `pnpm root -g`), puis le sous-dossier `palabre/skills/palabre`.
