---
title: Installation
description: Install Palabre from npm, verify the command, and prepare the AI agents used by debates and Ask requests.
seo:
  title: Install from npm and set up your AI agents
  description: Install Palabre globally with npm, verify the command, and connect Claude Code, Codex, OpenCode, or Ollama before your first debate.
---

## Prerequisites

Palabre requires:

- Node.js 20 or higher;
- at least one agent already installed on your machine among Claude Code, Codex CLI, Antigravity CLI, OpenCode, Mistral Vibe, or Ollama.

Two or more agents are recommended: debates need a pair, and Ask mode is most useful when comparing several independent answers.

## Install Palabre

Palabre is published as a Node.js package on npm. Install it globally with your preferred package manager:

```bash
# npm
npm install --global palabre

# pnpm
pnpm add --global palabre

# Yarn
yarn global add palabre

# Bun
bun add --global palabre
```

Palabre is not a Python package, so `pip` cannot install it. There is no official `curl` installer either; do not use an undocumented `curl ... | sh` command.

Then verify that the command is available:

```bash
palabre --version
palabre --help
```

## Install from the source repository

This section is for people who want to test Palabre from the Git repository. It requires `pnpm`.

```bash
git clone https://github.com/JuReyms/Palabre.git
cd Palabre
pnpm install
pnpm build
pnpm link --global
palabre --version
```

Throughout the rest of this documentation, examples always use the final user command `palabre`.

## Install agents

Palabre drives external tools. Install and authenticate the agents you want to use before launching Palabre.

Access conditions, models and limits for Claude Code, Codex, Antigravity, OpenCode and Mistral Vibe depend on their provider and your configuration. With Ollama and a locally installed model, requests run on your machine; a remote server receives the data you send it.

Useful pages:

- [Claude Code](/en/agents/claude-code)
- [Codex](/en/agents/codex)
- [Antigravity](/en/agents/antigravity)
- [OpenCode](/en/agents/opencode)
- [Mistral Vibe](/en/agents/vibe)
- [Ollama](/en/agents/ollama)

## Next step

Now run `palabre` in an interactive terminal. On first launch, Palabre creates the global configuration if needed, detects installed agents, and opens the TUI home screen.

For explicit setup, scripts, or a project-local configuration, see [the configuration guide](/en/get-started/configuration). If you use VS Code, you can also install the [Palabre extension](/en/get-started/vscode-extension). To drive Palabre from an AI agent, install the [Palabre skill](/en/get-started/skill).

## Update

Moving to another computer, including a previously used one? Follow [Change machines](/en/get-started/change-machine): inventory without changes, updates and a new Relay conversation.

`palabre update` detects the installation and skill copies, shows the plan and asks for one confirmation in an interactive terminal. Copies are refreshed from the new package after backup outside skill directories, preserving junctions. `palabre update --check` checks without modifying the installation. For the skill only, without network: `palabre skill --sync`. Your assistant can reread the current instructions without restarting; details: [Palabre skill](/en/get-started/skill).

After a direct update with your package manager (for example `npm install --global palabre`), installed copies remain untouched. Palabre reports differences in an interactive terminal, without changing machine output. Your assistant can reread the current package instructions and continue within existing authorization, without asking you to synchronize or restart. To also align installed files if you wish, `palabre skill --check` checks their state and `palabre skill --sync` shows a plan to confirm, backing up replaced copies. See [Palabre skill](/en/get-started/skill).

Identical files do not prove what the agent has loaded.

Relay and its Mission option use existing Codex or Claude Code conversations. Each provider sets its own access conditions and limits; PALABRE does not replace them.
