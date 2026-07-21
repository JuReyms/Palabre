---
title: Flux NDJSON v1
description: Lire les événements de session Palabre sur stdout et construire une interface robuste.
---

`--renderer ndjson` écrit un objet JSON valide par ligne sur stdout. Chaque événement contient `v: 1` et un champ `type`.

| Type | Usage |
|------|-------|
| `start` | Mode, sujet, agents, contexte et options. |
| `notice`, `warning` | Informations ordonnées dans le flux. |
| `thinking-start`, `thinking-end` | État d'attente d'un agent. |
| `turn-start`, `message` | Tour et réponse Débat. |
| `ask-response-start`, `ask-response` | Réponse Ask. |
| `summary-start`, `summary-message` | Synthèse. |
| `error` | Échec structuré. |
| `done` | Fin métier et chemin d'export, éventuellement nul. |

Chat ajoute `chat-agents`, `chat-user-message`, `chat-message`, `chat-consultation-start`, `chat-consultation` et `chat-agent-changed`. Ses commandes sont envoyées sur stdin, une ligne à la fois.
Pour une intégration, chaque commande Chat doit être un objet JSON v1 sur une seule ligne :

| Commande | Usage |
|----------|-------|
| `chat-send` | Envoyer `content` à l'agent actif. |
| `chat-consult` | Demander un avis ponctuel à `agent` sans changer l'agent actif. |
| `chat-use` | Choisir `agent` comme interlocuteur actif pour les prochains messages. |
| `chat-agents` | Redemander la liste des agents disponibles. |
| `chat-end` | Terminer la conversation et produire l'export `.chat.md`. |

```json
{"v":1,"type":"chat-send","content":"Analyse cette approche"}
{"v":1,"type":"chat-consult","agent":"vibe"}
{"v":1,"type":"chat-use","agent":"vibe"}
{"v":1,"type":"chat-end"}
```

Les commandes texte historiques restent acceptées pour les usages humains. Une intégration doit utiliser les objets JSON afin que le contenu d'un message ne puisse pas être confondu avec une commande.


```json
{"v":1,"type":"thinking-start","agent":"codex","role":"implementer"}
{"v":1,"type":"message","turn":1,"agent":"codex","role":"implementer","content":"..."}
{"v":1,"type":"thinking-end"}
{"v":1,"type":"done","outputPath":"C:\\project\\.palabre\\session.debate.md"}
```

stdout appartient au NDJSON. stderr peut contenir les diagnostics et la progression Ollama. Conservez l'ordre, ignorez les types inconnus, attendez le code de sortie et rendez le contenu agent comme texte non fiable, jamais comme HTML exécutable.
