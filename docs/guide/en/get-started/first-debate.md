---
title: Run your first session
description: Open Palabre, run a first debate from the TUI, and find its Markdown export.
---

The recommended path starts with one command:

```bash
palabre
```

In an interactive terminal, Palabre creates the global configuration on first launch when needed, detects installed agents, and opens the TUI home screen. You do not need to memorize a full command to get started.

## 1. Start a Debate

Debate is the primary mode. If needed, enter `/debat`, then choose the pair:

```text
/agents codex claude
```

The first agent answers first; the second responds. `/agents` without arguments displays available choices.

## 2. Enter the subject

```text
Review this technical plan and identify the highest-priority risks
```

To add project context:

```text
Review this architecture --context src docs
```

The agents answer each other, then Palabre produces a final summary when enabled.

## 3. Find the result

Palabre displays the path to the `.debate.md` export. Use `/history` to find Debate, Chat, and Ask exports.

## Try the other modes

| Mode | Agents | Purpose |
|------|--------|---------|
| Debate | 2 | Challenge two positions — primary mode. |
| Chat | 1 active, optional consultation | Work with one agent and request a second opinion. |
| Ask | 1 to 4 | Compare independent answers. |

Switch to Chat with `/chat`, or to Ask with `/ask`.

## Direct commands

They are useful for scripts, integrations, or advanced users:

```bash
palabre codex-claude "Review this plan" --context src -t 4
palabre chat --agent-a codex
palabre ask "Compare these approaches" --agents codex claude opencode
```

In a real terminal, they still use the TUI by default. Add `--terminal` for human-readable logs or `--renderer ndjson` for an integration.

Continue with [Choose a mode](/en/usage/running-a-debate), [Use the TUI](/en/usage/tui), and [Exports](/en/usage/exports).
