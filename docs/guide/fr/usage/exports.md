---
title: Exports
description: Savoir où Palabre écrit les exports Markdown et ce qu'ils contiennent pour Débat, Relay, Ask, Chat et l’option Mission.
seo:
  title: Exports Markdown de chaque session
  description: Retrouver les exports Débat, Relay, Ask, Chat et de l’option Mission, leurs diagnostics et leurs limites.
---

Les exports utilisent `outputDir` (`.palabre/` par défaut) :

- `.debate.md` pour Débat ;
- `.relay.md` pour Relay, sauf `--no-export` et refus avant lancement ;
- `.ask.md` pour Ask ;
- `.chat.md` pour Chat après `/end` ou en cas d'erreur, lorsque l'écriture est possible.

L'option Mission de Relay écrit état et export `.mission.md` dans `.palabre/missions/<id>/`, indépendamment de `outputDir`.

Par défaut, les exports sont regroupés dans un dossier `.palabre/` sous le dossier depuis lequel vous lancez `palabre`. À la fin d'une session TUI, Palabre affiche le fichier exporté et son dossier avec des liens cliquables dans les terminaux compatibles. La commande `/history` permet de retrouver les derniers exports depuis l'accueil TUI.

## Contenu de l'export

Le fichier contient :

- une table d'en-tête avec le sujet, les agents, les modèles, la date locale et le fuseau horaire ;
- la liste des fichiers injectés dans le contexte ;
- le transcript complet de la conversation ou du débat, ou les réponses indépendantes des agents en mode Ask ;
- la raison et l'heure de fin d'une conversation Chat, avec le message d'erreur lorsqu'elle a échoué ;
- la synthèse finale de Débat ou Ask si elle est activée.

## Nom du fichier

Le nom contient une version courte du sujet et un horodatage. Cela rend les débats plus faciles à retrouver tout en gardant un nom unique :

```text
palabre-critique-ce-plan-technique-2026-05-06T08-52-43-000Z.debate.md
palabre-clarifie-cette-architecture-2026-05-06T08-52-43-000Z.chat.md
palabre-compare-ces-approches-2026-05-06T08-52-43-000Z.ask.md
```

Si le sujet ne contient aucun caractère exploitable, Palabre utilise `debat`, `chat` ou `ask` comme nom court selon le mode.

## Synthèse finale

En Débat et Ask, la synthèse est séparée du transcript par une ligne horizontale. Elle commence par une table courte : agent, rôle et date. Chat n'ajoute pas de synthèse automatique : il conserve la conversation et sa raison de fin.

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

## Historique

Depuis la TUI :

```text
/history
```

La vue historique affiche les derniers exports `.debate.md`, `.chat.md` et `.ask.md`, leur mode, les agents, le nombre de tours ou réponses, le fichier et le dossier de sortie. Hors TUI, utilisez `palabre history` ou `palabre history --json`.

## Particularités et confidentialité

Débat et Ask conservent une section « Interruption » en cas d'échec ; leurs exports et celui de Chat indiquent version de PALABRE et provenance du client déclaré. Un `.relay.md` indique version de PALABRE, expéditeur, cible et UUID, objet éventuel, message, réponse ou erreur, délivrance, diagnostics et éventuelle publication de revue. Une indication de reprise `retryAfter` n'est présente que si ce parcours la fournit. Retirez les identifiants et données sensibles avant tout partage public.

Exemple Relay : `palabre-relay-codex-2026-05-06T08-52-43-000Z.relay.md` ; son nom dépend de l'agent cible, pas du sujet. Les chemins relatifs `outputDir` sont résolus depuis le dossier de lancement. Modifiez la configuration locale ou globale puis réapprouvez son contenu si l'édition est manuelle.

`/history` et `palabre history` ne listent que Débat, Ask et Chat. Retrouvez Relay dans `outputDir` et Mission avec `palabre mission status <id>`.
