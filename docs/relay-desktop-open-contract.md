# Contrat `palabre relay open` — lot Codex de #219

Une ouverture sur demande humaine directe, phrase ou bouton de l'hôte. Un message
d'agent ne vaut jamais accord ; le succès de la commande ne peut pas l'authentifier.

```powershell
palabre relay open --to codex:<uuid> --json
```

Seulement `--to`, `--config`, `--language`/`--lang`, `--json`, chacun une fois.
Pas de message, reprise implicite, `--new`, `--open`, `--trust-config`, réglage,
export, envoi chaîné ou suivi. Claude/OpenCode sont refusés. Le dépannage Claude
de #225 reste séparé : #193 n'est pas livré ici.

## Déroulé et limites

1. Analyse stricte des arguments/UUID, puis validation commune `relay --check --open` :
   configuration déjà approuvée, agent Codex, exécutable compatible, localisation
   bornée et sonde. Accepter seulement `checked` ou `target-not-open` ; conserver
   les autres refus. Aucun processus Codex, modèle ni liste MCP ; le verrou POSIX
   peut lancer `python3`.
2. Retrouver le dossier par la même localisation bornée, sans l'inventer.
3. Lancer une seule fois le lien construit depuis l'UUID : Explorer natif sous
   Windows, `/usr/bin/open` sur macOS, `xdg-open` sur Linux. Arguments structurés,
   sans shell, stdin/flux ignorés. Aucune donnée libre envoyée au lanceur.
4. Après succès du lanceur, sonder immédiatement puis toutes les 500 ms au plus,
   sous budget coopératif de 15 s incluant validation et lancement. Vérifier annulation
   et délai après chaque IO avant d'accepter un verrou tardif. Validation, localisation,
   lectures et sondes peuvent retarder le retour et Ctrl+C : ce n'est pas une borne
   murale stricte. Aucun lancement ni succès accepté après le budget.
5. Rendre lancement et verrou séparément, jamais une preuve de fenêtre visible.

Une conversation peut être déjà tenue : `attached` ne prouve ni que l'ouverture
a créé cet attachement, ni quelle surface le possède, ni la visibilité de la cible.
À échéance/annulation du lanceur, détacher sans tuer : Desktop peut être son
descendant. Une ouverture déjà lancée peut aboutir plus tard. Aucun retrait promis,
kill d'app, modification de verrou, retry ou repli vers un envoi en arrière-plan.
Le lanceur est créé dans un groupe isolé (`detached: true`, flux ignorés), pour ne
pas recevoir le Ctrl+C du terminal appelant sous POSIX ; `unref` seul ne suffit pas.

## JSON v1 distinct

`type: relay-open-result` évite de confondre ouverture et échange.

| Champ | Signification |
| --- | --- |
| `status`, `exitCode` | Issue d'ouverture/observation, pas une réponse d'agent |
| `to` | Référence exacte validée, ou null avant validation |
| `launcher` | `attempted`, `status`, `exitCode?` ; succès distinct de l'affichage |
| `attachment` | `attached`, `detached`, `unknown`, dernière sonde terminée |
| `reason` | Validation, verrou tenu, délai, sonde inconnue, lanceur, annulation |
| `display` | Toujours `unverified` |
| `messageSent` | Toujours false |
| `error`, `durationMs` | Diagnostic/durée, jamais sortie brute du lanceur |

Ni `reply`, `delivery`, `mode`, `targetPermissions` ni `exportPath` : aucun tour
envoyé. Le JSON d'échange `relay-result` reste inchangé. Une intégration ne traite
pas un type/statut inconnu comme une réponse reçue.

Codes : 0 `attached` ; 3 `target-not-open` à l'échéance après sondes libres ou
`target-state-unknown` ; 4 `timeout` pendant validation/lancement/sonde ;
7 `command-not-found` (lanceur) ; 2 `cli-failure` (lanceur) ; 130 `cancelled`.
Les refus de validation gardent leur statut, code et motif.

Après succès, l'envoi exige une tâche autorisée. Vérifier `relay --check --open`,
puis envoyer avec `--open` explicite pour refuser une cible relâchée entre-temps.
Ouvrir ne change ni les permissions de création (`--new` reste en lecture seule)
ni `relay.view`. Aucun bouton natif Palabre ajouté : l'hôte fournit sa présentation.

## Qualification

Tests simulés/profils fictifs via `scripts/test.mjs`. La nouvelle commande doit
encore être essayée sur une conversation Codex précise choisie par le propriétaire
sous Windows avant publication. Les essais antérieurs du lien système ne
qualifient pas seuls ce parcours. macOS/Linux restent non vérifiés. Aucun modèle
n'est nécessaire pour tester une ouverture.
