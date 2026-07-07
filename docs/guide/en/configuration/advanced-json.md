---
title: Advanced JSON
description: Edit the configuration JSON directly for advanced use cases and custom agents.
---

Most common settings can be done with `palabre config`. This page covers cases where you edit `palabre.config.json` directly.

## Minimal structure

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
      "args": ["exec", "-"],
      "promptMode": "stdin",
      "role": "implementer"
    },
    "claude": {
      "type": "cli",
      "command": "claude",
      "args": ["--print"],
      "promptMode": "stdin",
      "role": "reviewer"
    }
  }
}
```

## Main fields

| Field | Description |
|-------|-------------|
| `outputDir` | Destination folder for `.debate.md` and `.ask.md` exports. |
| `defaults.agentA` | Agent that responds first by default. |
| `defaults.agentB` | Agent that responds second by default. |
| `defaults.summaryAgent` | Agent used for the final summary by default. |
| `defaults.turns` | Total number of turns, between 1 and 20. |
| `agents` | List of available agents. It must contain at least one usable agent. |

## CLI agent

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

Useful options:

| Option | Description |
|--------|-------------|
| `command` | Command to run. |
| `args` | Arguments passed to the command. |
| `promptMode` | `stdin` or `argument`. |
| `modelArg` | Flag used to pass a model. |
| `model` | Default model for this agent. |
| `shell` | Useful on Windows for certain npm or PowerShell wrappers. |
| `role` | Agent role. |
| `timeoutMs` | Global timeout. |
| `idleTimeoutMs` | Timeout if the CLI stays silent. |
| `maxOutputBytes` | Maximum combined output size, 50 MiB by default. An invalid value restores this safe limit. |
| `cols` / `rows` | Pseudo-terminal dimensions for `cli-pty` agents. |

## Ollama agent

```json
"ollama-local": {
  "type": "ollama",
  "baseUrl": "http://localhost:11434",
  "model": "<installed-ollama-model>",
  "role": "critic",
  "validateModel": true,
  "unloadOtherModels": true
}
```

Useful options:

| Option | Description |
|--------|-------------|
| `model` | Ollama model used. |
| `baseUrl` | Ollama API URL. |
| `validateModel` | Verifies that the model is installed. |
| `autoPullModel` | Allows automatic download. |
| `pullTimeoutMs` | Download timeout. |
| `unloadOtherModels` | Unloads other models before generation. |
| `keepAlive` | Duration to keep the model loaded. |
| `temperature` | Response variation. |
| `maxOutputBytes` | Maximum size of each buffered HTTP response, 50 MiB by default. |
