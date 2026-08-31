---
title: Utiliser la TUI
description: Comprendre l'accueil TUI, choisir les modes et régler une session sans mémoriser les options CLI.
seo:
  title: Lancer une session depuis l'interface terminal
  description: Utiliser la TUI Palabre pour choisir un mode, sélectionner les agents et régler une session sans mémoriser les options.
---

```bash
palabre
```

La TUI est l'interface recommandée pour une utilisation humaine. Elle crée la configuration globale au premier lancement, rafraîchit les agents connus et conserve le contexte de navigation entre les sessions.

## Accueil

L'accueil résume la session courante sur deux lignes : mode, agents, rôles, nombre de réponses et agent de synthèse. Il affiche ensuite les raccourcis essentiels, les syntaxes `--context` et `--files`, puis le dossier courant. Si un agent nécessaire à la session n'est pas disponible, un avertissement apparaît sous le dossier et indique `/agents` ou `/config` selon le réglage à corriger.

Saisissez un sujet directement pour lancer le mode courant. Tapez `/` pour ouvrir la liste contextuelle des commandes ; utilisez les flèches, `Tab` ou `→` pour compléter, puis `Entrée` pour lancer.

`/help` regroupe les commandes selon le parcours utilisateur : démarrer, préparer, continuer puis naviguer. `/config` montre d'abord la session active et les réglages courants ; tapez `/` dans son composeur pour accéder aux réglages avancés. Une commande inconnue affiche un message explicite dans chaque écran au lieu de changer de vue silencieusement.

## Composer une nouvelle session

`/new` ouvre un parcours guidé commun à Chat, Débat et Ask. Choisissez le mode, les agents puis le sujet. Palabre affiche un récapitulatif compact et propose ensuite de lancer la session, de la personnaliser ou de l'annuler.

La personnalisation donne accès au nombre de réponses, aux modèles transmis aux agents, à la synthèse, au contexte et aux options de rendu. Les identifiants de modèle restent ceux de la CLI concernée ; Palabre ne maintient pas de catalogue de modèles distants.

## Commandes principales

| Commande | Effet |
|----------|-------|
| `/` | Affiche les commandes utiles dans la vue courante. |
| `/new` | Compose une session Chat, Débat ou Ask pas à pas. |
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
