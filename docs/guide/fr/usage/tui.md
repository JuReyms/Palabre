---
title: Utiliser la TUI
description: Comprendre l'accueil TUI, choisir les modes et régler une session sans mémoriser les options CLI.
---

```bash
palabre
```

La TUI est l'interface recommandée pour une utilisation humaine. Elle crée la configuration globale au premier lancement, rafraîchit les agents connus et conserve le contexte de navigation entre les sessions.

## Accueil

L'accueil affiche le mode courant — Débat en premier —, les agents et rôles actifs, la synthèse, le nombre de réponses, le dossier courant et les commandes disponibles. Saisissez un sujet directement pour lancer le mode courant.

## Commandes principales

| Commande | Effet |
|----------|-------|
| `/debat` | Passe au mode principal Débat. |
| `/chat` | Ouvre une conversation. |
| `/ask` | Passe aux réponses indépendantes. |
| `/agents` | Affiche ou modifie les agents. |
| `/roles` | Affiche ou modifie les rôles. |
| `/config` | Ouvre les réglages. |
| `/history` | Affiche les exports récents. |
| `/help` | Affiche toutes les commandes. |
| `/home` | Revient à l'accueil. |
| `/quit` | Quitte Palabre. |

## Ajouter du contexte

```text
Relis ce module --files src/auth.ts README.md
Critique l'architecture --context src docs
```

Les chemins contenant des espaces doivent être fournis avec une commande directe.

## Fin d'un Chat

`/end` termine et enregistre ; `/home` revient sans enregistrer ; une erreur produit une transcription partielle quand cela est possible. L'export indique la raison de fin.

Utilisez `--terminal` pour un rendu humain brut. Pour une intégration, utilisez `--renderer ndjson` et la [documentation NDJSON](/fr/integrations/ndjson).
