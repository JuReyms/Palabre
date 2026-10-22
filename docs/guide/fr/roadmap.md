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
- Relay vers Codex ou Claude Code fermé ; `--open` vers Codex ouvert sous Windows, macOS ou Linux (pilote, `python3` requis sur POSIX), avec ses propres outils et permissions, sans affichage immédiat garanti.
- Revue GitHub COMMENT sur dépôt autorisé par `palabre relay allow-repo` ; en-tête PALABRE, objet facultatif, JSON et export `.relay.md`.
- Option Mission de Relay : étapes en lecture seule dans un cadre et un budget fixés avec vous.
- Configuration locale/globale, détection et synchronisation prudente des agents, presets et modèles choisis par les CLI.
- [Interface TUI](/fr/usage/tui), skill pour agents et extension VS Code.
- Contexte `--files` / `--context`, prévisualisation, synthèses Débat/Ask et exports Markdown ; historique Débat/Ask/Chat.
- Checkpoints opt-in Débat/Ask et reprise sans rejouer les réponses acceptées ; export partiel si possible après échec.
- Diagnostics `usage-limit` et `readAccess`, indication de reprise lorsqu’elle est fournie, aucun renvoi automatique.
- `palabre doctor`, contrats JSON/NDJSON et `palabre update` avec confirmation.

## Prochaines améliorations

1. **Relay vers OpenCode, en CLI et en Desktop** : un autre point de vue avec des modèles gratuits ou locaux ([#136](https://github.com/JuReyms/Palabre/issues/136)).
2. **Quotas** : afficher le quota restant de chaque agent et proposer des choix à l'humain ([#41](https://github.com/JuReyms/Palabre/issues/41)).
3. **Relay vers une conversation Claude Code ouverte** ([#96](https://github.com/JuReyms/Palabre/issues/96)).
4. **Lecture de Codex sous Windows** : apporter une solution aux lancements de commandes refusés signalés par `readAccess` ([#128](https://github.com/JuReyms/Palabre/issues/128)).
5. **Agents locaux compatibles OpenAI** (llama.cpp, LM Studio…) pour Débat, Ask et Chat ([#120](https://github.com/JuReyms/Palabre/issues/120)).

## Philosophie

Palabre restera centré sur un principe simple : piloter les outils IA que vous avez déjà installés, sans remplacer leurs comptes, leurs modèles, leurs abonnements ou leurs règles de confidentialité. Son différenciateur est le désaccord organisé, la synthèse explicite et l’action sous contrôle.
