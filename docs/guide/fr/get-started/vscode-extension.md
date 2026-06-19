---
title: Extension VS Code
description: Installer l'extension Palabre pour lancer des débats depuis VS Code avec les agents et presets exposés par la CLI.
---

L'extension VS Code ajoute un panneau Palabre dans l'éditeur. Elle permet de préparer un sujet, choisir des agents, ajouter du contexte de workspace, suivre la session et ouvrir l'export Markdown sans quitter VS Code.

Elle ne remplace pas la CLI : l'extension lance `palabre` en local et consomme les contrats publics du CLI (`presets --json`, `context scan --json` et rendu NDJSON). Palabre CLI reste donc la source de vérité pour les agents, les presets, le scan de contexte, les erreurs et les exports.

## Installer l'extension

L'extension est disponible sur le Visual Studio Marketplace :

[Installer Palabre pour VS Code](https://marketplace.visualstudio.com/items?itemName=JuReyms.palabre-vscode)

Après installation, ouvrez le panneau Palabre depuis la barre latérale de VS Code.

## Prérequis

L'extension nécessite :

- Palabre CLI installé sur la même machine ;
- Palabre CLI `0.8.1` ou plus récent recommandé ;
- au moins un agent compatible configuré ou détecté par Palabre ; deux ou plus sont recommandés pour les comparaisons.

Vérifiez l'installation depuis un terminal :

```bash
palabre --version
palabre doctor
palabre presets --json
```

## Ce que l'extension apporte

- choix des agents disponibles à partir des presets exposés par la CLI ;
- sélection de contexte workspace via le scan officiel de Palabre ;
- affichage des réponses, de la synthèse et des erreurs dans une interface VS Code ;
- bouton pour ouvrir le fichier `.debate.md` ou `.ask.md` exporté ;
- bouton d'arrêt qui annule le processus Palabre et ses agents enfants ;
- réglages rapides pour le preset par défaut, l'agent de synthèse, la langue, le nombre de tours, la synchronisation des agents et le modèle Ollama quand Ollama est disponible ;
- accès rapide à `Palabre: Run Doctor` et à l'Output channel Palabre en cas d'erreur.

## Dépannage rapide

Si l'extension ne trouve pas Palabre, vérifiez que `palabre --version` fonctionne dans un terminal et redémarrez VS Code après une installation globale.

Si aucun agent n'apparaît, lancez `palabre doctor` puis vérifiez votre configuration avec `palabre config`.

Pour signaler un problème lié à l'extension, utilisez le dépôt public Palabre : [github.com/JuReyms/Palabre/issues](https://github.com/JuReyms/Palabre/issues).
