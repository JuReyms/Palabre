---
title: Agents
description: Comprendre les agents Palabre, leurs rôles, leurs modèles et la différence entre CLIs externes et agents locaux.
seo:
  title: Agents IA compatibles et rôles disponibles
  description: Claude Code, Codex, OpenCode, Mistral Vibe, Antigravity et Ollama peuvent participer à une session. Comparer agents CLI et agents locaux.
---

Un agent Palabre est une entrée de configuration qui décrit comment appeler une IA.

Palabre supporte deux familles d'agents :

- les agents CLI, comme Claude Code, Codex CLI, Antigravity CLI, OpenCode ou Mistral Vibe ;
- les agents locaux, comme Ollama via son API HTTP.

## Agents CLI

Un agent CLI est lancé comme une commande de terminal. Palabre lui envoie un prompt, récupère sa sortie, puis ferme le process.

Chaque CLI garde ses propres règles : authentification, modèle par défaut, abonnement, limites d'usage et options de configuration. Certaines CLIs peuvent fonctionner avec une offre gratuite, un abonnement, un provider local ou un provider cloud ; dans tous les cas, les quotas et erreurs de limite viennent de l'agent utilisé, pas de Palabre.

## Agents locaux

Un agent local comme Ollama utilise un modèle installé sur votre machine. C'est utile pour des rôles de critique, d'exploration ou de synthèse légère. Si vous configurez Ollama avec une offre cloud ou un service payant, les limites associées restent celles d'Ollama ou du provider choisi.

Ollama ne lit pas vos fichiers directement. Pour lui donner du contexte, utilisez `--files` ou `--context`.

## Voir les agents disponibles

```bash
palabre agents
palabre agents --json
```

Si une CLI installée n'apparaît pas dans la configuration :

```bash
palabre config --sync-agents
```

## Rôles

Chaque agent a un rôle qui influence le prompt :

| Rôle | Usage |
|------|-------|
| `implementer` | Proposer une solution concrète. |
| `reviewer` | Chercher les risques, régressions et tests manquants. |
| `critic` | Challenger les hypothèses. |
| `architect` | Structurer les options techniques. |
| `scout` | Explorer rapidement un sujet. |
| `summarizer` | Produire une synthèse fidèle. |

Les rôles ne changent pas le modèle utilisé. Ils changent la consigne envoyée dans le prompt.

## Utiliser un rôle

Un rôle durable se configure dans `palabre.config.json`, dans l'entrée de l'agent, ou avec `palabre agent-role <agent> <role>`. Pour un lancement ponctuel, utilisez `--role-a`, `--role-b` en mode débat, ou `--ask-role` pour appliquer un rôle commun aux agents Ask.

Exemple :

Extrait du bloc `agents` :

```json
"codex": {
  "type": "cli",
  "command": "codex",
  "role": "implementer"
},
"claude": {
  "type": "cli",
  "command": "claude.exe",
  "role": "reviewer"
}
```

Avec cette configuration :

```bash
palabre codex-claude "Critique ce plan" -t 4
```

Codex reçoit une consigne de proposition concrète, tandis que Claude reçoit une consigne de relecture critique.

Pour utiliser deux comportements différents avec la même CLI, créez deux agents distincts dans la configuration, par exemple `claude-reviewer` et `claude-summarizer`.

## Modèles passés en commande

Quand vous utilisez `--model-a`, `--model-b` ou `--summary-model`, Palabre ne vérifie pas la liste des modèles disponibles chez le provider. La valeur est transmise à la CLI concernée via son option modèle configurée. Si le modèle n'existe pas ou n'est pas autorisé par votre compte, c'est la CLI qui renvoie l'erreur.

## Agents et Relay

[Relay](/fr/usage/relay) vise des conversations Codex ou Claude Code : fermées par défaut ; `--open` vise seulement Codex sous Windows, macOS ou Linux (pilote, avec `python3` requis sur POSIX). Mission, option de Relay, utilise les conversations fermées. Antigravity, OpenCode, Mistral Vibe et Ollama participent à Débat, Ask et Chat, pas aux cibles Relay.

Les agents CLI sont lancés depuis le dossier courant. Les défauts demandent la lecture seule quand elle est disponible : Claude `Read,Glob,Grep`, Codex `--sandbox read-only`, Vibe `read,grep`. OpenCode `--pure` désactive les plugins, **sans garantir une liste d'outils en lecture seule**. Des arguments personnalisés restent sous votre contrôle ; les migrations ne remplacent que d'anciens défauts exacts. Une limite connue donne `usage-limit`, sans renvoi automatique.

## Windows

Les adapters préfèrent un exécutable natif, puis un shim npm ou pnpm reconnu, lancé directement (Node + script JavaScript, ou variante native npm). Pour pnpm, le `NODE_PATH` du shim est transmis. Un autre shim peut passer par PowerShell ; les wrappers shell restants sont refusés pour un prompt en argument. `shell: true` dans la configuration générée active cette résolution prudente ; ne le retirez pas pour forcer le lancement d'un wrapper. Relay n'accepte que les exécutables directs et la forme npm Node + script.

`tier` (`primary` ou `local`) classe l'agent dans la configuration ; il ne change pas sa consigne de rôle.
