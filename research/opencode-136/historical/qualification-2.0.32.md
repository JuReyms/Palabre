<!-- Compte rendu historique du 18 octobre 2026. Les anciens chemins .cache et scripts cités sont des références de provenance, pas des instructions pour ce clone. Voir ../README.md. -->

## Lot 1 : qualification de la cible fermée, OpenCode 2.0.32

**La lecture seule est imposable dans les conditions isolées essayées, mais le contrat Relay complet n'est pas qualifié.** OpenCode persiste le second message pendant qu'un premier appel est occupé, dans les deux montages concurrents. Le format V2 ne fournit plus le `parentID` de l'étude V1 : il faut un contrat de corrélation différent avant tout adapter.

### Périmètre et changement de version

Les premiers contrôles ont porté sur 1.18.25. Son exécutable a ensuite disparu pendant l'étude ; le paquet installé est devenu `@opencode/cli` 2.0.32. Cause de ce remplacement non déterminée. Après décision explicite du propriétaire, qualification reprise sur **2.0.32**, SHA-256 `045c13859180608981b87abb901a31f9fb0d1845e1c40f273f8d421a16182903`, contrôlée de nouveau en fin d'essais. Les résultats des deux versions sont séparés.

Profil HOME/XDG/ProgramData jetable, environnement filtré, aucune authentification du propriétaire, binaire natif Windows, `shell:false`. Serveurs de test privés, sur 127.0.0.1, avec mot de passe éphémère. Modèle réel : **Ollama local `openbmb/minicpm5-2b:q8_0`**, déjà présent. Pour provoquer sûrement des appels interdits, deuxième canal : réponses SSE entièrement contrôlées sur localhost, clairement distinctes des réponses d'Ollama. Aucun modèle gratuit ni payant distant appelé par l'agent.

Scripts et pièces non versionnés sous `.tmp/opencode-136-qualification/.cache/`. Aucun code produit, compte, conversation personnelle ou configuration utilisateur OpenCode/Codex/PALABRE modifié par ces essais. Aucun essai Desktop, commit ou PR.

### 1. Permissions effectives : résultat positif, sous conditions

V2 utilise `permissions` (tableau), `agents`, `shell` et `subagent`, au lieu de `permission`, `agent`, `bash` et `task`. Le profil est transmis par **`OPENCODE_CONFIG_CONTENT` à l'environnement du serveur privé**, pas simplement au client d'un serveur déjà lancé. `run --standalone` lance ce serveur privé ; nos essais avec serveur nommé utilisent `run --server <URL privée>`.

Agent dédié `palabre-ro-136`, primaire, avec :

```json
{
  "permissions": [
    { "action": "*", "resource": "*", "effect": "deny" },
    { "action": "read", "resource": "*", "effect": "allow" },
    { "action": "grep", "resource": "*", "effect": "allow" },
    { "action": "glob", "resource": "*", "effect": "allow" },
    { "action": "list", "resource": "*", "effect": "allow" }
  ],
  "policies": [
    { "action": "tool.use", "resource": "*", "effect": "deny" },
    { "action": "tool.use", "resource": "read:*", "effect": "allow" },
    { "action": "tool.use", "resource": "grep:*", "effect": "allow" },
    { "action": "tool.use", "resource": "glob:*", "effect": "allow" },
    { "action": "tool.use", "resource": "list:*", "effect": "allow" },
    { "action": "integration.use", "resource": "*", "effect": "deny" }
  ]
}
```

Les mêmes permissions sont placées dans l'agent dédié. Fournisseurs limités séparément au fournisseur local de test. L'inspection des requêtes réellement envoyées au modèle montre **uniquement `read`, `grep`, `glob`**. Aucun outil `list` distinct n'est exposé par cette version ; `read` sait aussi lister un dossier. Ne pas promettre un quatrième outil absent.

**Pourquoi ajouter les politiques ?** Les permissions d'une session sont fusionnées après celles de l'agent : un ancien `* allow` peut les élargir. Essai avec une session jetable explicitement permissive : `write`, `shell`, `webfetch` atteignent le refus **`Blocked by configuration policy`** ; les fichiers témoins restent absents et le serveur HTTP témoin ne reçoit aucune requête. Le contrôle positif HTTP fonctionne. Le contrôle positif `read` lit le contenu exact du fichier témoin. Les appels interdits ont été générés par le transport SSE contrôlé ; le refus est celui du vrai moteur `opencode run`, avant l'écriture, le lancement shell ou la requête web.

Avec une session sans autorisation large, ces trois outils sont directement absents du registre accessible et l'appel forcé reçoit `No tool named ... is currently available`. Une vraie lecture par Ollama a aussi réussi.

Limites : contrôle applicatif, **pas bac à sable OS** ; OpenCode écrit ses propres sessions, caches et journaux. Les configurations globales, système ou administrées peuvent changer les priorités. Ces essais ne qualifient pas leur héritage arbitraire, ni un serveur personnel déjà lancé. Un profil non vérifiable doit être refusé. Un premier essai du cas session permissive a été arrêté au stade de compaction ; conservé comme non probant. Les essais concluants ont utilisé un contexte de témoin plus grand et la compaction désactivée.

Références versionnées : [permissions](https://github.com/anomalyco/opencode/blob/v2.0.32/packages/core/src/permission.ts), [politiques effectives](https://github.com/anomalyco/opencode/blob/v2.0.32/packages/core/src/config/plugin/policy.ts), [options transmises au serveur](https://github.com/anomalyco/opencode/blob/v2.0.32/packages/cli/src/server-process.ts). Le `plan` fourni par défaut ne suffit toujours pas.

### 2. Agent absent ou inadapté : refus avant l'appel possible

L'API **`GET /api/agent/<id>?directory=<dossier>`** renvoie l'agent effectif, dont mode et règles. Contrôles réellement exécutés, sans lancement de modèle :

| Cible de précontrôle | Résultat | Décision du script d'essai |
| --- | --- | --- |
| Agent absent | HTTP 404 / `AgentNotFoundError` | Refus, aucun `run` |
| `general` | Mode `subagent` | Refus, aucun `run` |
| Agent témoin primaire permissif | Règles incompatibles | Refus, aucun `run` |
| Agent dédié attendu | Identité, mode primaire et règles attendus | Précontrôle accepté |

L'inventaire peut être vide au tout début de l'initialisation : vide ou inexploitable ne doit jamais autoriser un repli. Vérifier aussi la session existante avant la commande : en V2, `--session <id>` peut **créer** une session si elle n'existe pas. L'adapter devra refuser ce cas avant envoi, conformément au périmètre Relay. Aucun précontrôle séparé n'est une réservation atomique contre une dérive ultérieure.

Références : [API agent](https://github.com/anomalyco/opencode/blob/v2.0.32/packages/protocol/src/groups/agent.ts), [sélection/création de session CLI](https://github.com/anomalyco/opencode/blob/v2.0.32/packages/cli/src/session-target.ts).

### 3. Plugins et MCP : moyen vérifié en V2, pas `--pure` comme garantie

Faux fichier global de notre profil XDG : plugin local témoin inerte + MCP stdio témoin, tous deux déclarés actifs, permissions générales permissives.

- Contrôle positif sans politique `integration.use` : import **et activation** du plugin (2 relevés), démarrage et initialisation du MCP (4 relevés).
- Même configuration avec `integration.use * deny` dans le profil fermé : **aucun relevé supplémentaire**, plugin témoin absent de l'inventaire, MCP absent de l'inventaire ; l'appel Ollama répond.
- Le PID du seul serveur MCP témoin a ensuite été contrôlé : absent.

Le [chargeur V2](https://github.com/anomalyco/opencode/blob/v2.0.32/packages/core/src/plugin/module.ts) évalue `integration.use` sur `plugin:<cible>` avant de charger le module ; la [politique MCP](https://github.com/anomalyco/opencode/blob/v2.0.32/packages/core/src/config/plugin/policy.ts) retire les serveurs refusés. Les composants internes nécessaires d'OpenCode restent présents : « plugins neutralisés » signifie ici les plugins externes et MCP du profil, pas une application sans composants internes.

Résultat distinct sur **1.18.25** avant son remplacement : `--pure run` a malgré tout importé le plugin témoin et démarré le MCP ; le `debug agent` avec `--pure` ne faisait pas cet import. Le contournement envisagé par `OPENCODE_PURE=1` pendant `run` n'a pas pu être testé avant disparition du binaire. La cause n'est pas établie et ces observations ne sont pas extrapolées à V2. L'aide V2 n'annonce pas `--pure` : utiliser les politiques éprouvées, pas cette seule option.

### 4. Occupée : refus sans dépôt contredit par les deux essais

Le relais local intercepte la première requête Ollama et la retient avant sa réponse ; pendant cette attente, un second `run` vise la même session avec un nonce différent. Lecture de notre historique/inbox avant libération de la première requête :

| Montage | Second nonce durable avant la réponse du premier | Sorties CLI |
| --- | --- | --- |
| Deux clients `run --server` sur le même serveur privé | **Oui** | 0 et 0 |
| Deux `run --standalone`, donc deux serveurs/processus privés distincts, même base XDG de test | **Oui** | 0 et 0 |

Ce n'est pas simplement invérifiable : **le second message est admis**, sans refus `busy` préalable. L'API V2 décrit l'admission durable et le pilotage de l'exécution ; les prompts peuvent être injectés dans le même tour. Observer « idle » puis envoyer ne supprime pas la course. Un verrou propre à PALABRE ne protège pas des autres clients OpenCode.

**Décision du propriétaire requise avant adapter** : conserver l'exigence et attendre un moyen OpenCode d'admission atomique sans dépôt si occupée, ou accepter explicitement un périmètre différent/exclusif. Je ne propose pas d'affaiblir discrètement la garantie Relay.

### 5. Délivrance et corrélation : contrat V2 à établir séparément

La forme V1 de l'étude précédente avait `messages[].info.parentID`. Les messages V2 effectivement relus via `/api/session/<id>/context` ont `type:user`, `type:assistant`, `id`, `content`, `time.completed`, `finish`, puis **`type:idle` avec `outcome`**, **sans `parentID`**. Le [schéma V2](https://github.com/anomalyco/opencode/blob/v2.0.32/packages/schema/src/session-message.ts) le confirme. Tous les messages depuis le précédent `idle`, y compris des prompts injectés pendant l'exécution, peuvent appartenir au même tour.

Cas observés :

- Réponse courte Ollama : utilisateur portant le nonce, assistant texte non vide, `time.completed`, `finish:stop`, puis `idle/succeeded`. La sortie CLI n'avait pourtant **pas de `step_finish` final** : l'historique reste nécessaire.
- Autre échange : CLI 0, texte présent et `idle/succeeded`, mais dernier assistant `finish:tool-calls` et outil en erreur après la limite d'étapes. Ne pas promouvoir cela en réponse complète sur ces seuls signaux.
- La CLI V2 encadre actuellement un argument texte contenant des espaces par des guillemets dans le message persistant : comparer le corps réellement transmis par ce chemin, pas seulement un nonce aperçu dans n'importe quel texte.

Règles proposées, à faire accepter avant implémentation :

1. Identifiants opaques et sensibles à la casse, état initial relevé, session existante exacte ; message utilisateur nouveau avec nonce et **corps exact attendu**. Plusieurs correspondances ou un autre message utilisateur concurrent interdisent une corrélation univoque.
2. En V1 seulement : assistant lié par `parentID`. En V2 : délimitation du tour par l'historique et `idle`, aucun autre apport concurrent, assistant attendu et terminé, texte final non vide, `finish:stop`, absence d'erreur et `idle/succeeded`. Cela est une **proposition limitée**, pas un remplacement prouvé de `parentID` en présence de concurrence.
3. `replied` seulement si cette preuve complète est satisfaite ; **`persisted-no-reply`** si le message utilisateur est durable mais sans réponse finale attribuable (erreur, longueur limitée, résultat ambigu compris) ; **`not-delivered`** seulement pour un refus certain avant admission ; **`unknown`** si l'historique ne permet même pas d'établir la persistance. Un code CLI 0 ou 1 ne prouve jamais à lui seul la délivrance.
4. Aucun renvoi automatique après résultat incertain. Échec/quota uniquement sur erreurs structurées, jamais d'après la prose du modèle. Aucun quota réel provoqué ou observé ici.

### Modèle gratuit : commande réservée au propriétaire

Aucun appel gratuit avec son compte n'a été effectué. Une commande utilisant directement son profil habituel ne peut pas être présentée comme fermée sans qualifier aussi les plugins/MCP et politiques de ce profil. Le script local préparé propose donc **un profil jetable sans sa clé ni son compte**, aucun outil, aucune intégration externe, modèle explicitement gratuit et aucun repli payant :

```powershell
# Depuis la racine du dépôt Palabre, sur la machine étudiée.
& "C:\Program Files\nodejs\node.exe" .tmp\opencode-136-qualification\.cache\free-model-owner.mjs
```

Script non commité, syntaxe vérifiée, **non exécuté** ; épingle 2.0.32, une invocation `run --standalone`, modèle `opencode/deepseek-v4.1-flash-free`, message « Réponds uniquement OK. », délai 60 s, sortie 4 Mio. Un 401/403 reste possible dans ce profil sans compte : cela ne conclurait rien sur son compte habituel. Ne pas contourner le refus ni choisir un modèle payant. L'essai authentifié habituel reste à faire par le propriétaire lui-même ; aucune réussite n'est revendiquée ici. [Modèles gratuits officiels](https://dev.opencode.ai/v2/docs/console/models).

### Suite proposée

Le lot 1 aboutit à une **qualification partielle et à un obstacle démontré**, pas au feu vert d'un adapter. Faire décider le traitement de la concurrence et du nouveau contrat V2 avant un lot de code. Requalifier la lecture seule sur tout profil effectivement retenu. Desktop reste un lot séparé ; aucun essai Desktop autorisé par ce commentaire.

— Codex, équipier. Recherche et essais isolés, 18 octobre 2026.
