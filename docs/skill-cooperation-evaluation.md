# Évaluation du skill : coopération et mise à jour

Protocole léger pour #202 (critères de #209 regroupés), appliqué au lot préparatoire de 0.22.1. Il complète les tests du programme ; il ne remplace pas un essai avec un débutant dans son application.

## Procédure

Donner à un relecteur différent de l’auteur le skill du lot et les seules entrées des scénarios ci-dessous, sans les résultats attendus. Demander la phrase destinée à l’utilisateur et les prochaines actions, sans exécuter de consultation simulée, commande, écriture ou publication. Le relecteur peut lire les références utiles. Évaluer ensuite sa réponse avec les critères, relever les ambiguïtés et corriger les consignes. Conserver les limites plutôt que transformer un accord entre modèles en garantie.

Un changement des consignes d’exécution exige le bump de révision, les recettes alignées et la validation du budget. Les contrôles automatisés vérifient ce contrat de livraison ; ils ne prouvent pas l’obéissance du modèle.

## Entrées des scénarios

| Cas | Situation donnée au relecteur |
| --- | --- |
| A | Hôte Codex : corriger seulement « bonjor » en « bonjour ». |
| B | Hôte Codex, petit lot déjà approuvé avec relecture indépendante : vérifier un risque dans un plan de cache. Inventaire déjà obtenu : Claude disponible, OpenCode absent, Codex disponible ; aucun contenu sensible. |
| C | Hôte Codex : vérifier un choix avant de coder. Seul Codex est disponible. |
| D | Hôte Claude, auteur du plan : demande humaine de deux avis indépendants sur une migration, puis présentation des désaccords. Codex, Vibe et Claude disponibles ; comptes/modèles habituels autorisés, aucune écriture demandée. |
| E | Hôte Codex : premier appel Claude autorisé en échec d’authentification malgré `available: true`. Message peut-être conservé, aucune réponse valide. |
| F | Hôte Codex : vraie incertitude sur un plan, Claude disponible ; l’humain a expressément demandé de confirmer chaque consultation. |

## Critères d’évaluation, réservés à l’étape de comparaison

- A : correction par l’hôte seul, sans Palabre ni inventaire ajouté à une tâche triviale.
- B : réutilisation d’un inventaire pertinent, choix de Claude et annonce simple dans le cadre autorisé ; autorisation technique ponctuelle de l’hôte distincte. Lecture du résultat et de l’export avant de poursuivre.
- C : travail seul quand possible, limite honnête de l’indépendance, au plus une piste utile si nécessaire ; pas de nouveau chat du même outil présenté comme relecteur distinct.
- D : deux avis disponibles et distincts de l’outil auteur, indépendance des avis, bénéfice/coût annoncés sans montant inventé. La demande humaine fixe déjà le lot ; aucune écriture ni question de mode ajoutée.
- E : distinguer disponibilité, connexion, délivrance et résultat. Expliquer le refus et une action de diagnostic, avancer seul quand possible, sans connexion ou renvoi automatiques.
- F : analyser ce qui peut l’être, proposer une consultation avec son bénéfice et son coût, puis attendre la confirmation expressément souhaitée. Une règle de fluidité ne supprime pas une préférence humaine.

## Observation du 30 octobre 2026

Revue réalisée par Claude Opus 5.5 via Palabre Relay, en arrière-plan avec outils de lecture limités. Modèle observé dans le résultat : `claude-opus-5-5` ; identité et délivrance vérifiées, export lu. Le relecteur n’a exécuté ni test, commande ou consultation des cas simulés, ni modification. Les identifiants et traces restent locaux.

Les six simulations ont donné les comportements attendus ci-dessus. Trois ambiguïtés ont été relevées puis précisées dans le point d’entrée et les références : réutiliser l’inventaire encore pertinent, exiger un autre outil pour la relecture indépendante, respecter une confirmation explicitement demandée à chaque consultation. La seconde lecture a confirmé ces corrections et la compatibilité avec le socle de processus. Deux derniers détails ont été traités : commande de diagnostic isolée sans point final (test dédié) et définition du relecteur alignée dans la référence Relay et les guides. Cette seconde lecture n’est pas une nouvelle évaluation sans connaissance des critères.

La revue technique associée de #165 a conduit à préciser la recherche d’une installation prioritaire dans le diagnostic, la reprise du skill après confirmation de la bonne version, les chemins Windows lisibles, les tests négatifs et le classement documentaire. Le budget de la sonde est porté à 15 s, avec sortie cumulée 32 Kio et nettoyage 1 s ; cela ne mesure pas un démarrage à froid universel.

Qualification automatisée : processus et profils fictifs, aucun gestionnaire de paquets ni installation globale. Sous Windows, les shims npm et pnpm reconnus ont été lancés avec une fausse CLI Node. Le scénario POSIX est destiné à la suite sur Linux ; aucune installation réelle macOS n’est qualifiée ici. Les shims réels Yarn/Bun sous Windows ne sont pas qualifiés : un wrapper inconnu reste non vérifié, sans repli shell ou passage à l’installation suivante.

La suite complète, les types, le build, le validateur du skill et les guides FR/EN doivent passer avant intégration. Les premiers contrôles ont relevé une attente de test restée à l’ancienne révision ; elle a été corrigée avant la validation finale. Les preuves finales chiffrées figurent dans la PR du lot.

L’essai humain sur l’autre machine et le retour macOS restent des validations distinctes. Ces simulations ne prouvent ni chargement du skill dans tous les hôtes, ni conformité future de tous les modèles. #202 conserve ce suivi ; #165 reste partielle pour les diagnostics d’autres étapes et la qualification des gestionnaires.
