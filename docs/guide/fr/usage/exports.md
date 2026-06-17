---
title: Exports
description: Savoir où Palabre écrit les exports Markdown et ce qu'ils contiennent après un débat ou une demande Ask.
---

Chaque session génère un export Markdown dans le dossier défini par `outputDir` :

- `.debate.md` pour un débat ;
- `.ask.md` pour une demande Ask.

Par défaut, les exports sont regroupés dans un dossier `.palabre/` sous le dossier depuis lequel vous lancez `palabre`. À la fin de la session, le terminal affiche une ligne `Palabre exporte:` suivie du chemin complet du fichier.

## Contenu de l'export

Le fichier contient :

- une table d'en-tête avec le sujet, les agents, les modèles, la date locale et le fuseau horaire ;
- la liste des fichiers injectés dans le contexte ;
- le transcript complet du débat, ou les réponses indépendantes des agents en mode Ask ;
- la synthèse finale si elle est activée.

## Nom du fichier

Le nom contient une version courte du sujet et un horodatage. Cela rend les débats plus faciles à retrouver tout en gardant un nom unique :

```text
palabre-critique-ce-plan-technique-2026-05-06T08-52-43-000Z.debate.md
palabre-compare-ces-approches-2026-05-06T08-52-43-000Z.ask.md
```

Si le sujet ne contient aucun caractère exploitable, Palabre utilise `debat` ou `ask` comme nom court selon le mode.

## Synthèse finale

La synthèse est séparée du transcript par une ligne horizontale. Elle commence par une table courte : agent, rôle et date.

## Aperçu Windows

Certains aperçus Windows interprètent `:**` comme un émoji. Palabre remplace cette séquence par `&#58;**` dans les contenus exportés.

Le rendu Markdown reste visuellement équivalent, mais l'aperçu Windows évite l'interprétation en émoji.

## Changer le dossier de sortie

Dans la configuration avancée :

```json
{
  "outputDir": ".palabre"
}
```

Les prochains exports seront placés dans ce dossier.
