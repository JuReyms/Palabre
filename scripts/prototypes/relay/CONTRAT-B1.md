# Relay vers une conversation ouverte : contrat B1 proposé

Statut au 8 octobre 2026 : **contrat relu dans la PR #110, transport implémenté par le lot B1**
(`palabre relay --open`), non publié. Décisions retenues après la
[revue du plan](https://github.com/JuReyms/Palabre/issues/96#issuecomment-6050672839) :
permissions de la cible acceptées et seulement relevées après coup (option A), récepteur annoncé
**non vérifié** (limite assumée du pilote, pas une preuve de compatibilité), enveloppe de 8 192
unités UTF-16 au plus, un seul nouveau statut `target-not-open`. Le contrat produit, avec la table
complète des issues, est dans `AGENTS.md` (section « Relay vers une conversation ouverte »). Le
contrat de Relay A sans `--open` est inchangé.

## Objectif et portée

Déposer une notification dans une conversation existante ouverte, puis rendre sa réponse au
même appelant. L'humain ne copie plus la notification entre les agents ; les décisions et le
travail restent dans les issues et PR. Un relay reste un message et une réponse, sans boucle.

Le pilote envisagé est Codex sous Windows, dans un TUI ordinaire ou dans **Codex desktop**,
l'application qu'utilise le mainteneur. Sur des conversations jetables, un échange est vérifié avec
Codex 0.151.0 (TUI) et avec Codex desktop 26.930.7945.0 (app-server 0.160.1) : cible au repos,
cible en génération, deux messages successifs, message long et multiligne, et fil fermé, où le
dépôt est différé jusqu'à l'ouverture. Ces essais ne démontrent ni les autres versions, ni les
IDE, ni macOS ou Linux, ni Codex desktop comme expéditeur, bloqué par son bac à sable.
#96 reste ouverte.

Le transport `queue` et le lecteur ne doivent pas être intégrés à la CLI avant les décisions et
essais listés plus bas. Les shims pnpm (#109) restent un chantier distinct.

Sources : [bilan de Claude](https://github.com/JuReyms/Palabre/issues/96#issuecomment-6048846894),
[revue indépendante](https://github.com/JuReyms/Palabre/issues/96#issuecomment-6048964688),
[relecture de ce contrat](https://github.com/JuReyms/Palabre/pull/110#issuecomment-6049573390),
[relecture des corrections](https://github.com/JuReyms/Palabre/pull/110#issuecomment-6049723456),
[essais Codex desktop et Claude desktop](https://github.com/JuReyms/Palabre/issues/96#issuecomment-6050285877).

## Décisions proposées

| Sujet | Proposition et état |
| --- | --- |
| Activation | Option explicite `--open`, sans bascule automatique (lot B1). |
| Cible | UUID explicite, config approuvée, commande résolue sans shell par les règles Relay D21. Pas de nom flou, de dernière conversation ni de changement de modèle. |
| Surface | Capacité du récepteur à consommer la file à vérifier. Un verrou **tenu**, pas seulement présent, est **obligatoire avant le dépôt** ; sans lui, aucun appel `queue` (`not-delivered`). Il prouve un écrivain, mais ne garantit ni un TUI, ni son repos, ni l'affichage, ni la consommation du message : Codex desktop garde un fil chargé et le traite sans l'afficher. Un message déposé peut encore être traité après le délai ; aucun renvoi automatique. Une surface inconnue ne devient pas implicitement compatible : sans preuve de surface disponible, le pilote annonce un récepteur **non vérifié** (`receiver: "unverified"`), limite assumée. |
| Droits | La conversation ouverte conserve ses outils, hooks, MCP, permissions et demandes d'approbation. Palabre ne promet aucune lecture seule et ne modifie pas ces réglages. **Accepté (option A)** : les permissions du seul tour corrélé sont relevées après coup, pour diagnostic. |
| Provenance | Enveloppe claire, expéditeur déclaré non authentifié, nonce neuf, contenu marqué comme demande d'un autre agent. Un message n'est jamais présenté comme une autorisation humaine à exécuter une action ou à lever une restriction. Le texte exact reste **à relire**. |
| Dépôt | Un seul appel `codex queue --message <TEXT>`, arguments structurés, cwd de la cible. Limite propre à B1 et vérification de la ligne Windows complète avant dépôt, détaillées ci-dessous ; les 64 Kio de Relay A ne s'appliquent pas. Un accusé valide identifie la tentative et la file, pas une réponse. Pas de reprise concurrente, de fork ni de repli `exec resume`. |
| Attente | Budget total borné, annulation locale, snapshots append-only bornés, pas de renvoi automatique. Timeout, Ctrl+C et fermeture de Palabre ne prouvent pas la suppression d'un message en file. |
| Résultat | Réponse finale du tour lié au message, avec preuve de terminaison cohérente. Toute ambiguïté est exposée sans réponse et sans consigne de renvoi « sans risque ». |
| Compatibilité | Relay A, D21 et ses refus restent inchangés. Pas d'ajout silencieux au JSON v1 ou aux codes de sortie ; un lot d'intégration proposera explicitement diagnostics, champs optionnels, codes et traductions. |

## Trois preuves distinctes

1. **File** : `queue` a accepté le dépôt. L'identifiant d'élément accepté est diagnostique.
2. **Conversation** : une nouvelle entrée utilisateur de la cible contient l'enveloppe exacte.
3. **Réponse** : le même tour fournit une réponse finale et une terminaison cohérente.

Le nonce, l'enveloppe exacte et une référence à l'historique **avant** le dépôt empêchent de
confondre un ancien message, une citation ou une réponse de l'assistant avec la réception.
Une preuve de réception observée reste mémorisée si un snapshot ultérieur devient illisible.

| Situation au retour | Délivrance proposée |
| --- | --- |
| Refus certain avant tentative de dépôt, sans preuve contradictoire | `not-delivered` |
| Dépôt tenté ou accepté, sans preuve dans la conversation | `unknown` |
| Enveloppe dans la conversation, sans réponse finale corrélée (timeout, échec, annulation ou ambiguïté) | `persisted-no-reply` |
| Réponse finale et fin de son tour identifiées | `replied` |

`persisted` conserve son sens : présence dans l'historique de la conversation, **pas** dans la
base de la file. Un snapshot lu sans nonce donne `persisted: false`, mais ne prouve pas la
non-délivrance future. Si la lecture est impossible, la preuve vaut `unknown` ; une preuve
antérieure `true` l'emporte toujours. Les délais ne provoquent jamais de retry automatique.
Une entrée utilisateur neuve avec le nonce mais une enveloppe différente donne `ambiguous`,
raison `envelope-altered`, `persisted: unknown`, sans réponse. Ni normalisation des fins de ligne,
ni réparation des espaces ou d'une troncature ne permettent d'inventer une preuve exacte.

Le constat `Queued` vers une cible fermée doit être formulé précisément : aucun tour n'a été
traité pendant l'essai, mais une vérification sans modèle sur une copie isolée a trouvé le
message dans `queued_items` de `queue_1.sqlite`. Il pourrait être traité ultérieurement. Ne pas
consulter ni modifier cette base privée dans le produit ; elle sert ici uniquement de preuve.
Les essais Codex desktop l'ont confirmé : un message déposé vers un fil fermé n'a pas été traité
pendant 45 s, puis l'a été dès l'ouverture du fil dans l'application, 49 s après le dépôt. Le
dépôt vers une cible fermée est donc **différé**, pas perdu ; d'où le verrou obligatoire.

## Corrélation et lectures bornées

`src/externalSessions/openReader.ts` contient des fonctions pures. Leur dialecte est celui des
événements liés à un tour observés dans les rollouts Codex 0.151.0 (TUI) et 0.160.1 (app-server
de Codex desktop 26.930.7945.0) ; ce n'est pas un schéma public
garanti par OpenAI. Les historiques factices sont construits dans `tests/external-sessions-open.test.ts`.

Avant le dépôt, le collecteur `src/externalSessions/openRollout.ts` mémorise l'offset de fin d'une ligne
complète, l'empreinte SHA-256 de la première ligne et celle des 64 derniers Kio avant l'offset
(ou du fichier entier s'il est plus court). Il ouvre seulement le fichier explicitement fourni,
en lecture seule, sans découvrir de conversation. Il lit ensuite la première ligne (1 Mio max),
la fenêtre témoin et les octets ajoutés **après cet offset**. Le plafond de 50 Mio porte sur
l'ajout cumulé depuis la référence, pas sur l'historique : un fichier factice de 151 Mio est testé.
À chaque snapshot, seule cette partie neuve est relue et analysée ; le collecteur n'est pas encore
un suivi continu qui conserverait les événements en mémoire entre les lectures.

La taille totale, l'identité et le témoin détectent une troncature et certains remplacements.
Le témoin et la première ligne sont relus après l'ajout pour détecter une dérive pendant la
lecture. **Une réécriture située hors de ces deux fenêtres peut rester indétectable**, comme
le démontre un test. Ni l'empreinte partielle ni un snapshot ne garantissent l'intégrité totale,
l'authenticité du fichier ou un verrou exclusif. Ces limites remplacent la garantie précédente
sur le préfixe complet ; elles ne doivent pas être masquées par l'intégration future.

Le lecteur exige :

- une première ligne `session_meta` correspondant à la cible, selon le principe Relay A ;
  une nouvelle identité ajoutée après l'offset est refusée comme incohérente ;
- une nouvelle `response_item/message` de rôle `user` contenant l'enveloppe exacte ;
- un seul `event_msg/item_completed`, `item.type: UserMessage`, portant le même texte et les
  `thread_id` et `turn_id` de la cible ;
- un seul `task_started` de ce tour, dans l'ajout après la référence et **avant** le message
  utilisateur ; un début absent rend `ambiguous`, `turn-start-not-observed-after-baseline`
  (le lecteur ne prétend pas savoir si le début est ancien ou manque dans le dialecte) ;
- un seul utilisateur dans ce tour (des messages fusionnés ou une intervention humaine dans le
  même tour rendent la réponse ambiguë) ;
- toute autre saisie utilisateur apparue après le début du tour et avant sa terminaison doit
  être explicitement liée à un autre tour ; une saisie sans liaison identifiable interdit
  l'attribution, sauf le contexte d'environnement strictement délimité plus bas ;
- une seule réponse `AgentMessage`, `phase: final_answer`, de ce thread et de ce tour ;
- un `task_complete` du même tour, après la réponse, avec `last_agent_message` identique, sans
  `error` non nul, et aucun échec ou abandon de ce tour.

Les commentaires intermédiaires et les événements d'un autre tour ne terminent pas l'attente.
Une dernière ligne partielle est ignorée jusqu'à sa complétion. Une ligne terminée corrompue,
une identité incohérente ou un témoin remplacé interdit tout succès. L'ancien couple
`event_msg/user_message` + `agent_message` n'offre pas la liaison
nécessaire : le lecteur ne l'accepte pas comme preuve de réponse.

Un message `user` comme `<environment_context>` peut être injecté sans liaison `UserMessage`.
S'il précède la référence ou le début du tour, il ne participe pas à l'échange analysé. Les
messages de rôle `developer` sont ignorés pour la preuve de réception et le contrôle des saisies
concurrentes : ils ne deviennent ni une saisie utilisateur ni une réponse d'agent.

**Contexte d'environnement observé dans un tour relayé.** Avec Codex desktop (app-server 0.160.1),
au premier tour d'un fil dans l'application après un changement d'environnement ou de
permissions, Codex écrit un message `user` `<environment_context>` après `task_started` et avant
le message relayé, sans liaison `UserMessage` (deux fils sur deux dans ce cas, aucun quand les
permissions ne changeaient pas). Ce message porte `internal_chat_message_metadata_passthrough`
avec `content_item_kinds: ["environments.environment_context"]` et le `turn_id` du tour corrélé.
Il n'est toléré que si **toutes** ces conditions sont réunies :

- dans le tour corrélé, après son `task_started` et **avant** le message relayé ;
- métadonnée présente, `turn_id` égal au tour corrélé, `content_item_kinds` exactement
  `["environments.environment_context"]` ;
- une seule partie textuelle, formée d'un seul bloc `<environment_context>…</environment_context>`
  sans autre texte ;
- aucune liaison `UserMessage` de ce texte ;
- aucune occurrence du nonce de la demande dans ce texte ;
- une seule exemption par tour.

Une balise seule, une métadonnée absente, d'un autre tour ou mêlée à d'autres types, un texte
hors du bloc, un contexte après le message relayé ou lié dans le même tour restent ambigus
(`unbound-concurrent-user` ou `multiple-users-in-turn`). Un contexte qui cite le nonce donne
`nonce-in-environment-context`. Un second contexte exemptable dans le même tour, identique ou
distinct, donne `multiple-environment-contexts`. Dans tous ces cas, aucune réponse n'est rendue
et la preuve de réception est conservée (`persisted-no-reply` à l'arrêt). Aucun autre préfixe
textuel n'est une preuve de provenance système.

**Formats d'échec.** Dans les traces réelles sont observés `task_started`, les deux
`item_completed` et `task_complete` avec `last_agent_message`, sans `thread_id` ni `status`.
Un échec réel a été relevé avec Codex 0.151.0 (modèle refusé par le compte) : `task_complete`
porte un objet `error` et `last_agent_message: null`. Un `task_complete` du tour corrélé avec
`error` non nul donne `failed`, raison `completion-error`, même sans réponse finale, et empêche
un succès même si un texte final identique existe ; `error: null` n'est pas un échec. Les noms
`error` (événement), `turn_aborted`, `task_cancelled`, `task_failed` et `task_complete.status`
restent **des hypothèses défensives factices**. Il faut relever les événements réels lors des
essais d'annulation. Sans événement attribuable au tour et sans fin valide, l'attente se
termine au délai en `persisted-no-reply` si le message est reçu.
Le lecteur assemble les parties textuelles par `\n` ; si le fournisseur les assemble autrement
dans `last_agent_message`, il conserve l'ambiguïté plutôt que normaliser la réponse.

Le lecteur `openReader.ts` ne lit aucun fichier. Le collecteur `openRollout.ts` lit seulement
les fenêtres du fichier fourni ; aucun des deux ne dépose de message, ne sonde de verrou ou ne
pilote d'agent. Les statuts internes `awaiting-*`, `failed`, `ambiguous` et `unreadable` **ne sont
pas des statuts CLI** : `openRelay.ts` les traduit en issues existantes et garde les raisons de
diagnostic (`correlation`) et les preuves antérieures.

### Arrêt de l'attente et exceptions du collecteur

Le transport (`runOpenRelay`, `src/externalSessions/openRelay.ts`) applique cette politique, sans relancer le dépôt :

| Observation | Politique d'attente |
| --- | --- |
| `awaiting-message`, `awaiting-reply` | Continuer les lectures dans le budget total, sauf délai ou annulation. |
| `replied` | Arrêter et rendre uniquement la réponse corrélée. |
| `failed`, `ambiguous` | Arrêter sans réponse ; ne pas attendre une hypothétique clarification ultérieure. |
| `unreadable` | Arrêter sans réponse ; ne pas réessayer la lecture dans cette tentative. |

Ces choix sont une politique prudente du relay, pas une affirmation que les fichiers du
fournisseur ne peuvent jamais être réparés ou complétés. Une ambiguïté, y compris
`envelope-altered`, met fin à cette tentative. Une dernière ligne partielle normalement en
cours d'écriture reste ignorée par le lecteur et donne `awaiting-*` tant qu'aucune observation
terminale n'existe ; elle n'est pas à elle seule une erreur `unreadable`.

Après **chaque** observation, mémoriser toute preuve `persisted: true`, y compris pendant
`awaiting-reply`. À l'arrêt, au délai ou à l'annulation, appeler `settleOpenDelivery` avec cette
preuve antérieure et l'état de tentative. Une lecture illisible ne l'efface jamais : après dépôt,
`unreadable` donne `unknown` sans preuve, ou `persisted-no-reply` avec une preuve antérieure.

`captureOpenRollout` et `readOpenRollout` lèvent des exceptions, contrairement à
`inspectOpenReply`. `runOpenRelay` les traduit selon la frontière de dépôt :

| Moment de l'exception | Traduction requise |
| --- | --- |
| Avant toute tentative de dépôt | Refus et aucun appel `queue` : `not-delivered`, sous réserve d'une preuve contradictoire conformément à `settleOpenDelivery`. |
| Dès que le dépôt a été tenté, y compris avant son accusé | Observation `unreadable`, `persisted: unknown`, sans réponse, arrêt de l'attente ; `unknown` sans preuve antérieure, `persisted-no-reply` si une preuve est conservée. |

Cette règle couvre les erreurs explicites (`history-replaced`, `added-too-large`,
`identity-incomplete`, `baseline-incomplete`…) et les exceptions de lecture, d'ouverture ou de
décodage. Le diagnostic doit garder la catégorie utile sans exposer le contenu brut ou un chemin
privé provenant de l'exception. Ni une exception ni l'annulation ne prouvent que la file a
supprimé le message. La boucle d'attente et cette traduction sont implémentées dans
`runOpenRelay` et testées avec une horloge simulée (`tests/external-sessions-open-relay.test.ts`).

Ces tests font partie de `pnpm test` et de la CI :

```powershell
pnpm test
```

Les quatre sondes `open-*.mjs` de Claude restent locales et non commitées. Elles ne sont pas
appelées par `pnpm test` ni par la CI. Leur lecteur expérimental n'est pas corrigé dans ce
lot ; il devra utiliser une corrélation validée et échouer réellement si la preuve manque.

## Budget de message Windows

L'aide vérifiée par Claude pour Codex 0.151.0 n'expose que `--message <TEXT>` pour `queue`,
sans entrée stdin ni fichier. Windows limite `CreateProcessW` à **32 767 unités UTF-16,
terminateur nul compris**, pour toute la ligne de commande. Les chemins de l'exécutable et du
script, les arguments fixes, l'UUID, l'enveloppe complète et l'échappement des guillemets et
antislashs consomment ce budget.
[Référence Microsoft](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-createprocessw).

Implémenté dans `src/externalSessions/codexQueue.ts` : l'enveloppe complète est plafonnée à
**8 192 unités UTF-16**, puis la ligne réellement sérialisée (exécutable, arguments préfixés D21,
arguments, échappement libuv et NUL final) est vérifiée contre la limite de 32 767. Un NUL
incorporé est refusé. Tout dépassement est refusé avant dépôt, avec `invalid-request` / raison
`message-too-large`, sans tronquer le contenu ni lancer la CLI. Un test Windows vérifie le calcul
à la limite réelle : 32 767 unités sont lancées, 32 768 donnent `ENAMETOOLONG`. Les tests couvrent
Unicode hors BMP, guillemets, antislashs et chemins longs.

## Conditions d'intégration B1

- [x] Relecture indépendante de ce contrat et du lecteur, notamment de la liaison des tours (#110).
- [x] Décision sur le pilote et l'absence de garantie de lecture seule : option A, permissions de
      la cible relevées après coup dans le seul tour corrélé.
- [x] Récepteur : pas de définition vérifiable disponible. Remplacé par une **limite assumée** du
      pilote : verrou tenu obligatoire, récepteur annoncé `unverified`, version inconnue non
      bloquée. Ce n'est pas la satisfaction du critère « récepteur compatible vérifié ».
- [ ] Essais jetables. Faits avec Codex desktop : cible en génération (le second message attend
      la fin du tour), deux messages successifs, message long et multiligne (7 501 unités UTF-16),
      fil fermé (dépôt différé jusqu'à l'ouverture). Restent : saisie humaine concurrente,
      fermeture entre sonde et dépôt, TUI avec les mêmes cas.
- [x] Contexte `user` injecté après `task_started` dans un tour relayé : forme relevée avec Codex
      desktop, exception stricte par métadonnée, messages `developer` ignorés.
- [x] Boucle d'attente : arrêt sur les observations terminales, exceptions avant/après tentative
      de dépôt correctement traduites et preuve de réception antérieure conservée (tests factices).
- [ ] Timeout et Ctrl+C après acceptation : pas de succès inventé, de nouvelle reprise ni de
      renvoi automatique, « réception non observée » signalée (fait, tests factices). Reste à relever le format
      exact d'annulation (le format d'échec `task_complete.error` est relevé) au lieu de présenter
      les événements factices comme vérifiés.
- [x] Format exact de l'accusé de `queue` (0.151.0) lu strictement, accusé étranger jamais accepté ;
      limites sur arguments Windows et taille du rollout traitées.
- [x] Vérification spécifique de Codex desktop pour le besoin réel : dépôt et réponse corrélée
      vérifiés sur fils jetables, résultats publiés sur #96 sans assimiler desktop et TUI.
      Codex desktop comme expéditeur reste bloqué par son bac à sable. #96 reste ouverte.
- [x] Évolutions JSON (champs optionnels, statut `target-not-open`), diagnostics, codes de sortie
      et exports, avec mention des permissions de la cible ; documentation FR/EN ; sortie de Relay A
      inchangée et testée.

## Alternatives et suite Claude

L'app-server partagé avec TUI `--remote` a des réponses structurées, mais impose ce mode de
lancement. Le client doit corréler `threadId` **et** `turnId`. L'API documentée `thread/read`
permet une lecture sans reprendre un fil ; son aptitude à remplacer le lecteur de rollout B1
reste à vérifier sur le stockage complet et la version réellement utilisés.
[Documentation app-server](https://developers.openai.com/codex/app-server).

Pour Claude, la réception par un TUI 2.1.292 depuis un messager `-p` est prouvée, mais le messager
est un appel de modèle. `--allowedTools` n'est pas une restriction de la liste des outils ;
l'outillage effectivement exposé doit être vérifié. La documentation décrit désormais le chemin
du socket, le token et une ligne d'authentification, notamment pour un enfant postant dans sa
propre session. Cela ne valide pas à soi seul un transport externe complet vers une autre cible.
Ne pas extraire de jeton privé d'une application pour contourner ses contrôles. Les politiques
de réception `accept`, `hold` et `refuse` et les expirations font partie du futur contrat Claude.
[Messagerie officielle](https://code.claude.com/docs/en/cross-session-messaging),
[référence CLI](https://code.claude.com/docs/en/cli-reference).

Aucun essai réel consommant du quota Claude n'est requis pour relire ce lot. Claude peut faire
la revue une fois son quota disponible, avant le développement du transport et de la commande.
