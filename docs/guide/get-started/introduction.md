---
title: Introduction
description: Comprendre ce que fait Palabre, comment il orchestre vos agents IA et quelles garanties de confidentialité il apporte.
---

Palabre est un orchestrateur de débats entre agents IA déjà installés sur votre machine.

L'objectif est simple : vous donnez un sujet, Palabre fait dialoguer deux assistants, affiche leurs réponses dans le terminal, puis exporte le transcript complet avec une synthèse finale.

Palabre ne remplace pas Claude Code, Codex CLI, Gemini CLI, OpenCode ou Ollama. Il les pilote. Vous gardez donc vos outils, vos abonnements, vos modèles par défaut et vos habitudes de terminal.

Palabre s'exécute localement sur votre machine. Il n'envoie aucune donnée à un serveur appartenant à Palabre. Les prompts, fichiers et transcripts sont transmis uniquement aux agents que vous choisissez d'utiliser.

La confidentialité dépend donc des agents sélectionnés. Avant d'envoyer du code, des documents ou des données sensibles à Claude Code, Codex CLI, Gemini CLI, OpenCode, Ollama ou tout autre agent configuré, vérifiez leurs propres politiques de confidentialité et les paramètres de votre compte.

## À quoi sert Palabre ?

Palabre est utile pour :

- comparer deux agents sur une même question ;
- obtenir une relecture critique d'une idée ;
- confronter un modèle local Ollama à une CLI plus puissante ;
- produire un transcript Markdown partageable ;
- transformer une discussion IA en consensus, désaccords, actions proposées et conclusion.

## Ce que Palabre fait

Palabre :

- détecte les CLIs disponibles sur votre machine ;
- lance les agents en mode batch ;
- injecte le sujet, le contexte de session et l'historique du débat dans chaque tour ;
- peut ajouter des fichiers ou dossiers de projet au contexte ;
- génère une synthèse finale ;
- exporte la session dans un fichier `.debate.md`.

## Ce que Palabre ne fait pas

Palabre ne fournit pas d'accès payant aux modèles. Il ne crée pas de compte Claude, OpenAI, Google ou Ollama. Chaque agent doit être installé et authentifié séparément.

Palabre ne garde pas non plus une session interactive ouverte avec les CLIs. Chaque réponse est produite par un appel batch. La mémoire du débat vient du transcript que Palabre réinjecte à chaque tour.

## Suite

Commencez par [installer Palabre](/get-started/installation), puis lancez [la première configuration](/get-started/configuration).
