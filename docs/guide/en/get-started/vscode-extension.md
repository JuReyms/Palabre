---
title: VS Code extension
description: Install the Palabre extension to run debates from VS Code using the agents and presets exposed by the CLI.
---

The VS Code extension adds a Palabre panel to the editor. It lets you prepare a subject, choose two agents, add workspace context, follow the debate, and open the Markdown export without leaving VS Code.

It does not replace the CLI: the extension launches `palabre` locally and consumes the public CLI contracts (`presets --json`, `context scan --json`, and NDJSON rendering). Palabre CLI remains the source of truth for agents, presets, context scanning, errors, and exports.

## Install the extension

The extension is available on the Visual Studio Marketplace:

[Install Palabre for VS Code](https://marketplace.visualstudio.com/items?itemName=JuReyms.palabre-vscode)

After installation, open the Palabre panel from the VS Code sidebar.

## Requirements

The extension requires:

- Palabre CLI installed on the same machine;
- Palabre CLI `0.6.0` or newer;
- at least two compatible agents configured or detected by Palabre.

Verify the installation from a terminal:

```bash
palabre --version
palabre doctor
palabre presets --json
```

## What the extension adds

- agent selection from the presets exposed by the CLI;
- workspace context selection through Palabre's official scan;
- display of debate turns, the final summary, and errors in a VS Code interface;
- button to open the exported `.debate.md` file;
- quick access to `Palabre: Run Doctor` and the Palabre Output channel when something fails.

## Quick troubleshooting

If the extension cannot find Palabre, check that `palabre --version` works in a terminal and restart VS Code after a global install.

If no agent appears, run `palabre doctor`, then check your configuration with `palabre config`.

To report an extension issue, use the public Palabre repository: [github.com/JuReyms/Palabre/issues](https://github.com/JuReyms/Palabre/issues).
