# Relay Codex : ouverture et échange — essai Windows du 23 octobre 2026

## Résultat

Deux conversations existantes, locales et explicitement choisies par le propriétaire
se sont affichées après `palabre relay open`. L'application Codex était déjà ouverte ;
elle n'a pas été quittée. Chaque demande a produit un seul lancement, sans message.

Un échange distinct Codex → Codex a ensuite réussi dans la même application avec
`palabre relay --open`. Le propriétaire a confirmé le marqueur de réponse dans la
cible, tout en restant dans la conversation d'origine pendant l'appel. Un envoi
n'impose donc pas un changement d'écran dans ce scénario ; ouvrir reste une action
séparée, sur demande humaine.

## Preuves et limites

| Essai | Résultat technique | Observation du propriétaire |
| --- | --- | --- |
| Ouverture A | `launcher.attempted: true`, `launcher.exitCode: 1`, `status: cli-failure`, `reason: launcher-failed`, `attachment: unknown`, `messageSent: false` ; 453 ms | Bonne conversation affichée, mais pas tout en bas ; retour volontaire à la conversation d'origine |
| Ouverture B | Même résultat et même code Explorer ; 344 ms, aucun message | Bonne conversation affichée ; confirmation à la question sur l'affichage et le bas de l'historique |
| Échange séparé | Précontrôle `checked`, `mode: open`, cible ouverte ; un seul dépôt accepté, `replied`/0, `persisted: true`, `same-as-target`, `correlated-final` ; 12 069 ms | Marqueur reçu à l'identique et visible dans la cible ; aucun basculement de conversation pendant l'envoi |

La version exécutée était le développement de Palabre 0.20.0 de la PR #226,
commit `db59af879ca3caa06f07931bd70f0b6e5c4cc395`, avant le correctif Explorer.
La version de l'application Codex et celle de la CLI configurée n'ont pas été
relevées pour ces essais ; ne pas extrapoler à toutes les versions.

Les identifiants, titres, chemins et exports des conversations restent locaux.
Le rapport d'échange et son export Markdown ont été lus, sans renvoi du message.
L'envoi demandait uniquement un marqueur, sans outils ni modification de fichiers.
Les permissions du tour sont restées celles de la cible ; aucune lecture seule
technique n'est déduite de cette consigne. `receiver: unverified` et
`delivery.inActiveBranch: unknown` restent les limites du rapport technique ;
la confirmation visuelle vient du propriétaire, pas du verrou.

## Correctif et vérification restante

La première implémentation traitait tout code non nul du lanceur comme un échec,
avant la sonde après lancement. Ces essais montrent que le code 1 d'Explorer
peut accompagner une ouverture effective sur la machine testée.

Le correctif conserve ce code et donne au lanceur `status: unverified` dans ce
seul cas Windows. Il poursuit l'observation du verrou, sans second lancement.
Un verrou tenu donne `attached`, jamais « fenêtre affichée » ; un verrou libre
ou inconnu garde son refus. Les autres codes, plateformes, erreurs, délais et
annulations restent inchangés. Aucun envoi n'est ajouté à la commande d'ouverture.

Le correctif est couvert par des tests simulés, sans application ni modèle réel.
Il n'a pas encore été rejoué sur une vraie cible : le résultat corrigé de bout
en bout reste à qualifier avant publication. macOS et Linux ne sont pas qualifiés
par ces essais Windows. La position de défilement n'est ni pilotée ni garantie.
Aucun de ces résultats ne qualifie le transport vers Claude ouverte (#193).
