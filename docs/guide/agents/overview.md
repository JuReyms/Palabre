# Agents

Palabre supporte deux familles d'agents :

- les agents CLI, comme Claude Code, Codex CLI, Gemini CLI ou OpenCode ;
- les agents comme Ollama (et bientôt LM Studio) qui appellent via l'API HTTP locale.

## Agents CLI

Un agent CLI est lancé comme une commande de terminal. Palabre lui envoie un prompt, récupère sa sortie, puis ferme le process.

Chaque CLI garde ses propres règles : authentification, modèle par défaut, abonnement, limites d'usage et options de configuration.

## Agents Locaux

Un agent local comme Ollama utilise un modèle local installé sur votre machine. C'est utile pour des rôles de critique, d'exploration ou de synthèse légère.

L'agent local ne lit pas vos fichiers directement. Pour lui donner du contexte, utilisez `--files` ou `--context`.

## Voir les agents disponibles

```bash
palabre agents
```

Si un agent CLI installé n'apparaît pas dans la configuration :

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
