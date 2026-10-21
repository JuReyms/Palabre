---
title: Agents
description: Understand Palabre agents, their roles, their models, and the difference between external CLIs and local agents.
seo:
  title: Supported AI agents and how roles work
  description: Claude Code, Codex, OpenCode, Mistral Vibe, Antigravity, and Ollama can all join a session. Compare CLI agents and local agents.
---

A Palabre agent is a configuration entry that describes how to call an AI.

Palabre supports two agent families:

- CLI agents, such as Claude Code, Codex CLI, Antigravity CLI, OpenCode, or Mistral Vibe;
- local agents, such as Ollama via its HTTP API.

## CLI agents

A CLI agent is launched as a terminal command. Palabre sends it a prompt, retrieves its output, then closes the process.

Each CLI keeps its own rules: authentication, default model, subscription, usage limits, and configuration options. Some CLIs can work with a free tier, a subscription, a local provider, or a cloud provider; in all cases, quotas and rate limit errors come from the agent being used, not from Palabre.

If a CLI exits with an error without writing to stderr, Palabre shows a sanitized, bounded stdout excerpt to help diagnose the failure, for example an authentication error. The session still fails: this excerpt is never accepted as a response. Fix authentication or configuration in the affected CLI first, then run Palabre again.

## Local agents

A local agent like Ollama uses a model installed on your machine. This is useful for critic, exploration, or lightweight summary roles. If you configure Ollama with a cloud offer or a paid service, the associated limits remain those of Ollama or the chosen provider.

Ollama does not read your files directly. To give it context, use `--files` or `--context`.

## View available agents

```bash
palabre agents
palabre agents --json
```

If an installed CLI does not appear in the configuration:

```bash
palabre config --sync-agents
```

## Roles

Each agent has a role that influences the prompt:

| Role | Usage |
|------|-------|
| `implementer` | Propose a concrete solution. |
| `reviewer` | Look for risks, regressions, and missing tests. |
| `critic` | Challenge assumptions. |
| `architect` | Structure technical options. |
| `scout` | Quickly explore a topic. |
| `summarizer` | Produce a faithful summary. |

Roles do not change the model used. They change the instruction sent in the prompt.

## Using a role

A persistent role is configured in `palabre.config.json`, in the agent entry, or with `palabre agent-role <agent> <role>`. For a one-off run, use `--role-a`, `--role-b` in debate mode, or `--ask-role` to apply one shared role to Ask agents.

Example:

Excerpt from the `agents` block:

```json
"codex": {
  "type": "cli",
  "command": "codex",
  "role": "implementer"
},
"claude": {
  "type": "cli",
  "command": "claude.exe",
  "role": "reviewer"
}
```

With this configuration:

```bash
palabre codex-claude "Critique this plan" -t 4
```

Codex receives a concrete proposal instruction, while Claude receives a critical review instruction.

To use two different behaviors with the same CLI, create two distinct agents in the configuration, for example `claude-reviewer` and `claude-summarizer`.

## Models passed as arguments

When you use `--model-a`, `--model-b`, or `--summary-model`, Palabre does not verify the list of models available at the provider. The value is passed to the relevant CLI via its configured model option. If the model does not exist or is not authorized by your account, the CLI will return the error.

## Agents and Relay

[Relay](/en/usage/relay) targets Codex or Claude Code conversations: closed by default; `--open` targets only Codex on Windows, macOS, or Linux (pilot, with `python3` required on POSIX). Mission, a Relay option, uses closed conversations. Antigravity, OpenCode, Mistral Vibe and Ollama participate in Debate, Ask and Chat, not as Relay targets.

CLI agents run from the current directory. Defaults request read-only tools where available: Claude `Read,Glob,Grep`, Codex `--sandbox read-only`, Vibe `read,grep`. OpenCode `--pure` disables plugins **without guaranteeing a read-only tool allowlist**. Custom arguments remain under your control; migrations replace only exact old defaults. A recognized limit gives `usage-limit`, without automatic resend.

## Windows

Adapters prefer a native executable, then a recognized npm or pnpm shim launched directly (Node + JavaScript script, or the native npm variant). For pnpm, the shim's `NODE_PATH` is passed through. Other shims may use PowerShell; remaining shell wrappers are refused for an argument prompt. `shell: true` in generated configuration enables this conservative resolution; do not remove it to force a wrapper launch. Relay accepts only direct executables and the npm Node + script form.

`tier` (`primary` or `local`) classifies the configured agent; it does not change its role instruction.
