---
title: Introduction
description: Comprendre ce que fait Palabre, comment il orchestre vos agents IA et quelles garanties de confidentialité il apporte.
seo:
  title: Débats entre agents IA depuis le terminal
  description: Palabre orchestre Claude Code, Codex et Ollama en débats structurés depuis votre terminal. Comprendre son fonctionnement et ce qui reste en local.
---

PALABRE fait coopérer les agents IA déjà installés sur votre machine pour **mieux décider avant d'agir**. Vous gardez vos outils, vos abonnements et vos modèles ; PALABRE organise les échanges et garde une trace Markdown.

## Quatre modes, selon votre besoin

- **Débat** : deux agents se répondent sur un sujet, puis une synthèse dégage les accords et désaccords.
- **Relay** : un agent transmet un message à une conversation Codex ou Claude Code existante et récupère sa réponse, sans copier-coller de votre part.
- **Ask** : jusqu'à quatre agents répondent indépendamment, puis une synthèse résume chaque réponse et les compare.
- **Chat** : vous échangez avec un agent actif et pouvez demander un second avis avec `/consult`.

Pour plusieurs étapes en lecture seule dans un cadre et un budget convenus, Relay propose l'option [Mission](/fr/usage/relay#option-mission). Vous prenez les décisions ; le chef de mission appelle son équipier une étape explicite à la fois.

## À quoi sert PALABRE ?

Comparer des approches, faire critiquer un plan, confronter des avis, ou passer la main à une conversation qui connaît déjà votre projet. Débat et Ask peuvent produire une synthèse finale, désactivable avec `--no-summary` ; Chat et Relay n'en ajoutent pas.

## Ce que PALABRE fait

- détecte les agents installés et ouvre une interface TUI avec `palabre` dans un terminal interactif ;
- joint le sujet, le contexte et l'historique utile aux appels Débat, Ask et Chat ;
- peut transmettre des fichiers choisis avec `--files` ou `--context` ;
- rend un Débat ou un Ask reprenable avec `--checkpoint` et `palabre resume` ;
- relaie un message à une conversation existante avec `palabre relay` ;
- exporte les échanges en `.debate.md`, `.relay.md`, `.ask.md` ou `.chat.md`, et l'option Mission en `.mission.md`.

## Ce qui reste sous votre contrôle

PALABRE n'ouvre pas de compte et ne fournit pas d'accès aux modèles. Chaque agent doit être installé et, si nécessaire, authentifié séparément. Un rôle ou un message d'un autre agent n'autorise pas une action à votre place.

Débat, Ask et Chat lancent un nouvel appel d'agent pour chaque réponse. PALABRE fournit tout le transcript du Débat, ou au plus les six messages récents du Chat. Relay reprend au contraire une conversation existante et peut en modifier l'historique : fermée par défaut, ou ouverte avec `--open` pour Codex sous Windows (pilote). Il ne renvoie jamais un message automatiquement.

## Confidentialité

PALABRE s'exécute localement et n'a pas de serveur. Les prompts, fichiers et échanges vont aux agents choisis, selon leurs politiques et vos réglages. Avec Ollama **et un modèle local sur votre machine**, les requêtes restent locales ; un serveur Ollama distant reçoit les données qui lui sont envoyées.

## Suite

Commencez par [installer PALABRE](/fr/get-started/installation), puis [lancez une première session](/fr/get-started/first-debate). Pour passer la main, consultez [Relay](/fr/usage/relay) ; pour les réglages, [la configuration](/fr/get-started/configuration).
