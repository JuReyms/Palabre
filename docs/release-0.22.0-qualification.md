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

Ces contrôles n'appellent aucun modèle réel. Les tests passent par le lanceur isolé avec surveillance du vrai profil personnel. La [CI de `f5070c6`](https://github.com/JuReyms/Palabre/actions/runs/41019039600) a réussi sur Linux et macOS. Les ajouts documentaires de qualification doivent également obtenir une CI verte avant toute fusion.

## Essais réels ciblés déjà effectués

Essais Windows du 29 octobre, autorisés pendant le développement de #254, avec OpenCode 2.0.32. Ils portent sur le code intégré avant cette PR de version ; ils ne constituent pas une campagne complète du paquet Bunny.

- Une relecture GLM gratuite a continué après l'ancienne échéance locale de trois minutes et a terminé en environ neuf minutes. La réponse exacte a été relue sans renvoyer la demande. Une échéance locale n'établit donc pas l'échec du modèle ni l'arrêt de son travail distant.
- Une sonde structurée avec lecture d'un fichier fictif a mis en évidence une confusion entre identifiant de partie et identifiant d'appel d'outil. Après correction, une nouvelle sonde distincte a reçu les événements structurés d'étape, d'outil et de texte, puis la réponse finale attendue en environ cinq secondes. La première demande n'a pas été renvoyée.
- La commande de récupération a relu une demande DeepSeek précise déjà terminée : identité et empreinte du prompt vérifiées, réponse identique, indicateur `sent: false`, sans nouvelle génération ni nouvelle conversation.

OpenCode garde son environnement habituel, plugins, MCP et permissions compris ; ces essais ne prouvent aucune lecture seule imposée. Les identifiants, messages et traces privées restent locaux. Les limites et formats qualifiés sont décrits dans le [contrat des adapters](dev/adapters.md).

Les campagnes complètes de [0.21.0](release-0.21.0-qualification.md) sont des preuves historiques sur d'autres révisions : elles ne remplacent pas les campagnes finales de 0.22.0, dont les adapters et le parcours Relay ont évolué.

## Campagnes réelles du 30 octobre

Le mainteneur a explicitement autorisé les deux campagnes, y compris leurs quotas, historiques, configuration temporaire de confiance et MCP. Exécution après build sur **`f5070c6`**, paquet 0.22.0. Environnement Windows : Node 24.19.0, pnpm 10.18.3, Codex CLI 0.163.0, Claude Code 2.1.312, OpenCode 2.0.32, Antigravity 1.4.11 et Vibe 2.16.0.

| Campagne | Résultat | Portée |
| --- | --- | --- |
| Presets, deux tours, Débat et Ask, synthèses actives, poursuite après échec | **6 réussis, 14 échoués, aucun ignoré**, 419,1 s | Les vingt scénarios ont été exécutés et leurs vingt exports lus. Les six Débats sans OpenCode ont réussi. Les quatre autres Débats et les dix Ask ont rencontré le même message OpenCode `Invalid credential` : comme participant, ou comme agent de synthèse Ask choisi dans la configuration. Aucun résultat vide ou partiel n'a été validé comme succès. |
| Relay, nouvelles conversations jetables Claude et Codex | **22/22 vérifications réussies** | Réponses et contexte conservés, identité et délivrance correctes, arrière-plan explicite, exports lus, refus des cibles attachées avec historiques inchangés, contrôle d'outils Claude et comparaison des journaux MCP Codex. |

Commandes effectivement utilisées : `pnpm smoke:real-presets --mode both --keep-going`, puis `pnpm smoke:real-relay`, avec `TERM=xterm-256color` limité au processus Relay. Un premier lancement des presets avec un séparateur `--` supplémentaire s'était arrêté au parsing avant tout appel d'agent ; il ne compte pas dans les vingt scénarios. La commande copiable du protocole est corrigée, sans changement des scripts ou du code produit.

Les modèles habituels ont été conservés pendant ces campagnes. La relecture sans génération de l'unique session OpenCode correspondant à la première synthèse Ask échouée a montré une erreur `provider.auth`, HTTP 401, sur **`opencode-go/iceman-contributor-free`**. Aucun modèle n'avait été explicitement choisi par Palabre ; les modèles gratuits utilisés lors des anciens essais ne sont donc pas ceux de cette demande. La cause du refus chez le fournisseur n'est pas établie. Aucune connexion, clé ou configuration de l'outil n'a été modifiée et aucune demande échouée n'a été renvoyée.

Relay demandait `haiku` pour créer Claude, mais Claude a annoncé `claude-sonnet-5-5`, également observé à la reprise. Codex a enregistré `gpt-6.1-sol`. Modèles demandés, enregistrés et observés restent distingués. Le scénario Claude attaché porte sur un processus non interactif, pas sur son TUI ni Desktop ; son arrêt a été confirmé. Les journaux MCP Codex restent un indice de neutralisation, pas une preuve universelle d'absence d'exposition.

La configuration globale Palabre est restée identique en contenu et date de modification. Seules les données et approbations temporaires prévues par le smoke Relay ont été créées. Conversations de test, exports et traces privées restent locaux ; aucun identifiant ou message n'est publié dans ce bilan.

### Reprise ciblée avec DeepSeek Free

Le mainteneur a ensuite autorisé explicitement de nouveaux essais avec `opencode/deepseek-v4.1-flash-free`, sans modifier les réglages habituels. Ils ont été exécutés sur `f57e752`, dont le runtime, les scripts et le paquet sont identiques à `f5070c6` ; seuls les documents de qualification avaient changé. Les versions des outils sont restées celles indiquées ci-dessus.

**14 scénarios réussis sur 14, aucun échec ni cas ignoré**, en 582,9 s : les dix Ask et les quatre Débats comportant OpenCode. Les six Débats déjà réussis sans OpenCode ni synthèse OpenCode n'ont pas été rejoués. Les quatorze demandes ont un nouveau sujet de qualification et de nouvelles conversations ; aucun message échoué n'a été renvoyé.

Un lanceur local reprend le smoke compilé officiel : filtre des quatorze cas, ajout de `--model-a` ou `--model-b` pour le participant OpenCode et de `--summary-model` pour ses synthèses Ask, puis capture locale des sorties. Les critères NDJSON, compteurs de réponses, synthèses, exports, délais et refus des sorties invalides sont conservés. La comparaison indépendante confirme que la fonction d'analyse est identique. Aucun code produit ni script versionné n'a changé.

Les quatorze exports ont été contrôlés avec leurs captures : deux réponses et une synthèse non vides par scénario, sortie CLI réussie et aucun événement d'erreur. La relecture sans génération des dix-huit demandes OpenCode correspondantes confirme un résultat `succeeded` et le modèle **`opencode/deepseek-v4.1-flash-free`** réellement utilisé. La configuration globale Palabre est restée identique en contenu et date de modification ; aucun réglage ni connexion d'outil n'a été modifié par l'agent. Le choix de modèle n'est passé que par les options de ces demandes.

Cette réussite conserve les quatorze refus d'authentification de la première campagne. Elle qualifie ce parcours avec DeepSeek Free ; elle n'établit ni la cause du refus de `iceman-contributor-free`, ni son rétablissement.

## État de la qualification avant publication

Les vingt scénarios presets prévus ont désormais chacun un résultat réussi : six Débats dans la première campagne et quatorze cas lors de la reprise ciblée autorisée. **La couverture est acquise en deux séquences, avec un choix de modèle et un sujet différents ; ce n'est pas une campagne unique 20/20 à environnement constant.** Relay a réussi ses 22 vérifications sur le même runtime. Ces résultats et leurs limites doivent être examinés avant l'accord de fusion, puis de tag et publication ; aucune de ces actions n'est effectuée par cette qualification.

Le test débutant sur CoolMaster et l'essai utilisateur Mac sur npm 0.21.0 restent des travaux distincts, sans résultat annoncé. Les fiches correspondantes ne qualifient pas Bunny. Le pilote OpenCode sur copie, Chat et les interfaces Desktop ne sont pas couverts exhaustivement par les deux campagnes ci-dessus.

## Étapes de publication distinctes

- Finaliser la revue indépendante et vérifier la CI du commit final de cette PR.
- Terminer les campagnes réelles autorisées, consigner leurs révisions, résultats et limites, puis obtenir l'accord de fusion.
- Après fusion, obtenir l'accord pour créer et pousser uniquement `v0.22.0` sur le commit courant de `main`. Ce push déclenche le workflow : publication npm par Trusted Publishing, release GitHub, synchronisation du site vers `dev` et post social prévu. Aucune publication npm locale.
- La promotion du site `dev` vers `main` et son déploiement de production restent distincts, après publication réussie. Ne pas promouvoir une annonce de version non publiée.
- Les copies installées du skill restent intactes. L'agent peut relire le paquet exécuté ; un éventuel alignement disque passe par un plan humain confirmé issu du paquet publié, puis rechargement du skill dans l'outil. Ne jamais synchroniser depuis cette branche.
