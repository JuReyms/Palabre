# Vision produit de Palabre

## Promesse

> Mieux travailler et se corriger entre outils, tout en gardant l’humain dans la boucle.

Formulation développée, précisée avec le propriétaire le 31 octobre 2026 : **Palabre aide chacun à faire travailler ensemble ses outils IA pour croiser les regards, se corriger et avancer, en gardant la maîtrise de ses décisions, de son budget et de ses choix d’outils.**

Palabre est le produit global : il facilite la coopération entre les outils IA choisis par l’utilisateur, les avis croisés et l’aide à la décision. Il rend les échanges et les arbitrages plus simples à suivre et peut préparer une action sous contrôle humain. Il ne remplace pas les outils IA existants : sa valeur doit se mesurer à ce qu’il épargne à l’utilisateur en manipulations, pertes de fil et vérifications de coordination.

## Produit et modes : deux niveaux distincts

**Décision du propriétaire, 26 octobre 2026.** Cette distinction doit rester explicite dans les consignes aux agents, le README, la documentation et le site. Une promesse propre à un mode ne doit pas être présentée comme le fonctionnement de tout Palabre.

### 1. Palabre, le produit

Formulation de référence pour présenter l’ensemble :

> Faites coopérer vos outils IA, croisez leurs avis et avancez dans vos décisions comme dans votre travail.

Cette promesse rassemble plusieurs usages. Elle ne signifie pas que chaque mode confronte des arguments, délègue des tâches ou relie des conversations existantes.

### 2. Les modes, des usages précis

| Mode | Besoin auquel il répond |
| --- | --- |
| **Relay** | Faire communiquer et travailler des outils IA entre leurs conversations précises : confier une tâche, demander un avis ou une relecture, récupérer le résultat. L’exécution dépend des capacités et permissions du parcours. |
| **Débat** | Confronter les arguments de deux agents au fil des tours, puis synthétiser les désaccords et arbitrages. |
| **Ask** | Recueillir plusieurs avis indépendants sur une même question, puis les comparer ou les synthétiser. |
| **Chat** | Échanger avec un agent, avec la possibilité d’en consulter un autre. |

Ces modes partagent les intentions de consultation, décision et action sous contrôle ; ils ne partagent pas nécessairement les mêmes transports, permissions ou interfaces. Relay peut être mis en avant dans la présentation sans devenir la définition du produit entier. Ne pas employer « mode Palabre » comme synonyme de Relay ou de Débat.

## Le parcours de coopération propre à Relay

L’utilisateur échange dans son outil habituel avec un **chef de mission** qui coordonne le travail. Un **coéquipier**, dans un autre outil, reçoit une tâche ou une demande de relecture. L’humain garde la main et peut consulter les conversations pour comprendre les échanges, les résultats et les désaccords. Ces termes décrivent la coordination Relay, pas les rôles configurables de Débat, Ask et Chat.

Exemple : l’utilisateur demande une correction à son chef de mission. Celui-ci peut confier une analyse, du codage ou une relecture à un coéquipier, selon les permissions du parcours. Les résultats reviennent directement au chef de mission, qui coordonne les corrections et restitue le résultat ou un résumé à l’utilisateur. Chaque étape reste dans le cadre humain autorisé, sans boucle automatique.

### Une méthode légère et un suivi GitHub facultatif

Une délégation précise l’objectif, le périmètre et le résultat attendu, avec le contexte utile et les vérifications demandées. Le retour distingue travail réalisé, vérifications et preuves, limites ou blocages, puis suite utile. La forme reste proportionnée : une question simple appelle une réponse simple. Le chef de mission garde la responsabilité de la restitution et attribue les contributions sans déduire une réussite du seul statut de transport.

Le suivi GitHub se rattache au **travail en cours**, pas à toute la conversation ni à une installation. Une issue peut porter le problème et son suivi, une PR les changements et leur revue, un commentaire un bilan, une vérification, un blocage ou une décision. Les échanges intermédiaires restent possibles directement par Relay ; tous n’ont pas vocation à être publiés. Sans rattachement désigné, la conversation et les exports suffisent. La présence d’un dépôt Git ne choisit jamais ce suivi à la place de l’utilisateur.

Le premier lot porte le lien explicite et le nom déclaré du participant dans l’enveloppe et les traces locales. Il ne contacte pas GitHub, ne publie rien et n’autorise aucune publication. La publication d’un bilan choisi est un lot ultérieur, distinct des parcours Mission/review/write gelés.

L’attribution distingue le compte GitHub qui publie, le participant déclaré et l’intervention concernée. Un nom stable peut distinguer deux conversations utilisant le même outil ; il ne constitue ni une identité authentifiée ni un relecteur indépendant. Les identifiants privés de conversation, nonces et historiques restent locaux. Un commentaire sous le compte de l’utilisateur ne prouve pas que l’humain a donné un accord.

La visibilité en direct est un objectif du parcours, pas une garantie sur toutes les interfaces. En particulier, ne pas présenter l’envoi dans une conversation Claude Desktop ouverte comme acquis. Les capacités effectivement prises en charge restent décrites dans les guides [Relay français](guide/fr/usage/relay.md) et [anglais](guide/en/usage/relay.md), par outil et parcours.

## Coopération native et valeur de Relay

**Décision du propriétaire, 30 octobre 2026.** Codex → Codex reste une compatibilité utile, sans devenir un argument central de Relay. Son intérêt se mesure au gain pour l’utilisateur ; la coopération entre outils différents, le parcours CLI et les traces d’échange sont des raisons concrètes de choisir Relay.

Quand l’hôte fournit un envoi vers la conversation désignée et la lecture de sa réponse, privilégier ce parcours natif s’il est vérifié, autorisé pour cette cible et suffisant pour la tâche. Relay reste disponible sur demande explicite, pour une qualification de Palabre ou pour un besoin précis de CLI/export. Ne pas l’imposer comme préalable à toute coopération dans Codex.

Cette règle ne promet aucune capacité native dans toutes les versions, applications ou interfaces : l’agent vérifie les outils réellement disponibles et les permissions requises. Le choix intervient avant l’envoi. Une demande explicite de Relay reste respectée ; un refus de permission ou une délivrance incertaine n’autorise aucun contournement ou renvoi par l’autre parcours. Ne pas attribuer les garanties, statuts ou exports de Relay à un échange natif.

Deux modèles utilisés dans Codex restent des perspectives d’un même outil ; leur différence ne constitue pas à elle seule un croisement d’outils. Cette décision concerne le parcours de coopération de Relay ; Débat, Ask et Chat gardent leurs usages propres.

## Contexte, quotas et vérification croisée

- **Même projet, conversations distinctes.** Partager les fichiers ne partage pas automatiquement la mémoire. Le chef de mission transmet l’objectif, les décisions et le contexte utile ; les agents conservent leurs conversations propres. Ne pas promettre une mémoire commune sans mécanisme explicite.
- **Plusieurs outils, quotas distincts.** Répartir les tâches permet d’utiliser les outils et abonnements déjà disponibles. Les échanges consomment aussi du temps et des quotas : ni fusion des quotas, ni économie garantie, ni bascule automatique au premier épuisement.
- **Liberté de choix et de budget.** L’utilisateur peut composer avec plusieurs offres accessibles, découvrir différents environnements et modèles et changer un outil sans abandonner sa méthode de travail. Ne pas imposer une offre coûteuse ni multiplier les consultations sans bénéfice attendu ; les prix et disponibilités appartiennent aux fournisseurs.
- **Mieux se corriger, pas garantir la vérité.** Les agents peuvent repérer les erreurs des autres, mais aussi se tromper ensemble. Préserver les avis indépendants quand ils sont utiles, expliciter les désaccords et demander des preuves et vérifications. Un accord entre modèles ne prouve pas que la proposition est correcte.

## Expérience utilisateur

**Décision du propriétaire, 29 octobre 2026.** Elle vaut pour Palabre et ses quatre modes. L'humain exprime un objectif, un doute ou un choix ; il n'a pas à connaître Palabre, un mode, un outil, un identifiant ou une option. L'agent propose la coopération adaptée et son bénéfice, l'explique sans jargon, puis prend en charge outils, conversations et contrôles dans les autorisations existantes.

- Questions de travail : résultat attendu, compromis, périmètre ; ne pas faire choisir transport, identifiant ou option dans le parcours courant. Une cible ambiguë se lève en demandant le sujet ou le projet, jamais en choisissant la plus récente.
- Proposer sans imposer : pas de consultation ni de formulaire ajoutés à une tâche simple.
- L'explication accompagne l'action, pas seulement l'erreur. Une impossibilité réelle se dit : ce qui manque et une prochaine action compréhensible, sans cacher le blocage ni supposer un accord.
- Données sensibles, nouvelles autorisations et actions non couvertes restent des décisions humaines ; les autorisations techniques de l'hôte restent distinctes. Modes, permissions et capacités conditionnelles ne changent pas.
- Les détails techniques restent accessibles sur demande, pour diagnostiquer ou pour les utilisateurs avancés, sans en imposer la lecture.

Critère : un nouvel utilisateur npm avance sans soulever le capot.

## Règle de rédaction pour les agents

Avant de rédiger une accroche, un exemple ou une explication, nommer son niveau : **Palabre globalement** ou **un mode précis**. Présenter d’abord le bénéfice du produit, puis le fonctionnement du mode concerné. Ne pas généraliser à tous les modes le chef de mission, les conversations reliées ou la visibilité Relay ; ne pas généraliser non plus à tout Palabre les tours contradictoires et la synthèse de Débat. Distinguer les capacités actuelles, leurs limites et les objectifs futurs.

## Rôles respectifs

```text
Les outils IA analysent et réalisent les tâches autorisées.
Palabre facilite la coordination et la restitution des résultats.
L’utilisateur décide.
```

L’intelligence propre de Palabre est une intelligence de processus : contexte de session, choix des rôles et des agents, comparaison des réponses, contrôle des passages entre consultation, décision et action, et garde-fous humains. Elle ne doit pas devenir un cerveau opaque qui décide seul.

## Capacités et politiques produit

Le moteur distingue une capacité de son exposition dans une interface ou un produit. Une capacité désactivée doit être refusée par le CLI/API, pas seulement cachée dans l’UI.

Des profils peuvent sélectionner les capacités autorisées :

- **simple** : débat, Ask, synthèse et export ;
- **décision** : suivi conversationnel, plans et revue de plan ;
- **action contrôlée** : actions explicitement confirmées ;
- **produit dérivé** : politique de capacités adaptée, sans forker le moteur d’orchestration.

## Principes de conception

- Toute nouvelle fonctionnalité est soit une manière de consulter, soit un artefact de décision, soit une action confirmée ; jamais un nouveau silo.
- Les intégrations restent des clients minces du CLI ; la logique produit appartient au cœur Palabre.
- Une sélection automatique d’agents doit être explicable et toujours remplaçable par un choix utilisateur.
- Toute mutation passe par le contrat d’action contrôlée : capacité autorisée, aperçu, confirmation, exécution et trace.
- La mémoire de décision reste distincte de l’export Markdown et de l’état machine de reprise ; elle exige des choix explicites de confidentialité et de conservation.

## Maturation

Ce document contient les principes stabilisés. Les hypothèses, arbitrages en cours et dépendances de livraison restent dans l’issue de coordination #22 et les issues liées.
