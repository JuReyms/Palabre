# Relay vers une conversation Claude ouverte : contrat B2

Statut au 8 octobre 2026 : **lot B2.1 en relecture** (lecteur pur du transcript Claude Code et ses
tests), non branché à une commande, non publié. B2.2 (transport par le messager et garde d'envoi)
et B2.3 (essais réels jetables, puis notre conversation active avec accord au moment même) restent
à valider. #96 reste ouverte.

Sources :
[plan B2](https://github.com/JuReyms/Palabre/issues/96#issuecomment-6059060083),
[plan révisé](https://github.com/JuReyms/Palabre/issues/96#issuecomment-6059196072),
[précisions après la deuxième relecture](https://github.com/JuReyms/Palabre/issues/96#issuecomment-6060631916),
et les relectures de Codex transmises par le mainteneur (feu vert pour B2.1 seulement).

## Portée de B2.1

`inspectClaudeOpenReply(snapshot, request)` (`src/externalSessions/claudeOpenReader.ts`) observe
l'ajout d'un transcript `~/.claude/projects/<dossier>/<uuid>.jsonl` depuis une référence prise
**avant** l'envoi, et rend une observation :

- `persisted` : preuve de réception, distincte de la corrélation de la réponse ;
- `queued` : diagnostic de mise en file, sans valeur de preuve ;
- `status`, `reason` et, pour `replied` seulement, `reply`.

Aucun accès disque, envoi, attente ni appel de modèle. Les lectures bornées de B1
(`captureOpenRollout`, `readOpenRollout` : première ligne, témoin de 64 Kio, ajout plafonné à
50 Mio) ne dépendent pas du format et servent telles quelles. Les contrôles communs de référence et
d'ajout sont partagés avec le lecteur Codex (`checkOpenFraming`, `openAddedLines`), ainsi que
`settleOpenDelivery`.

Dialecte relevé hors ligne avec Claude Code 2.1.293 (Claude desktop, Windows), sur une conversation
jetable : 111 entrées, 1 tour humain, 11 tours de pair dont 2 avec un outil. Ce n'est pas un schéma
public. Le squelette anonymisé de ce transcript est versionné dans
`tests/fixtures/external-sessions/claude-open-peer-turns.jsonl` (liste blanche de champs
structurels, identifiants et textes synthétiques).

## Règles du lecteur

**Contrôles globaux**, sur tout l'ajout, avant toute corrélation (`unreadable`) :

- requête : `sessionId` au format UUID, nonce présent dans l'enveloppe (`invalid-request`) ;
- référence et dérive (`invalid-baseline`, `history-replaced`, `added-too-large`,
  `incomplete-snapshot`, `invalid-utf8`) : règles de B1 ;
- identité : la première ligne et chaque entrée ajoutée qui porte un `sessionId` portent celui de
  la cible (`identity-mismatch`) ;
- lignes terminées : JSON objet avec un `type` (`invalid-json-line`, `invalid-record`). La dernière
  ligne partielle attend le prochain snapshot.

**Réception** (`persisted: true`). Une entrée neuve `type: "user"`, `origin.kind: "peer"`,
`origin.body` **identique** à l'enveloppe, `sessionId` de la cible, `isSidechain: false`. Elle prouve
la réception, pas l'authentification de l'expéditeur déclaré.

- Aucune : `awaiting-message` (`persisted: false`), ou `ambiguous` / `envelope-altered`
  (`persisted: "unknown"`) si le nonce figure dans le texte d'une autre entrée `user` ou dans un corps
  de pair.
- Plusieurs : `ambiguous` / `duplicate-envelope`.
- Une seule, mais nonce cité ailleurs : `ambiguous` / `envelope-altered`, réception conservée.

**Début de tour** (sinon `ambiguous`, réception conservée, donc `persisted-no-reply`) :

- `turnOrigin: "peer"`, `turnPosition.promptIndex: 1`, parent égal à une **fin valide** : la
  dernière entrée chaînée du témoin, ou une fin de l'ajout écrite avant l'ancre
  (`turn-start-not-proven`) ;
- `uuid` unique (`duplicate-uuid`), et l'ancre seule enfant de cette fin (`concurrent-branch`) ;
- `promptId` au format UUID (`invalid-prompt-id`), distinct de celui des **autres** débuts de tour
  visibles dans le témoin et l'ajout, l'ancre exclue (`duplicate-prompt-id`). Un début de tour est
  une entrée `user` qui porte `turnOrigin` ou `turnPosition`.

**Segment** : chaîne linéaire depuis l'ancre, dans l'ordre du fichier, jusqu'à la **première** fin
valide. Les entrées sans `uuid` (file, `last-prompt`, titres…) sont ignorées. Les tours suivants
sont hors segment.

| Entrée chaînée | Règle | Sinon |
| --- | --- | --- |
| deux enfants d'une même entrée | branche concurrente | `concurrent-branch` |
| enfant écrit avant son parent | | `invalid-chain-order` |
| `uuid` déjà vu (ajout ou témoin) | | `duplicate-uuid` |
| `isSidechain` différent de `false` | | `unknown-entry-in-turn` |
| `assistant` | blocs `text`, `thinking`, `redacted_thinking`, `tool_use` (identifiant unique) | `unknown-entry-in-turn`, `duplicate-tool-call` |
| `assistant` en erreur (`isApiErrorMessage`, `error`, modèle `<synthetic>`) | hypothèse défensive, non observée | `failed` / `assistant-error` |
| `user` | seulement un résultat d'outil lié (ci-dessous) | `concurrent-input-in-turn` |
| `attachment` | type parmi les 14 relevés (`CLAUDE_ANNEX_ATTACHMENTS`) | `unknown-entry-in-turn` |
| `system` | fin valide seulement | `unknown-terminal` |
| autre type | | `unknown-entry-in-turn` |

**Résultat d'outil lié** : contenu formé uniquement de blocs `tool_result`, chacun lié à un appel
**encore en attente** de l'entrée parente (consommé une seule fois) ; `sourceToolAssistantUUID`
égal au parent ; `promptId` de l'ancre ; ni `turnOrigin`, ni `turnPosition`, ni `origin` ;
`sessionId` de la cible.

**Fin valide** : `system/stop_hook_summary`, `preventedContinuation: false`, `hookErrors: []`,
`isSidechain: false`, `sessionId` de la cible. Avant de l'accepter :

- seules des pièces jointes relevées séparent la dernière entrée `assistant` de la fin
  (`unknown-terminal`) ;
- aucun appel d'outil sans résultat (`unresolved-tool-call`) ;
- aucune entrée chaînée hors segment entre l'ancre et la fin : `broken-chain` si son parent est
  inconnu (compaction, lien manquant), `concurrent-branch` sinon.

Sans fin : `awaiting-reply` / `end-not-observed`, jamais de repli sur `stop_reason: end_turn`. Une
entrée hors segment après l'ancre rend l'attente `ambiguous` de la même façon.

**Texte rendu** : les blocs `text` des entrées `assistant` après le dernier résultat d'outil du
segment (ou après l'ancre), dans l'ordre, joints par `\n`, au moins un non blanc
(`empty-final-text` sinon). Un commentaire avant un appel d'outil n'est jamais la réponse.

**Relevé** (`context`, pour `replied` et `failed`) : modèles des entrées `assistant` du segment et
`permissionMode` de l'ancre, valeurs courtes seulement.

**File** (`queued`). Une entrée neuve `queue-operation` / `enqueue` du `sessionId` de la cible, dont
le `content` est **exactement**, attributs sans guillemet ni saut de ligne :

```text
<cross-session-message from="…" from-name="…" from-mode="…">
<corps exact>
</cross-session-message>
```

Toute autre forme (inclusion, CRLF, espace, préambule) n'est pas reconnue, et une enveloppe qui
contient la balise ne l'est jamais. `queued` ne change jamais `persisted` : en faire une preuve de
réception est une décision reportée après B2.3.

**Délivrance** : `settleOpenDelivery` de B1. `replied` seulement avec une réponse corrélée ;
`persisted-no-reply` dès qu'une réception exacte est prouvée, y compris pour `ambiguous` ou `failed` ;
`unknown` sinon après une tentative.

## Choix d'implémentation soumis à la relecture

1. **Pièce jointe avant la fin.** Le contrat demandait une fin dont le parent est la dernière entrée
   `assistant`. Dans le transcript jetable, 1 fin sur 12 (tour humain) a une pièce jointe pour
   parent. Le lecteur admet donc des pièces jointes relevées entre la dernière réponse et la fin.
2. **Liste blanche des pièces jointes** : les 14 types relevés. Une saisie mise en file pendant un
   tour pourrait prendre la forme d'une pièce jointe d'un autre type : elle reste ambiguë.
3. **Nonce dans un résultat d'outil** : non compté comme une altération, car la cible peut lire un
   fichier qui le contient. Les textes `user` et les corps de pair sont contrôlés.
4. **Marque de tour sur un résultat d'outil** : l'entrée devient un autre début de tour au même
   `promptId`, donc `duplicate-prompt-id`.
5. **Appels parallèles** (non observés) : un résultat dont le parent n'est pas l'entrée de son appel
   donne `concurrent-input-in-turn`. Perte de réponse possible, jamais de fausse réponse.
6. **Fin de la référence** : prouvée par sa forme seulement, car son propre parent peut sortir du
   témoin. Témoin de 64 Kio : une dernière entrée plus longue, ou une ligne illisible, retire la
   preuve (`turn-start-not-proven`).
7. **Première ligne** : elle doit porter le `sessionId` de la cible. Relevé : une `queue-operation`
   en tête, pour la conversation desktop comme pour les sessions `-p` jetables du smoke Relay A. Un
   transcript qui commencerait sans `sessionId` serait refusé (`identity-mismatch`).

## Tests B2.1

`tests/external-sessions-claude-open.test.ts` (73 cas, sans quota) : tour simple, tours successifs,
tour suivant hors segment, tour humain commencé avant la référence, outils (liés, deux appels pour un
résultat, résultat consommé deux fois, orphelin, mauvais `promptId`, blocs mêlés, injection entre
deux appels), début non prouvé avec réception conservée, `promptId` absent, contradictoire ou déjà vu
(ancre exclue), types et fins inconnus, branches concurrentes, compaction, autre identité, nonce
cité, doublon d'enveloppe, forme de file exacte puis altérée, squelette anonymisé (11 tours
corrélés), transcript de 151 Mio en lectures bornées. Une mutation de chaque règle clé fait échouer
au moins un test.

## Suite (non validée)

- **B2.2, transport.** Garde d'envoi : tant qu'un blocage effectif en cas de panne n'est pas
  démontré sur la vraie CLI, toute tentative lancée reste `unknown`, et l'unicité n'est pas promise.
  Piste : `SendMessage` non préautorisé, `--permission-mode dontAsk`, autorisation par une décision
  `allow` explicite d'un hook. Registre, version du messager, auto-ciblage, budget unique et refus
  avant l'envoi d'une enveloppe contenant la balise de file.
- **B2.3, essais réels jetables**, avec accord séparé, puis notre conversation active avec accord
  au moment même.
