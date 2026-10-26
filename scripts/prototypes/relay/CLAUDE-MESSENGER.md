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

## Prochaine qualification, séparée

Avant un essai de messagerie réelle : qualifier les pannes et timeouts avec le
faux outil, établir le schéma natif et l'adresse exacte d'une conversation jetable
désignée par l'humain, puis démontrer les refus applicables à cet outil natif.
Ne pas appliquer un réglage `accept` pour faire passer un test, extraire un
token privé, fermer une app, ou utiliser un second écrivain sur le transcript.

Un essai avec modèle/communication exige un accord humain distinct : conversation,
message unique, modèle et coût de quota annoncés. Pas d'appel de calibration ou
de message témoin caché dans les tests hors ligne. Aucune attente de réponse
d'Anthropic n'est un préalable pour poursuivre ce travail isolé.
