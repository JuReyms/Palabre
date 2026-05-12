---
title: Configuration file reference
description: Reference for the palabre.config.json format, agents, defaults, and advanced options.
---

This page serves as a quick reference for `palabre.config.json`.

For a step-by-step explanation, start with [Configuration](/en/configuration/overview).

## Full example

```json
{
  "outputDir": ".palabre",
  "defaults": {
    "agentA": "codex",
    "agentB": "claude",
    "summaryAgent": "claude",
    "turns": 4
  },
  "agents": {
    "codex": {
      "type": "cli",
      "command": "codex",
      "args": ["exec", "--skip-git-repo-check", "--color", "never", "--sandbox", "read-only", "-"],
      "promptMode": "stdin",
      "shell": true,
      "role": "implementer"
    },
    "claude": {
      "type": "cli",
      "command": "claude.exe",
      "args": ["--print", "--output-format", "text", "--no-session-persistence"],
      "promptMode": "stdin",
      "shell": false,
      "role": "reviewer"
    }
  }
}
```

## `defaults`

| Field | Type | Description |
|-------|------|-------------|
| `agentA` | string | Agent that responds first. |
| `agentB` | string | Agent that responds second. |
| `summaryAgent` | string | Final summary agent. |
| `turns` | number | Total number of turns, between 1 and 20. |

## CLI agent

| Field | Type | Description |
|-------|------|-------------|
| `type` | `cli` | Agent type. |
| `command` | string | Command to run. |
| `args` | string[] | Arguments passed. |
| `promptMode` | `stdin` or `argument` | How the prompt is passed. |
| `shell` | boolean | Runs via the system shell. |
| `role` | string | Agent role. |
| `model` | string | Optional default model. |
| `modelArg` | string | Optional model flag. |
| `timeoutMs` | number | Global timeout. |
| `idleTimeoutMs` | number | Idle timeout. |

## Ollama agent

| Field | Type | Description |
|-------|------|-------------|
| `type` | `ollama` | Agent type. |
| `baseUrl` | string | Ollama API URL. |
| `model` | string | Local model. |
| `role` | string | Agent role. |
| `validateModel` | boolean | Verifies that the model exists. |
| `autoPullModel` | boolean | Downloads the model if missing. |
| `pullTimeoutMs` | number | Download timeout. |
| `unloadOtherModels` | boolean | Unloads other models. |
| `keepAlive` | string | Duration to keep the model loaded. |
| `temperature` | number | Response variation. |
