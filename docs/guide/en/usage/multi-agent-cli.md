---
title: Use multiple AI agents from the terminal
description: Choose between Debate, Relay, Ask, and Chat to orchestrate several AI agents through one CLI and keep an actionable result.
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
| Relay | 1 target conversation | One message, one reply | Hand off without copy-paste |
| Ask | 1 to 4 | Independent answers | Compare analyses without mutual influence |
| Chat | 1 active, explicit consultations | Ongoing conversation | Work with one agent and request a second opinion when needed |

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
palabre ask "Compare these migration strategies" --agents codex claude opencode
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

Use `/consult <agent>` when you need a complementary opinion. Chat keeps bounded recent context and exports the session with `/end`.

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
palabre codex-claude "Review this implementation" --context src tests -t 4
```

CLI agents may also have their own workspace access depending on their tools. Ollama only sees context explicitly injected by Palabre.

## Keep an actionable record

Exported sessions write Markdown to `outputDir` (`.palabre/` by default):

- `.debate.md` for Debate;
- `.relay.md` for Relay;
- `.ask.md` for Ask;
- `.chat.md` for Chat.

These files preserve the subject, agents, transcript, and optional summary. They provide a shareable record and can be opened by the VS Code extension at the end of a session; it follows NDJSON for events.

Continue with [Choose a mode](/en/usage/running-a-debate), [Context and files](/en/usage/context-and-files), or the [agent overview](/en/agents/overview).

## Hand off with Relay

```text
palabre relay --from claude:<sender-session> --to codex:<target-session> "Read the plan and list the risks"
```

The target is closed by default. `--open` targets open Codex on Windows (pilot), keeping its own tools and permissions; immediate display is not guaranteed. Relay's Mission option keeps several read-only steps within an agreed scope and budget. See [Relay](/en/usage/relay).

Agents: [OpenCode](/en/agents/opencode), [Mistral Vibe](/en/agents/vibe), [Ollama](/en/agents/ollama).
