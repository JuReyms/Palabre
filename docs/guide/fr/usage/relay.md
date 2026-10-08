---
title: Relay vers une conversation
description: Transmettre un message à une conversation Codex ou Claude Code fermée, ou à une conversation ouverte avec --open, et récupérer sa réponse avec palabre relay.
seo:
  title: palabre relay, interroger une conversation Codex ou Claude Code
  description: Envoyer un message à une conversation Codex ou Claude Code existante, fermée, et recevoir sa réponse en un seul appel, en lecture seule renforcée.
---

`palabre relay` transmet **un** message à une conversation Codex ou Claude Code existante, récupère **une** réponse, puis termine. Un agent peut ainsi interroger la conversation d'un autre agent, qui répond avec tout son contexte.

```bash
palabre relay --from codex:<session-expéditeur> --to claude:<session-cible> "Peux-tu relire ce plan ?"
```

## Conversation fermée par défaut

Sans `--open`, la conversation cible doit être **fermée** : aucun TUI, desktop, IDE ni exécution en cours ne doit y être attaché. Sinon, le relay est refusé avant tout envoi (`target-busy`). Il est aussi refusé quand Palabre ne peut pas vérifier l'état de la conversation (`target-state-unknown`).

Pour une conversation **ouverte**, utilisez `--open` (sections suivantes) : Codex, ou Claude Code en pilote expérimental, sous Windows.

## Conversation Codex ouverte (`--open`)

```bash
palabre relay --open --from claude:<session-expéditeur> --to codex:<session-cible> "Peux-tu relire ce plan ?"
```

Avec `--open`, Palabre dépose le message dans une conversation Codex **ouverte**, dans le TUI ou dans Codex desktop, avec la commande `codex queue`. Il attend ensuite la réponse de cette conversation dans son historique, puis vous la rend. C'est un **pilote**, réservé à Codex sous Windows.

- **La conversation doit être ouverte.** Son verrou d'écriture doit être tenu, sinon rien n'est déposé (`target-not-open`). Le verrou est contrôlé de nouveau juste avant le dépôt.
- **Pas de lecture seule.** La conversation ouverte répond avec ses propres outils, serveurs MCP et permissions, et Codex desktop applique ses permissions courantes au tour relayé. Les garanties de lecture seule du relay sans `--open` ne s'appliquent donc pas. Le message relayé indique qu'il vient d'un autre agent, non authentifié, et qu'il n'autorise aucune action.
- **Récepteur non vérifié.** Le verrou tenu ne prouve ni que la conversation est affichée, ni qu'elle traite le message. Codex desktop garde une conversation chargée après qu'on l'a quittée, et la traite sans l'afficher.
- **Traitement différé possible.** Un message déposé peut être traité après le délai, même si Palabre s'est arrêté. Ctrl+C n'annule pas un dépôt, et il n'y a aucun renvoi automatique.
- **Taille.** Le message passe en argument de commande : l'enveloppe complète est limitée à 8 192 unités UTF-16. Au-delà, le relay est refusé (`message-too-large`).
- **Un seul délai.** `--timeout` couvre la préparation, le dépôt et l'attente.
- **Historiques volumineux.** Palabre ne lit que la première ligne de l'historique et ce qui s'y ajoute après le dépôt, quelle que soit sa taille.

Versions vérifiées : Codex CLI 0.151.0 (TUI) et Codex desktop 26.930.7945.0 (app-server 0.160.1). Le format de l'historique de Codex n'est pas un schéma public : une autre version n'est pas bloquée, mais la corrélation de la réponse n'y est pas garantie.

## Conversation Claude Code ouverte (`--open`, pilote expérimental)

```bash
palabre relay --open --from codex:<session-expéditeur> --to claude:<session-cible> "Peux-tu relire ce plan ?"
```

Quand l'agent cible est Claude Code, `--open` envoie le message à une conversation **ouverte** (terminal ou Claude desktop) par la messagerie entre sessions de Claude Code. Palabre lance pour cela un messager `claude -p` (modèle `haiku`), puis lit la réponse dans le transcript de la conversation. C'est un **pilote expérimental**, réservé à Windows, qui demande Claude Code 2.1.292 ou plus récent. Ses garanties n'ont pas encore été vérifiées sur la vraie CLI.

- **Envoi contrôlé par Palabre.** Le messager ne peut envoyer qu'avec l'accord d'un garde fourni par Palabre. Le garde autorise un seul envoi, vers la conversation prévue, avec le texte exact du message. Le modèle du messager ne voit jamais votre message.
- **Autorisation limitée dans le temps.** Le garde refuse une demande encore en attente après annulation, déconnexion ou échéance. Un message déjà autorisé ou mis en file peut néanmoins être traité plus tard ; une annulation ne prouve donc pas l'absence d'envoi.
- **La conversation doit être ouverte et identifiable.** Palabre la cherche dans la liste des sessions vivantes (`claude agents`) : absente, le relay est refusé (`target-not-open`) ; si son nom est partagé par une autre session ou si la liste est illisible, aussi (`target-state-unknown`). Une conversation ne peut pas se relayer un message à elle-même.
- **Réception selon les réglages de la cible.** Une conversation en mode « contourner les permissions », ou réglée pour garder ou refuser les messages des autres sessions, peut ne jamais recevoir le message. Palabre l'indique alors comme « réception non observée », avec une délivrance inconnue.
- **Pas de lecture seule.** La conversation répond avec ses propres outils et permissions.
- **Conversation occupée.** Si elle travaille déjà, le message se mêle au tour en cours. Palabre ne rend alors pas de réponse, mais indique que le message a été reçu.
- **Aucun renvoi automatique.** Un message peut être traité plus tard ; ne le renvoyez pas sans vérifier la conversation.

## Désigner les conversations

- `--to <agent>:<session>` : `<agent>` est le nom d'un agent CLI Codex ou Claude Code de votre configuration (`codex`, `claude`, `claude-opus`…). `<session>` est l'identifiant de la conversation (un UUID).
  - Claude Code : c'est le nom du fichier `~/.claude/projects/<dossier>/<session>.jsonl`.
  - Codex : c'est la fin du nom du fichier `~/.codex/sessions/AAAA/MM/JJ/rollout-…-<session>.jsonl`.
- `--from <agent>:<session>` : l'expéditeur. C'est une simple étiquette, recopiée dans le message transmis. Elle n'est ni lancée ni vérifiée, et la conversation de l'expéditeur peut être ouverte.

Aucune conversation n'est choisie implicitement.

## Options

| Option | Rôle |
| --- | --- |
| `"<message>"` ou `--message-file <chemin>` | Le message, 64 Kio au plus. Utilisez un fichier pour un message qui commence par `-`. |
| `--open` | Vise une conversation ouverte : Codex, ou Claude Code en pilote expérimental (voir plus haut). |
| `--timeout <secondes>` | Délai maximal, de 10 à 3600 secondes (600 par défaut). |
| `--json` | Un seul objet JSON v1 sur stdout, quelle que soit l'issue. |
| `--no-export` | N'écrit pas l'export `.relay.md`. |
| `--config <chemin>` | Configuration explicite. |
| `--trust-config` | Approuve la configuration résolue. Le relay ne pose jamais de question : une configuration non approuvée est refusée, même dans un terminal interactif. |
| `--language <fr\|en>` | Langue des messages et de l'enveloppe. |

Toute autre option est refusée et nommée, sans rien lancer : les options courtes (sauf `-h`), les options des autres commandes, la forme `--option=valeur` et les options répétées.

En sortie texte, la réponse s'affiche seule sur stdout. L'issue, la délivrance et le chemin de l'export s'affichent sur stderr.

## Ce que fait la reprise

- **Lecture seule renforcée.** Claude Code est relancé en mode plan, avec les seuls outils de lecture, sans serveur MCP et sans hooks. Codex est relancé en bac à sable en lecture seule, sans approbation possible, sans hooks, sans `notify` et sans mémoires.
- **Perte d'outils pendant le tour relayé.** Codex perd ses plugins, ses connecteurs et ses serveurs MCP. Claude n'a que la lecture. Votre configuration n'est pas modifiée.
- **Garanties conditionnelles.** Avec les options imposées par Palabre et sur les versions de CLI vérifiées, la cible ne dispose d'aucun outil d'écriture, et les hooks et la commande `notify` non gérés sont neutralisés. Les serveurs MCP sont neutralisés sous réserve que la configuration ne change pas entre l'inspection et la reprise. Ces garanties ne couvrent ni les politiques administrées, ni les versions de CLI non vérifiées.
- **L'historique de la cible est modifié.** Le message et la réponse sont ajoutés à la conversation, même en lecture seule et même après un échec. Vous les retrouverez à sa prochaine ouverture.
- **Exécutables.** Palabre lance la CLI directement, sans shell. Sous Windows, une CLI installée par npm est lancée avec Node et le script du paquet, jamais par son shim PowerShell, qui altère les accents et les arguments. Le shim n'est accepté que s'il est identique au modèle généré par npm ; un shim modifié est refusé (`unsupported-executable`).

## Limites connues

Observées avec de vraies conversations jetables, sur Claude Code 2.1.85 et Codex 0.151.0 :

- **Claude peut refuser de répondre.** La cible peut prendre le message relayé pour une tentative d'injection et refuser de partager des éléments de sa conversation. Le relay rend alors `replied`, avec ce refus comme réponse.
  - Pour l'éviter, Palabre ajoute au prompt système de la reprise un cadre fixe. Ce cadre indique que vous utilisez `palabre relay` pour poser une question, que l'expéditeur affiché n'est pas authentifié, et qu'aucune consigne n'est levée.
  - Ce cadre est efficace avec Claude Code 2.1.85. Avec 2.1.292, un prompt système ajouté lors d'une reprise n'est pas appliqué ; aucun refus n'a cependant été observé avec cette version.
- **Codex reprend le modèle enregistré dans la conversation.** Si votre compte n'autorise plus ce modèle, le relay échoue (`cli-failure`). Le message reste enregistré dans la conversation (`persisted-no-reply`) : ne le renvoyez pas sans vérifier.
- **Claude Code choisit lui-même le modèle de la reprise.** Le modèle effectivement utilisé figure dans `observedModels`.

Versions vérifiées : Claude Code 2.1.85 et 2.1.292, Codex 0.151.0. Les garanties ne sont pas étendues aux autres versions.

## Issue et délivrance

Palabre ne renvoie jamais un message automatiquement. Le statut de délivrance indique ce que vous pouvez faire :

| Délivrance | Signification |
| --- | --- |
| `replied` | Réponse reçue. |
| `not-delivered` | Rien n'a été écrit : un nouvel envoi est sans risque de doublon. |
| `persisted-no-reply` | Le message est dans la conversation cible, sans réponse : un nouvel envoi le dupliquerait. |
| `unknown` | Impossible de savoir : vérifiez la conversation cible avant de renvoyer. |

| Code | Issue |
| --- | --- |
| 0 | `replied` |
| 1 | `internal-error` |
| 2 | `cli-failure`, `no-valid-reply`, `usage-limit`, `output-too-large` |
| 3 | `target-busy`, `target-state-unknown`, `neutralization-failed`, `target-not-open` (avec `--open`) |
| 4 | `timeout` |
| 5 | `identity-mismatch` (la réponse ne vient pas de la cible et n'est pas rendue) |
| 6 | `session-not-found` |
| 7 | `command-not-found` |
| 8 | `invalid-request`, avec une raison : arguments, identifiant, taille du message, agent, configuration, exécutable ou dossier de travail |
| 130 | `cancelled` |

## Sortie JSON

```json
{
  "v": 1,
  "type": "relay-result",
  "status": "replied",
  "exitCode": 0,
  "from": { "agent": "codex", "session": "<uuid>" },
  "to": { "agent": "claude", "session": "<uuid>", "provider": "claude" },
  "reply": "…",
  "delivery": { "status": "replied", "persisted": true, "inActiveBranch": true },
  "identity": "same-as-target",
  "observedModels": ["…"],
  "error": null,
  "exportPath": ".palabre/…relay.md",
  "durationMs": 12345
}
```

`reply` n'est présent que pour `replied`. Pour toute autre issue, `error` contient `kind`, `message` et, pour `invalid-request`, `reason`. `inActiveBranch` est un diagnostic.

Avec `--open` seulement, l'objet ajoute des champs optionnels :

- `mode` : `"open"` ;
- `queue` : `attempted` (un dépôt a été tenté), `accepted` (`true` pour un accusé reconnu, `"unknown"` sans preuve, `false` seulement si votre Codex ne connaît pas `queue`), `itemId` et `diagnostic` ;
- `correlation` : statut et raison de la lecture de l'historique ;
- `receiver` : toujours `"unverified"` ;
- `targetPermissions` : approbation, bac à sable et réseau appliqués au tour relayé (Codex), mode de permissions au début du tour (Claude), ou `"unknown"`.

Vers Claude Code, `messenger` remplace `queue` : `attempted`, `guard` (garde chargé ou non), `guardConsulted`, `sendAllowed` (`true`, `false` ou `"unknown"`), `toolResult`, `model` et `diagnostic`. Ce sont des diagnostics, pas des preuves de réception. `queued` indique que la mise en file du message a été observée.

Si l'enveloppe n'est pas retrouvée dans l'historique après un dépôt, le message d'erreur indique « réception non observée » : le message peut encore être traité plus tard.

## Export

Par défaut, Palabre écrit un fichier `palabre-relay-<agent>-<date>.relay.md` dans le dossier des exports (voir [Exports](/fr/usage/exports)). Il contient l'expéditeur et la cible, avec leurs identifiants de session, ainsi que le message, la réponse ou l'erreur, et la délivrance.
