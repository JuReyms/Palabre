---
title: Roadmap
description: Découvrir ce qui est déjà disponible dans Palabre et les améliorations envisagées pour les prochaines versions.
seo:
  title: Ce qui existe déjà et ce qui est prévu
  description: Voir ce que Palabre fait déjà aujourd'hui et les améliorations prévues pour les prochaines versions.
---

Cette page donne une vue d'ensemble des évolutions prévues pour Palabre. Elle aide les utilisateurs à comprendre où va le projet, sans promettre de date de livraison.

## Direction du produit

Palabre aide à **mieux décider et travailler** en faisant coopérer les outils IA que vous choisissez. Croiser les regards peut faire apparaître une erreur, un oubli ou une autre approche ; l’accord entre agents demande toujours des preuves et des vérifications. Vous gardez la maîtrise des décisions, du budget et du choix des outils.

Les quatre modes répondent à des besoins complémentaires :

- **Relay** : déléguer une analyse, du codage ou une relecture selon le parcours, échanger directement et récupérer le résultat ;
- **Ask** : recueillir des avis indépendants ;
- **Débat** : confronter des arguments et expliciter les arbitrages ;
- **Chat** : avancer avec un interlocuteur et consulter un autre agent.

Relay conserve un chef de mission piloté par l’utilisateur et un suivi GitHub facultatif par travail. Les résultats utiles peuvent rejoindre une issue ou une PR dans un cadre autorisé ; les échanges intermédiaires et les usages sans GitHub restent simples. Chaque outil garde ses abonnements, modèles, quotas et permissions ; aucune économie ni correction automatique des erreurs n’est garantie.

## Disponible aujourd'hui

PALABRE propose quatre modes : **Débat**, **Relay**, **Ask** et **Chat**, avec vos agents installés.

- Débat contradictoire, Ask indépendant (1 à 4 agents) et Chat avec second avis explicite ; après Débat/Ask, Chat reprend le sujet et la synthèse.
- Relay vers Codex ou Claude Code fermé ; `--open` vers Codex ouvert sous Windows, macOS ou Linux (pilote, `python3` requis sur POSIX), avec ses propres outils et permissions, sans affichage immédiat garanti.
- Restitution Relay légère et proportionnée ; lien GitHub et participant déclarés facultatifs dans les messages et traces locales, sans accès ni publication GitHub.
- Publication distincte d’un bilan Relay choisi sur une issue ou PR existante : aperçu exact, compte/visibilité, confirmation humaine clavier, commentaire attribué et lien confirmé ; aucune politique globale ajoutée.
- Parcours historiques Mission, revue GitHub COMMENT et `--write` : gelés, hors parcours par défaut ; correctifs de sécurité seulement.
- Configuration locale/globale, détection et synchronisation prudente des agents, presets et modèles choisis par les CLI.
- [Interface TUI](/fr/usage/tui), skill pour agents et extension VS Code.
- Contexte `--files` / `--context`, prévisualisation, synthèses Débat/Ask et exports Markdown ; historique Débat/Ask/Chat.
- Checkpoints opt-in Débat/Ask et reprise sans rejouer les réponses acceptées ; export partiel si possible après échec.
- Diagnostics `usage-limit` et `readAccess`, indication de reprise lorsqu’elle est fournie, aucun renvoi automatique.
- `palabre doctor`, contrats JSON/NDJSON et `palabre update` avec confirmation.

## Prochaines améliorations

1. **Synthèses dans GitHub** : étudier la sélection explicite d’une synthèse Ask/Débat pour le même socle de publication, sans publier l’export complet ([#122](https://github.com/JuReyms/Palabre/issues/122)).
2. **Continuité du travail** : retrouver un résultat après interruption sans renvoyer la demande ; qualifier séparément les cas restant ambigus ([#146](https://github.com/JuReyms/Palabre/issues/146)).
3. **OpenCode** : étendre la qualification du pilote sur copie, avant tout nouveau parcours CLI/Desktop ([#136](https://github.com/JuReyms/Palabre/issues/136)).
4. **Budget et diagnostics** : informations fournisseur datées ou estimations explicites, sans bascule automatique ([#41](https://github.com/JuReyms/Palabre/issues/41)).
5. **Agents locaux compatibles OpenAI** (llama.cpp, LM Studio…) pour Débat, Ask et Chat ([#120](https://github.com/JuReyms/Palabre/issues/120)).

## En exploration

- **Relay vers une conversation Claude Code ouverte** : recherche d'un mécanisme officiel et d'une corrélation fiable des réponses ([#193](https://github.com/JuReyms/Palabre/issues/193)). Aucun délai ni garantie ; aujourd'hui, aucun envoi n'est possible vers une conversation Claude ouverte.

## Philosophie

Palabre restera centré sur un principe simple : piloter les outils IA que vous avez déjà installés, sans remplacer leurs comptes, leurs modèles, leurs abonnements ou leurs règles de confidentialité. Son différenciateur est le désaccord organisé, la synthèse explicite et l’action sous contrôle.
