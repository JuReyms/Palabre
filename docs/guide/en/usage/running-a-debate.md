---
title: Running a debate
description: Choose agents, turns, presets, and main options to start a Palabre debate.
---

## Guided mode

```bash
palabre new
```

Palabre's assistant helps you choose agents, prepare the subject, and set the main options. This is the best starting point if you are new to Palabre.

## With default agents

```bash
palabre -s "Critique this plan" -t 4
```

This command uses the agents defined in your configuration.

## With a preset

```bash
palabre codex-claude "Critique this plan" -t 4
```

A preset quickly selects an agent pair. Order matters: `codex-claude` has Codex respond first, then Claude.

## With explicit agents

```bash
palabre run --subject "Critique this plan" --agent-a codex --agent-b claude --turns 4
```

This form is longer, but makes the command fully explicit.

## Number of turns

`--turns` or `-t` sets the total number of turns, between 1 and 20.

Example with `codex` as agent A and `claude` as agent B:

| Value | Flow |
|-------|------|
| `-t 2` | codex, then claude |
| `-t 3` | codex, claude, codex |
| `-t 4` | codex, claude, codex, claude |

By default, Palabre may stop before the limit if agents clearly express full agreement after a complete turn.

To force all requested turns:

```bash
palabre codex-claude "Subject" -t 4 --no-early-stop
```

## Choose a model on the fly

Palabre does not list CLI models, as they change frequently. It simply passes the value to the agent. If the model does not exist or is not authorized by your account, the CLI will return the error.

```bash
palabre codex-claude "Subject" --model-a gpt-5.5 --model-b opus-4.7
```

For Ollama:

```bash
palabre codex-ollama "Subject" --model-b gemma4:e4b
```

## Preview without calling AI

```bash
palabre codex-claude "Subject" --show-prompt
```

This command displays the first turn prompt, the agents, and the summary options, then stops. This is useful for verifying the context being sent without consuming an AI request.

## Terminal rendering

Before the first turn, Palabre displays a summary: subject, agents with their roles, number of turns, summary, injected context, and important options. This lets you spot a wrong agent pair or forgotten context before reading the debate.

By default, Palabre uses a readable rendering with headers, separators, structured summary, and generation status.

To get raw rendering suitable for logs:

```bash
palabre codex-claude "Subject" --plain
```
