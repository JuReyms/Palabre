---
title: Default settings
description: Define or remove the agents, number of turns, and summary used by default.
---

Default settings are used when you start a debate without specifying all agents or all options. They can be partial: you can define only the number of turns, only the summary, or a complete agent pair.

## Set default agents

```bash
palabre config --set-defaults codex claude
```

After this command:

```bash
palabre -s "Critique this plan"
```

uses `codex` as agent A and `claude` as agent B.

## Set the default summary

```bash
palabre config --summary-agent claude
```

If no summary agent is defined, Palabre uses agent B. To remove this setting without deleting the other default settings:

```bash
palabre config --summary-agent none
```

## Set default Ask agents

```bash
palabre config --ask-agents codex claude opencode
```

Ask mode accepts 1 to 4 agents. Without this setting, Palabre uses the default debate pair.

To choose a summary agent specific to Ask mode:

```bash
palabre config --ask-summary-agent opencode
```

This setting is separate from `--summary-agent`, so debate and Ask can use different summary agents.

## Set the default mode

```bash
palabre config --mode ask
```

Accepted values are `debate` and `ask`. In the TUI, you can also switch mode with `/ask` or `/debat`.

## Set the number of turns

```bash
palabre config -t 4
```

`turns` is the total number of debate turns. Palabre accepts a value between 1 and 20.

## Set the language

```bash
palabre config --language en
```

The configured language controls the Palabre interface and the prompts sent to agents. You can override it for one command with `--language <fr|en>`, `--lang <fr|en>`, or the `PALABRE_LANGUAGE` environment variable.

In the TUI, open `/config`, then use:

```text
/language fr
/language en
```

The `/lang fr` alias is also accepted.

## Set the default interface

```bash
palabre config --interface tui
```

`tui` is the recommended behavior when using Palabre in an interactive terminal. To use raw terminal rendering by default:

```bash
palabre config --interface terminal
```

## Clear default settings

```bash
palabre config --clear-defaults
```

After that, use a preset or explicit agents:

```bash
palabre codex-claude "Subject" -t 4
palabre run --subject "Subject" --agent-a codex --agent-b claude
```
