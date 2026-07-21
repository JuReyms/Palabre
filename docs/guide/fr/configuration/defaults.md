---
title: Paramètres par défaut
description: Définir ou supprimer les agents, le nombre de tours et la synthèse utilisés par défaut.
---

Les paramètres par défaut sont utilisés quand vous lancez une session sans préciser tous les agents ou toutes les options. Ils peuvent être partiels : vous pouvez définir seulement le nombre de tours, seulement la synthèse, ou une paire d'agents complète.

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

## Définir les agents Ask par défaut

```bash
palabre config --ask-agents codex claude opencode
```

Le mode Ask accepte 1 à 4 agents. Sans ce réglage, Palabre utilise la paire de débat par défaut.

Pour choisir un agent de synthèse spécifique au mode Ask :

```bash
palabre config --ask-summary-agent opencode
```

Ce réglage est séparé de `--summary-agent`, afin de pouvoir garder une synthèse différente entre débat et Ask.

## Définir le mode par défaut

```bash
palabre config --mode chat
```

Les valeurs acceptées sont `debate`, `chat` et `ask`. Débat reste le mode principal. Chat utilise `defaults.agentA` comme agent actif initial ; Ask utilise `defaults.askAgents`. Dans la TUI, changez de mode avec `/debat`, `/chat` ou `/ask`.

## Définir le nombre de tours

```bash
palabre config -t 4
```

`turns` est le nombre total de tours du débat. Palabre accepte une valeur entre 1 et 20.

## Définir la langue

```bash
palabre config --language en
```

La langue configurée contrôle l'interface Palabre et les prompts envoyés aux agents. Vous pouvez la forcer pour une commande avec `--language <fr|en>`, `--lang <fr|en>` ou la variable d'environnement `PALABRE_LANGUAGE`.

Dans la TUI, ouvrez `/config`, puis utilisez :

```text
/language fr
/language en
```

Les alias `/lang fr` et `/langue fr` sont aussi acceptés.

## Définir l'interface par défaut

```bash
palabre config --interface tui
```

`tui` est le comportement recommandé pour utiliser Palabre dans un terminal interactif. Pour retrouver le rendu brut par défaut :

```bash
palabre config --interface terminal
```

## Supprimer les paramètres par défaut

```bash
palabre config --clear-defaults
```

Après cela, utilisez un preset ou des agents explicites :

```bash
palabre codex-claude "Sujet" -t 4
palabre run --subject "Sujet" --agent-a codex --agent-b claude
```
