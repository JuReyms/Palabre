# Exports

Chaque débat génère un fichier `.debate.md` dans le dossier défini par `outputDir`.

Par défaut, l'export est créé dans le dossier courant.

## Contenu de l'export

Le fichier contient :

- une table d'en-tête avec le sujet, les agents, les modèles, la date locale et le fuseau horaire ;
- la liste des fichiers injectés dans le contexte ;
- le transcript complet ;
- la synthèse finale si elle est activée.

## Nom du fichier

Le nom contient un horodatage :

```text
palabre-2026-05-06T08-52-43-000Z.debate.md
```

## Synthèse finale

La synthèse est séparée du transcript par une ligne horizontale. Elle commence par une table courte : agent, rôle et date.

## Aperçu Windows

Certains aperçus Windows interprètent `:**` comme un émoji. Palabre remplace cette séquence par `&#58;**` dans les contenus exportés.

Le rendu Markdown reste visuellement équivalent, mais l'aperçu Windows évite l'interprétation en émoji.

## Changer le dossier de sortie

Dans la configuration avancée :

```json
{
  "outputDir": "debates"
}
```

Les prochains exports seront placés dans ce dossier.
