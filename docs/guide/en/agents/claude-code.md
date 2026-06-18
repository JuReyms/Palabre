---
title: Claude Code
description: Configure Claude Code in Palabre and understand what Palabre passes to the Claude CLI.
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

Claude often works better with `claude.exe` and `shell: false`, since this binary is generally directly executable. This difference from Codex, Gemini, or OpenCode comes from the fact that those are often npm or PowerShell wrappers on Windows.

## Typical configuration

```json
"claude": {
  "type": "cli",
  "command": "claude.exe",
  "args": ["--print", "--output-format", "text", "--no-session-persistence"],
  "promptMode": "stdin",
  "shell": false,
  "role": "reviewer"
}
```

Claude often works well as `reviewer` or `summarizer`.

## Usage

```bash
palabre codex-claude "Critique this plan" -t 4
palabre run -s "Summarize these options" --summary-agent claude
```
