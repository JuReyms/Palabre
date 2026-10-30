---
title: OpenCode
description: Configurer OpenCode dans Palabre et l'utiliser comme agent CLI dans une paire de débat.
seo:
  title: Utiliser OpenCode comme agent de débat
  description: Configurer OpenCode dans Palabre et l'associer à Claude Code, Codex ou un modèle Ollama local dans un débat.
---

OpenCode est une CLI d'assistance au développement. Selon votre configuration locale, elle peut utiliser différents modèles et providers.

Palabre peut l'utiliser comme agent CLI au même titre que Codex, Claude ou Antigravity.

## À installer avant Palabre

Installez OpenCode depuis la documentation officielle, puis vérifiez que la commande fonctionne :

Documentation officielle : [https://opencode.ai/docs/](https://opencode.ai/docs/)

Référence CLI : [https://opencode.ai/docs/cli/](https://opencode.ai/docs/cli/)

```bash
opencode --version
```

Si OpenCode a été installé après votre première configuration Palabre, relancez `palabre` ou synchronisez explicitement :

```bash
palabre config --sync-agents
```

## Windows

Voir [Lancement des agents sous Windows](/fr/agents/overview#windows).

## Offres et limites

OpenCode peut utiliser des providers gratuits, payants ou locaux selon votre configuration. Les quotas, abonnements et limites d'usage dépendent donc du provider configuré dans OpenCode, pas de Palabre.

## Modèle par défaut

OpenCode garde son propre modèle par défaut. La configuration générée contient `modelArg: "--model"` : `--model-a`, `--model-b` ou `--summary-model` transmettent la valeur à OpenCode, qui la valide.

## Connexion et modèle utilisé

Une CLI détectée ou une interface qui fonctionne ne garantit pas que son modèle par défaut fonctionne aussi en appel non interactif. `palabre doctor` l’indique pour OpenCode, sans appeler de modèle ni modifier vos réglages.

En cas de refus de connexion reconnu, votre assistant explique la différence possible entre le choix de l’interface et celui de la CLI. Il peut proposer un modèle explicite pour une prochaine demande, avec `--model-a`, `--model-b` ou `--summary-model` selon le besoin. Palabre ne se connecte pas, ne change pas vos réglages et ne renvoie pas la demande automatiquement. Un essai réel consomme du quota et nécessite votre accord.

Un ancien défaut exact `["run", "--pure"]` peut rester dans le fichier : il est remplacé en mémoire à l’exécution. La commande confirmée `palabre config --sync-agents` permet de l’aligner ; les arguments personnalisés restent préservés.

## Configuration typique

Extrait du bloc `agents` :

```json
"opencode": {
  "type": "cli",
  "command": "opencode",
  "args": ["run"],
  "promptMode": "stdin",
  "modelArg": "--model",
  "shell": true,
  "tier": "primary",
  "role": "reviewer"
}
```

OpenCode s'exécute dans son **environnement habituel** : ses plugins, serveurs MCP et permissions configurés restent actifs, en Débat, Ask et Chat comme pour les synthèses. Palabre ne promet ni neutralisation des plugins ni lecture seule. OpenCode 2 n'a plus l'option `--pure`, et Palabre n'a qualifié aucun remplaçant pour cette commande. Vérifiez donc vous-même les permissions d'OpenCode dans sa configuration.

## Réponses lentes

Certains modèles d'OpenCode répondent en plusieurs minutes. Sans `timeoutMs` dans la configuration, Palabre attend jusqu'à 15 minutes ; une valeur que vous avez fixée est conservée. Pendant l'attente, Palabre indique chaque minute qu'il attend toujours : cela ne dit rien de l'avancement du modèle.

Si le délai est dépassé, Palabre cesse d’attendre, indique si l’arrêt local est confirmé et ne renvoie jamais la demande. Avec les arguments par défaut, il demande seulement l’arrêt de son client OpenCode, sans arrêter votre application ou son service. Votre assistant peut alors conserver une référence de la demande. Avec cette référence, votre assistant peut relire plus tard la réponse de cette demande précise, sans la renvoyer, si la même configuration approuvée est toujours en place. Il vous dit simplement si la réponse est prête, encore en cours ou introuvable : vous n'avez ni identifiant à recopier ni commande à lancer. Une réponse retrouvée se vérifie comme toute réponse d'agent.

## Utilisation

```bash
palabre codex-opencode "Relis ce MVP" -t 4
palabre opencode-claude "Compare ces options" -t 3
```

Dans l'exemple Windows, `shell` vaut `true` ; il vaut `false` ailleurs.

Si une ancienne configuration contient encore l'ancien défaut exact `["run", "--pure"]`, Palabre le remplace par `["run"]` à chaque lancement, sans toucher au fichier ; `palabre config --sync-agents` écrit ce remplacement dans le fichier. Des arguments personnalisés ne sont jamais modifiés : s'ils contiennent `--pure`, OpenCode 2 refuse de démarrer et Palabre vous indique de retirer `--pure` vous-même.

Le [pilote Relay OpenCode sur copie](/fr/usage/relay#demander-un-avis-à-une-copie-opencode) utilise un parcours distinct, avec l'environnement habituel conservé, pour Windows et OpenCode CLI 2.0.32 seulement.
