---
title: Introduction
description: Comprendre ce que fait Palabre, comment il orchestre vos agents IA et quelles garanties de confidentialité il apporte.
---

Palabre est un orchestrateur CLI/TUI pour agents IA déjà installés sur votre machine.

L'objectif est simple : vous donnez un sujet, Palabre orchestre les agents, affiche leurs réponses dans le terminal, puis exporte le transcript complet avec une synthèse finale.

Deux modes sont disponibles :

- `debate` : deux agents dialoguent tour à tour sur un sujet ;
- `ask` : plusieurs agents répondent indépendamment à la même demande, puis un agent de synthèse résume fidèlement chaque réponse et les compare.

Palabre ne remplace pas Claude Code, Codex CLI, Gemini CLI, Antigravity CLI, OpenCode, Mistral Vibe ou Ollama. Il les pilote. Vous gardez donc vos outils, vos abonnements, vos modèles par défaut et vos habitudes de terminal.

Palabre s'exécute localement sur votre machine. Il n'envoie aucune donnée à un serveur appartenant à Palabre. Les prompts, fichiers et transcripts sont transmis uniquement aux agents que vous choisissez d'utiliser.

La confidentialité dépend donc des agents sélectionnés. Avant d'envoyer du code, des documents ou des données sensibles à Claude Code, Codex CLI, Gemini CLI, Antigravity CLI, OpenCode, Mistral Vibe, Ollama ou tout autre agent configuré, vérifiez leurs propres politiques de confidentialité et les paramètres de votre compte.

## À quoi sert Palabre ?

Palabre est utile pour :

- comparer deux agents sur une même question ;
- comparer plusieurs réponses indépendantes avec le mode Ask ;
- obtenir une relecture critique d'une idée ;
- confronter un modèle local Ollama à une CLI plus puissante ;
- produire un transcript Markdown partageable ;
- transformer une discussion IA en consensus, désaccords, actions proposées et conclusion.

## Ce que Palabre fait

Palabre :

- détecte les CLIs disponibles sur votre machine ;
- ouvre une interface TUI par défaut avec `palabre` dans un terminal interactif ;
- lance les agents en mode batch ;
- injecte le sujet, le contexte de session et l'historique du débat dans chaque tour ;
- peut lancer des demandes Ask sans conversation entre agents ;
- peut ajouter des fichiers ou dossiers de projet au contexte ;
- génère une synthèse finale ;
- exporte la session dans un fichier `.debate.md` ou `.ask.md`.

## Ce que Palabre ne fait pas

Palabre ne fournit pas d'accès payant aux modèles. Il ne crée pas de compte Claude, OpenAI, Google ou Ollama. Chaque agent doit être installé et authentifié séparément.

Palabre ne garde pas non plus une session interactive ouverte avec les CLIs. Chaque réponse est produite par un appel batch. La mémoire du débat vient du transcript que Palabre réinjecte à chaque tour.

## Suite

Commencez par [installer Palabre](/fr/get-started/installation), puis [lancez une première session](/fr/get-started/first-debate). La page [configuration](/fr/get-started/configuration) explique les détails quand vous voulez plus de contrôle.
