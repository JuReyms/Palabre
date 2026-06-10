---
title: Configuration
description: Understand the Palabre configuration file and the commands available to create or modify it.
---

The configuration tells Palabre which agents exist, which agents to use by default, and where to write exports. If `outputDir` is not defined, `.debate.md` files are created in the default `.palabre/` folder.

## Create a configuration

```bash
palabre init
```

This command creates a global configuration at:

```text
~/.palabre/palabre.config.json
```

For a configuration specific to the current project:

```bash
palabre init --local
```

This creates:

```text
./palabre.config.json
```

## View useful configuration

```bash
palabre agents
palabre doctor
```

`palabre agents` displays declared agents and their local detection. `palabre doctor` checks for common errors.

## Modify common settings

```bash
palabre config
```

The assistant lets you define or remove default settings. The direct commands below let you change a single setting without going through the full assistant.

Useful direct commands:

```bash
palabre config --set-defaults codex claude --summary-agent claude -t 4
palabre config -t 3
palabre config --summary-agent claude
palabre config --clear-defaults
palabre config --sync-agents
palabre config --ollama-models --json
palabre config --set-ollama-model gemma4:e4b
palabre config --sync-ollama-model
```

## Go further

- [Default settings](/en/configuration/defaults)
- [Local vs global configuration](/en/configuration/local-vs-global)
- [Advanced JSON](/en/configuration/advanced-json)
