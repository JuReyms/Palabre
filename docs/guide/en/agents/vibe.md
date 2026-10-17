---
title: Mistral Vibe
description: Configure Mistral Vibe CLI in Palabre and use it as a CLI agent in a debate pair.
seo:
  title: Use Mistral Vibe as a debate agent
  description: Configure Mistral Vibe CLI in Palabre and use it as a debate agent alongside Claude Code, Codex, or Ollama.
---

Mistral Vibe is a development assistance CLI. Palabre uses it in programmatic mode with `--prompt`, then captures its text output.

## Install before Palabre

Install and configure Mistral Vibe outside Palabre, then verify that the command works:

```bash
vibe --version
```

If Mistral Vibe was installed after your first Palabre configuration, open `palabre` again or synchronize explicitly:

```bash
palabre config --sync-agents
```

## Windows

See [Launching agents on Windows](/en/agents/overview#windows).

## Default model

Palabre does not choose the Mistral Vibe model for you. Vibe uses its own default configuration. If you pass a model with `--model-a`, `--model-b`, or `--summary-model`, Palabre passes the value through the configured model option.

## Typical configuration

Excerpt from the `agents` block:

```json
"vibe": {
  "type": "cli",
  "command": "vibe",
  "args": ["--output", "text", "--trust", "--enabled-tools", "read", "--enabled-tools", "grep", "--prompt"],
  "promptMode": "argument",
  "modelArg": "--model",
  "role": "reviewer"
}
```

`--enabled-tools read --enabled-tools grep` disables every other tool in programmatic mode.
`--trust` only skips the working-directory trust prompt; it does not authorize additional tools.

## Usage

```bash
palabre codex-vibe "Review this plan" -t 4
palabre vibe-claude "Compare these options" -t 3
```

Mistral Vibe participates in Debate, Ask and Chat, not as a Relay target. The prompt is an argument; if no safe launch is available, PALABRE refuses the shell wrapper. A recognized limit gives `usage-limit`, without automatic retry.
