# Préparation de Palabre 0.22.1

Bilan du 30 octobre 2026. Cette préparation ne prouve ni publication npm, ni création du tag, ni déploiement du site. La date du changelog est proposée ; l’ajuster si la publication est différée.

## Périmètre

Base : `cfa1d23`, après fusion des PR [#257](https://github.com/JuReyms/Palabre/pull/257), [#258](https://github.com/JuReyms/Palabre/pull/258) et [#259](https://github.com/JuReyms/Palabre/pull/259). Le premier candidat préparait la version du paquet et les notes. Le candidat final reprend aussi le correctif YAML de la PR [#262](https://github.com/JuReyms/Palabre/pull/262) et le premier lot de diagnostics #261 décrit ci-dessous, sans modification des permissions ni des transports Relay.

- #256 : aide à consulter la conversation Codex concernée, commande structurée facultative en JSON et vocabulaire courant.
- #165, premier lot : vérifier la version réellement lancée après une mise à jour effectuée par Palabre ; erreur claire avant la synchronisation du skill en cas d’écart ou de sonde non concluante.
- #202 et critères regroupés de #209 : coopération utile proposée avec des outils disponibles, relecture par un outil distinct, respect des préférences humaines et absence de consultation superflue.
- Codex → Codex reste une compatibilité utile ; parcours natif vérifié, autorisé et suffisant privilégié, demande explicite de Relay respectée. Aucun contournement de refus ou renvoi après réception incertaine.

Le skill livré passe en révision 8 avec les consignes de diagnostic #261 ; la correction YAML seule ne nécessitait pas de bump. Le premier candidat testé ci-dessous avait la révision 7. Aucune copie installée n’est modifiée depuis cette branche. Mission, review et write restent gelés ; l’envoi vers Claude Desktop ouverte n’est pas ajouté. Le titre prévu est `v0.22.1`, stable sous npm `latest`, sans nouveau nom d’affichage.

## Contrôles du premier candidat (941c299)

Sur Windows, Node 24.19.0 et pnpm 10.18.3 :

- `pnpm check` réussi ; suite complète via le lanceur isolé : **1 308 réussis, 6 ignorés, 0 échec**, sur 1 314 tests. Le vrai profil personnel est resté identique en contenu et métadonnées.
- `pnpm pack --pack-destination .tmp/release-0221-package` réussi : validation du skill et build exécutés par prepack. Archive inspectée puis extraite : **158 entrées**, sans historique, profil, trace, dépendances installées ni dossier temporaire.
- Paquet extrait : version réellement rendue **0.22.1**, aide Relay accessible, skill **révision 7** et sept références internes lisibles.
- Profil fictif avec copie du skill 0.22.0 (révision 4) et configuration volontairement invalide : `skill --read --json --skill-revision 4` rend `reload-required` avec les consignes exactes du paquet ; déclaration 7 rend `current`. Un faux skill du dossier courant n’est pas utilisé. Copie ancienne, configuration et profil fictifs restent identiques ; aucune installation, connexion ou consultation d’agent réel.
- Métadonnées de `v0.22.1` : version exacte, stable, `latest`, titre `v0.22.1`. Les marqueurs Bunny de 0.22.0 ne sont pas réutilisés. Conversion des 78 pages FR/EN et des deux changelogs réussie.

Les captures et le tarball restent locaux. Les contrôles de livraison et les profils fictifs ne prouvent pas le chargement des consignes dans la mémoire d’une application réelle ni une mise à jour npm globale réelle.

## Scénarios de compréhension

Un autre agent interne a lu le skill du paquet extrait et les références utiles. Les six entrées ont été données sans résultats attendus ; aucune action des simulations n’a été exécutée.

| Situation | Comportement observé dans la simulation |
| --- | --- |
| Ancienne conversation, révision 4 déclarée, diagnostic 7, tâche Relay déjà autorisée | Relire le paquet et les références, vérifier la même cible/configuration puis poursuivre dans le cadre autorisé, sans sync ni redémarrage imposé. |
| L’humain demande de voir la conversation Codex créée | Employer la commande structurée avec les permissions habituelles, sans nouvel accord de consultation, envoi ni affichage supposé. |
| Installation terminée, version PATH 0.22.0 au lieu de 0.22.1 | Distinguer installation et vérification, expliquer le blocage ; aucune réussite globale, synchronisation du skill ou réinstallation automatique. |
| Nouvelle conversation avec ancien skill, aucun diagnostic rencontré | Ne pas annoncer de rechargement global ; appliquer la comparaison à la prochaine opération Palabre autorisée. |
| Simple faute à corriger, seul Codex disponible | Corriger directement, sans consultation superflue ni autre chat présenté comme un outil indépendant. |
| Réception Relay incertaine puis diagnostic de skill ancien | Relire les consignes et vérifier l’échange existant dans les droits disponibles, sans renvoyer ni changer de parcours. |

Ces réponses sont cohérentes avec les critères. Cette relecture interne est distincte d’un croisement d’outils et d’un test utilisateur réel. Le [protocole général](skill-cooperation-evaluation.md) conserve les observations Claude du lot précédent et leurs limites.

## Campagnes réelles du 30 octobre

Les deux campagnes ont ensuite été explicitement autorisées par le mainteneur, y compris quotas, conversations de test, approbation de configuration temporaire et contrôle MCP. Exécution sur **`941c299`**, après build, paquet **0.22.1**. Versions Windows : Node 24.19.0, pnpm 10.18.3, Codex CLI 0.163.0, Claude Code 2.1.312, OpenCode 2.0.32, Antigravity 1.4.11 et Vibe 2.16.0.

| Campagne | Résultat | Portée |
| --- | --- | --- |
| Presets Débat et Ask | **20/20 réussis, aucun échec ni cas ignoré**, 646.7 s | Dix paires prioritaires, deux tours de Débat, deux réponses indépendantes Ask et synthèses actives. Les vingt captures NDJSON et vingt exports ont été relus : réponses/synthèses présentes, aucune erreur, sorties réussies et contrôles officiels conservés. |
| Relay | **22/22 vérifications réussies** | Sessions jetables Claude/Codex, contexte conservé, délivrance et identité, arrière-plan explicite, refus des cibles attachées avec historiques inchangés, outils Claude annoncés et comparaison des journaux MCP Codex. Les deux exports de réponse ont été lus. |

Presets : un lanceur local reprend le smoke compilé officiel sans filtrer les vingt cas ni modifier son analyse NDJSON. Il ajoute le modèle explicite `opencode/deepseek-v4.1-flash-free` aux participants OpenCode et aux synthèses Ask configurées sur OpenCode, capture les sorties et vérifie l’empreinte de la configuration avant chaque appel. Options : `--mode both --keep-going`, synthèses conservées, sujet inédit de qualification. La comparaison indépendante a confirmé ces seules adaptations. Aucun changement de code produit ni de script versionné.

Les **18 demandes OpenCode** correspondantes ont été relues via leur export natif, sans génération : sujet de qualification vérifié, résultat `succeeded` et modèle **`opencode/deepseek-v4.1-flash-free`** enregistré dans les réponses. La configuration globale Palabre est restée identique en contenu et date de modification ; le choix de modèle ne vaut que pour ces demandes.

Relay : commande `pnpm smoke:real-relay`, avec `TERM=xterm-256color` limité au processus. Claude demandé avec `haiku` a annoncé `claude-sonnet-5-5` à la création et à la reprise ; ne pas confondre modèle demandé et observé. Codex avait `gpt-6.1-terra` enregistré dans sa conversation de test ; le résultat de reprise n’annonce pas de modèle observé. Le test Claude attaché utilise un processus non interactif dont l’arrêt est confirmé, pas son TUI ni Desktop. Les journaux MCP Codex restent un indice, sans garantie universelle d’absence d’exposition.

Seules les données et approbations temporaires prévues par les essais ont été créées. Conversations, identifiants, messages, exports et captures restent locaux. Ces campagnes qualifient leurs parcours et contrats, sans certifier la justesse de chaque avis, le parcours d’un débutant dans son application ou une installation npm globale réelle.

## Ajouts #261 et #262 après les premières campagnes

Le correctif de #262 charge avec PyYAML strict ; le garde-fou et son test couvrent aussi une tabulation après deux-points. Les consignes d’exécution ne changent pas pour ce seul correctif.

#261, premier lot : doctor indique connexion et modèle OpenCode non vérifiés sans appel modèle. Le profil batch qualifié ajoute une explication à un refus d’accès reconnu après exit non nul, sans changer le kind ni choisir un modèle. Les renderers console distinguent les réponses Ask exportées de la synthèse manquante, y compris après reprise depuis un checkpoint. L’erreur, le code de sortie et les contrats NDJSON restent conservés.

La suite complète finale passe : **1 312 réussis, 6 ignorés, 0 échec**, sur 1 318 tests, vrai profil inchangé. Les types et le validateur du skill passent. Les 66 contrôles ciblés initiaux sont réussis. La revue indépendante a trouvé un compteur de réponses conservées oublié à la reprise ; il a été corrigé dans les deux renderers. Les 12 tests d’intégration de session passent ensuite, avec reprise depuis une réponse sur deux et reprise de synthèse seule, sans rejeu des réponses. Le paquet final a été reconstruit et extrait : 158 entrées, version 0.22.1, skill 8, YAML strict valide et sept références. Les sondes ancienne révision 4 / actuelle 8 passent, sur profil fictif inchangé ; 78 guides FR/EN et deux changelogs sont générés.

L’autotest doctor consommant du quota, l’inférence de modèle depuis des formats non qualifiés, la reprise depuis un simple export et l’enrichissement de la version Git restent hors du lot. La migration mémoire de l’ancien défaut exact --pure et sa persistance par synchronisation confirmée sont déjà disponibles ; aucun réglage utilisateur n’est réécrit ici. #261 reste ouverte pour ces suites et l’essai utilisateur.

OpenCode et Vibe ont été mis à jour après les premières campagnes : 2.2.3 et 3.0.4 remplacent 2.0.32 et 2.16.0 dans l’environnement. Les résultats sur 941c299 restent datés ; ils ne prouvent pas seuls la compatibilité de ces nouvelles versions. La validation finale doit distinguer les nouveaux essais des anciens, sans republier les traces privées.

## Vérifications restantes avant publication

- Obtenir une CI verte et finaliser la revue du commit final de la PR de version.
- Les deux campagnes réelles du candidat sont terminées avec les résultats ci-dessus. Le [protocole](dev/verification.md) conserve leurs garanties conditionnelles ; les résultats de [0.22.0](release-0.22.0-qualification.md) restent des preuves historiques distinctes.
- Les shims réels Yarn/Bun Windows, une installation globale npm et le parcours dans une ancienne conversation Desktop ne sont pas qualifiés par les processus fictifs. Le retour humain Mac et le test débutant CoolMaster restent distincts, sans résultat annoncé.
- #165 et #202 restent partielles ; #256 attend la publication effective du correctif. #136 et #193 ne sont pas incluses dans ce lot.

La fusion de cette PR, la création/poussée de `v0.22.1` et le déploiement du site restent des actions distinctes à autoriser. Ne pas publier localement sur npm ni promouvoir le site avant publication. Après une éventuelle synchronisation des copies installées par un plan confirmé issu du paquet publié, recharger le skill dans l’outil concerné ; cette synchronisation n’est pas un préalable à la lecture du paquet par l’agent.
