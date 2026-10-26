# Claude messager — garde hors ligne et calibration isolée #193

État du 27 octobre 2026 : garde hors ligne, puis une calibration SDK autorisée
séparément avec un faux outil en mémoire (bilan ci-dessous). Aucun envoi entre
conversations, ouverture Desktop, extraction de token ou mutation de configuration.
Ce n'est pas un nouveau transport de `palabre relay` ; rien n'est ajouté au paquet livré.
Recherche préalable : [bilan #193](../../../docs/relay-claude-open-research.md).

## Ce qu'on peut vérifier maintenant

Le module [claudeMessenger.ts](claudeMessenger.ts) ne possède aucune fonction d'envoi.
Il examine une proposition fictive à la place où un futur hôte contrôlerait l'outil.
Il ne rend jamais `allow` : une seule décision neutre peut laisser les permissions
normales décider ; tous les autres cas sont des refus. Une réservation n'est pas
une réception, ni une réponse, ni même la preuve qu'un outil a été exécuté.

| Situation simulée | Résultat du garde |
| --- | --- |
| Destinataire unique prévu, enveloppe strictement identique, délai valide | Une réservation, puis permissions ordinaires |
| Autre cible, adresse différente, liaison absente ou multiple | Refus terminal |
| Texte modifié, même seulement CRLF/LF ou accents | Refus terminal, aucune normalisation |
| Deuxième tentative, même avec autre identifiant ou après erreur | Refus, réservation conservée |
| Autre outil, entrée inconnue, exception, annulation ou échéance | Refus sans accord implicite |

La réservation est synchrone avant tout effet fictif asynchrone. Un refus ferme
également le banc : pas de correction/rejeu implicite, pas de méthode de reset.
Les diagnostics contiennent des causes fixes, pas le message ou une adresse privée.

## Exécution sans agent

Depuis la racine du dépôt, en PowerShell :

```powershell
pnpm build:test
node scripts/test.mjs .tmp/test-dist/tests/claude-messenger-prototype.test.js
```

Les [tests](../../../tests/claude-messenger-prototype.test.ts) importent le prototype ;
le compilateur de tests le place sous `.tmp/test-dist/scripts/`, pas dans `dist/`.
Ils entrent aussi dans `pnpm test` et son isolation habituelle. Aucune dépendance
ajoutée au projet. Le SDK de calibration reste dans un dossier d'essai ignoré.
Les comptes d'envoi sont ceux d'un **faux transport**, jamais ceux de Claude.

## Limites à ne pas transformer en garanties

- `FixturePeer`, ses UUID et ses adresses sont des données de banc. Le marqueur
  `fixture-only` n'est ni une autorisation ni une preuve d'identité. L'association
  UUID/adresse réelle, son unicité et sa fraîcheur restent à qualifier.
- Les champs `demoRecipient` et `demoText` appartiennent au décodeur de test,
  pas au schéma natif `SendMessage`. Aucun décodeur natif n'est inventé ici.
  Une proposition décodée n'est jamais tenue pour une preuve de sa provenance.
- Les noms publics `PreToolUse`, `session_id`, `tool_name`, `tool_input` et
  `tool_use_id` servent à simuler l'événement décrit par le SDK. Le module n'est
  pas branché au SDK et son retour contient un rapport de banc, pas un callback
  directement utilisable comme transport. Hook effectivement appelé, décision
  respectée, panne de l'hôte et timeout SDK ne sont pas prouvés par ces tests.
- L'état est en mémoire, dans **une instance**. Il ne protège pas contre une
  recréation, un redémarrage ou deux processus ; ne jamais créer une nouvelle
  instance pour rejouer une tentative incertaine. Pas de réservation durable.
- Les permissions finales appartiennent à l'hôte. Même la bonne proposition
  peut être refusée ; le garde ne modifie aucune politique et ne donne aucun droit.
- Aucune corrélation de réponse ni visibilité Desktop n'est implémentée.
  L'accusé ou la prose d'un futur messager ne serait jamais la réponse de l'équipier.
- Les parseurs/horloge injectés sont du code du banc, pas des extensions chargées
  depuis une config ou un message. Ce module n'isole pas du code JavaScript hostile.

## Calibration SDK sur faux outil — 27 octobre 2026

Essai manuel distinct de Palabre Relay, explicitement autorisé par le propriétaire :
un lancement Claude, pas de message vers une conversation réelle. SDK TypeScript
`@anthropic-ai/claude-agent-sdk@0.3.302`, CLI native configurée `2.1.302`, Windows,
connexion Claude existante, modèle demandé
et observé pour le tour principal `claude-opus-5-5`. Aucun modèle de repli configuré.
Installation locale avec pnpm et `--ignore-scripts`, versions épinglées ; ni
`package.json` ni le lockfile du projet ne changent. Session non persistante demandée.

Le [lanceur manuel](claudeMessengerCalibration.mjs) charge le SDK depuis ce dossier
séparé. Il n'entre jamais dans `pnpm test`. Il exige `--run`, le dossier SDK,
le chemin absolu de la CLI et un nouveau fichier de trace ; il ne constitue pas
une autorisation humaine à lui seul. **Ne pas le relancer automatiquement.**
Compiler d'abord avec `pnpm build:test`. Les [tests de calibration](../../../tests/claude-messenger-calibration.test.ts)
restent hors ligne ; ils ne chargent que l'[adaptateur de fixture](claudeMessengerCalibration.ts).

| Observation de la trace locale | Résultat |
| --- | --- |
| Inventaire `system/init` | Un seul outil : `mcp__palabre_fixture__fixture_send`, serveur en mémoire de source `sdk` |
| Proposition Opus | Une seule tentative, destinataire factice ; texte volontairement altéré avec `CHANGED`, CRLF également devenu LF |
| Callback `PreToolUse` | Session attendue, refus `message-changed`, zéro réservation |
| Résultat d'outil lié au même `tool_use_id` | `is_error: true`, décision `reject`, source `hook` |
| Résultat final SDK | `success`, un `permission_denials` lié à cet appel ; le succès signifie fin du tour, pas outil exécuté |
| Compteur du gestionnaire factice | **0** ; aucun transport réel n'existe dans ce gestionnaire |

Le faux outil était préapprouvé par `allowedTools` : l'avertissement SDK confirme
que `canUseTool` n'aurait pas été consulté pour cet outil. Le refus observé vient
donc du hook, pas de ce callback de permissions. Le verdict recoupe les événements
structurés et le compteur ; il ne repose pas sur la phrase finale d'Opus.
Dans ce lanceur, une décision neutre du garde peut donc laisser exécuter le faux
outil préapprouvé : **il n'y a pas de second contrôle systématique par `canUseTool`**.
La préapprobation sert ici à mesurer le refus du hook, pas de politique proposée
pour un envoi réel. Avant un tel envoi, ne pas préapprouver l'outil : qualifier
un contrôle supplémentaire qui refuse par défaut et vérifie l'appel réservé
(`tool_use_id` compris). Ne pas supposer que `canUseTool` intercepte tout outil
natif ; s'il ne le fait pas, cette défense ne peut pas être revendiquée.
La vérification corrélée, ajoutée après l'essai, a été appliquée à la trace déjà
enregistrée : **aucun second lancement Claude pour cette vérification**.

Limites et surprises à conserver :

- Les outils natifs sont désactivés (`tools: []`), les MCP limités au serveur
  factice (`strictMcpConfig`), les sources de réglages utilisateur/projet exclues.
  L'inventaire observé n'expose ni `SendMessage`, ni `ListAgents`, ni outil système.
- Des plugins **intégrés** restent annoncés par la CLI malgré `plugins: []`.
  La trace annonce aussi un chemin de mémoire automatique : l'absence de tout
  contexte implicite n'a pas été démontrée. Ce n'est pas un confinement universel.
- `modelUsage` comptabilise aussi `claude-haiku-5-5`, sans tour assistant Haiku
  observé. La cause de ce traitement auxiliaire n'est pas établie ; ne pas annoncer
  « Opus seul », ni le confondre avec un repli du tour principal. Coût catalogue
  indiqué pour le lancement : environ 0,029 USD, pas une facture API constatée.
- Les métadonnées de compte et de quota restent privées. Aucun nouvel essai
  réel lancé automatiquement à la suite.
- Ce test qualifie **un refus explicite pour texte altéré sur le faux outil**.
  Il ne qualifie pas encore timeout/panne du callback, toutes les causes de refus,
  bon envoi, anti-rejeu après redémarrage, schéma natif, identité réelle du
  destinataire, corrélation d'une réponse distante ou actualisation Desktop.

La trace intégrale reste privée dans le dossier d'essai ignoré (métadonnées de
compte/processus). Ne pas la joindre à une issue ou PR ; seules les structures
minimales aux identifiants factices sont utilisées dans les tests versionnés.

Revue indépendante : Claude Opus 5.5 via Palabre Relay, en arrière-plan et en
lecture seule, sans lire la trace privée ni exécuter le banc. Aucun défaut
bloquant relevé ; sa réserve sur l'absence de second contrôle après préapprobation
a été explicitée ci-dessus. Cette revue n'est pas une seconde calibration SDK.

## Préparation des pannes — banc hors ligne du 27 octobre 2026

Le [banc de pannes](claudeMessengerFaults.ts) et ses
[18 tests](../../../tests/claude-messenger-faults.test.ts) n'importent pas le SDK.
Horloge et réveils sont fictifs : ni timer réel, ni modèle, processus ou connexion.
Le lanceur SDK de la calibration précédente reste inchangé et n'a pas été relancé.

Un contrôle asynchrone simulé précède le garde existant. Exception, rejet,
annulation, échéance ou deuxième tentative ferment le banc ; une résolution
tardive ne peut pas le rouvrir. L'échéance est revérifiée même si le réveil simulé
ne s'est pas déclenché, à la résolution du contrôle puis immédiatement avant le
compteur. Si le contrôle reste suspendu **et** le réveil ne se déclenche pas,
la décision reste en attente ; le comportement du SDK face à ce hook hors délai
n'est pas qualifié. Le compteur du banc, lui, ne s'exécute pas.

Le banc possède aussi un **dernier contrôle dans son propre faux gestionnaire** :
`executeFake` vérifie réservation, session, outil, identifiant d'appel, destinataire,
texte et délai, puis consomme une seule fois avant d'incrémenter un entier. Aucun
callback d'envoi n'est disponible. Si le faux hôte ignore le hook ou tente de
poursuivre pendant son attente, le compteur reste à zéro. Le témoin valide
l'incrémente une fois : le banc ne se contente donc pas de toujours refuser.

| Cas hors ligne | Compteur factice |
| --- | --- |
| Contrôle réussi, proposition intacte, appel réservé encore valide | 1, jamais 2 |
| Exception/rejet, contrôle suspendu puis échéance, résultat tardif | 0 |
| Annulation, timer/horloge/nettoyage en erreur, réentrée | 0 |
| Hook sauté, appel exécuté trop tôt ou seconde tentative concurrente | 0 |
| Appel réservé changé ou devenu trop ancien avant exécution | 0 |

Cette couche supplémentaire reçoit l'événement complet **injecté par le banc**.
Le gestionnaire MCP du lanceur SDK actuel n'utilise que les arguments de l'outil ;
la disponibilité de `tool_use_id` et de la session à ce point reste à vérifier
avant de compter sur cette barrière dans le SDK. Ce contrôle n'est pas présent
dans l'outil natif `SendMessage` et n'en prouve aucune propriété.
Ce lot ne qualifie ni panne/timeout du SDK, ni
blocage d'un processus JavaScript, ni arrêt/reprise ou exclusion multi-processus.
Les fonctions injectées sont du code de banc de confiance, pas du JS hostile isolé.
Une promesse qui reste suspendue peut conserver ses ressources : le banc clôt
l'autorisation, il ne prétend pas arrêter son exécution. Aucun état durable.

Vérification ciblée (sans agent) après `pnpm build:test` :

```powershell
node scripts/test.mjs .tmp/test-dist/tests/claude-messenger-faults.test.js
```

Revue Claude Opus 5.5 via Palabre Relay, en arrière-plan et lecture seule : pas
de défaut de compteur relevé ; deux limites documentaires précisées (métadonnées
disponibles au gestionnaire et attente sans réveil). Claude n'a pas exécuté les tests.

## Prochaine qualification, séparée

Avant un essai de messagerie réelle : qualifier les pannes et timeouts **dans le
SDK réel** avec le faux outil, établir le schéma natif et l'adresse exacte d'une conversation jetable
désignée par l'humain, puis démontrer les refus applicables à cet outil natif.
Ne pas appliquer un réglage `accept` pour faire passer un test, extraire un
token privé, fermer une app, ou utiliser un second écrivain sur le transcript.

Un essai avec modèle/communication exige un accord humain distinct : conversation,
message unique, modèle et coût de quota annoncés. Pas d'appel de calibration ou
de message témoin caché dans les tests hors ligne. Aucune attente de réponse
d'Anthropic n'est un préalable pour poursuivre ce travail isolé.
