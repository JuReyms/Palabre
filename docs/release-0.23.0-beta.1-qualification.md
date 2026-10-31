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

Résultats isolés observés sur ce checkout ; les campagnes réelles sont détaillées séparément ci-dessous :

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

## Campagnes réelles autorisées le 31 octobre 2026

Le propriétaire a autorisé les deux campagnes après présentation de leurs effets : quotas, historiques réels, approbations de configurations temporaires et lancement possible des MCP par le témoin Codex. Elles utilisent le build du candidat, sous Windows 11, Node `24.19.0`, Claude Code `2.1.316`, Codex CLI `0.163.0`, OpenCode `2.2.3`, Antigravity CLI `1.4.12` et Mistral Vibe `3.0.4`. Les qualifications datées de [0.22.1](release-0.22.1-qualification.md) restent historiques ; elles ne remplacent pas ces résultats. Identifiants, chemins personnels, exports et journaux bruts restent locaux.

### Relay : 18 contrôles réussis sur 22

La commande officielle `pnpm smoke:real-relay` se termine avec le code 1. Conversations jetables fermées : Claude et Codex répondent avec le contexte attendu, la délivrance et l'identité attendues, en arrière-plan explicite. Codex a relu leurs deux exports séparément des critères du script, qui ne compte que la présence de l'export Claude. Claude annonce seulement `Read`, `Glob`, `Grep` et aucun MCP. Le scénario Claude attaché non interactif établit son processus propre, refuse l'envoi avec `target-busy` / code 3 / `not-delivered`, puis constate l'historique inchangé avant arrêt confirmé du processus lancé. Le refus conserve aussi une passation locale `.handoff.md`, sans l'envoyer.

Quatre contrôles restent en échec :

- **Indice MCP Codex :** le témoin sans neutralisation est exploitable, mais la recherche de noms dans stderr trouve encore `computer_use` pendant l'échange neutralisé. La réponse et l'identité sont correctes ; cela ne suffit pas à valider le contrôle MCP.
- **Trois contrôles Codex attaché :** l'écran attend `Continue anyway? [y/N]` après l'avertissement `TERM=dumb`. L'attachement n'est pas établi et aucun message Relay n'est envoyé. La trace contient une mesure avant (un fichier, 53 lignes), sans mesure après : l'historique inchangé n'est pas établi. Le refus d'une cible Codex réellement attachée n'est donc pas qualifié par ce passage.

L'instantané Codex précède le nettoyage et note un PTY encore actif. Le script demande ensuite l'arrêt du seul arbre de processus qu'il a lancé, sans consigner de confirmation d'arrêt comparable au scénario Claude. Une inspection ultérieure en lecture seule par Codex ne trouve aucun processus dont la ligne de commande nomme la session jetable exacte ; cette observation ne prouve pas l'arrêt universel de tous les descendants.

Un diagnostic distinct, avec une nouvelle demande sur la même cible jetable Codex fermée et les mêmes protections, conserve stdout/stderr bruts. Il répond correctement, avec la même identité et un code 0. Codex constate dans cette capture une seule occurrence de `computer_use`, dans `feature.computer_use` parmi les métadonnées de fonctionnalités ; les journaux déclarent `mcp_server_count=0` et `mcp_servers=""`. Cette observation indique un faux positif possible du critère textuel. Elle ne reconstitue pas le stderr perdu du premier échange, ne transforme pas ses résultats en 22/22 et ne prouve pas une absence universelle d'exposition aux outils.

Le modèle Claude demandé à la création est l'alias `haiku`, mais le modèle observé à la création puis à la reprise est `claude-sonnet-5-5`. La cause de cette résolution n'est pas établie. Le témoin sans cadre opérateur répond aussi ; il ne démontre ni la nécessité ni l'absence d'effet de ce cadre.

### Presets : 6 scénarios réussis, 14 en échec, aucun ignoré

Les dix paires CLI prioritaires sont lancées dans les deux modes Débat et Ask, deux tours pour Débat, avec les synthèses configurées : Antigravity pour Débat et OpenCode pour Ask. Aucun modèle n'est imposé par Palabre. Ollama et les directions inversées ne sont pas inclus. Le passage complet dure 429 secondes et se termine avec le code 1.

Le lanceur local reprend le script officiel et ses critères sans modification ; son seul ajout conserve les sorties brutes des sous-processus dans un dossier privé avant analyse. Le premier appel de compilation n'a trouvé aucun `tsc` et n'a lancé aucun agent ; après ajout des outils de développement du dépôt au PATH du processus, la compilation puis la campagne démarrent.

| Paire | Débat | Ask |
| --- | --- | --- |
| Codex / Claude | Réussi | Deux réponses reçues ; synthèse OpenCode refusée |
| Codex / Antigravity | Réussi | Deux réponses reçues ; synthèse OpenCode refusée |
| Claude / Antigravity | Réussi | Deux réponses reçues ; synthèse OpenCode refusée |
| OpenCode / Antigravity | Refus OpenCode comme participant | Refus OpenCode avant réception de deux réponses |
| Codex / OpenCode | Refus OpenCode comme participant | Refus OpenCode avant réception de deux réponses |
| Claude / OpenCode | Refus OpenCode comme participant | Refus OpenCode avant réception de deux réponses |
| Codex / Vibe | Réussi | Deux réponses reçues ; synthèse OpenCode refusée |
| Vibe / Claude | Réussi | Deux réponses reçues ; synthèse OpenCode refusée |
| OpenCode / Vibe | Refus OpenCode comme participant | Refus OpenCode avant réception de deux réponses |
| Antigravity / Vibe | Réussi | Deux réponses reçues ; synthèse OpenCode refusée |

Les quatorze échecs contiennent le même diagnostic amont : le modèle Go choisi par l'outil utilise les données des requêtes pour l'entraînement, ce qui est refusé par les réglages de confidentialité actuels du workspace OpenCode. Aucun réglage n'est modifié ni modèle remplacé pour contourner ce refus. Six Ask échouent à la synthèse OpenCode après réception des deux réponses ; les quatre autres échouent d'abord sur OpenCode comme participant. Les sorties partielles ne sont pas comptées comme des succès.

Les vingt exports annoncés ont été lus et leurs messages rapprochés des événements NDJSON capturés. Même un échec peut produire un export : sa présence ne valide pas une session. Les six Débats réussis satisfont les critères du smoke : NDJSON v1, événements et messages attendus, synthèse, export et absence du bruit interdit. Ce sujet simple vérifie ces contrats, pas la justesse de chaque affirmation ni la qualité d'une relecture contradictoire.

Le précontrôle et le contrôle final de Codex constatent un contenu SHA-256 et une date de modification identiques pour la configuration Palabre globale. Codex n'a exécuté aucune synchronisation de copie installée du skill ni nettoyage des historiques, approbations temporaires, exports ou passations produits par les essais. Sa lecture de l'état Git confirme que le rapport est le seul fichier versionné modifié après les campagnes ; ce rapport n'entre pas dans l'archive npm contrôlée ci-dessus.

Claude a relu le bilan par Relay en arrière-plan et recoupé les comptes et le tableau avec l'audit des presets, la trace Relay, le résumé MCP expurgé et le contrôle final de configuration. Ses remarques ont fait préciser les six échecs Ask en synthèse et les quatre en participation, la mesure d'historique avant seule et l'auteur des vérifications complémentaires. Il n'a relancé aucun essai, ni lu les exports, le log presets, les scripts ou la capture MCP personnelle ; durée, versions OpenCode/Antigravity/Vibe, vérifications Git, lecture des exports et comparaison de configuration restent des constats de Codex. Cette relecture ne certifie pas la campagne et n'autorise aucune publication.

## Avant une publication

Les campagnes réelles sont terminées mais ne sont pas vertes. Choisir un modèle OpenCode compatible avec les choix de confidentialité du propriétaire, examiner le critère MCP et le lancement du terminal de qualification Codex, puis compléter les contrôles manquants dans un périmètre humain autorisé. Ces décisions ne sont pas prises par cette campagne. Aucun réglage de confidentialité ni de sécurité ne doit être élargi pour obtenir un résultat vert.

Pour le parcours humain de publication, une vérification éventuelle doit partir d'un terminal effectivement utilisé par le propriétaire et d'une cible explicitement désignée. Ne pas reprendre un ancien envoi ni présenter un PID, un TTY ou une trace comme un accord humain. Cette qualification reste ouverte, même pour une préversion.

Fusion de la PR, tag, publication npm/GitHub et déploiement restent des actions distinctes. Après une éventuelle fusion autorisée, vérifier le commit courant de `main` avant de créer uniquement le tag prévu ; publication par le workflow Trusted Publishing, jamais par un token npm local.
