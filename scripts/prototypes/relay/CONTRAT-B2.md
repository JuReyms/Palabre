# Relay vers une conversation Claude ouverte : contrat B2

Statut au 8 octobre 2026 :
- **B2.1** (lecteur pur du transcript Claude Code) : validé dans son périmètre expérimental (#112) ;
- **B2.2a** (transport par un messager gardé, pilote Windows) : implémenté avec des tests sans
  quota, en relecture. La sémantique réelle des permissions n'est **pas** démontrée ;
- **B2.3** (essais réels jetables, puis notre conversation active avec accord au moment même) :
  soumis à un accord séparé.

Rien n'est publié. #96 reste ouverte.

Sources :
[plan B2](https://github.com/JuReyms/Palabre/issues/96#issuecomment-6059060083),
[plan révisé](https://github.com/JuReyms/Palabre/issues/96#issuecomment-6059196072),
[précisions après la deuxième relecture](https://github.com/JuReyms/Palabre/issues/96#issuecomment-6060631916),
[plan B2.2](https://github.com/JuReyms/Palabre/issues/96#issuecomment-6062453243),
et les relectures de Codex transmises par le mainteneur.

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
valide. Les tours suivants sont hors segment.

**Entrées sans identifiant de chaîne** (`uuid` absent, `null` ou vide), entre l'ancre et la fin (ou
après l'ancre tant qu'aucune fin n'est observée) :

- métadonnées relevées (`CLAUDE_METADATA_TYPES` : `queue-operation`, `last-prompt`,
  `custom-title`, `agent-name`, `atis-latch`, `file-history-snapshot`) : admises, ignorées ;
- entrée de conversation (`user`, `assistant`, `system`, `attachment`) : structurellement invalide,
  `malformed-entry-in-turn`. Un message humain, un pair ou une fin sans `uuid` ne disparaît donc
  jamais de l'analyse ;
- autre type : `unknown-entry-in-turn`.

Une ancre exacte sans `uuid` prouve la réception, mais jamais un début de tour
(`malformed-entry-in-turn`). Avant l'ancre ou après la fin, ces entrées n'appartiennent pas au tour
relayé et restent sans effet. Dans tous ces cas, `persisted: true` est conservé.

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
- aucune entrée hors segment entre l'ancre et la fin, hors métadonnées relevées : entrée sans
  `uuid` (règles ci-dessus), puis entrée chaînée, `broken-chain` si son parent est inconnu
  (compaction, lien manquant), `concurrent-branch` sinon.

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

## Choix d'implémentation

Les sept choix ci-dessous ont été jugés acceptables à la relecture de `da5abae`. Cette relecture a
relevé un point P2, corrigé ensuite : le filtre sur `uuid` ignorait aussi des entrées de conversation
mal formées (message humain ou fin inconnue sans `uuid`, ou avec `uuid: null`), et une réponse
restait corrélée. Voir « Entrées sans identifiant de chaîne ».

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

`tests/external-sessions-claude-open.test.ts` (87 cas, sans quota) : tour simple, tours successifs,
tour suivant hors segment, tour humain commencé avant la référence, outils (liés, deux appels pour un
résultat, résultat consommé deux fois, orphelin, mauvais `promptId`, blocs mêlés, injection entre
deux appels), début non prouvé avec réception conservée, `promptId` absent, contradictoire ou déjà vu
(ancre exclue), types et fins inconnus, branches concurrentes, compaction, autre identité, nonce
cité, doublon d'enveloppe, entrées de conversation sans `uuid` (absent, `null`, vide ; message,
pair, assistant, pièce jointe, fin connue ou inconnue ; ancre), type non chaîné inconnu,
métadonnées relevées pendant le tour, entrée mal formée avant l'ancre ou dans le tour suivant,
forme de file exacte puis altérée, squelette anonymisé (11 tours
corrélés), transcript de 151 Mio en lectures bornées. Une mutation de chaque règle clé fait échouer
au moins un test.

## B2.2 : envoi par un messager gardé (lot B2.2a)

Décisions validées à la relecture du [plan B2.2](https://github.com/JuReyms/Palabre/issues/96#issuecomment-6062453243) :
- **garde** par un hôte de permissions MCP, au lieu d'un hook ;
- **consigne neutre** donnée au modèle, avec substitution du destinataire et du message par le garde ;
- **pilote Windows** seulement ;
- **messager `haiku`**, distinct du modèle de la cible, sans modèle de repli.

Code :
- `src/externalSessions/claudeOpen.ts` : préconditions et formats ;
- `claudeGuard.ts` et `claudeGuardServer.ts` : le garde ;
- `claudeOpenRelay.ts` : le déroulé ;
- branchement dans `palabre relay --open` quand l'agent cible est Claude Code.

### Déroulé, sous une seule échéance `--timeout`

1. **Enveloppe** : `buildOpenEnvelope` avec une consigne propre à Claude (répondre dans la
   conversation, sans `SendMessage`). Elle est refusée sans aucun lancement si :
   - elle dépasse 8 192 unités UTF-16 ou contient un NUL (`message-too-large`) ;
   - elle contient la balise de file réservée (`reserved-content`).
2. **Version du messager** : `claude --version` doit rendre exactement `X.Y.Z (Claude Code)`, au
   moins 2.1.292. Sinon, `unsupported-version`.
3. **Registre** (`claude agents --json`, 10 s et 1 Mio au plus) :
   - toute entrée non conforme rend le registre invérifiable : `target-state-unknown` ;
   - UUID absent d'une liste valide : `target-not-open` ;
   - doublon, nom non adressable (vide, multiligne, avec crochets) ou homonyme vivant :
     `target-state-unknown`.
4. **Auto-ciblage**, d'après l'environnement de l'appelant avant nettoyage (`self-target`) :
   - `CLAUDE_CODE_SESSION_ID` égal à l'UUID, ou `CLAUDE_PID` égal au `pid` de la cible ;
   - refus prudent si `CLAUDECODE` est présent sans aucune des deux variables.
5. **Transcript** :
   - dossier lu par `claude auth status` (`projectsDirectory`, sinon `configDirectory/projects`) ;
     un messager déclaré non connecté (`loggedIn: false`) est refusé avant tout lancement
     (`cli-failure`, `messenger-not-logged-in`) ;
   - un seul `projects/*/<uuid>.jsonl`, dont la première ligne porte le `sessionId` ;
   - illisible : `target-state-unknown` ; absent ou ambigu : `session-not-found`.
6. **Référence** du transcript (lectures bornées de B1), puis **nouveau contrôle du registre**
   (même UUID, même nom, même `pid`). Sinon, aucun lancement.
7. **Messager** : un seul lancement, sans shell, dans un dossier temporaire privé (supprimé à la
   fin), environnement nettoyé, en `min(120 s, budget restant)` et 1 Mio au plus :

   ```text
   claude -p --restricted --strict-mcp-config --mcp-config <garde seul>
             --permission-mode default --permission-prompt-tool mcp__palabre_guard__decide
             --tools SendMessage --settings <ask SendMessage, crossSessionInbound refuse, disableAllHooks>
             --model haiku --max-turns 2 --max-budget-usd 0.25 --no-session-persistence
             --name palabre-relay --output-format stream-json --verbose
   ```

   Aucune préautorisation (`--allowedTools`), ni `dontAsk`, ni modèle de repli. La consigne (stdin)
   donne le nom résolu et un texte de remplacement : l'enveloppe n'entre jamais dans le contexte
   du modèle.
8. **Attente** : lecteur B2.1 toutes les 500 ms, jusqu'à une observation terminale, l'échéance ou
   l'annulation. Ces deux dernières sont contrôlées avant et après chaque lecture.

### Garde

Le garde est un serveur MCP stdio, lancé par la CLI avec l'interpréteur Node courant. Il lit
`guard.json` dans le dossier privé : nom, UUID, `pid`, enveloppe et son empreinte, exécutable
résolu. Pour chaque demande, dans cet ordre :
1. seul `SendMessage` est autorisé ;
2. l'état doit être valide ;
3. le registre est relu avec l'exécutable de la cible et doit désigner la même cible ;
4. le fichier `allowed` est créé de façon exclusive : un second appel est refusé, même en
   parallèle ou depuis un autre processus ;
5. la réponse est `{ behavior: "allow", updatedInput: { to, message } }` exacts.

Toute erreur donne un refus. Chaque décision est ajoutée à `consulted.jsonl`.

Le format de la demande (`{ tool_name, input, tool_use_id? }`) et de la réponse (texte JSON
`behavior` / `updatedInput` / `message`) suit la documentation publique. Il **reste à vérifier**
sur la vraie CLI (B2.3), comme l'environnement fourni au serveur MCP. Si la relecture du registre
y échoue, l'envoi est refusé.

### Délivrance et diagnostics

- Avant le lancement du messager : `not-delivered`, sans export.
- Après le lancement : **`unknown`** tant que le transcript ne prouve rien. Une entrée de pair au
  corps exact donne `persisted-no-reply`, et une réponse corrélée donne `replied`. **Aucune
  promotion vers `not-delivered`** à ce stade, même sans autorisation enregistrée.
- Champ JSON `messenger` (au lieu de `queue`, propre à Codex). Ce sont des diagnostics, jamais des
  preuves :
  - `attempted` ;
  - `guard` (`loaded`, `not-loaded` ou `unknown`, d'après `system/init`). **Un garde chargé n'a pas
    forcément été consulté** ;
  - `guardConsulted` ;
  - `sendAllowed` : `true` (autorisation enregistrée), `false` (garde consulté sans autorisation)
    ou `"unknown"` ;
  - `toolResult` (`returned` ou `absent`, texte non recopié) ;
  - `model` ;
  - `diagnostic`, par exemple `messenger-model-unexpected` si le modèle annoncé n'est pas `haiku`.
- `queued` : forme exacte de file observée, sans effet sur la délivrance.
- `targetPermissions: { permissionMode }`, tiré de l'ancre corrélée seulement.
- Issue primaire du messager :
  - arrêt (`timeout`, `output-too-large`, `cancelled`) ;
  - code non nul (`cli-failure`) ;
  - aucune autorisation enregistrée (`no-valid-reply`, avec `guard-not-loaded`,
    `guard-not-consulted` ou `send-not-allowed`).
- **Échec, annulation et échéance.** L'issue principale est conservée, ainsi que toute réception
  déjà prouvée. Une dernière lecture bornée peut encore relever une réception, sauf après
  annulation ou échéance. **Aucune réponse n'est rendue** après un échec, une annulation ou un
  dépassement du délai, même si le transcript en contient une.

### Limites

- **Sémantique réelle des permissions non démontrée.** La fausse CLI vérifie seulement le code de
  Palabre. B2.3 devra montrer que `SendMessage` passe par le garde avec la règle `ask`, et qu'un
  garde absent, en échec, sans réponse ou au JSON invalide bloque l'envoi.
- **Politiques administrées** : elles peuvent contourner la règle `ask` (hook `PermissionRequest`
  administré, `allowManagedPermissionRulesOnly`, règles administrées). Elles ne sont pas couvertes.
- **Course résiduelle** : un nom peut changer de propriétaire entre la relecture du registre par le
  garde et l'envoi. La messagerie n'offre pas d'adressage immuable par UUID.
- **Règles de réception de la cible** (documentation, section *Control inbound messages*) :
  - `crossSessionInbound: hold` **conserve** le message sans le remettre. Un `hold` explicite
    n'expire pas : le message n'est remis que si une valeur `accept` s'applique plus tard ;
  - `refuse` **supprime** le message ;
  - sans valeur applicable, la décision dépend des deux modes : une cible qui demande les
    permissions reçoit le message du messager (mode `default`). Une cible qui contourne les
    permissions le **garde pour approbation**. Seul ce `hold` par défaut expire au délai
    `dialogExpiry` (5 minutes par défaut, `"never"` possible). Claude desktop ne peut pas afficher
    l'approbation ;
  - **mode Plan** : il compte comme un contournement des permissions seulement dans une session
    de terminal interactive où le contournement est disponible. Ailleurs, il compte comme une
    demande de permissions.

  Palabre ne lit pas ces réglages. Le lecteur reste à « message non observé », puis `unknown` à
  l'échéance, sans renvoi.
- **Aucun accusé** pour une session Claude desktop ; seul le transcript fait foi.
- **Cible occupée** : le message est lu entre deux appels d'outils, d'où
  `turn-start-not-proven`, puis `persisted-no-reply`.
- **Codex desktop comme expéditeur** : bloqué par son bac à sable, hors de ce lot.

### Tests B2.2a (sans quota)

- `tests/external-sessions-claude-guard.test.ts` (21 cas) :
  - version, registre, auto-ciblage, dossier, balise, localisation ;
  - arguments, réglages et consigne du messager ;
  - lecture du flux ;
  - décisions du garde : autre outil, état, cible changée, réservation, erreur, 8 demandes
    parallèles pour une seule autorisation ;
  - serveur MCP en flux mémoire et en vrai sous-processus.
- `tests/external-sessions-claude-open-relay.test.ts` (26 cas) : déroulé avec horloge simulée et
  transcript temporaire réel :
  - nominal ;
  - refus avant envoi, dont un messager non connecté ;
  - garde chargé mais non consulté ;
  - garde non chargé ;
  - consulté sans autorisation ;
  - réception sans autorisation enregistrée ;
  - `hold` ;
  - file seule ;
  - modèle inattendu ;
  - échec, échéance et annulation après réception, sans réponse ;
  - lecture tardive ;
  - tour en cours ;
  - lecture en échec après preuve ;
  - budget épuisé.
- `tests/relay-command.test.ts` (Windows) : bout en bout avec une fausse CLI qui lance réellement
  le garde compilé :
  - enveloppe exacte imposée, consigne neutre, environnement nettoyé ;
  - second appel et autre outil refusés ;
  - garde non consulté ;
  - cible changée au moment de la décision ;
  - refus avant envoi, sortie texte, export.
- Hors Windows : refus du pilote.

## B2.3 (accord séparé)

Les essais réels jetables reprennent la liste du plan B2.2. Ensuite seulement vient notre
conversation active, avec un accord au moment même. L'éventuelle promotion vers `not-delivered`
ne sera examinée qu'après ces essais.
