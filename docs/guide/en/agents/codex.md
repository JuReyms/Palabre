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

Palabre only passes the prompt. If you specify `--model-a` or `--model-b`, the value is passed to the CLI via its configured model argument.

## Typical configuration

```json
"codex": {
  "type": "cli",
  "command": "codex",
  "args": ["exec", "--skip-git-repo-check", "--color", "never", "--sandbox", "read-only"],
  "promptMode": "stdin",
  "role": "implementer"
}
```

On Windows, generated configuration enables `shell` for some npm or PowerShell wrappers. Palabre first tries the native executable, then the PowerShell `.ps1` shim; only force this option when your installation needs it. Claude is different in many Windows installations: `claude.exe` is generally called directly with `shell: false`.

## Usage

```bash
palabre codex-claude "Critique this architecture" -t 4
palabre codex-opencode "Compare these two approaches" -t 3
```
