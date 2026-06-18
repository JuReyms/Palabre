---
title: Agents
description: Understand Palabre agents, their roles, their models, and the difference between external CLIs and local agents.
---

A Palabre agent is a configuration entry that describes how to call an AI.

Palabre supports two agent families:

- CLI agents, such as Claude Code, Codex CLI, Antigravity CLI, OpenCode, or Mistral Vibe;
- local agents, such as Ollama via its HTTP API.

## CLI agents

A CLI agent is launched as a terminal command. Palabre sends it a prompt, retrieves its output, then closes the process.

Each CLI keeps its own rules: authentication, default model, subscription, usage limits, and configuration options. Some CLIs can work with a free tier, a subscription, a local provider, or a cloud provider; in all cases, quotas and rate limit errors come from the agent being used, not from Palabre.

## Local agents

A local agent like Ollama uses a model installed on your machine. This is useful for critic, exploration, or lightweight summary roles. If you configure Ollama with a cloud offer or a paid service, the associated limits remain those of Ollama or the chosen provider.

Ollama does not read your files directly. To give it context, use `--files` or `--context`.

## View available agents

```bash
palabre agents
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

A role is configured in `palabre.config.json`, in the agent entry. There is no command option like `--role-a` or `--role-b` yet.

Example:

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
