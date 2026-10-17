---
title: Roadmap
description: Découvrir ce qui est déjà disponible dans Palabre et les améliorations envisagées pour les prochaines versions.
seo:
  title: Ce qui existe déjà et ce qui est prévu
  description: Voir ce que Palabre fait déjà aujourd'hui et les améliorations prévues pour les prochaines versions.
---

Cette page donne une vue d'ensemble des évolutions prévues pour Palabre. Elle aide les utilisateurs à comprendre où va le projet, sans promettre de date de livraison.

## Direction du produit

Palabre aide à **mieux décider avant d’agir**. C’est un harnais d’intelligence collective orchestrée : il fait dialoguer les outils IA que vous avez choisis, organise les avis contradictoires et rend les décisions explicites.

Les évolutions futures s’inscrivent dans une même session, plutôt que dans une multiplication de modes indépendants :

- **Consulter** : discuter avec un agent, demander plusieurs avis ou lancer un débat ;
- **Décider** : synthétiser, approfondir une conclusion, préparer ou faire relire un plan ;
- **Agir** : préparer une action et, seulement après confirmation explicite, la déléguer à un outil adapté.

L’action reste optionnelle et sous le contrôle de l’utilisateur. Palabre n’a pas vocation à remplacer les assistants de code ou les outils spécialisés : son rôle est d’éclairer une décision et d’enchaîner proprement vers l’étape suivante quand vous le souhaitez.

## Disponible aujourd'hui

PALABRE propose quatre modes : **Débat**, **Relay**, **Ask** et **Chat**, avec vos agents installés.

- Débat contradictoire, Ask indépendant (1 à 4 agents) et Chat avec second avis explicite ; après Débat/Ask, Chat reprend le sujet et la synthèse.
- Relay vers Codex ou Claude Code fermé ; `--open` vers Codex ouvert sous Windows (pilote), avec ses propres outils et permissions, sans affichage immédiat garanti.
- Revue GitHub COMMENT sur dépôt autorisé par `palabre relay allow-repo` ; en-tête PALABRE, objet facultatif, JSON et export `.relay.md`.
- Option Mission de Relay : étapes en lecture seule dans un cadre et un budget fixés avec vous.
- Configuration locale/globale, détection et synchronisation prudente des agents, presets et modèles choisis par les CLI.
- [Interface TUI](/fr/usage/tui), skill pour agents et extension VS Code.
- Contexte `--files` / `--context`, prévisualisation, synthèses Débat/Ask et exports Markdown ; historique Débat/Ask/Chat.
- Checkpoints opt-in Débat/Ask et reprise sans rejouer les réponses acceptées ; export partiel si possible après échec.
- Diagnostics `usage-limit` et `read-unavailable`, indication de reprise lorsqu’elle est fournie, aucun renvoi automatique.
- `palabre doctor`, contrats JSON/NDJSON et `palabre update` avec confirmation.

## Prochaines améliorations

### Diagnostic plus utile

`palabre doctor` est le premier réflexe quand quelque chose ne fonctionne pas. Il affiche un diagnostic lisible par sections et garde `--terminal` pour les logs. Les prochaines améliorations continueront à rendre ses messages plus actionnables pour les problèmes courants : agent introuvable, configuration incomplète, modèle Ollama manquant, PATH incorrect ou quota atteint côté provider.

### Intégrations plus robustes

Palabre expose déjà des contrats JSON pour les presets, le scan de contexte et le rendu NDJSON des débats. Les prochaines améliorations viseront à garder ces contrats stables, mieux documentés et plus faciles à consommer par l'extension VS Code ou d'autres intégrations.

### Configuration plus simple

La commande `palabre config`, la vue TUI `/config`, la configuration de premier lancement et la synchronisation des agents connus couvrent déjà les réglages courants : agents par défaut, rôles, nombre de tours, agent de synthèse, mode par défaut, interface par défaut et rafraîchissement des agents détectés. Les prochaines améliorations viseront surtout des messages plus clairs, de meilleures validations et des wizards plus complets pour les choix qui méritent de la découverte.


### Conversation après le débat

Après la synthèse finale d'un débat ou d'un Ask, `/chat` permet maintenant de poursuivre avec un agent actif. Le contexte transmis indique sa provenance et reprend le sujet avec la synthèse finale, ou les six échanges récents lorsqu'aucune synthèse n'existe. La conversation reste stateless et bornée ; les sessions Chat persistantes et le streaming restent des évolutions distinctes.

### Tests et stabilité

Les tests reproductibles couvrent déjà l'adapter CLI, le renderer NDJSON, la disponibilité des presets et la résolution du dossier d'export. La suite consiste à élargir progressivement cette couverture aux autres comportements sensibles, sans appeler de vrais services IA pendant les tests automatisés.

## Ensuite

Ces sujets sont envisagés après stabilisation du CLI :

- reprise d'un débat depuis un export Markdown existant, distincte de `palabre resume` qui reprend un checkpoint Palabre ;
- provider compatible OpenAI local pour LM Studio, LocalAI, vLLM ou équivalent ;
- maintenance continue de la documentation française et anglaise ;
- interface CLI multilingue français/anglais à continuer d'affiner, avec un futur choix interactif de langue dans les flows de premier lancement ou de configuration ;
- TUI plus avancée avec scrolling, panneaux persistants, pause et reprise ;
- affichage fiable des modèles quand Palabre pourra les connaître sans bruit inutile.

## Philosophie

Palabre restera centré sur un principe simple : piloter les outils IA que vous avez déjà installés, sans remplacer leurs comptes, leurs modèles, leurs abonnements ou leurs règles de confidentialité. Son différenciateur est le désaccord organisé, la synthèse explicite et l’action sous contrôle.
