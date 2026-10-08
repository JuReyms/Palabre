# Relay vers une conversation ouverte : contrat B1 proposé

Statut au 8 octobre 2026 : **proposition à relire, pas un contrat produit adopté**.
Le mainteneur a autorisé la préparation du contrat et des tests factices. Cela ne vaut pas
validation d'un lancement avec les droits de la cible, ni implémentation de `--open`.
Le contrat en vigueur de Relay A reste dans `AGENTS.md`.

## Objectif et portée

Déposer une notification dans une conversation existante ouverte, puis rendre sa réponse au
même appelant. L'humain ne copie plus la notification entre les agents ; les décisions et le
travail restent dans les issues et PR. Un relay reste un message et une réponse, sans boucle.

Le pilote envisagé est Codex dans un **TUI ordinaire sous Windows**. Les traces de Claude et la
revue indépendante confirment un échange avec Codex 0.151.0. Elles ne démontrent pas les autres
versions, une cible occupée, les applications desktop ou les IDE. Le mainteneur utilise
l'application Codex : le pilote TUI seul **ne termine donc pas #96**.

Le transport `queue` et le lecteur ne doivent pas être intégrés à la CLI avant les décisions et
essais listés plus bas. Les shims pnpm (#109) restent un chantier distinct.

Sources : [bilan de Claude](https://github.com/JuReyms/Palabre/issues/96#issuecomment-6048846894),
[revue indépendante](https://github.com/JuReyms/Palabre/issues/96#issuecomment-6048964688),
[relecture de ce contrat](https://github.com/JuReyms/Palabre/pull/110#issuecomment-6049573390),
[relecture des corrections](https://github.com/JuReyms/Palabre/pull/110#issuecomment-6049723456).

## Décisions proposées

| Sujet | Proposition et état |
| --- | --- |
| Activation | Option explicite telle que `--open`, sans bascule automatique. Nom et acceptation des garanties **à décider** ; l'option n'existe pas aujourd'hui. |
| Cible | UUID explicite, config approuvée, commande résolue sans shell par les règles Relay D21. Pas de nom flou, de dernière conversation ni de changement de modèle. |
| Surface | Capacité du récepteur à consommer la file à vérifier. Un verrou **tenu**, pas seulement présent, prouve un écrivain ; il ne prouve ni un TUI ni son repos. Une surface inconnue ne devient pas implicitement compatible. La preuve ou déclaration de surface et ses limites restent **à définir**. |
| Droits | La conversation ouverte conserve ses outils, hooks, MCP, permissions et demandes d'approbation. Palabre ne promet aucune lecture seule et ne modifie pas ces réglages. **Acceptation produit requise avant implementation.** |
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

## Prototype de corrélation testé hors ligne

`open-response.ts` est une fonction pure, non importée par `src/`. Son dialecte est celui des
événements liés à un tour observés dans le rollout Codex 0.151.0 ; ce n'est pas un schéma public
garanti par OpenAI. Les historiques factices sont construits dans `open-response.test.ts`.

Avant le dépôt, le collecteur expérimental `open-rollout.ts` mémorise l'offset de fin d'une ligne
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
  être explicitement liée à un autre tour ; une saisie sans liaison identifiable interdit l'attribution ;
- une seule réponse `AgentMessage`, `phase: final_answer`, de ce thread et de ce tour ;
- un `task_complete` du même tour, après la réponse, avec `last_agent_message` identique, et
  aucun échec ou abandon de ce tour.

Les commentaires intermédiaires et les événements d'un autre tour ne terminent pas l'attente.
Une dernière ligne partielle est ignorée jusqu'à sa complétion. Une ligne terminée corrompue,
une identité incohérente ou un témoin remplacé interdit tout succès. L'ancien couple
`event_msg/user_message` + `agent_message` n'offre pas la liaison
nécessaire : le prototype ne l'accepte pas comme preuve de réponse.

Un message `user` comme `<environment_context>` peut être injecté sans liaison `UserMessage`.
S'il précède la référence ou le début du tour, il ne participe pas à l'échange analysé. S'il
apparaît pendant le tour relayé, même avant le message relayé, le lecteur conserve l'ambiguïté
`unbound-concurrent-user`. Aucun préfixe textuel n'est une preuve de provenance système, et
aucune liste d'exemptions n'est ajoutée sans critère observé et vérifiable.
Dans la trace jetable relue par Claude, ce contexte est écrit **après `task_started` au premier
tour** ; dans le tour relayé observé, Codex écrit un message de rôle `developer`. Ce dernier est
ignoré pour la preuve de réception et le contrôle des saisies concurrentes, comme tout message
de ce rôle : il ne devient ni une saisie utilisateur ni une réponse d'agent. Un contexte `user`
injecté dans un tour relayé reste à observer lors des essais réels ; les cas factices ne prouvent
pas sa fréquence ni ses déclencheurs.

Dans la trace réelle sont observés `task_started`, les deux `item_completed` et `task_complete`
avec `last_agent_message`, sans `thread_id` ni `status` sur cette terminaison. Les noms `error`,
`turn_aborted`, `task_cancelled`, `task_failed` et `task_complete.status` testés sont **des
hypothèses défensives factices, pas des formats d'échec vérifiés**. Il faut relever les événements
réels lors des essais d'annulation et d'erreur. Sans événement attribuable au tour et sans fin
valide, l'attente future se termine au délai en `persisted-no-reply` si le message est reçu.
Le lecteur assemble les parties textuelles par `\n` ; si le fournisseur les assemble autrement
dans `last_agent_message`, il conserve l'ambiguïté plutôt que normaliser la réponse.

La fonction pure `open-response.ts` ne lit aucun fichier. Le collecteur `open-rollout.ts` lit
seulement les fenêtres du fichier fourni ; aucun des deux ne dépose de message, ne sonde de
verrou ou ne pilote d'agent. Les statuts internes `awaiting-*`, `failed`, `ambiguous` et `unreadable` **ne sont
pas de nouveaux statuts CLI**. L'intégration devra garder les raisons de diagnostic et les
preuves antérieures. Les types et statuts du produit restent inchangés.

### Arrêt de l'attente et exceptions du collecteur

Le futur lot transport doit appliquer cette politique, sans relancer le dépôt :

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
`inspectOpenReply`. L'appelant futur doit les traduire selon la frontière de dépôt :

| Moment de l'exception | Traduction requise |
| --- | --- |
| Avant toute tentative de dépôt | Refus et aucun appel `queue` : `not-delivered`, sous réserve d'une preuve contradictoire conformément à `settleOpenDelivery`. |
| Dès que le dépôt a été tenté, y compris avant son accusé | Observation `unreadable`, `persisted: unknown`, sans réponse, arrêt de l'attente ; `unknown` sans preuve antérieure, `persisted-no-reply` si une preuve est conservée. |

Cette règle couvre les erreurs explicites (`history-replaced`, `added-too-large`,
`identity-incomplete`, `baseline-incomplete`…) et les exceptions de lecture, d'ouverture ou de
décodage. Le diagnostic doit garder la catégorie utile sans exposer le contenu brut ou un chemin
privé provenant de l'exception. Ni une exception ni l'annulation ne prouvent que la file a
supprimé le message. La boucle d'attente et cette traduction ne sont **pas implémentées** dans
ce lot : leur comportement doit être vérifié avec les tests du futur transport.

Commande reproductible, comprise dans `pnpm test` et la CI :

```powershell
pnpm test:relay-open
```

Les quatre sondes `open-*.mjs` de Claude restent locales et non commitées. Elles ne sont pas
appelées par cette commande ni par la CI. Leur lecteur expérimental n'est pas corrigé dans ce
lot ; il devra utiliser une corrélation validée et échouer réellement si la preuve manque.

## Budget de message Windows à intégrer avec le transport

L'aide vérifiée par Claude pour Codex 0.151.0 n'expose que `--message <TEXT>` pour `queue`,
sans entrée stdin ni fichier. Windows limite `CreateProcessW` à **32 767 unités UTF-16,
terminateur nul compris**, pour toute la ligne de commande. Les chemins de l'exécutable et du
script, les arguments fixes, l'UUID, l'enveloppe complète et l'échappement des guillemets et
antislashs consomment ce budget.
[Référence Microsoft](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-createprocessw).

Proposition pour le lot transport : plafonner l'enveloppe complète à **8 192 unités UTF-16**,
puis vérifier aussi la taille de la ligne effectivement sérialisée par le lancement Node.
Ce plafond prudent ne suffit pas à lui seul pour des chemins ou arguments longs. Tout dépassement
doit être refusé avant dépôt, avec `invalid-request` / raison `message-too-large`, sans tronquer
le contenu, lancer la CLI ou modifier Relay A. Ce contrôle et sa traduction ne sont pas encore
implémentés ; les essais doivent couvrir Unicode hors BMP, guillemets, antislashs et chemins longs.

## Conditions avant intégration B1

- [ ] Relecture indépendante de ce contrat et du lecteur, notamment de la liaison des tours.
- [ ] Décision du mainteneur sur le pilote TUI et l'absence de garantie de lecture seule.
- [ ] Définition vérifiable du récepteur compatible ; le verrou seul ne suffit pas.
- [ ] Essais jetables : cible déjà en génération, deux messages en file, message long et
      multiligne, saisie humaine concurrente, fermeture entre sonde et dépôt.
- [ ] Contexte `user` injecté après `task_started` dans un tour relayé : relever sa forme et
      vérifier l'ambiguïté prudente ; distinguer les messages `developer`, ignorés par la corrélation.
- [ ] Boucle d'attente : arrêt sur les observations terminales, exceptions avant/après tentative
      de dépôt correctement traduites et preuve de réception antérieure conservée.
- [ ] Timeout et Ctrl+C après acceptation : pas de succès inventé, de nouvelle reprise ni de
      renvoi automatique ; présence éventuelle en file correctement signalée. Relever les formats
      exacts d'échec et d'annulation au lieu de présenter les événements factices comme vérifiés.
- [ ] Versions et format exact de sortie de `queue` relevés ; limites sur arguments Windows et
      taille du rollout traitées sans parsing de sortie optimiste.
- [ ] Vérification spécifique de Codex desktop pour le besoin réel ; résultat positif, négatif
      ou inconnu publié sans assimiler desktop et TUI. #96 reste ouverte tant que nécessaire.
- [ ] Proposition explicite des évolutions JSON, diagnostics, codes de sortie et exports, avec
      mention des permissions de la cible ; documentation FR/EN et tests de Relay A.

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
