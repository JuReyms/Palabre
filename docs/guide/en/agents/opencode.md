---
title: OpenCode
description: Configure OpenCode in Palabre and use it as a CLI agent in a debate pair.
seo:
  title: Use OpenCode as a debate agent
  description: Configure OpenCode in Palabre and pair it with Claude Code, Codex, or a local Ollama model inside a debate.
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

See [Launching agents on Windows](/en/agents/overview#windows).

## Plans and limits

OpenCode can use free, paid, or local providers depending on your configuration. Quotas, subscriptions, and usage limits therefore depend on the provider configured in OpenCode, not on Palabre.

## Default model

OpenCode retains its own default model. Generated configuration includes `modelArg: "--model"`: `--model-a`, `--model-b` or `--summary-model` pass the value to OpenCode, which validates it.

## Typical configuration

Excerpt from the `agents` block:

```json
"opencode": {
  "type": "cli",
  "command": "opencode",
  "args": ["run"],
  "promptMode": "stdin",
  "modelArg": "--model",
  "shell": true,
  "tier": "primary",
  "role": "reviewer"
}
```

OpenCode runs in its **usual environment**: its configured plugins, MCP servers and permissions stay active, in Debate, Ask and Chat as well as for summaries. Palabre promises neither plugin neutralization nor read-only access. OpenCode 2 no longer has the `--pure` option, and Palabre has qualified no replacement for this command. Check OpenCode's permissions in its own configuration yourself.

## Slow replies

Some OpenCode models take several minutes to reply. Without `timeoutMs` in the configuration, Palabre waits up to 15 minutes; a value you set is kept. While waiting, Palabre says every minute that it is still waiting: this says nothing about the model's progress.

If the time limit is exceeded, Palabre stops waiting, reports whether the local stop was confirmed and never resends the request. With the default arguments, it requests that only its OpenCode client stop, without stopping your application or its service. Your assistant can keep a reference to the request. With that reference, your assistant can read this exact request's reply later, without resending it, as long as the same trusted configuration is still in place. It simply tells you whether the reply is ready, still in progress or not found: you have no identifier to copy and no command to run. A reply found this way is checked like any agent reply.

## Usage

```bash
palabre codex-opencode "Review this MVP" -t 4
palabre opencode-claude "Compare these options" -t 3
```

In the Windows example, `shell` is `true`; elsewhere it is `false`.

If an older configuration still contains the exact old default `["run", "--pure"]`, Palabre replaces it with `["run"]` on every launch, without touching the file; `palabre config --sync-agents` writes that replacement to the file. Custom arguments are never changed: if they contain `--pure`, OpenCode 2 refuses to start and Palabre tells you to remove `--pure` yourself.

The [OpenCode Relay copy pilot](/en/usage/relay) uses a separate path with the usual environment preserved, for Windows and OpenCode CLI 2.0.32 only.
