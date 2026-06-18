---
title: Your first session
description: Start a first debate or Ask request from the TUI home screen or a short command, then find the Markdown export.
---

```bash
palabre
```

In an interactive terminal, `palabre` opens the TUI home screen. On first launch, it creates `~/.palabre/palabre.config.json` if no config exists yet, detects installed agents, then shows the current mode, agents, roles, summary agent, current folder, and useful commands.

Each time the TUI home screen starts, Palabre refreshes known detected agents in the config. It can add newly installed known agents and update known command names, but it keeps custom agents and user choices intact.

Type your subject in the `Mode debate > Subject >` field, then press Enter. To collect several independent answers instead of a conversation, use `/ask` before entering the subject.

Useful commands from the home screen:

- `/ask` switches to Ask mode;
- `/agents` displays available agents and lets you choose the active agents;
- `/roles` displays available roles and lets you apply them;
- `/config` opens settings without leaving the TUI.

`palabre new` remains available if you prefer a guided assistant that also displays the equivalent command.

## Launch with default agents

If you have [configured default agents](/en/configuration/defaults):

```bash
palabre -s "Critique this technical plan" -t 4
```

`-s` sets the subject. `-t 4` requests four turns in total, not four turns per agent.

## Launch an Ask request

```bash
palabre ask "Compare these two approaches" --agents codex claude opencode
```

In Ask mode, agents answer the same subject independently, without seeing each other's responses. The summary faithfully summarizes each response and compares them. The export uses the `.ask.md` extension.

## Launch with a preset

```bash
palabre codex-claude "Critique this technical plan" -t 4
```

The short syntax `codex-claude` selects the agent pair. The subject can be placed directly after the preset.

## Launch with explicit agents

```bash
palabre run --subject "Critique this technical plan" --agent-a codex --agent-b claude --turns 4
```

This form is longer, but useful in scripts.

## Add project context

To ask agents to read text files or folders:

```bash
palabre codex-claude "Critique this architecture" --context src docs -t 4
```

To provide only a few specific files:

```bash
palabre codex-claude "Review this module" --files src/auth.ts README.md -t 2
```

## Read the result

During the session, Palabre displays responses in the terminal. At the end, it exports a `.debate.md` file for a debate or `.ask.md` for an Ask request, containing:

- session information;
- injected file context;
- the full debate transcript, or the independent agent responses in Ask mode;
- the final summary;
- a short prose conclusion.

By default, the [export](/en/usage/exports) is created in a `.palabre/` folder under the folder from which you run the command. At the end of the debate, Palabre displays the full path of the exported file in the terminal.

To go further, see [Debate and Ask](/en/usage/running-a-debate), [Context and files](/en/usage/context-and-files), and [Summaries](/en/usage/summaries).
