# Vision produit de Palabre

## Promesse

> Palabre aide à mieux décider avant d’agir.

Palabre est un harnais d’intelligence collective orchestrée. Il organise des avis contradictoires entre les outils IA choisis par l’utilisateur, rend les décisions explicites et peut préparer une action qui reste sous son contrôle.

```text
Question → avis contradictoires → décision explicite → plan → action sous contrôle
```

Palabre ne remplace pas les assistants de code ni les outils spécialisés. Son différenciateur est le désaccord organisé, la synthèse explicite et l’action sous contrôle.

## Une session, trois intentions

Les évolutions appartiennent à une même session Palabre, plutôt qu’à une multiplication de modes ou de silos :

- **Consulter** : discuter avec un agent, demander plusieurs avis ou lancer un débat.
- **Décider** : synthétiser, approfondir une conclusion, préparer ou faire relire un plan.
- **Agir** : préparer une action et, seulement après confirmation explicite, la déléguer à un outil adapté.

Le parcours actuel reste le chemin court : un utilisateur peut continuer à lancer un Débat ou un Ask sans rencontrer les capacités avancées. Les suites de session sont contextuelles et optionnelles.

## Rôles respectifs

```text
Les CLIs raisonnent.
Palabre organise, compare, mémorise et gouverne.
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