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
[revue indépendante](https://github.com/JuReyms/Palabre/issues/96#issuecomment-6048964688).

## Décisions proposées

| Sujet | Proposition et état |
| --- | --- |
| Activation | Option explicite telle que `--open`, sans bascule automatique. Nom et acceptation des garanties **à décider** ; l'option n'existe pas aujourd'hui. |
| Cible | UUID explicite, config approuvée, commande résolue sans shell par les règles Relay D21. Pas de nom flou, de dernière conversation ni de changement de modèle. |
| Surface | Capacité du récepteur à consommer la file à vérifier. Un verrou **tenu**, pas seulement présent, prouve un écrivain ; il ne prouve ni un TUI ni son repos. Une surface inconnue ne devient pas implicitement compatible. La preuve ou déclaration de surface et ses limites restent **à définir**. |
| Droits | La conversation ouverte conserve ses outils, hooks, MCP, permissions et demandes d'approbation. Palabre ne promet aucune lecture seule et ne modifie pas ces réglages. **Acceptation produit requise avant implementation.** |
| Provenance | Enveloppe claire, expéditeur déclaré non authentifié, nonce neuf, contenu marqué comme demande d'un autre agent. Un message n'est jamais présenté comme une autorisation humaine à exécuter une action ou à lever une restriction. Le texte exact reste **à relire**. |
| Dépôt | Un seul appel `codex queue`, arguments structurés, cwd de la cible, limite actuelle de 64 Kio pour le message. Un accusé valide identifie la tentative et la file, pas une réponse. Pas de reprise concurrente, de fork ni de repli `exec resume`. |
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

Le constat `Queued` vers une cible fermée doit être formulé précisément : aucun tour n'a été
traité pendant l'essai, mais une vérification sans modèle sur une copie isolée a trouvé le
message dans `queued_items` de `queue_1.sqlite`. Il pourrait être traité ultérieurement. Ne pas
consulter ni modifier cette base privée dans le produit ; elle sert ici uniquement de preuve.

## Prototype de corrélation testé hors ligne

`open-response.ts` est une fonction pure, non importée par `src/`. Son dialecte est celui des
événements liés à un tour observés dans le rollout Codex 0.151.0 ; ce n'est pas un schéma public
garanti par OpenAI. Les historiques factices sont construits dans `open-response.test.ts`.

Avant le dépôt, le futur collecteur capture un préfixe se terminant par une ligne complète et
son empreinte SHA-256. Il vérifie ensuite que le préfixe n'a pas été tronqué ou remplacé.
L'empreinte détecte une dérive du fichier, **pas** l'authenticité de son contenu.

Le lecteur exige :

- une identité `session_meta` unique correspondant à la cible ;
- une nouvelle `response_item/message` de rôle `user` contenant l'enveloppe exacte ;
- un seul `event_msg/item_completed`, `item.type: UserMessage`, portant le même texte et les
  `thread_id` et `turn_id` de la cible ;
- un seul utilisateur dans ce tour (des messages fusionnés ou une intervention humaine dans le
  même tour rendent la réponse ambiguë) ;
- toute autre saisie utilisateur apparue avant la terminaison doit être explicitement liée à
  un autre tour ; une saisie sans liaison identifiable interdit l'attribution ;
- une seule réponse `AgentMessage`, `phase: final_answer`, de ce thread et de ce tour ;
- un `task_complete` du même tour, après la réponse, avec `last_agent_message` identique, et
  aucun échec ou abandon de ce tour.

Les commentaires intermédiaires et les événements d'un autre tour ne terminent pas l'attente.
Une dernière ligne partielle est ignorée jusqu'à sa complétion. Une ligne terminée corrompue,
une identité incohérente ou un historique remplacé interdit tout succès. Un snapshot est plafonné
à 50 Mio. L'ancien couple `event_msg/user_message` + `agent_message` n'offre pas la liaison
nécessaire : le prototype ne l'accepte pas comme preuve de réponse.

Ce lecteur ne dépose aucun message, ne sonde aucun verrou, ne lit aucun fichier et ne pilote
aucun agent. Les statuts internes `awaiting-*`, `failed`, `ambiguous` et `unreadable` **ne sont
pas de nouveaux statuts CLI**. L'intégration devra garder les raisons de diagnostic et les
preuves antérieures. Les types et statuts du produit restent inchangés.

Commande reproductible, comprise dans `pnpm test` et la CI :

```powershell
pnpm test:relay-open
```

Les quatre sondes `open-*.mjs` de Claude restent locales et non commitées. Elles ne sont pas
appelées par cette commande ni par la CI. Leur lecteur expérimental n'est pas corrigé dans ce
lot ; il devra utiliser une corrélation validée et échouer réellement si la preuve manque.

## Conditions avant intégration B1

- [ ] Relecture indépendante de ce contrat et du lecteur, notamment de la liaison des tours.
- [ ] Décision du mainteneur sur le pilote TUI et l'absence de garantie de lecture seule.
- [ ] Définition vérifiable du récepteur compatible ; le verrou seul ne suffit pas.
- [ ] Essais jetables : cible déjà en génération, deux messages en file, message long et
      multiligne, saisie humaine concurrente, fermeture entre sonde et dépôt.
- [ ] Timeout et Ctrl+C après acceptation : pas de succès inventé, de nouvelle reprise ni de
      renvoi automatique ; présence éventuelle en file correctement signalée.
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
