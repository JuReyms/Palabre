---
title: Installation
description: Install Palabre from npm, verify the command, and prepare the AI agents used by debates and Ask requests.
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
pnpm install
pnpm build
pnpm link --global
palabre --version
```

Throughout the rest of this documentation, examples always use the final user command `palabre`.

## Install agents

Palabre drives external tools. Install and authenticate the agents you want to use before launching Palabre.

**OpenCode**, **Mistral Vibe**, and **Ollama** can be used with models or limits specific to their providers, while **Claude Code** and **Codex** generally require a subscription.

**Ollama** is free for local use. If you use a cloud or remote offering, quotas and limits come from that offering, not from Palabre.

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
