---
title: Installation
description: Install Palabre from npm, verify the command, and prepare the AI agents used by debates.
---

## Prerequisites

Palabre requires:

- Node.js 20 or higher;
- at least two agents already installed on your machine among Claude Code, Codex CLI, Gemini CLI, OpenCode, or Ollama.

You can use Palabre with only one configured agent, but the main benefit is having two agents dialogue with each other.

## Install Palabre

From npm:

```bash
npm install -g palabre
```

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

**OpenCode** and **Gemini** can be used for free with certain models and limits specific to their providers, while **Claude Code** and **Codex** require a subscription.

**Ollama** is free for local use. If you use a cloud or remote offering, quotas and limits come from that offering, not from Palabre.

Useful pages:

- [Claude Code](/en/agents/claude-code)
- [Codex](/en/agents/codex)
- [Gemini](/en/agents/gemini)
- [OpenCode](/en/agents/opencode)
- [Ollama](/en/agents/ollama)

## Next step

Now proceed to [the first configuration](/en/get-started/configuration).
