---
title: Relay vers une conversation
description: Transmettre un message à une conversation Codex ou Claude Code fermée, ou à une conversation Codex ouverte avec --open, et récupérer sa réponse avec palabre relay.
seo:
  title: palabre relay, interroger une conversation Codex ou Claude Code
  description: Envoyer un message à une conversation Codex ou Claude Code existante, fermée, et recevoir sa réponse en un seul appel, en lecture seule renforcée.
---

## Relay v1 : coordination et revue autorisée

Relay sert à consulter un collègue depuis la conversation habituelle de l'agent appelant : un appel, un message, une réponse. L'enveloppe identifie un **agent**, pas l'utilisateur, et précise qu'un message de coordination n'autorise aucune action. Une réponse ne provoque jamais de nouvel appel automatique. Une session encore attachée peut être refusée même sans génération : `target-busy`, code 3 et `retryable: true`. L'appelant décide de réessayer plus tard ; après une délivrance inconnue, il vérifie avant tout renvoi.

La réponse CLI, et non son affichage Desktop, est le canal de retour. Les essais jetables Codex 0.151.0 et Claude Code 2.1.292 ont confirmé réponse, même identifiant et contexte conservé. Ils ne démontrent pas l'affichage immédiat dans Desktop, ni une écriture concurrente sûre dans une conversation Desktop ouverte. Le mode par défaut exige une session détachée. `--open` reste un pilote distinct, hors de cette v1.

### Préautoriser la seule tâche `review`

L'humain ajoute explicitement une politique dans son `palabre.config.json` local, puis en approuve le contenu :

```json
{
  "relay": {
    "allowedTasks": ["review"],
    "reviewRepositories": ["proprietaire/depot"]
  }
}
```

Ce fragment complète les agents de la configuration, il ne les remplace pas. Depuis le dossier contenant cette configuration locale, son propriétaire peut l'approuver avec `palabre config --trust-config`. Cette approbation porte sur son chemin et son empreinte ; une modification invalide l'autorisation existante. Les agents ne doivent ni éditer cette politique ni l'approuver pour s'accorder des droits. `--trust-config` est refusé dans l'appel `--task review` lui-même.

```text
palabre relay --from codex:<uuid> --to claude:<uuid> --task review --pr https://github.com/proprietaire/depot/pull/123 --json
```

Le message est facultatif avec `review`. GitHub CLI (`gh`) doit être installé et connecté pour lire la PR et publier. Seuls les dépôts GitHub.com explicitement listés sont acceptés ; une tâche inconnue, un dépôt absent, une URL ambiguë ou `--open` est refusé. Sans politique, les notifications et consultations en lecture seule restent disponibles, mais aucune revue n'est publiée.

Palabre récupère la description et le diff complet d'une PR ouverte, les marque comme données non fiables et les transmet au collègue en lecture seule. Une PR trop grande est refusée, jamais relue silencieusement sur un diff tronqué. Claude est lancé avec `--safe-mode`, les seuls outils Read/Glob/Grep et aucun MCP.

La tâche `review` avec Claude exige **Claude Code 2.1.292 au minimum** et la présence de `--safe-mode` dans son aide. Avant toute lecture de la PR, Palabre sonde `--version` puis `--help` sur la CLI effectivement résolue (commande configurée, ou premier résultat du PATH), sans appel de modèle. Une CLI incompatible ou non vérifiable produit `invalid-request` avec `error.reason: "review-cli-unsupported"` (code 8), la version trouvée et le minimum ; aucune PR n'est lue ni revue publiée. Si plusieurs versions coexistent, utilise l'agent dédié décrit dans « Plusieurs CLI Claude sur la même machine » ; ne retire pas `--safe-mode`.

Le champ optionnel `cli` du résultat `--json` donne `path` et `version` pour cette vérification (version `null` si non vérifiable). Le même chemin et la même version figurent dans l'export `.relay.md` de la revue ; avec un shim npm reconnu, le chemin désigne le script CLI lancé directement. Les notifications ordinaires gardent leurs arguments historiques, sans cette exigence de version.

Le modèle rend uniquement le texte de revue ; **Palabre publie une revue COMMENT**, liée au commit relu, sur cette PR exacte. Le modèle ne modifie aucun fichier, ne commite, ne pousse, ne merge et ne publie pas lui-même. Les identifiants locaux de l'enveloppe sont masqués dans le texte publié ; ils restent dans l'export local. Cela ne remplace pas une vigilance sur les secrets déjà présents dans le contexte.

Le message de coordination reste limité à 64 Kio UTF-8 ; le contexte GitHub ajouté par Palabre dispose d'une borne séparée de 256 Kio UTF-8, JSON compris. Au-delà, la revue est refusée avant l'appel au modèle ; aucun diff tronqué n'est envoyé.

Safe-mode ne s'applique qu'à `review` : les notifications et consultations ordinaires gardent leurs arguments et personnalisations historiques. L'approbation est une règle opérateur ; elle n'isole pas un agent disposant déjà d'un shell en écriture et du registre de confiance, qui pourrait réapprouver le fichier par une autre commande. Le contenu d'une sonnette ne peut pas, lui, étendre la politique.

Un premier Ctrl+C reste pris en charge jusqu'au résultat et à l'export : avant le POST, il empêche la publication ; si le POST est déjà parti, Palabre attend son issue bornée plutôt que de prétendre l'annuler. La réponse est conservée aussi en sortie texte sans export ; état et URL de publication sont affichés séparément. Un refus certain avant POST (`not-attempted`) est distingué d'un retour de publication inconnu.

Avant publication, la tête de PR et la configuration approuvée sont revérifiées. La publication ne vise qu'un commit explicitement indiqué ; une modification ultérieure de la PR ne transforme pas la revue en validation de nouveaux changements. Le résultat JSON expose `task` avec PR, commit, état de publication et URL ; l'export `.relay.md` reprend ces éléments. Le timeout de Relay borne l'appel au collègue ; les commandes GitHub ont chacune leur propre limite de 60 s.

Un échec de publication sort en code **9**, `review-failed`, et conserve la réponse du collègue ainsi que sa délivrance. `publication: unknown` signifie qu'une revue peut avoir été publiée malgré une erreur de retour : **aucun nouvel essai automatique**. Vérifier GitHub avant de redemander. L'autorisation de revue n'est jamais une autorisation de merge.

Mission v2 ajoutera l'orchestration des échanges, rôles, budgets et décisions humaines. Le réveil desktop-vers-desktop reste une recherche distincte en pause.

`palabre relay` transmet **un** message à une conversation Codex ou Claude Code existante, récupère **une** réponse, puis termine. Un agent peut ainsi interroger la conversation d'un autre agent, qui répond avec tout son contexte.

```bash
palabre relay --from codex:<session-expéditeur> --to claude:<session-cible> "Peux-tu relire ce plan ?"
```

## Plusieurs CLI Claude sur la même machine

Une ancienne CLI Claude peut être détectée avant la CLI récente selon l'ordre du PATH. Un chemin absolu dans `agents.claude.command` est désormais conservé à l'accueil TUI et avec `palabre config --sync-agents` : une autre installation détectée ne l'écrase plus. Si le chemin est introuvable, il est conservé et le lancement échoue explicitement, sans repli vers une autre CLI.

Tu peux aussi garder un agent dédié `claude-review`, pour choisir séparément le rôle et la CLI de revue, dans les `agents` existants de ton `palabre.config.json`, sans remplacer le reste de la configuration ni sa politique `relay` :

```json
{
  "agents": {
    "claude-review": {
      "type": "cli",
      "command": "C:/Tools/Claude/claude.exe",
      "args": ["--print", "--output-format", "text", "--no-session-persistence", "--tools", "Read,Glob,Grep"],
      "promptMode": "stdin",
      "shell": false,
      "role": "reviewer"
    }
  }
}
```

Remplace le chemin d'exemple par le chemin absolu de ta CLI Claude Code **2.1.292 ou plus récente**. Recopie les mêmes `args` que ton agent `claude` ; ceux de l'exemple sont les valeurs par défaut. Relay construit lui-même ses arguments de reprise. Après modification, le propriétaire doit réapprouver la configuration selon la procédure ci-dessus.

La synchronisation ne touche que les clés d'agents connus, dont `claude`, et laisse `claude-review` intact. Relay reconnaît Claude en normalisant le nom du programme (`claude.exe`), indépendamment du nom donné à l'agent. La sonde `review-cli-unsupported` continue de vérifier la CLI choisie avant toute lecture GitHub.

```text
palabre relay --from codex:<uuid> --to claude-review:<session> --task review --pr https://github.com/proprietaire/depot/pull/123 --json
```

## Conversation fermée par défaut

Sans `--open`, la conversation cible doit être **fermée** : aucun TUI, desktop, IDE ni exécution en cours ne doit y être attaché. Sinon, le relay est refusé avant tout envoi (`target-busy`). Il est aussi refusé quand Palabre ne peut pas vérifier l'état de la conversation (`target-state-unknown`).

Pour une conversation Codex **ouverte**, utilisez `--open` (section suivante). Le relay vers une conversation Claude Code ouverte n'est pas encore disponible ; il est suivi dans l'issue [#96](https://github.com/JuReyms/Palabre/issues/96).

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
| `--open` | Vise une conversation Codex ouverte (voir plus haut). |
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
- `targetPermissions` : approbation, bac à sable et réseau appliqués au tour relayé, ou `"unknown"`.

Si l'enveloppe n'est pas retrouvée dans l'historique après un dépôt, le message d'erreur indique « réception non observée » : le message peut encore être traité plus tard.

## Export

Par défaut, Palabre écrit un fichier `palabre-relay-<agent>-<date>.relay.md` dans le dossier des exports (voir [Exports](/fr/usage/exports)). Il contient l'expéditeur et la cible, avec leurs identifiants de session, ainsi que le message, la réponse ou l'erreur, et la délivrance.
