---
title: VS Code extension
description: Install the Palabre extension to run Debate or Ask sessions from VS Code using agents exposed by the CLI.
---

The VS Code extension adds a Palabre panel to the editor. It lets you prepare a subject, choose agents, add workspace context, follow a Debate or Ask session, and open the Markdown export.

**Chat is currently available in the Palabre TUI and direct CLI, but not yet in the VS Code extension.**

The extension remains a thin client: it launches `palabre` locally and consumes the public CLI contracts. Palabre CLI remains the source of truth for agents, presets, context, errors, and exports.

## Install the extension

[Install Palabre for VS Code](https://marketplace.visualstudio.com/items?itemName=JuReyms.palabre-vscode)

After installation, open the Palabre panel from the sidebar.

## Requirements

- Palabre CLI installed on the same machine;
- Palabre CLI `0.12.0` or newer recommended;
- at least one available agent for Ask, two for Debate.

```bash
palabre --version
palabre doctor
palabre presets --json
```

## Current features

- Debate or Ask selection and available agents;
- context selection through the official CLI scan;
- NDJSON response, summary, and error rendering;
- opening `.debate.md` and `.ask.md` exports;
- stopping Palabre and its child agents;
- quick settings and diagnostics.

For Chat, run `palabre` in a terminal and use `/chat`.

If the extension cannot find Palabre, check `palabre --version` and restart VS Code. If no agent appears, run `palabre doctor` and `palabre config`.
