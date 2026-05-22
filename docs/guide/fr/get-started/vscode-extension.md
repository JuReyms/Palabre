---
title: Extension VS Code
description: Installer l'extension Palabre pour lancer des débats depuis VS Code avec les agents et presets exposés par la CLI.
---

L'extension VS Code ajoute un panneau Palabre dans l'éditeur. Elle permet de préparer un sujet, choisir deux agents, ajouter du contexte de workspace, suivre le débat et ouvrir l'export Markdown sans quitter VS Code.

Elle ne remplace pas la CLI : l'extension lance `palabre` en local et consomme les contrats publics du CLI (`presets --json`, `context scan --json` et rendu NDJSON). Palabre CLI reste donc la source de vérité pour les agents, les presets, le scan de contexte, les erreurs et les exports.

## Installer l'extension

L'extension est disponible sur le Visual Studio Marketplace :

[Installer Palabre pour VS Code](https://marketplace.visualstudio.com/items?itemName=JuReyms.palabre-vscode)

Après installation, ouvrez le panneau Palabre depuis la barre latérale de VS Code.

## Prérequis

L'extension nécessite :

- Palabre CLI installé sur la même machine ;
- Palabre CLI `0.6.0` ou plus récent ;
- au moins deux agents compatibles configurés ou détectés par Palabre.

Vérifiez l'installation depuis un terminal :

```bash
palabre --version
palabre doctor
palabre presets --json
```

## Ce que l'extension apporte

- choix des agents disponibles à partir des presets exposés par la CLI ;
- sélection de contexte workspace via le scan officiel de Palabre ;
- affichage des tours, de la synthèse et des erreurs dans une interface VS Code ;
- bouton pour ouvrir le fichier `.debate.md` exporté ;
- accès rapide à `Palabre: Run Doctor` et à l'Output channel Palabre en cas d'erreur.

## Dépannage rapide

Si l'extension ne trouve pas Palabre, vérifiez que `palabre --version` fonctionne dans un terminal et redémarrez VS Code après une installation globale.

Si aucun agent n'apparaît, lancez `palabre doctor` puis vérifiez votre configuration avec `palabre config`.

Pour signaler un problème lié à l'extension, utilisez le dépôt public Palabre : [github.com/JuReyms/Palabre/issues](https://github.com/JuReyms/Palabre/issues).
