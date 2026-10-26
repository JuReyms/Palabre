# Claude messager — prototype hors ligne #193

État du 27 octobre 2026 : banc de garde seulement. Aucun envoi, SDK installé,
processus Claude, ouverture Desktop, lecture de token ou mutation de configuration.
Ce n'est pas un nouveau transport de `palabre relay` et rien n'est ajouté au paquet livré.
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
Ils entrent aussi dans `pnpm test` et son isolation habituelle. Aucun dépendance ajoutée.
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

## Prochaine qualification, séparée

Avant un essai réel : relier un callback à la version choisie du SDK, établir
le schéma natif et l'adresse exacte d'une conversation jetable désignée par
l'humain, puis démontrer que les refus et pannes bloquent réellement l'outil.
Ne pas appliquer un réglage `accept` pour faire passer un test, extraire un
token privé, fermer une app, ou utiliser un second écrivain sur le transcript.

Un essai avec modèle/communication exige un accord humain distinct : conversation,
message unique, modèle et coût de quota annoncés. Pas d'appel de calibration ou
de message témoin caché dans les tests hors ligne. Aucune attente de réponse
d'Anthropic n'est un préalable pour poursuivre ce travail isolé.
