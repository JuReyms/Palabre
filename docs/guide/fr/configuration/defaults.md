---
title: Paramètres par défaut
description: Définir ou supprimer les agents, le nombre de réponses et la synthèse utilisés par défaut.
---

Les paramètres par défaut sont utilisés quand vous lancez un débat sans préciser tous les agents ou toutes les options. Ils peuvent être partiels : vous pouvez définir seulement le nombre de réponses, seulement la synthèse, ou une paire d'agents complète.

## Définir les agents par défaut

```bash
palabre config --set-defaults codex claude
```

Après cette commande :

```bash
palabre -s "Critique ce plan"
```

utilise `codex` en agent A et `claude` en agent B.

## Définir la synthèse par défaut

```bash
palabre config --summary-agent claude
```

Si aucun agent de synthèse n'est défini, Palabre utilise l'agent B. Pour retirer ce réglage sans supprimer les autres paramètres par défaut :

```bash
palabre config --summary-agent none
```

## Définir le nombre de réponses

```bash
palabre config -t 4
```

`turns` est le nombre total de réponses du débat. Palabre accepte une valeur entre 1 et 20.

## Définir la langue de l'interface

```bash
palabre config --language en
```

La langue configurée contrôle progressivement l'interface Palabre. Vous pouvez la forcer pour une commande avec `--language <fr|en>`, `--lang <fr|en>` ou la variable d'environnement `PALABRE_LANGUAGE`.

## Supprimer les paramètres par défaut

```bash
palabre config --clear-defaults
```

Après cela, utilisez un preset ou des agents explicites :

```bash
palabre codex-claude "Sujet" -t 4
palabre run --subject "Sujet" --agent-a codex --agent-b claude
```
