# Préparation de Palabre 0.23.0-beta.1

31 octobre 2026 — candidat de préversion, pas une annonce de publication. Base `main` : `e02f1e5`, après #263, #264 et #267. Le paquet conserve le runtime intégré ; ce lot prépare version, notes, documentation et vérifications du paquet. Aucun tag ou release n'est créé par cette préparation.

## Périmètre et canal

- Coopération Relay avec rattachement GitHub facultatif du travail, participant déclaré et restitution proportionnée. Les échanges directs restent possibles sans GitHub.
- Publication expérimentale d'un bilan choisi sur une issue ou PR existante : aperçu, attribution, compte et destination, lancement de l'envoi par l'humain, trace locale et lien du commentaire.
- Skill livré en révision 12. La lecture des consignes du paquet ne remplace ni une autorisation ni une synchronisation de copies installées. Synchronisation par plan humain confirmé depuis le paquet installé, puis rechargement des consignes.
- Version cible `0.23.0-beta.1`, tag futur `v0.23.0-beta.1`, canal npm `next`, GitHub prerelease et `make_latest: false`. Le workflow de préversion ne promeut ni le badge de version du site ni un post Bluesky.

Le numéro a été recherché sur les tags Git et sur npm : absent au début de la préparation. Les canaux npm lus à cette date indiquent `latest: 0.22.1` et `next: 0.18.0-beta.1`. Un canal `next` existant ne prouve donc pas que ce candidat est disponible. Les guides demandent de choisir le numéro annoncé après publication et donnent le retour à `latest`.

## Limite à garder visible

La [qualification de publication](relay-publication-qualification.md) distingue les observations techniques sur #265 et #266 de la validation humaine. Les commentaires et reçus ont été relus par Codex via l'API GitHub, séparément de la sortie de publication. La fenêtre visible et l'auteur de l'entrée affirmative ne sont pas établis : **le parcours de confirmation humaine reste non qualifié**. Aucun résultat de test automatisé ne comble cette limite.

L'agent prépare le bilan et l'aperçu, puis fournit la commande ; l'humain lance lui-même l'envoi dans son terminal. Aucun nouveau commentaire, fenêtre, modification de politique, connexion ou effacement de reçu n'est entrepris ici. Mission, `--task review` et `--write` restent gelés.

## Vérifications de ce candidat

Résultats observés sur ce checkout, sans campagne réelle d'agent :

| Contrôle | Résultat |
| --- | --- |
| Typage, suite complète isolée, build | Réussis ; 1 339 tests réussis, 6 ignorés, aucun échec ; garde du vrai profil inchangé |
| Métadonnées de release : version/tag/canal | Huit tests réussis ; candidat résolu en `next`, `prerelease: true`, `makeLatest: false`, titre `v0.23.0-beta.1` |
| Validation du skill et génération documentaire FR/EN | Réussies ; révision 12 et sept références conservées |
| Paquet `.tgz`, inventaire et extraction | Réussis ; 164 entrées, fichiers attendus présents, aucun transcript, reçu, historique ou fichier de test empaqueté |
| CLI extraite : version, aide FR/EN, lecture du skill, refus sans TTY | Neuf contrôles réussis sur profil fictif sans outils externes dans le PATH ; aucun profil Palabre créé par la CLI, aucune tentative de publication |
| Relecture indépendante du lot de préparation | Claude via Relay, lecture statique ciblée ; remarques documentaires appliquées, sans blocage de préparation relevé |
| CI de la PR finale | À consulter sur la PR de préparation ; résultat lié à sa tête, à vérifier avant fusion/publication |

L'extraction et les contrôles CLI ne sont pas une installation npm globale. Ils ne changent pas l'installation ou les copies du skill utilisées par le propriétaire.

Archive locale finale : `palabre-0.23.0-beta.1.tgz`. SHA-256 : `98c0d0fc80df9b81c7100e3e9edaab3738ae5c8ae3c86da47afa4d67e947daf6`. Après les retouches de revue du README, le paquet a été reconstruit et les neuf contrôles relancés sur une extraction neuve : tous réussissent. La lecture du skill est liée à ce paquet extrait, pas au checkout ou à une copie installée. Le profil, le PATH et les variables de configuration des sous-processus sont fictifs. Ces contrôles ne qualifient pas PTY, les agents externes ni une interface Desktop. Cette empreinte identifie uniquement l'archive locale ; le workflow reconstruira son propre paquet lors d'une éventuelle publication.

Claude a relu version, canal, passages de préversion, installation FR/EN, skill et bilan. Il n'a exécuté aucun contrôle ni vérifié lui-même les comptes de tests ou empreintes annoncés par Codex. Ses remarques ont conduit à préciser le choix du gestionnaire initial, séparer les commandes pnpm/npm et dédupliquer les notes de synchronisation. Les liens de préversion du README pointent vers les sources GitHub, disponibles après fusion, sans présumer d'un déploiement du site. Une fusion de guides peut déclencher leur synchronisation vers la branche web `dev` ; le déploiement de production reste distinct.

Le premier essai de lancement de la suite complète n'a pas exécuté cette suite, son répertoire de journal étant absent. Après création de ce répertoire, le passage complet ci-dessus réussit ; aucune erreur de préparation n'est comptée comme un test réussi.

## Avant une publication

Le [protocole de vérification](dev/verification.md) demande des campagnes réelles presets et Relay avant publication. Elles sont séparées des tests isolés et exigent un accord humain pour leurs quotas, historiques, éventuels MCP et approbations temporaires. Elles ne sont pas lancées par cette préparation. Les qualifications datées de [0.22.1](release-0.22.1-qualification.md) restent historiques ; elles ne deviennent pas une campagne de ce candidat.

Pour le parcours humain de publication, une vérification éventuelle doit partir d'un terminal effectivement utilisé par le propriétaire et d'une cible explicitement désignée. Ne pas reprendre un ancien envoi ni présenter un PID, un TTY ou une trace comme un accord humain. Cette qualification reste ouverte, même pour une préversion.

Fusion de la PR, tag, publication npm/GitHub et déploiement restent des actions distinctes. Après une éventuelle fusion autorisée, vérifier le commit courant de `main` avant de créer uniquement le tag prévu ; publication par le workflow Trusted Publishing, jamais par un token npm local.
