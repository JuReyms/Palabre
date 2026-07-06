---
title: OpenCode
description: Configure OpenCode in Palabre and use it as a CLI agent in a debate pair.
---

OpenCode is a development assistance CLI. Depending on your local configuration, it can use different models and providers.

Palabre can use it as a CLI agent in the same way as Codex, Claude, or Antigravity.

## Install before Palabre

Install OpenCode from the official documentation, then verify that the command works:

Official documentation: [https://opencode.ai/docs/](https://opencode.ai/docs/)

CLI reference: [https://opencode.ai/docs/cli/](https://opencode.ai/docs/cli/)

```bash
opencode --version
```

If OpenCode was installed after your first Palabre configuration, open `palabre` again or synchronize explicitly:

```bash
palabre config --sync-agents
```

## Windows

On Windows, `shell: true` is often required for npm or PowerShell wrappers such as `opencode`.

## Plans and limits

OpenCode can use free, paid, or local providers depending on your configuration. Quotas, subscriptions, and usage limits therefore depend on the provider configured in OpenCode, not on Palabre.

## Default model

Palabre does not choose the OpenCode model for you. OpenCode uses its own default model, unless you configure a model argument in the Palabre agent. If you pass a model with `--model-a`, `--model-b`, or `--summary-model`, Palabre passes the value to OpenCode via the configured model option; OpenCode remains responsible for validating that model.

## Typical configuration

```json
"opencode": {
  "type": "cli",
  "command": "opencode",
  "args": ["run", "--pure"],
  "promptMode": "stdin",
  "shell": true,
  "role": "reviewer"
}
```

`--pure` prevents external plugins from loading. This OpenCode command does not currently expose
a tool allowlist equivalent to Claude's or Vibe's.

## Usage

```bash
palabre codex-opencode "Review this MVP" -t 4
palabre opencode-claude "Compare these options" -t 3
```
