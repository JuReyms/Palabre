---
title: Extension VS Code
description: Installer l'extension Palabre pour lancer des sessions Débat, Chat ou Ask depuis VS Code avec les agents exposés par la CLI.
seo:
  title: "Palabre pour VS Code : conversations entre agents IA"
  description: Installer Palabre pour VS Code afin de lancer des sessions Débat, Chat ou Ask, comparer des agents IA, ajouter le contexte du projet et suivre les résultats.
---

L'extension VS Code ajoute un panneau Palabre dans l'éditeur. Elle permet de préparer un sujet, choisir des agents, ajouter du contexte workspace, suivre une session Débat, Chat ou Ask et ouvrir l'export Markdown correspondant.

**En Chat, vous pouvez changer l'agent actif, demander ponctuellement l'avis d'un autre agent ou poursuivre la conversation avec lui.**

L'extension reste un client mince : elle lance `palabre` en local et consomme les contrats publics du CLI. Palabre CLI demeure la source de vérité pour les agents, presets, contexte, erreurs et exports.

## Installer l'extension

[Installer Palabre pour VS Code](https://marketplace.visualstudio.com/items?itemName=JuReyms.palabre-vscode)

Après installation, ouvrez le panneau Palabre depuis la barre latérale.

## Prérequis

- Palabre CLI installé sur la même machine ;
- Palabre CLI `0.12.0` ou plus récent recommandé ;
- au moins un agent disponible pour Chat ou Ask, deux pour Débat.

```bash
palabre --version
palabre doctor
palabre presets --json
```

## Fonctionnalités actuelles

- choix Débat, Chat ou Ask et des agents disponibles ;
- sélection de contexte via le scan officiel du CLI ;
- rendu des réponses, synthèses et erreurs NDJSON ;
- ouverture des exports `.debate.md`, `.chat.md` et `.ask.md` ;
- arrêt du processus Palabre et de ses agents enfants ;
- réglages rapides et accès au diagnostic.

Pour Chat, choisissez **Chat** dans l'extension. La CLI conserve l'état de la conversation et expose le même comportement via son contrat NDJSON public.

Si l'extension ne trouve pas Palabre, vérifiez `palabre --version` puis redémarrez VS Code. Si aucun agent n'apparaît, lancez `palabre doctor` et `palabre config`.
