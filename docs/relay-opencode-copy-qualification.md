# Qualification du pilote Relay OpenCode CLI sur copie

19 octobre 2026 — Codex MSI — #136. Branche `codex/opencode-relay-copy`.

## Résultat et portée

**Un envoi réel de la commande produit a réussi**, sur la source fictive créée
et fermée par le propriétaire dans le laboratoire de recherche. Une nouvelle
copie a reçu le message ; aucun prompt n'a été envoyé à l'original. Le résultat
JSON donne `replied`/0, `delivery.status: replied`, `persisted: true`,
`identity: same-as-target`, `copy.verified: true`, `sourceCheck: unchanged` et
`serverStop: confirmed`. L'export `.relay.md` existe dans le worktree produit.

OpenCode Windows `@opencode/cli` 2.0.32 ; binaire SHA-256 :
`045c13859180608981b87abb901a31f9fb0d1845e1c40f273f8d421a16182903`.
Le lanceur npm habituel a été résolu sans shell vers ce binaire natif, sans
modifier le PATH ou la configuration. La configuration Palabre existante était
déjà approuvée ; aucun `--trust-config` ni ajout au registre pour cet essai.

Le modèle observé est `opencode/deepseek-v4.1-flash-free#high`, identique à la
sélection source, avec l'agent `build`. Pas d'override ni de repli de modèle.
Durée rapportée : environ 15,4 s, relevés et arrêt compris. Source, copie et
export restent locaux ; aucun identifiant réel, code de contexte, mot de passe
ou journal de compte n'est publié ici.

## Parcours réellement exécuté

La commande compilée a reçu source, dossier, fichier de message, objet,
expéditeur déclaré `codex-msi`, délai de 180 s et chemin de configuration
explicites. Elle a démarré son serveur stdio privé avec le profil habituel,
comparé les relevés source, vérifié le fork, envoyé une enveloppe neuve par
stdin dans la copie et contrôlé le flux client ainsi que le nouveau contexte.
Elle a revérifié la source, arrêté son serveur et écrit l'export.

Les informations, export API, contexte, inbox et instructions API source sont
identiques au dernier contrôle. Les quatre fichiers témoins du laboratoire
restent identiques à leur relevé initial après l'essai ; ce contrôle ne couvre
pas tous les fichiers nouveaux, métadonnées Git ou effets d'intégrations.

Deux refus ont précédé cet envoi : découpage de l'argument texte par PowerShell,
puis libellé de version réel `opencode v2.0.32`, alors que le lecteur attendait
`2.0.32` nu. Tous deux sont `not-delivered`, sans serveur, fork ou modèle. Le
message a ensuite été fourni par fichier et les deux libellés exacts de version
ont été couverts par les tests. **Un seul `run` réel a été admis**, sans renvoi
après admission et sans replay pour refaire ce bilan.

## La réponse est reçue, pas automatiquement juste

La copie restitue le code de contexte sans qu'il soit fourni dans la question,
identifie correctement la remise soustraite comme montant plutôt que comme
pourcentage et propose les tests manquants. L'exemple principal est correct :
`total(100, 2, 10)` donne 190 avec le défaut, au lieu de 180 attendus.

Un exemple secondaire est faux : la réponse annonce 26 pour
`total(12, 3, 100)`, alors que la fonction donne **-64** et devrait donner 0.
L'avis ne doit donc pas être annoncé entièrement vérifié. Le succès du transport
ne note ni la justesse de chaque calcul, ni la réussite de la tâche, ni l'absence
d'effets externes.

## Vérifications hors modèle

- `pnpm check`, `pnpm build` et `pnpm validate:skill` réussissent.
- Après les corrections de revue, toutes les suites ont été exécutées par
  groupes de quatre via le lanceur officiel `scripts/test.mjs` : 860 tests,
  856 réussis et 4 ignorés. Le garde-profil confirme le vrai `~/.palabre` inchangé
  à chaque groupe. Après le dernier test export/`--no-export` et les libellés de
  rétention, passage ciblé OpenCode/résolution/commande Relay : 91 tests,
  90 réussis et 1 ignoré ; les 5 tests d'exports généraux passent également.
- Le lancement simultané `pnpm test` a révélé un test Windows préexistant avec
  une échéance de 200 ms (`aucun kill après une terminaison normale`) : il expire
  sous charge, puis passe en sélection ciblée et dans le passage par groupes.
  Une première suite avait aussi dépassé un délai PowerShell de 2 s, passé aux
  passages suivants. Ces délais et le lanceur n'ont pas été modifiés ici.
- Un premier lancement ciblé dans le bac à sable a reçu des notifications du
  garde-profil Windows malgré des empreintes identiques ; il n'a pas été accepté
  comme passage vert. Les passages hors bac à sable via le même garde-fou
  réussissent. Aucun garde-fou désactivé et aucune restauration du profil.
- Relecture indépendante : contradictions du flux client, arrêt serveur
  idempotent et test du registre corrigés ; contrôles des corrections sans
  nouvel appel modèle. La résolution npm native est opt-in OpenCode `--copy`
  seulement ; les reprises Codex/Claude gardent leur politique existante.

## Correctif après le premier passage CI

La première CI Linux de la PR #178 a révélé un défaut distinct des délais
Windows : quand le serveur dépasse son plafond de sortie pendant des requêtes
API, son arrêt coupe leurs sockets. L'erreur HTTP secondaire masquait alors
la cause connue `server-output-limit` et rendait `cli-failure` au lieu de
`output-too-large`.

Un scénario fictif déclenche désormais la rafale après la première requête API :
il reproduit l'échec avant correction également sous Windows. Les handlers
d'erreur HTTP conservent maintenant la cause serveur déjà connue ; sans cause
connue, une coupure API reste une erreur de transport générique. Le contrôleur
garde la priorité de l'annulation/échéance et ses preuves de délivrance.
Les 20 tests ciblés OpenCode passent après cette première correction, avec le garde-profil
inchangé. Aucun plafond, délai, droit ou règle de retry modifié ; aucun nouvel
appel OpenCode réel ou modèle pour ce correctif.

Le passage CI suivant confirme la correction HTTP mais révèle une seconde
course : le serveur peut finir le tour avant que son dépassement de sortie soit
observé. Le drainage lors de l'arrêt connaissait cette cause, mais ne rendait
qu'un booléen de fermeture et laissait donc le statut global à `replied`.
Un autre scénario fictif n'émet la rafale qu'à la fermeture de stdin ; il
reproduit le faux succès avant correction également sous Windows.

Le contrat d'arrêt rend désormais séparément la fermeture confirmée et la cause
connue après drainage des flux. Une fermeture demandée normale n'est pas un
échec ; une cause tardive interdit le succès global, sans effacer la réponse
validée ou sa délivrance. Refus, annulation, délai et plafond déjà établi gardent
leur priorité. Une sortie inattendue est mémorisée dès `exit`, sans figer une
cause générique avant les derniers chunks ; elle reste un échec si `stop`
intervient avant `close`. Les tests de ce cycle de vie pilotent les événements
sans processus réel. Aucun nouvel appel OpenCode ni augmentation des limites.
Les 27 tests OpenCode passent après ce second correctif, ainsi que le typage,
le build et la validation du skill. La relecture indépendante confirme les
priorités et les ordres d'événements ; le garde-profil reste inchangé.

## Limites conservées

Cette preuve concerne cette CLI, cette version Windows et ce contexte textuel
simple. Ni Desktop, conversation concurrente, compaction, tous les contenus
multimodaux, tous les MCP/plugins ni les erreurs réelles de quota ne sont
qualifiés. Les tests ordinaires couvrent plusieurs échecs avec des transports
fictifs ; cela ne les transforme pas en essais réels du fournisseur.

Le fork copie la conversation, pas les fichiers. Les permissions habituelles
restent celles choisies par l'utilisateur ; aucune lecture seule imposée ni
neutralisation générale. Les relevés ne sont pas un verrou global. Pas de
retry, suppression automatique, changement de modèle ou extrapolation à Claude
Code. Mission, review et `--write` restent gelés ; #136 n'est pas résolue par ce
seul lot CLI. Les copies installées du skill nécessitent une mise à jour manuelle.
