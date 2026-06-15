---
title: Command reference
description: Reference for commands and options available in the Palabre CLI.
---

This page lists the main Palabre commands.

## Startup commands

| Command | Description |
|---------|-------------|
| `palabre init` | Creates the global configuration and detects agents. |
| `palabre init --local` | Creates a configuration in the current folder. |
| `palabre doctor` | Displays a diagnostic by sections: configuration, local tools, agents, and items to check. |
| `palabre agents` | Lists declared agents and their local detection. |
| `palabre -a` | Shortcut for `palabre agents`. |
| `palabre context scan --json` | Previews the project context Palabre would retain. |

## Configuration

| Command | Description |
|---------|-------------|
| `palabre config` | Opens the configuration assistant. |
| `palabre config --set-defaults codex claude` | Sets the default agents. |
| `palabre config -t 4` | Sets the default number of turns. |
| `palabre config --summary-agent claude` | Sets the default summary agent. |
| `palabre config --summary-agent none` | Removes the default summary agent. |
| `palabre config --ask-summary-agent opencode` | Sets the default summary agent for ask mode. |
| `palabre config --mode ask` | Sets the default mode (`debate` or `ask`). |
| `palabre config --ask-agents codex claude opencode` | Sets the default ask agents, 4 maximum. |
| `palabre config --language en` | Sets the Palabre and agent prompt language. |
| `palabre config --clear-defaults` | Removes default settings. |
| `palabre config --sync-agents` | Adds missing detected agents and refreshes known commands. |
| `palabre config --ollama-models --json` | Lists installed Ollama models and the configured model status. |
| `palabre config --set-ollama-model gemma4:e4b` | Sets the model for the `ollama-local` agent. |
| `palabre config --sync-ollama-model` | Replaces the configured Ollama model if it is no longer installed. |

## Debates

| Command | Description |
|---------|-------------|
| `palabre new` | Opens the debate creation assistant. |
| `palabre -s "Subject" -t 4` | Launches with default agents. |
| `palabre codex-claude "Subject" -t 4` | Launches with a preset. |
| `palabre run --subject "Subject" --agent-a codex --agent-b claude` | Launches with explicit agents. |
| `palabre ask "Subject" --agents codex claude` | Runs a request with independent responses. |

## Integrations

| Command | Description |
|---------|-------------|
| `palabre presets --json` | Lists presets and their local availability. |
| `palabre config --ollama-models --json` | Returns local Ollama state as JSON v1 for integrations. |
| `palabre context scan [paths...] --json` | Returns the folders, files, and warnings from the `--context` scan as JSON v1. |

## General options

| Option | Description |
|--------|-------------|
| `-h`, `--help` | Displays help. |
| `-v`, `--version` | Displays the version. |
| `--config <path>` | Uses an explicit configuration file. |
| `--language <fr\|en>`, `--lang <fr\|en>` | Forces the Palabre and agent prompt language for this command. |
| `--plain` | Uses raw terminal rendering. Also useful with `palabre doctor` for logs. |

## Debate options

| Option | Description |
|--------|-------------|
| `-s`, `--subject <text>` | Debate subject. |
| `--topic <text>` | Compatible alias for `--subject`. |
| `--preset <name>` | Selects an agent pair. |
| `--agent-a <name>` | First agent. |
| `--agent-b <name>` | Second agent. |
| `--mode <debate\|ask>` | Selects the orchestration mode. |
| `--agents <names...>` | Ask mode agents, 4 maximum. |
| `-t`, `--turns <number>` | Total number of turns, between 1 and 20. |
| `--no-early-stop` | Disables early stopping. |
| `--model-a <model>` | Model passed to agent A. |
| `--model-b <model>` | Model passed to agent B. |
| `--pull-models` | Allows Ollama to download a missing model. |
| `--summary-agent <name>` | Summary agent. |
| `--summary-model <model>` | Summary model. |
| `--no-summary` | Disables the final summary. |
| `--files <paths...>` | Injects specific files. |
| `--context <paths...>` | Scans text files or folders. |
| `--show-prompt` | Displays the first turn prompt without calling any agent. |

## Update

| Command | Description |
|---------|-------------|
| `palabre update` | Displays update instructions. |
| `palabre update --apply` | Applies the update from a git checkout. |
