---
title: Palabre skill
description: Install the Palabre skill so a skills-compatible AI agent knows when to use Chat, Debate, Ask, or Relay.
seo:
  title: Use Palabre from a skills-compatible agent
  description: Install the Palabre skill so Claude Code, Codex, or another skills-compatible agent can choose between Chat, Debate, Ask, and Relay.
---

Palabre ships a ready-to-use skill. It teaches an AI agent that Palabre is available, when to use it, and how to choose the right path:

| Path | When the agent picks it |
|------|-------------------------|
| [Chat](/en/usage/chat) | Move forward with one agent, ask for a one-off second opinion, continue after a summary. |
| [Debate](/en/usage/debate) | Confront two positions and work through the disagreements. |
| [Ask](/en/usage/ask) | Collect up to four independent opinions before comparing them. |
| [Relay](/en/usage/relay) | Query a closed Claude Code or Codex conversation that already holds the context. |

The skill follows the open [agentskills.io](https://agentskills.io) standard, so it is portable across Claude Code, Codex, Hermes Agent, and any skills-compatible agent.

The skill does not replace the CLI: it drives `palabre` locally. Palabre CLI remains the source of truth for agents, presets, sessions, and exports.

## Install the skill

The skill is a folder: [`skills/palabre`](https://github.com/JuReyms/Palabre/tree/main/skills/palabre) in the repository, and `skills/palabre` in the installed npm package. Copy the whole folder, references included, to the location your agent expects.

| Agent | For all your projects | For one project |
|-------|-----------------------|-----------------|
| Claude Code | `~/.claude/skills/palabre/` | `.claude/skills/palabre/` |
| Codex | `~/.codex/skills/palabre/` | `.agents/skills/palabre/` |
| Hermes Agent | `hermes skills install JuReyms/Palabre/skills/palabre` | — |

For Claude desktop or another agent, follow its own skill-install procedure pointing at this folder.

After updating Palabre, copy the folder again: the installed copy is not updated automatically.

## When the agent sees the skill

An agent loads its skill list when a session starts or resumes. After installing, open a new session or resume one: a session that is already running may not see the skill.

| Agent | New session | Session resumed after installing |
|-------|-------------|----------------------------------|
| Claude Code 2.1.85 and 2.1.292 | Skill visible | Skill visible |
| Codex 0.151.0 | Skill visible | Skill visible |

These behaviors were verified in non-interactive mode (`claude -p`, `codex exec`), with a project skill and throwaway sessions. They may change with other versions. If the agent does not mention Palabre, remind it that the `palabre` skill is available.

Keep a single active copy of the skill. If an older version is also installed, for example a `palabre` skill added to your Claude account and then synced, the agent may follow the older one: update or remove it.

## Requirements

- Palabre CLI installed on the same machine (`npm install -g palabre`);
- at least one compatible agent configured or detected by Palabre; two or more are recommended for comparisons;
- a host agent compatible with the agentskills.io standard.

Verify the installation from a terminal:

```bash
palabre --version
palabre doctor
palabre agents
```

## What the skill adds

- **Path selection**: Chat, Debate, Ask, or Relay depending on the need, without running Palabre for a simple task or forcing a Debate for every second-opinion request.
- **Chat driven properly**: the agent uses the [NDJSON stream](/en/integrations/ndjson) and JSON commands on stdin (`chat-send`, `chat-consult`, `chat-use`, `chat-agents`, `chat-end`), never an imitation of the TUI. It knows Chat's bounded memory: six recent messages, no resume after the process ends.
- **Three kinds of resume kept apart**: the host agent's session, Palabre [checkpoints](/en/reference/cli#resume-a-session) for Debate and Ask, and resuming an external conversation through Relay.
- **Careful Relay**: target chosen by you, closed conversation, unauthenticated sender, target history modified, no automatic resend depending on the delivery status.
- **Controlled context**: `--files` or `--context`, with a warning before sending sensitive content; Ollama to stay local.
- **You stay in control**: installation, authentication, configuration, config approval, and updates remain your decisions. The `implementer` role is a proposal instruction, not a permission to write.
- **Restitution**: the agent reads the export (`.chat.md`, `.debate.md`, `.ask.md`, or `.relay.md`) and gives you decisions, disagreements, limits, and next steps.
