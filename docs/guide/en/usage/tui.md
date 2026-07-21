---
title: Use the TUI
description: Understand the TUI home screen, choose modes, and configure a session without memorizing CLI options.
---

```bash
palabre
```

The TUI is the recommended interface for human use. It creates the global configuration on first launch, refreshes known agents, and keeps navigation context between sessions.

## Home screen

The home screen displays the current mode — Debate first —, active agents and roles, summary settings, response count, working directory, and available commands. Enter a subject directly to run the current mode.

## Main commands

| Command | Effect |
|---------|--------|
| `/debat` | Switches to the primary Debate mode. |
| `/chat` | Opens a conversation. |
| `/ask` | Switches to independent answers. |
| `/agents` | Displays or changes agents. |
| `/roles` | Displays or changes roles. |
| `/config` | Opens settings. |
| `/history` | Displays recent exports. |
| `/help` | Displays all commands. |
| `/home` | Returns home. |
| `/quit` | Quits Palabre. |

## Add context

```text
Review this module --files src/auth.ts README.md
Review the architecture --context src docs
```

Paths containing spaces must be provided with a direct command.

## Ending Chat

`/end` ends and saves; `/home` returns without saving; an error produces a partial transcript when possible. The export records the termination reason.

Use `--terminal` for raw human output. For an integration, use `--renderer ndjson` and the [NDJSON documentation](/en/integrations/ndjson).
