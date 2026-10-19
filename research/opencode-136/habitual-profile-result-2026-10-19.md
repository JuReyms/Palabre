# Premier avis réel sur copie avec le profil OpenCode habituel

19 octobre 2026 — Codex MSI.

**Essai réussi sur le scénario fictif préparé.** La copie retrouve le contexte,
lit les trois fichiers demandés et fournit un avis correct. Les relevés de la
source et les fichiers du laboratoire restent inchangés. Ce résultat débloque la
préparation du contrat d'adapter CLI sous le cadrage « environnement habituel ».

## Périmètre

OpenCode Windows `@opencode/cli` **2.0.32**, binaire SHA-256
`045c13859180608981b87abb901a31f9fb0d1845e1c40f273f8d421a16182903`.
Le propriétaire a lui-même créé le tour source, attendu `ACK`, exporté la
conversation en Markdown puis fermé la session. Son premier export désignait
un autre dossier ; il a recréé la source dans le laboratoire avant toute copie.

La source réelle a été retrouvée par l'identifiant exact de ce second export,
puis vérifiée par l'API : dossier fictif exact, un seul message utilisateur
contenant le code préparé, réponse `ACK` terminée, fin de tour réussie et inbox
vide. Aucune sélection de « la dernière conversation » et aucun import d'export.

Le lanceur de recherche `scripts/habitual-copy.mjs` a utilisé le binaire natif,
sans shell, dans le dossier fictif. Le serveur privé utilise la configuration et
la connexion habituelles. Seuls le mot de passe éphémère de ce serveur et le
dossier courant sont fournis au lancement ; aucune politique de neutralisation
ni modification des permissions n'est demandée. Agent **`build`**, modèle
**`opencode/deepseek-v4.1-flash-free`**, variante **`high`**, hérités de la source.

## Contrôles et résultats

| Critère | Observation |
| --- | --- |
| Source stable avant envoi | Deux relevés identiques avant fork et un troisième après fork |
| Provenance de copie | `fork.sessionID` correspond à la source |
| Contexte immédiatement copié | Identique après retrait des seuls identifiants de message réattribués |
| Agent, modèle, permissions et instructions API | Identiques dans la copie avant le prompt ; vérifiés dans les traces après le tour |
| Nombre d'envois de consultation | Un lancement `run`, un seul nouveau message utilisateur au corps exact |
| Modèle observé | Même fournisseur, modèle et variante dans les deux messages assistant du tour |
| Code de contexte | Restitué exactement, sans le réintroduire dans le prompt d'avis |
| Outils du tour | Trois `read` terminés, visant README, implémentation et test du seul projet fictif |
| Fin du tour | Dernier assistant textuel non vide, `finish: stop`, date de fin, puis `idle: succeeded` |
| CLI | Code 0, sans timeout ni dépassement de sortie |
| Source après appel | Informations, export, contexte, inbox et instructions API identiques au relevé initial |
| Projet fictif | Quatre fichiers témoins inchangés ; inventaire et empreintes hors `.git` identiques |
| Serveur privé | Arrêt normal par fermeture de son entrée standard, code 0 |
| Rétention | Source et copie conservées ; aucune suppression automatique |

Les coûts rapportés dans les informations de la copie valent zéro. C'est une
observation de ce passage, pas une garantie tarifaire pour une requête future.
Les identifiants et traces brutes restent locaux sous
`.local/habitual-copy-KhyyxS/`, ignoré par Git.

## Avis vérifié après lecture des traces

L'avis identifie bien une remise soustraite comme montant fixe alors que le
README exige un pourcentage. Il donne la formule attendue et l'exemple
`total(12, 3, 10)` : **32,40 attendus, 26 calculés**. Les tests proposés couvrent
la remise partielle et les limites 100 %/quantité nulle.

Une vérification locale indépendante de l'implémentation et de l'arithmétique
confirme ces valeurs ; la fonction renvoie aussi `-64` à 100 % et `-10` pour une
quantité nulle avec 10 % de remise. Les trois lectures réussies sont établies par
les événements d'outils, pas uniquement par la déclaration finale du modèle.

## Vérifications hors modèle et limites

Quatre tests de corrélation sur données fictives réussissent : identifiant exact,
source admissible, corps intégral, concurrence, limites de longueur, réponse
partielle et erreurs d'outil. Les traces du passage réel sont également relues
hors ligne avec le contrôleur de réponse ; aucun prompt n'est rejoué pour cette
vérification.

Une revue indépendante par un autre agent a relu le lanceur, ses tests et les
traces de ce passage, sans nouvel appel réel : aucun problème bloquant relevé.

Ce passage ne qualifie pas Desktop, une conversation occupée ou modifiée par un
autre client, la compaction, tous les contenus multimodaux, les erreurs réelles
de quota, l'écriture ou toutes les intégrations possibles. L'état actif de l'API
est local au serveur ; le contrôle de source n'est pas un verrou atomique global.
Le fonctionnement des permissions est celui de l'environnement habituel, sans
garantie de lecture seule imposée. Le relevé de fichiers ne couvre pas les
métadonnées Git ni tous les effets possibles de plugins ou de services externes.

## Prochaine étape

Préparer un adapter de session externe côté CLI sur une branche produit distincte
depuis `main` à jour : source explicite, fork contrôlé, permissions habituelles,
modèle conservé sauf choix explicite, réponse attribuable et délivrance conservée
en échec, rétention annoncée. Les tests ordinaires utilisent de faux transports.
Le traitement des erreurs et la rétention demandent encore un contrat produit ;
Desktop reste nécessaire pour achever #136. Claude Code n'a pas été modifié.
