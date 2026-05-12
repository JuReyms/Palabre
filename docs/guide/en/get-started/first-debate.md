---
title: Your first debate
description: Start a first debate with the interactive assistant or a short command, then find the Markdown export.
---

```bash
palabre new
```

The `palabre new` command is an interactive assistant that lists available agents, asks for a subject, displays the equivalent command, and can launch the debate as soon as the minimum information is provided.

## Launch with default agents

If you have [configured default agents](/en/configuration/defaults):

```bash
palabre -s "Critique this technical plan" -t 4
```

`-s` sets the subject. `-t 4` requests four turns in total, not four turns per agent.

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

During the debate, Palabre displays responses in the terminal. At the end, it exports a `.debate.md` file containing:

- session information;
- injected file context;
- the full transcript;
- the final summary;
- a short prose conclusion.

By default, the [export](/en/usage/exports) is created in a `.palabre/` folder under the folder from which you run the command. At the end of the debate, Palabre displays the full path of the exported file in the terminal.

To go further, see [Running a debate](/en/usage/running-a-debate), [Context and files](/en/usage/context-and-files), and [Summaries](/en/usage/summaries).
