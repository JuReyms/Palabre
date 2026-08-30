---
title: Use multiple AI agents from the terminal
description: Choose between Debate, Chat, and Ask to orchestrate several AI agents through one CLI and keep an actionable result.
seo:
  title: Multi-agent AI CLI for debates and answer comparison
  description: Use Palabre as a multi-agent CLI to run Codex and Claude Code debates, compare up to four answers, or consult a second AI agent.
---

Palabre is a multi-agent CLI that orchestrates the AI tools already installed on your machine. It can make two agents discuss a decision, compare several independent answers, or let you work with one agent while explicitly consulting a second opinion.

Palabre is not an additional provider. Each agent keeps its own authentication, model, quotas, and access rules.

## Choose the right multi-agent mode

| Mode | Agents | Interaction | Primary use |
|------|--------|-------------|-------------|
| Debate | 2 | Agents answer each other | Challenge a decision and resolve disagreements |
| Chat | 1 active, explicit consultations | Ongoing conversation | Work with one agent and request a second opinion when needed |
| Ask | 1 to 4 | Independent answers | Compare analyses without mutual influence |

## Make two agents debate

A debate injects the previous transcript into every new turn:

```bash
palabre codex-claude "Review the risks in this architecture" -t 4
```

Presets choose a pair and speaking order. They do not automatically change configured models or roles.

See [Run a Codex and Claude Code debate](/en/usage/codex-claude-debate) for a complete workflow with roles and project context.

## Compare several answers with Ask

Ask sends the same subject to several agents without sharing their intermediate answers:

```bash
palabre ask "Compare these migration strategies" \
  --agents codex claude opencode
```

An optional final summary can then present agreement and differences. Ask is particularly useful when you want to prevent the first response from influencing the next ones.

## Chat and consult another agent

Open the TUI, then switch to Chat:

```bash
palabre
```

```text
/chat
/agents codex
```

Use `/consult` when you need a complementary opinion. Chat keeps bounded recent context and exports the session with `/end`.

## Add agents

Palabre detects known CLIs and safely synchronizes the configuration:

```bash
palabre config --sync-agents
palabre agents --json
palabre presets --json
```

Supported agents include [Codex](/en/agents/codex), [Claude Code](/en/agents/claude-code), [Antigravity](/en/agents/antigravity), OpenCode, Mistral Vibe, and Ollama.

## Give agents project context

Add exact files with `--files` or scan a folder with `--context`:

```bash
palabre codex-claude "Review this implementation" \
  --context src tests \
  -t 4
```

CLI agents may also have their own workspace access depending on their tools. Ollama only sees context explicitly injected by Palabre.

## Keep an actionable record

Every session produces a Markdown export under `.palabre/`:

- `.debate.md` for Debate;
- `.ask.md` for Ask;
- `.chat.md` for Chat.

These files preserve the subject, agents, transcript, and optional summary. They provide a shareable record and can be consumed by an integration such as the VS Code extension.

Continue with [Choose a mode](/en/usage/running-a-debate), [Context and files](/en/usage/context-and-files), or the [agent overview](/en/agents/overview).
