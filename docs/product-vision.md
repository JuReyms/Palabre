# Vision produit de Palabre

## Promesse

> Mieux travailler et se corriger entre outils, tout en gardant l’humain dans la boucle.

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

Exemple : l’utilisateur prépare une modification avec Codex, Claude la relit, puis Codex corrige et vérifie à partir de cette relecture. Chaque étape est une demande explicite, pas une boucle automatique. La priorité est de rendre ce parcours utile, visible et facile à reprendre, avant d’ajouter de nouvelles fonctions.

La visibilité en direct est un objectif du parcours, pas une garantie sur toutes les interfaces. En particulier, ne pas présenter l’envoi dans une conversation Claude Desktop ouverte comme acquis. Les capacités effectivement prises en charge restent décrites dans les guides [Relay français](guide/fr/usage/relay.md) et [anglais](guide/en/usage/relay.md), par outil et parcours.

## Contexte, quotas et vérification croisée

- **Même projet, conversations distinctes.** Partager les fichiers ne partage pas automatiquement la mémoire. Le chef de mission transmet l’objectif, les décisions et le contexte utile ; les agents conservent leurs conversations propres. Ne pas promettre une mémoire commune sans mécanisme explicite.
- **Plusieurs outils, quotas distincts.** Répartir les tâches permet d’utiliser les outils et abonnements déjà disponibles. Les échanges consomment aussi du temps et des quotas : ni fusion des quotas, ni économie garantie, ni bascule automatique au premier épuisement.
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
