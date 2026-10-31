# Relay : publier un bilan choisi

Lot distinct du contexte de travail et des fonctions Mission, `--task review` et `--write` gelées. Il publie un seul commentaire de conversation sur une issue ou PR GitHub existante. Ni création, fermeture, modification d’état, revue inline, ni agent lancé.

## Parcours et autorité

Le chef de mission choisit un bilan utile, attribue les contributions et prépare un fichier séparé. Il peut afficher l’aperçu avec `palabre relay publish --dry-run`. Pour publier, l’humain lance la commande dans un terminal visible, lit compte, destination, visibilité et corps exact, puis confirme au clavier. Une fin d’entrée ou Ctrl+D refuse ; Ctrl+C ou un signal d’annulation rend `cancelled`/130. Ces sorties à l’invite ne créent aucune réservation. L’agent ne confirme jamais à sa place, y compris avec un terminal caché.

Cette première version n’ajoute aucune politique globale et ne réutilise pas `relay.allowedTasks` ou `relay.reviewRepositories`. Pas de `--yes`, `--trust-config`, `--config`, accord transmis par un autre agent ou approbation déduite d’un commentaire. Une intention de publier dans la conversation n’est pas assimilée à la confirmation clavier. Le contrôle TTY reste un contrôle opérateur, pas une authentification contre un processus disposant déjà des droits de l’utilisateur.

`--from` est un nom d’agent déclaré, jamais une référence de conversation ; `--participant` le nomme pour ce travail (alias utilisé par défaut). La signature ne certifie ni auteur humain, modèle, permissions, vérifications ni réussite de la tâche. Le compte qui publie vient de GitHub, pas du nom déclaré.

## Entrées et aperçu

```powershell
palabre relay publish --to https://github.com/owner/repo/pull/42 --from codex --participant Atlas --message-file bilan.md --dry-run --json
```

Pour l’envoi, retirer `--dry-run`, puis confirmer dans le terminal visible. `--commit <sha40>` est facultatif sur PR seulement : le SHA doit correspondre à sa tête lors de l’aperçu et de la revérification. Sans cette option, le corps n’affirme pas avoir examiné le commit courant ; la tête est néanmoins contrôlée contre une dérive.

- Lien HTTPS github.com d’issue ou PR exact, validé avec le parseur du contexte de travail ; pas de dépôt seul, query, fragment, credentials ou cible déduite d’un remote.
- Fichier UTF-8 strict, régulier sans lien, borné à 60 Kio. Les changements pendant lecture et les contrôles/caractères invisibles sont refusés. CRLF devient LF avant aperçu et POST ; le reste du corps est préservé. L’attribution laisse une marge sous 64 Kio pour le corps final.
- Les fichiers `.relay.md`, `.handoff.md`, `.ask.md`, `.debate.md` et `.chat.md` sont refusés : préparer un bilan séparé, sans extraction automatique d’historique. Ce refus n’est pas un détecteur universel de secrets ; le commentaire exact doit être relu avant publication.
- Les détails distants ne deviennent pas des consignes. Dépôt non archivé, cible non verrouillée, type/URL/numéro/dépôt cohérents et compte reconnu requis. Une cible fermée ou une PR fusionnée peut recevoir un bilan si elle reste commentable ; aucun changement d’état.

L’aperçu lit le dépôt, le compte authentifié et la cible via `gh api` ; il n’écrit rien, ne lance aucun agent et n’exige aucune configuration Palabre. Sans terminal visible, un appel d’envoi est refusé avant ces lectures. Les jetons GitHub restent gérés par `gh`, sans lecture ou copie dans les traces Palabre. Le support est celui de la connexion utilisateur de `gh`, pas un nouveau bot/app installé. Visibilité `public`/`private` cohérente requise ; les visibilités inconnues ou `internal`, non qualifiées ici, sont refusées.

## Exécution et trace

Après confirmation, relire compte, identifiants GitHub immuables (`repository.id`, cible `id`, compte `id`), visibilité, état, tête de PR et contenu source. Toute dérive refuse avant POST ; les contrôles et le POST ne sont pas atomiques avec GitHub. Les permissions du serveur restent applicables. Un accord de terminal n’étend pas les droits.

Réservation exclusive `wx`/0600, synchronisée sur disque avant POST, sous `~/.palabre/relay-publications/<digest>.json`. Le digest lie destination, identifiants immuables, compte et corps final. La trace v1 conserve le bilan choisi et ses empreintes ; elle n’ajoute automatiquement ni transcript fournisseur, nonce ni chemin source. Dossier 0700 lorsque pris en charge. Lecture bornée à 256 Kio, suffisante pour l’échappement JSON du corps maximal.

Un seul appel de publication `gh api repos/<repo>/issues/<numéro>/comments --method POST --input -`, par le lanceur commun sans shell, données sur stdin, plafond stdout+stderr cumulé de 256 Kio, délai de 60 secondes et nettoyage borné à une seconde, avec annulation. Aucun retry applicatif. L’accusé exige un ID entier positif sûr, l’URL exacte `#issuecomment-ID`, l’issue API exacte, le corps exact, le compte et son ID. Une réponse vide, étrangère, partielle, erreur ou timeout après appel reste inconnue : aucun renvoi.

La trace finale remplace atomiquement la réservation seulement si elle est encore intacte. Une interruption conserve `reserved` ; deux appels concurrents ne peuvent réserver la même demande. Une réservation incertaine ou corrompue bloque le rejeu. Ne pas l’effacer, la déplacer, changer de profil ou altérer le bilan pour contourner ce refus. Une trace locale `published` valide permet de restituer le lien sans nouvel envoi, sans promettre que le commentaire existe encore actuellement.

Limite volontaire de cette première version : après réservation, un refus HTTP ou un processus non démarré reste bloquant, car le transport ne qualifie pas les refus distants comme une preuve réutilisable d’absence de publication. Une annulation entre réservation et appel peut rendre `cancelled`/130 et `attempted: false` tout en conservant cette réservation ; l’appel suivant rend alors `uncertain` sans envoi. L’absence de tentative dans l’appel courant n’autorise pas à effacer la trace. Il n’existe pas encore de commande de résolution de ces réservations : vérifier les éléments avec le mainteneur, conserver la trace et arrêter, sans modifier le bilan pour rejouer.

Un accusé confirmé reste prioritaire sur une annulation ou une erreur ultérieure de trace : URL et succès de publication conservés, avertissement de trace si nécessaire. L’annulation avant appel rend `not-attempted` ; pendant appel, elle laisse `unknown` sauf accusé confirmé. Aucun retrait du commentaire promis. Le garde-fou est local au profil et à la demande exacte, pas une garantie universelle d’effet exactement une fois.

## JSON, sortie humaine et vérification

JSON distinct v1 `type: relay-publication-result` : `status`, `exitCode`, `publication` (`not-attempted|published|unknown`), `attempted` pour cet appel seulement, `preview?` avec corps final/empreinte/compte/destination/visibilité/attribution/commit fourni, `commentUrl?`, `receipt?`, `cancelled?`, `error`. Aucun champ de délivrance ou de résultat de tâche.

Codes : 0 aperçu ou publication confirmée/historique ; 8 arguments, absence de confirmation ou refus humain ; 2 cible/source modifiée, indisponibilité, trace impossible ou issue incertaine ; 130 annulation avant appel. Aperçu et confirmation d’envoi sur stderr, JSON unique sur stdout. Le mode texte d’aperçu rend le corps exact sur stdout ; tous les textes humains sont assainis.

Tests via `scripts/test.mjs` sur profils et API fictifs : absence d’écriture en aperçu, identité/dérives, accord/refus/TTY, POST unique, accusés contradictoires, concurrence, crash simulé, trace volumineuse/corrompue/modifiée, annulation et succès conservé. Aucune publication réelle pour ces tests. Une qualification réelle sur une cible jetable désignée exige un accord humain distinct avant release ; ne jamais tester en créant un commentaire sur une issue de travail par défaut. Le [bilan et protocole de qualification](relay-publication-qualification.md) sépare les preuves acquises des essais humains restant à exécuter.

Sources du contrat distant : [commentaires de conversation](https://docs.github.com/en/rest/issues/comments#create-an-issue-comment), [issues](https://docs.github.com/en/rest/issues/issues#get-an-issue), [PR](https://docs.github.com/en/rest/pulls/pulls#get-a-pull-request). Les comportements des versions externes restent à qualifier.
