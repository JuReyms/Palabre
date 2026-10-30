# Préparation de Palabre 0.22.0 « Bunny »

Bilan de préparation du 30 octobre 2026. Ce document ne prouve ni publication npm, ni création du tag, ni déploiement du site. La date du changelog est proposée pour cette préparation ; l'ajuster si la publication est différée.

## Périmètre et révision

Base : `c31db07`, après fusion des PR [#251](https://github.com/JuReyms/Palabre/pull/251), [#253](https://github.com/JuReyms/Palabre/pull/253), [#254](https://github.com/JuReyms/Palabre/pull/254), [#249](https://github.com/JuReyms/Palabre/pull/249), [#252](https://github.com/JuReyms/Palabre/pull/252) et [#248](https://github.com/JuReyms/Palabre/pull/248). Leur arbre intégré a été comparé à celui de `main` avant la préparation de cette branche. La [CI de cette base](https://github.com/JuReyms/Palabre/actions/runs/40975325879) a réussi : types, suite complète, build et job macOS. Ce dernier couvre types, compilation et verrou POSIX Codex ; il ne qualifie ni modèles réels ni applications Desktop sur Mac.

La version mineure rassemble le parcours Relay clarifié, la relecture du skill du paquet, l'attente des modèles lents et la récupération exacte d'un résultat OpenCode. Le skill livré est en révision 4, indépendante du numéro CLI. Mission, review et write restent gelés ; les capacités de Relay vers Claude Desktop ouverte ne sont pas étendues.

Cette PR prépare `package.json` en `0.22.0`, les notes datées et le titre GitHub `Palabre v0.22.0 — Bunny`. Le tag prévu reste `v0.22.0`, stable sur npm `latest`. Le titre est lu uniquement dans la section exacte du changelog ; sans nom dans une prochaine version, le workflow revient à son tag. Les canaux et gardes tag/version restent inchangés.

## Vérifications du candidat

Contrôles locaux du candidat sous Windows, Node 24.19.0 et pnpm 10.18.3 :

- `pnpm check` réussi ; suite complète finale : **1 297 tests réussis, 5 ignorés, aucun échec**, avec le vrai profil personnel inchangé selon son garde-fou de contenu et métadonnées. Les huit tests de métadonnées de release sont inclus et réussissent aussi isolément.
- `pnpm validate:skill` réussi. `pnpm pack --pack-destination .tmp/bunny-package` a également validé le skill et exécuté le build avant de créer le tarball local.
- Tarball extrait et vérifié : **157 entrées**, version `0.22.0`, aide accessible, skill en révision 4 et sept références lisibles à l'intérieur du paquet. Pas de profil, historique, trace, dépendance installée ni dossier temporaire empaqueté.
- 78 pages de guides FR/EN et les deux changelogs générés avec succès ; les sections publiées jusqu'à 0.21.0 restent identiques, hors normalisation des fins de ligne. Les liens développeur passent leurs contrôles hors réseau.
- Métadonnées `v0.22.0` : stable, npm `latest`, titre `Palabre v0.22.0 — Bunny`. Aperçu social uniquement local : 278 caractères sur 300, sans envoi.
- Revue indépendante du script, de ses huit tests, du workflow et des notes : aucun problème actionnable identifié. La proposition de Claude n'a pas été utilisée ; le petit changement de titre a été écrit ici et relu par un autre agent.

La première passe avait démarré avant la création de ce bilan : son lien n'existait pas encore. Elle a aussi rencontré une échéance de deux secondes dans le test du shim PowerShell fictif, déjà observée sous charge sur la base intégrée. Le contrôle des liens a ensuite réussi et la suite complète finale a passé sans changement du code de l'adapter ni assouplissement du délai du test.

Ces contrôles n'appellent aucun modèle réel. Les tests passent par le lanceur isolé avec surveillance du vrai profil personnel. La CI doit encore être verte sur le commit final avant toute fusion ; un résultat local ne la remplace pas.

## Essais réels ciblés déjà effectués

Essais Windows du 29 octobre, autorisés pendant le développement de #254, avec OpenCode 2.0.32. Ils portent sur le code intégré avant cette PR de version ; ils ne constituent pas une campagne complète du paquet Bunny.

- Une relecture GLM gratuite a continué après l'ancienne échéance locale de trois minutes et a terminé en environ neuf minutes. La réponse exacte a été relue sans renvoyer la demande. Une échéance locale n'établit donc pas l'échec du modèle ni l'arrêt de son travail distant.
- Une sonde structurée avec lecture d'un fichier fictif a mis en évidence une confusion entre identifiant de partie et identifiant d'appel d'outil. Après correction, une nouvelle sonde distincte a reçu les événements structurés d'étape, d'outil et de texte, puis la réponse finale attendue en environ cinq secondes. La première demande n'a pas été renvoyée.
- La commande de récupération a relu une demande DeepSeek précise déjà terminée : identité et empreinte du prompt vérifiées, réponse identique, indicateur `sent: false`, sans nouvelle génération ni nouvelle conversation.

OpenCode garde son environnement habituel, plugins, MCP et permissions compris ; ces essais ne prouvent aucune lecture seule imposée. Les identifiants, messages et traces privées restent locaux. Les limites et formats qualifiés sont décrits dans le [contrat des adapters](dev/adapters.md).

Les campagnes complètes de [0.21.0](release-0.21.0-qualification.md) sont des preuves historiques sur d'autres révisions : elles ne remplacent pas les campagnes finales de 0.22.0, dont les adapters et le parcours Relay ont évolué.

## Qualification réelle restant avant publication

Le [protocole de vérification](dev/verification.md) demande, après build et avec accord humain explicite :

1. `pnpm smoke:real-presets -- --mode both --keep-going` : dix paires CLI en Débat et Ask, avec synthèses et exports contrôlés ; outils connectés et quotas réels.
2. `pnpm smoke:real-relay` : conversations jetables Claude et Codex, contexte, identité, délivrance, refus de cibles attachées et contrôles MCP. Les conversations restent dans leurs historiques ; une configuration temporaire entre dans le registre de confiance et la reprise témoin lance les MCP de l'utilisateur.

Ces campagnes n'ont pas été lancées pour ce candidat. La version n'est pas prête à taguer tant que cette qualification n'est pas terminée et examinée. Aucun résultat incertain ne doit provoquer un renvoi automatique ; une reprise éventuelle doit porter sur de nouvelles demandes explicitement autorisées.

Le test débutant sur CoolMaster et l'essai utilisateur Mac sur npm 0.21.0 restent des travaux distincts, sans résultat annoncé. Les fiches correspondantes ne qualifient pas Bunny. Le pilote OpenCode sur copie, Chat et les interfaces Desktop ne sont pas couverts exhaustivement par les deux campagnes ci-dessus.

## Étapes de publication distinctes

- Finaliser la revue indépendante et vérifier la CI du commit final de cette PR.
- Terminer les campagnes réelles autorisées, consigner leurs révisions, résultats et limites, puis obtenir l'accord de fusion.
- Après fusion, obtenir l'accord pour créer et pousser uniquement `v0.22.0` sur le commit courant de `main`. Ce push déclenche le workflow : publication npm par Trusted Publishing, release GitHub, synchronisation du site vers `dev` et post social prévu. Aucune publication npm locale.
- La promotion du site `dev` vers `main` et son déploiement de production restent distincts, après publication réussie. Ne pas promouvoir une annonce de version non publiée.
- Les copies installées du skill restent intactes. L'agent peut relire le paquet exécuté ; un éventuel alignement disque passe par un plan humain confirmé issu du paquet publié, puis rechargement du skill dans l'outil. Ne jamais synchroniser depuis cette branche.
