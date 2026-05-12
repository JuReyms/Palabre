---
title: Presets
description: List and principle of agent pair presets usable in short commands.
---

Presets let you quickly select an agent pair.

## Short syntax

```bash
palabre codex-claude "Subject" -t 4
```

This command is equivalent to choosing `codex` as agent A and `claude` as agent B.

## Common presets

| Preset | Typical use |
|--------|-------------|
| `codex-claude` | Codex proposes, Claude reviews. |
| `claude-codex` | Claude proposes, Codex reviews. |
| `codex-gemini` | Codex vs. Gemini comparison. |
| `claude-gemini` | Claude vs. Gemini comparison. |
| `codex-opencode` | Codex vs. OpenCode. |
| `opencode-claude` | OpenCode vs. Claude. |
| `codex-ollama` | Powerful CLI agent vs. local model. |
| `ollama-claude` | Local model first, Claude reviewing. |

`palabre presets --json` includes local availability metadata for integrations. A preset is marked unavailable when an agent is missing from the config, when a known CLI is not detected, or when the configured Ollama model is not installed.

## Choosing models

Models can be passed without Palabre listing them:

```bash
palabre codex-claude "Subject" --model-a gpt-5.5 --model-b opus-4.7
```

For Ollama:

```bash
palabre codex-ollama "Subject" --model-b gemma4:e4b
```

## When to use a preset?

Use a preset when you want a short and explicit command.

Use default agents when you frequently run the same pair.

Use `--agent-a` and `--agent-b` when writing a script or precise documentation.
