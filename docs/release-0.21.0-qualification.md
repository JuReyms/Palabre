# Préparation de Palabre 0.21.0

Bilan du 28 octobre 2026. Ce document accompagne la PR de version ; il ne prouve ni publication du paquet ni déploiement du site. La date du changelog est celle proposée pour cette préparation et devra être ajustée si la publication est différée.

## Périmètre

Version mineure : nouvelles commandes et métadonnées Relay compatibles avec le contrat v1, corrections et documentation. Le CLI reste la source de vérité. Les PR de recherche non fusionnées ne font pas partie de cette version. Mission, review et write restent gelés.

Base de préparation : `cf74012`, après [#244](https://github.com/JuReyms/Palabre/pull/244). Les contrôles de types, tests et build de #244, ainsi que son job de CI macOS, ont réussi sur `b03cf41`, dont le code a été intégré en squash. La PR de version modifie les métadonnées et la documentation ; son état final et son paquet sont vérifiés séparément.

Contrôles locaux de la préparation 0.21.0 : types, build, skill et guides réussis ; 1 227 tests réussis, 5 ignorés, aucun échec, et 8 tests supplémentaires des scripts de métadonnées/social réussis, avec profil personnel inchangé. Métadonnées `v0.21.0` cohérentes et changelogs FR/EN générés. Tarball local vérifié (148 entrées, version et aide accessibles, absence de profils, historiques et fichiers temporaires). Après relecture Claude Opus 5.5 via Palabre Relay, retouches documentaires vérifiées par 10 tests ciblés réussis et nouvelle génération du changelog. Ces contrôles ne lancent aucun modèle et ne publient rien. La CI du commit final reste à vérifier avant fusion.

## Essais réels déjà effectués

Tous les essais ci-dessous ont été autorisés par le mainteneur. Ils consomment les quotas et connexions des outils choisis ; les historiques et traces privées restent locaux.

| Code testé | Essai du 28 octobre | Résultat et portée |
| --- | --- | --- |
| `9e4db2a` | Presets, `--mode both --turns 2`, synthèses actives | 20 scénarios réussis : dix paires CLI en Débat et Ask. Les vingt exports ont été lus. |
| `9e4db2a` | Premier smoke Relay | 14/22 : quota Codex atteint et démarrage TUI gêné par `TERM=dumb`. Ce n'est pas une qualification réussie. Aucun message incertain n'a été renvoyé. |
| `9e4db2a` | Nouveau smoke Relay après retour du quota | 22/22, nouvelles conversations jetables, `TERM=xterm-256color` limité au processus. Réponse, contexte, identité, refus des conversations attachées et contrôles MCP selon les critères du script. Les deux exports de réponse ont été lus. |
| `b03cf41` | Antigravity après correction JSON | Un Ask puis sa synthèse, deux appels en 50 secondes, 11 contrôles réussis sur 11. Texte attendu, espaces et paragraphes conservés ; export lu, processus arrêté et configuration globale inchangée. Essai ciblé, pas une nouvelle campagne complète de presets. |
| `d82152b` (paquet 0.21.0) | Campagne finale Relay | 22/22, nouvelles conversations jetables, `TERM` limité au processus. Réponses et contexte conservés, identité/délivrance valides, refus des conversations attachées, historiques inchangés, processus Claude arrêté. Les deux exports de réponse ont été lus. |
| `d82152b` (paquet 0.21.0) | Campagne finale presets, deux tours, Débat + Ask, synthèses actives | 18 scénarios réussis, puis échec de `debate:antigravity-vibe` au premier tour (`empty-output`). Arrêt au premier échec après 550,2 s ; le dernier scénario Ask n'a pas été lancé. Les 18 exports réussis et l'export d'interruption ont été lus. Ce n'est pas un résultat 20/20. |

Environnement observé : Windows, Node 24.19.0, pnpm 10.18.3, Codex CLI 0.163.0, Claude Code 2.1.302, OpenCode 2.0.32, Antigravity 1.4.9 et Vibe 2.16.0. Le modèle OpenCode du smoke presets était explicitement gratuit (`opencode/deepseek-v4.1-flash-free`). Le smoke Relay demandait `haiku` à Claude, qui a annoncé Sonnet 5.5 : modèle demandé et modèle observé restent distincts.

## État de la qualification finale

La campagne finale est autorisée mais non concluante pour les presets. Palabre a refusé la première réponse Antigravity du Débat avec Vibe, sans accepter un résultat vide comme une réponse. D'après le chemin d'erreur `empty-output` du parseur JSON, le champ `response` est vide après assainissement ; le JSON brut n'est pas conservé dans l'export, et la cause fournisseur reste inconnue. Aucune preuve de quota, aucun nouvel appel pour reproduire, aucun repli texte/PTY, aucun renvoi automatique. Les premiers exports Antigravity conservent les paragraphes ; cela n'explique pas le dernier échec.

La configuration globale est restée inchangée. La configuration de qualification locale a été approuvée après accord humain spécifique ; l'assistant a également persisté ses migrations, avec réglages effectifs identiques vérifiés et modèle OpenCode gratuit conservé. Seules les données et approbations de qualification ont été créées ou actualisées.

La PR de version reste en brouillon, sans fusion ni tag. Sur `d82152b`, le job principal de CI a réussi ; le job macOS a été annulé sans étape exécutée. Une CI antérieure réussie et les contrôles locaux ne remplacent pas ce contrôle final manquant. Les ajouts de bilan ne modifient ni code runtime, scripts de smoke, dépendances ni version du paquet testé.

## Limites conservées

- Les résultats historiques proviennent de plusieurs révisions. La nouvelle campagne sur le paquet 0.21.0 réussit Relay, mais reste incomplète pour les presets ; les preuves historiques ne transforment pas cet échec en réussite.
- Le smoke Relay qualifie Claude attaché comme processus non interactif, pas comme TUI ou application Desktop. L'envoi vers Claude Desktop ouverte reste indisponible.
- Les essais d'ouverture Desktop et de Relay ouvert ont leurs qualifications datées dans les contrats de développement ; aucune visibilité en direct universelle n'est déduite de ces smoke tests.
- Le smoke Relay en arrière-plan ne qualifie pas à lui seul `relay recent`, les repères `--reference`/`--exchange`, `--then-follow`, le quota de `--check` ou le lecteur d'historiques Codex segmentés. Ces fonctions ont leurs tests hors ligne et, lorsqu'ils existent, leurs essais datés dans les contrats [Relay](dev/relay.md) et [Relay ouvert](dev/relay-open.md). Aucun nouvel essai fonctionnel dédié de chacun de ces parcours dans cette campagne ; les repères utilisés pour les relectures réelles ne constituent pas une qualification exhaustive.
- Ollama n'a pas participé à ces campagnes. Un modèle Ollama local peut conserver l'inférence sur la machine ; un modèle cloud peut envoyer les données à un service distant.
- Chat, le pilote OpenCode Relay sur copie et les interfaces Desktop n'ont pas été rejoués dans cette campagne. Leurs limites documentées restent applicables.
- Le JSON Antigravity a été éprouvé avec 1.4.9 sous Windows. Autres versions et plateformes non qualifiées ; le nettoyage PTY générique des configurations personnalisées reste inchangé.
- Les réglages, historiques, identifiants et journaux privés ne sont pas publiés. Les approbations ajoutées par les smoke tests concernent leurs configurations de qualification, après accord humain ; la configuration globale et les politiques des outils restent inchangées.

## Contrôles avant publication

1. Sur la PR de version : vérifier types, suite complète isolée, build, skill, guides, métadonnées de release, rendu du changelog et contenu du tarball local. Consigner les résultats dans la PR, puis obtenir une CI verte sur son commit final.
2. Avant le tag : compléter la qualification de la révision finale selon le [protocole](dev/verification.md). Toute nouvelle campagne réelle exige l'accord humain sur les quotas, historiques, confiance et éventuels MCP. Les preuves antérieures sont conservées ; aucun renvoi d'un message de délivrance inconnue ou enregistré sans réponse. Ne lever la réserve sur l'échec des presets qu'après une qualification concluante documentée ; actualiser ce bilan et le changelog avec les révisions et résultats correspondants, puis ajuster la date avant le tag si nécessaire.
3. Faire autoriser séparément la fusion de la PR de version, puis la création et le push du seul tag `v0.21.0` sur le commit courant de `main`. Le tag déclenchera la publication npm et GitHub par le workflow ; aucune publication locale.
4. Pour le site : la fusion de cette PR synchronise déjà le changelog 0.21.0 vers `palabre-web/dev`, avant la création du tag ; le lien généré vers la release n'existera qu'après publication. Ne pas promouvoir `dev` vers `main` avant la publication npm réussie. Cette promotion et le déploiement de production demandent leur propre validation.
5. Pour les copies installées du skill : proposer le plan `palabre skill --sync` ou `palabre update`, attendre sa confirmation, puis rappeler le rechargement. Aucune copie depuis cette branche.

Les changements déjà approuvés et testés ne justifient pas une nouvelle fonction dans ce lot. Lire les [notes de version](../CHANGELOG.md) et le [protocole de publication](dev/maintenance.md) avant toute action ultérieure.
