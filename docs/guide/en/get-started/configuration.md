---
title: First configuration
description: Create a Palabre configuration, detect installed agents, and set useful default settings.
---

## Initialize Palabre

```bash
palabre init
```

This command creates a global configuration at:

```text
~/.palabre/palabre.config.json
```

It also detects locally available tools: Codex, Claude, Gemini, OpenCode, and Ollama.
After creation, Palabre shows the active language and the quick command to switch to the other language.

## Choose the language

By default, Palabre uses French. To switch the interface and the prompts sent to agents to English:

```bash
palabre config --language en
```

To switch back to French:

```bash
palabre config --language fr
```

You can also choose the language directly during initialization:

```bash
palabre init --language en
```

## Verify the installation

```bash
palabre doctor
```

`doctor` does not launch any AI agent. It checks the configuration, available commands, Ollama, and declared local models.

## View declared agents

```bash
palabre agents
```

or:

```bash
palabre -a
```

This command displays the agents present in your configuration and indicates whether they are detected on your machine.

## Choose default agents

The simplest way is to use the assistant:

```bash
palabre config
```

You can also set default agents directly:

```bash
palabre config --set-defaults codex claude --summary-agent claude -t 4
```

Here:

- `codex` responds first;
- `claude` responds second;
- `claude` produces the final summary;
- `-t 4` requests four turns in total.

## Add agents detected later

If you install OpenCode, Gemini, or Ollama after creating the configuration:

```bash
palabre config --sync-agents
```

This command adds missing detected agents without overwriting your existing settings.

## Next step

You can now [start your first debate](/en/get-started/first-debate).
