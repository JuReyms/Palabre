---
title: Claude Code
description: Configure Claude Code in Palabre and understand what Palabre passes to the Claude CLI.
seo:
  title: Use Claude Code as a debate agent
  description: Configure Claude Code in Palabre, see exactly what Palabre passes to the Claude CLI, and pair it against Codex or a local model.
---

Claude Code is Anthropic's CLI for working with Claude from the terminal.

Palabre can use it as a debate agent or as a summary agent.

## Install before Palabre

Install Claude Code from the official Anthropic documentation, then authenticate the CLI in your terminal.

Official documentation: [https://code.claude.com/docs/](https://code.claude.com/docs/)

Then verify that the command works:

```bash
claude --version
```

On Windows, the detected command may be `claude.exe`.

If Claude Code was installed after your first Palabre configuration, open `palabre` again or synchronize explicitly:

```bash
palabre config --sync-agents
```

## Subscription and limits

Claude Code uses the access rules of your Anthropic or Claude account. Palabre does not bypass quotas, usage limits, or subscriptions.

If Claude hits a limit, Palabre displays a short error and you can wait for your usage quota to reset or use a different agent pair.

## Windows

Claude often works better with `claude.exe` and `shell: false`, since this binary is generally directly executable. This difference from Codex or OpenCode comes from the fact that those are often npm or PowerShell wrappers on Windows.

## Typical configuration

Excerpt from the `agents` block:

```json
"claude": {
  "type": "cli",
  "command": "claude.exe",
  "args": ["--print", "--output-format", "text", "--no-session-persistence", "--tools", "Read,Glob,Grep"],
  "promptMode": "stdin",
  "shell": false,
  "role": "reviewer"
}
```

Palabre's default limits Claude tools to `Read`, `Glob`, and `Grep`: the agent can inspect
the project without changing files or running commands. Custom `args` remain unchanged.

Claude often works well as `reviewer` or `summarizer`.

## Usage

```bash
palabre codex-claude "Critique this plan" -t 4
palabre run -s "Summarize these options" --summary-agent claude
```

## Claude Code and Relay

A closed Claude Code conversation can receive a [relay](/en/usage/relay), resumed in plan mode with `Read,Glob,Grep`, without MCP or hooks, under the documented conditional guarantees. An open Claude Code conversation is not an available target (#96). For `review`, PALABRE requires at least 2.1.292 and checks `--safe-mode` in help before reading the PR.

With several CLIs installed, an absolute `command` path is preserved by `--sync-agents`. On macOS/Linux, the generated command is `claude`. A recognized limit gives `usage-limit` without automatic retry; a time is shown only when supplied by the CLI diagnostic.
