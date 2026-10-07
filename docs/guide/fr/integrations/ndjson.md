---
title: Flux NDJSON v1
description: Lire les événements de session Palabre sur stdout et construire une interface robuste.
seo:
  title: Lire les événements de session en NDJSON
  description: Lire les événements de session Palabre sur stdout au format NDJSON v1 et construire une intégration robuste.
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
| `dry-run` | Prévisualisation résolue sans appel d'agent ni export. |
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

Fin d'une session Chat :

- une ligne vide ou composée d'espaces est ignorée et ne ferme pas Chat ;
- `chat-end` (ou `/end`) écrit l'export, puis émet `done` avec son chemin ;
- `/exit`, `/quit`, `/home` et la fin de stdin terminent sans export : `done` porte `outputPath: null` ;
- une erreur d'agent émet `error`, puis Palabre écrit l'export partiel et émet `done` avec son chemin, ou `null` si cet export échoue. Le code de sortie vaut 1. Les commandes suivantes ne sont pas traitées ;
- une annulation (Ctrl+C) termine Chat de la même façon, y compris pendant l'attente d'un message : `error` avec `kind: "cancelled"`, puis `done`, et code de sortie 130. Au repos, l'erreur ne porte ni `action` ni `agent`. Sans aucun message échangé, aucun export n'est écrit et `done` porte `null`.

Après `start`, Chat émet donc toujours exactement un `done`. L'événement `error` de Chat porte `phase: "chat"`, `action` (`send`, `consult` ou `end`), `agent` et `role` quand ils sont connus, ainsi que `kind`, `message` et les champs optionnels `retryAfter` et `details`, comme pour Débat et Ask.

```json
{"v":1,"type":"error","phase":"chat","action":"consult","agent":"vibe","role":"critic","kind":"non-zero-exit","message":"..."}
{"v":1,"type":"done","outputPath":"C:\\project\\.palabre\\session.chat.md"}
```

`--dry-run` n'existe pas pour Chat : la commande est refusée avant tout événement, sans appel d'agent ni export.


```json
{"v":1,"type":"thinking-start","agent":"codex","role":"implementer"}
{"v":1,"type":"thinking-end"}
{"v":1,"type":"message","turn":1,"agent":"codex","role":"implementer","content":"..."}
{"v":1,"type":"done","outputPath":"C:\\project\\.palabre\\session.debate.md"}
```

stdout appartient au NDJSON. stderr peut contenir les diagnostics et la progression Ollama. Conservez l'ordre, ignorez les types inconnus, attendez le code de sortie et rendez le contenu agent comme texte non fiable, jamais comme HTML exécutable.
