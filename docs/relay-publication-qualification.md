# Qualification de la publication d'un bilan Relay

État au 31 octobre 2026 : aperçu réel vérifié, publication réelle **non qualifiée**. Ce document complète le [contrat de publication](relay-publication-contract.md) ; il ne qualifie ni Mission, ni `--task review`, ni `--write`.

## Vérifications acquises

- Révision de code `06c3abf` : suite complète locale avant le dernier changement de lanceur, 1 337 tests réussis et 6 ignorés. Après réutilisation de `runExternalProcess`, 32 tests ciblés réussis, 1 ignoré, typage et build réussis. Profils fictifs et garde du vrai profil actifs.
- [CI de la PR #264](https://github.com/JuReyms/Palabre/pull/264) verte sur cette révision : suite complète sous Linux ; typage, tests du verrou POSIX et build sous macOS. Le passage macOS n'est pas un essai réel de publication GitHub.
- Aperçu réel du 31 octobre sous Windows, Node.js 24.19.0 et GitHub CLI 2.88.0, avec la commande compilée et un bilan fictif séparé. Lecture de la PR publique #264, du compte connecté, de la visibilité et de la tête `06c3abfc59d5377ee49a8b750b9ae6bf2a6040fa` réussie. Résultat `preview`, code 0, `publication: not-attempted`, `attempted: false`, corps et attribution exacts. Aucun POST ni reçu de publication créé par ce parcours.

L'aperçu ne démontre ni la confirmation clavier, ni les droits de commenter, ni la forme de l'accusé réel. Les erreurs réseau, la concurrence et les réservations incertaines sont couvertes avec des dépendances fictives ; ne pas provoquer une coupure réseau réelle pour les reproduire.

## Relecture indépendante et correction

Claude a relu le lot par Palabre Relay en arrière-plan, avec outils de lecture limités et sans modification ni test de son côté. Sa piste sur la confirmation a été reproduite par Codex avec le vrai `readline/promises` sur des streams fictifs : une fin d'entrée fermait l'interface sans régler la question ; Ctrl+C ne rendait pas le statut d'annulation attendu.

Le correctif relie fermeture, Ctrl+C et annulation externe au signal interne de l'invite. Les tests vérifient refus, Ctrl+C, Ctrl+D, EOF, signal pendant l'attente ou déjà annulé, et réponse affirmative, sans réseau ni confirmation humaine réelle. Claude a relu le helper corrigé, son appel et ce protocole ; aucun blocage relevé dans cette lecture statique ciblée. Il n'a pas relu la totalité des tests ni prouvé le comportement d'un terminal Windows réel.

Typage, build, validation du skill et génération documentaire réussis après correction. La suite complète locale compte 1 338 réussites, 6 ignorés et un échec : le test existant de shim PowerShell dans `cli-adapter.test.ts` dépasse son délai de 2 secondes sous charge. La reprise ciblée de ce fichier et des tests publication/skill/check réussit : 81 tests, aucun échec ; le shim termine en environ 476 ms. Aucun délai ni code d'adapter modifié pour obtenir ce résultat. Le garde du vrai profil confirme son intégrité aux deux passages. Ce n'est pas un passage complet local entièrement vert ; le résultat initial reste consigné.

La gestion conservatrice après réservation est maintenue et explicitée dans l'aide, les guides et le skill : pas de réouverture d'une demande sur la seule interprétation d'un message d'erreur HTTP. La comparaison exacte de la casse du lien peut aussi refuser un lien non canonique ; elle n'est pas assouplie dans ce correctif.

## Préparer les essais humains

L'humain désigne une issue et une PR jetables, et autorise explicitement les deux commentaires de qualification. Une issue de travail n'est pas une cible de test implicite. Aucun changement de politique, connexion, profil ou configuration n'est nécessaire ; les droits GitHub existants s'appliquent. L'agent prépare les fichiers et aperçus, mais ne confirme jamais au clavier et n'efface aucun reçu.

Depuis le checkout compilé, préparer un fichier séparé `bilan-qualification.md` avec ce seul contenu public :

```markdown
Essai de publication d'un bilan Relay choisi.

Contribution de Codex : préparation du bilan fictif.

Ce commentaire sert à la qualification. Il ne certifie aucune revue de code.
```

Remplacer `<cible-jetable>` par le lien exact désigné par l'humain :

```powershell
node dist/index.js relay publish --to <cible-jetable> --from codex --participant Codex --message-file bilan-qualification.md --dry-run --json
```

Lire `preview` : destination, compte, visibilité et corps entier. L'agent présente ensuite la commande suivante dans le terminal visible de l'humain :

```powershell
node dist/index.js relay publish --to <cible-jetable> --from codex --participant Codex --message-file bilan-qualification.md --json
```

L'humain lit à nouveau l'aperçu puis choisit lui-même sa réponse. Ne jamais injecter une réponse avec un pipe, un pseudo-terminal caché ou un outil d'automatisation. Conserver les reçus et commentaires, sans nettoyage automatique.

## Scénarios minimaux à compléter

| Scénario | Action humaine | Résultat et preuve attendus |
| --- | --- | --- |
| Refus | Répondre non au premier aperçu interactif | `declined`, code 8, `attempted: false` ; aucun nouveau commentaire ni réservation. |
| Fin d'entrée | À des aperçus frais, utiliser Ctrl+C, puis Ctrl+D ou fermer l'entrée | Ctrl+C : `cancelled`/130 ; Ctrl+D ou EOF : `declined`/8. JSON complet, `attempted: false`, aucun nouveau commentaire ni réservation. |
| Source modifiée | Après affichage de l'aperçu et avant toute réponse, modifier le bilan choisi puis confirmer | `changed`, code 2, `attempted: false` ; aucun nouveau commentaire. Repréparer et relire le bilan avant un autre essai explicite. |
| Issue | Confirmer le bilan relu sur l'issue jetable | `published`, code 0, `attempted: true`, reçu sauvegardé et URL du commentaire ; comparer le compte et le corps directement dans GitHub. |
| Même demande | Après le succès, relancer la commande identique sur cette issue, depuis le même profil et terminal visible | `already-published`, `attempted: false`, même URL ; aucun second commentaire. Le reçu reste conservé. |
| PR | Confirmer le bilan relu sur la PR jetable | Même vérification du succès et du compte ; commentaire de conversation, aucune revue inline, aucun changement d'état de la PR. |

Pour qualifier `--commit`, l'ajouter à l'essai PR avec les 40 caractères de sa tête relevée explicitement. Ce marqueur ne certifie pas que le code a été relu. Une tête différente doit refuser sans publication ; ne pas pousser un commit de test sur une PR de travail pour provoquer cette dérive.

Pour la fin d'entrée, noter le geste réellement utilisé et le terminal testé. Le scénario sur streams fictifs ne qualifie pas les raccourcis clavier ni ConPTY sous Windows.

Si une cible privée jetable est disponible et désignée, vérifier au minimum son aperçu privé. L'aperçu public acquis ne qualifie pas une publication privée ni la visibilité `internal`, qui reste refusée. Ne pas changer la visibilité d'un dépôt pour un test.

## Arrêt et preuves à conserver

En cas d'issue `uncertain`, de réservation préexistante ou de trace illisible : arrêter, lire GitHub et la trace locale, ne pas renvoyer. Ne jamais supprimer, déplacer, réécrire le reçu, changer de profil, de signature ou de corps pour contourner le blocage. Un accusé confirmé suivi d'un échec de trace garde son URL ; ne pas republier.

Ajouter ici, après chaque essai admis : date, révision, plateforme, versions, scénario, statut/code, vérification indépendante du commentaire et limites. Les preuves publiques se limitent au bilan choisi et aux liens autorisés ; aucun transcript, identifiant de conversation, nonce, chemin personnel ou jeton. Conserver les détails diagnostiques nécessaires localement.

Ces essais restent à exécuter avec l'humain avant de qualifier la publication réelle. Ils ne remplacent pas les contrôles de release décrits dans [la maintenance](dev/maintenance.md).
