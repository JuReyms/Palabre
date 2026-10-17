---
title: Codex
description: Configure Codex CLI in Palabre, optionally choose a model, and recognize common errors.
seo:
  title: Use Codex CLI as a debate agent
  description: Configure Codex CLI in Palabre, pick a model, pair it against Claude Code, and recognize the errors that come up most often.
---

Codex CLI lets you use Codex from the terminal.

Palabre can launch it as a debate agent, often as agent A to propose an initial solution.

## Install before Palabre

Install and configure Codex CLI outside of Palabre. Consult the official documentation, then verify the command:

Official documentation: [https://help.openai.com/en/articles/11096431-openai-codex-cli-getting-started](https://help.openai.com/en/articles/11096431-openai-codex-cli-getting-started)

GitHub repository: [https://github.com/openai/codex](https://github.com/openai/codex)

```bash
codex --version
```

If Codex was installed after your first Palabre configuration, open `palabre` again or synchronize explicitly:

```bash
palabre config --sync-agents
```

## Account, model, and limits

Codex keeps its own configuration: provider, default model, sandbox, approvals, and usage limits.

PALABRE passes the prompt with configured arguments, read-only by default (`--sandbox read-only`). If you specify `--model-a` or `--model-b`, the value is passed to the CLI via its configured model argument.

## Typical configuration

Excerpt from the `agents` block:

```json
"codex": {
  "type": "cli",
  "command": "codex",
  "args": ["exec", "--skip-git-repo-check", "--color", "never", "--sandbox", "read-only"],
  "promptMode": "stdin",
  "shell": true,
  "tier": "primary",
  "role": "implementer"
}
```

On Windows, generated configuration enables `shell` for some npm or PowerShell wrappers. Palabre first tries the native executable. For a CLI installed with npm or pnpm, it reads the `.ps1` shim and launches Node and the package script directly, without PowerShell, which preserves accents and arguments; for pnpm, the shim's `NODE_PATH` is reproduced. A shim of another form (modified, or whose script is not a `.js` file) is still launched through PowerShell; only force this option when your installation needs it. Claude is different in many Windows installations: `claude.exe` is generally called directly with `shell: false`.

## Usage

```bash
palabre codex-claude "Critique this architecture" -t 4
palabre codex-opencode "Compare these two approaches" -t 3
```

## Codex and Relay

Closed conversation: read-only resumption, without plugins, connectors or MCP, using the model saved in the conversation. Open conversation: `--open` (Windows pilot), with the target's own tools and permissions; immediate display is not guaranteed. See [Relay](/en/usage/relay).

With `--open`, a structured limit gives `usage-limit` and `retryAfter` when supplied. Without `--open`, `CreateProcessAsUserW failed: 5` during a read produces `read-unavailable`; the reply is preserved and no review is published. See [Troubleshooting](/en/troubleshooting).

The configuration example is for Windows (`shell: true`); elsewhere, generated configuration uses `false`.
