---
title: VS Code extension
description: Install the Palabre extension to run Debate, Chat, or Ask sessions from VS Code using agents exposed by the CLI.
seo:
  title: "Palabre for VS Code: multi-agent AI conversations"
  description: Install Palabre for VS Code to run Debate, Chat, or Ask sessions, compare AI agents, add project context, and follow the results in the editor.
---

The VS Code extension adds a Palabre panel to the editor. It lets you prepare a subject, choose agents, add workspace context, follow a Debate, Chat, or Ask session, and open the matching Markdown export.

**In Chat, you can switch the active agent, request a one-off opinion from another agent, or continue the conversation with that agent.**

The extension remains a thin client: it launches `palabre` locally and consumes the public CLI contracts. Palabre CLI remains the source of truth for agents, presets, context, errors, and exports.

## Install the extension

[Install Palabre for VS Code](https://marketplace.visualstudio.com/items?itemName=JuReyms.palabre-vscode)

After installation, open the Palabre panel from the sidebar.

## Requirements

- Palabre CLI installed on the same machine;
- Palabre CLI `0.12.0` or newer recommended;
- at least one available agent for Chat or Ask, two for Debate.

```bash
palabre --version
palabre doctor
palabre presets --json
```

## Current features

- Debate, Chat, or Ask selection and available agents;
- context selection through the official CLI scan;
- NDJSON response, summary, and error rendering;
- opening `.debate.md`, `.chat.md`, and `.ask.md` exports;
- stopping Palabre and its child agents;
- quick settings and diagnostics.

For Chat, choose **Chat** in the extension. The CLI keeps the conversation state and exposes the same behavior through its public NDJSON contract.

If the extension cannot find Palabre, check `palabre --version` and restart VS Code. If no agent appears, run `palabre doctor` and `palabre config`.
