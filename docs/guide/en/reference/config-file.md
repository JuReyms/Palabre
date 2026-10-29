---
title: Configuration file reference
description: Reference for the palabre.config.json format, agents, defaults, and advanced options.
seo:
  title: palabre.config.json reference
  description: "Full reference for the palabre.config.json format: agents, defaults, and advanced options."
---

This page serves as a quick reference for `palabre.config.json`.

For a step-by-step explanation, start with [Configuration](/en/configuration/overview).

## Full example

```json
{
  "language": "en",
  "outputDir": ".palabre",
  "defaults": {
    "mode": "debate",
    "agentA": "codex",
    "agentB": "claude",
    "askAgents": ["codex", "claude"],
    "summaryAgent": "claude",
    "askSummaryAgent": "claude",
    "turns": 4,
    "interface": "tui"
  },
  "agents": {
    "codex": {
      "type": "cli",
      "command": "codex",
      "args": ["exec", "--skip-git-repo-check", "--color", "never", "--sandbox", "read-only"],
      "promptMode": "stdin",
      "role": "implementer"
    },
    "claude": {
      "type": "cli",
      "command": "claude.exe",
      "args": ["--print", "--output-format", "text", "--no-session-persistence", "--tools", "Read,Glob,Grep"],
      "promptMode": "stdin",
      "shell": false,
      "role": "reviewer"
    }
  }
}
```

## Root

| Field | Type | Description |
|-------|------|-------------|
| `language` | `fr` or `en` | Palabre and agent prompt language. Can be overridden for one command with `--language` or `PALABRE_LANGUAGE`. |
| `outputDir` | string | Export folder for `.debate.md`, `.relay.md`, `.ask.md`, `.chat.md`; default `.palabre`, `.` treated as `.palabre`. |

## `defaults`

| Field | Type | Description |
|-------|------|-------------|
| `mode` | `debate`, `chat`, or `ask` | Default mode when no mode is provided. |
| `agentA` | string | Agent that responds first in Debate and is initially active in Chat. |
| `agentB` | string | Agent that responds second. |
| `askAgents` | string[] | Default ask mode agents, 4 maximum. |
| `summaryAgent` | string | Final summary agent for debate mode, and fallback for ask mode. |
| `askSummaryAgent` | string | Ask-specific final summary agent. |
| `turns` | number | Total number of turns, between 1 and 20. |
| `interface` | `tui` or `terminal` | Default interface for interactive sessions. |

## CLI agent

| Field | Type | Description |
|-------|------|-------------|
| `type` | `cli` or `cli-pty` | Agent type. |
| `command` | string | Command to run. |
| `args` | string[] | Arguments passed. |
| `promptMode` | `stdin` or `argument` | How the prompt is passed. |
| `responseFormat` | `text` or `antigravity-json` | `cli` adapter only; text by default. Antigravity JSON extracts only `response` when `status` is `SUCCESS`, without fallback. |
| `shell` | boolean | Runs through the system shell. Generated configuration only enables it for selected Windows wrappers. |
| `role` | string | Agent role. |
| `tier` | `primary` / `local` | Agent class; no effect on its role instruction. |
| `model` | string | Optional default model. |
| `modelArg` | string | Optional model flag. |
| `timeoutMs` | number | Global timeout in milliseconds, 180,000 by default for CLI/PTY, 900,000 for OpenCode batch. |
| `idleTimeoutMs` | number | Idle timeout. |
| `maxOutputBytes` | number | Maximum combined stdout and stderr size, 50 MiB by default. |
| `allowEmptyOutput` | boolean | Exceptionally allows an empty CLI text response; does not allow empty or invalid Antigravity JSON. |
| `cols` / `rows` | number | Pseudo-terminal dimensions for `cli-pty`. |

## Ollama agent

| Field | Type | Description |
|-------|------|-------------|
| `type` | `ollama` | Agent type. |
| `baseUrl` | string | Ollama API URL. |
| `model` | string | Local model. |
| `role` | string | Agent role. |
| `tier` | `primary` / `local` | Agent class; no effect on its role instruction. |
| `validateModel` | boolean | Verifies that the model exists. |
| `autoPullModel` | boolean | Downloads the model if missing. |
| `pullTimeoutMs` | number | Download timeout. |
| `unloadOtherModels` | boolean | Unloads other models. |
| `keepAlive` | string | Duration to keep the model loaded. |
| `temperature` | number | Response variation. |
| `maxOutputBytes` | number | Maximum size of each buffered HTTP response, 50 MiB by default. |

## `relay`

`view` is optional: `background` (**Background**, default) or `auto` (**Prefer the open conversation**, explicit choice). Background limits tools and refuses an open target. In `auto`, an existing open Codex conversation uses its tools and permissions, including writing if allowed; when closed, it runs in background. A `{ "view": "background" }` block is valid without authorizing reviews. Existing explicit values are preserved, without file migration. Only the owner changes this setting with `palabre config --relay-view <auto|background>`, after the file, choice and consequences are displayed, then TTY keyboard confirmation, without `--yes` or `--trust-config`. See [Relay mode](/en/usage/relay).

| Field | Type | Description |
| --- | --- | --- |
| `allowedTasks` | string[] | Preauthorizable task: `review` only. |
| `reviewRepositories` | string[] | Exact GitHub.com `owner/repository` or `owner/*` pattern. |

Use `palabre relay allow-repo owner/repository`: keyboard confirmation in your terminal, never by an agent. When `review` is allowed, the repository list cannot be empty.

`tier` (`primary` / `local`) is optional for CLI and Ollama agents. `timeoutMs` is in milliseconds (180,000 by default for CLI/PTY, 900,000 for OpenCode batch, 300,000 in the Antigravity default). Relay ignores `shell`; adapters refuse a remaining shell wrapper for an argument prompt. `outputDir` defaults to `.palabre`; `.` is treated as `.palabre`. It also receives `.relay.md`; Mission keeps `.palabre/missions/<id>/` independently. The example above is a complete two-agent configuration, not the full generated agent set.
