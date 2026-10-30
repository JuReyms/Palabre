# Préparation de Palabre 0.22.1

Bilan du 30 octobre 2026. Cette préparation ne prouve ni publication npm, ni création du tag, ni déploiement du site. La date du changelog est proposée ; l’ajuster si la publication est différée.

## Périmètre

Base : `cfa1d23`, après fusion des PR [#257](https://github.com/JuReyms/Palabre/pull/257), [#258](https://github.com/JuReyms/Palabre/pull/258) et [#259](https://github.com/JuReyms/Palabre/pull/259). Le candidat prépare uniquement la version du paquet, les notes datées et ce bilan ; aucune nouvelle modification du runtime ou des permissions.

- #256 : aide à consulter la conversation Codex concernée, commande structurée facultative en JSON et vocabulaire courant.
- #165, premier lot : vérifier la version réellement lancée après une mise à jour effectuée par Palabre ; erreur claire avant la synchronisation du skill en cas d’écart ou de sonde non concluante.
- #202 et critères regroupés de #209 : coopération utile proposée avec des outils disponibles, relecture par un outil distinct, respect des préférences humaines et absence de consultation superflue.
- Codex → Codex reste une compatibilité utile ; parcours natif vérifié, autorisé et suffisant privilégié, demande explicite de Relay respectée. Aucun contournement de refus ou renvoi après réception incertaine.

Le skill livré reste en révision 7. Aucune copie installée n’est modifiée depuis cette branche. Mission, review et write restent gelés ; l’envoi vers Claude Desktop ouverte n’est pas ajouté. Le titre prévu est `v0.22.1`, stable sous npm `latest`, sans nouveau nom d’affichage.

## Contrôles du candidat

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

## Vérifications restantes avant publication

- Obtenir une CI verte et finaliser la revue du commit final de la PR de version.
- Effectuer les campagnes réelles presets Débat/Ask et Relay sur le candidat, avec accord humain pour leurs effets : quotas, conversations, configuration temporaire de confiance et MCP. Le [protocole](dev/verification.md) décrit les commandes et les garanties conditionnelles. Elles n’ont pas été exécutées pendant cette préparation. Les résultats de [0.22.0](release-0.22.0-qualification.md) restent historiques et ne qualifient pas automatiquement ce candidat.
- Les shims réels Yarn/Bun Windows, une installation globale npm et le parcours dans une ancienne conversation Desktop ne sont pas qualifiés par les processus fictifs. Le retour humain Mac et le test débutant CoolMaster restent distincts, sans résultat annoncé.
- #165 et #202 restent partielles ; #256 attend la publication effective du correctif. #136 et #193 ne sont pas incluses dans ce lot.

La fusion de cette PR, la création/poussée de `v0.22.1` et le déploiement du site restent des actions distinctes à autoriser. Ne pas publier localement sur npm ni promouvoir le site avant publication. Après une éventuelle synchronisation des copies installées par un plan confirmé issu du paquet publié, recharger le skill dans l’outil concerné ; cette synchronisation n’est pas un préalable à la lecture du paquet par l’agent.
