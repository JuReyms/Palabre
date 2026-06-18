---
title: Configuration
description: Understand the Palabre configuration file and the commands available to create or modify it.
---

The configuration tells Palabre which agents exist, which agents to use by default, and where to write exports. If `outputDir` is not defined, `.debate.md` and `.ask.md` files are created in the default `.palabre/` folder.

## Create a configuration

In an interactive terminal, `palabre` creates the global configuration automatically on first launch when none exists, then opens the TUI home screen:

```bash
palabre
```

The explicit command remains available for scripts, CI, or when you want to create a config without entering the TUI:

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
palabre
palabre agents
palabre doctor
```

From the TUI home screen, `/config` shows current settings and `/agents` lists available agents. Outside the TUI, `palabre agents` displays declared agents and their local detection. `palabre doctor` checks for common errors.

When the TUI home screen starts, Palabre conservatively synchronizes known detected agents: it can add missing known agents and refresh known command names, but it does not overwrite custom agents, roles, models, or user defaults.

## Modify common settings

```bash
palabre config
```

In the TUI, `/config` lets you define or remove default settings without leaving Palabre. The direct commands below also let you change a single setting from the terminal or a script.

Useful direct commands:

```bash
palabre config --set-defaults codex claude --summary-agent claude -t 4
palabre config --mode ask --ask-agents codex claude opencode --ask-summary-agent opencode
palabre config --interface tui
palabre config --language en
palabre config -t 3
palabre config --summary-agent claude
palabre config --clear-defaults
palabre config --sync-agents
palabre config --ollama-models --json
palabre config --set-ollama-model <installed-ollama-model>
palabre config --sync-ollama-model
```

In the TUI, the same common settings are available from `/config` with commands such as `/agents`, `/roles`, `/summary`, `/turns`, `/interface`, `/language`, `/mode`, and `/default`.

## Go further

- [Default settings](/en/configuration/defaults)
- [Local vs global configuration](/en/configuration/local-vs-global)
- [Advanced JSON](/en/configuration/advanced-json)
