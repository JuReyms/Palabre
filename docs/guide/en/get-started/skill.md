---
title: Palabre skill
description: Install the Palabre skill so a skills-compatible AI agent knows when to use Debate, Relay, Ask, or Chat.
seo:
  title: Use Palabre from a skills-compatible agent
  description: Install the Palabre skill so Claude Code, Codex, or another skills-compatible agent can choose between Debate, Relay, Ask, and Chat.
---

Palabre ships a ready-to-use skill. It teaches an AI agent that Palabre is available, when to use it, and how to choose the right path:

| Path | When the agent picks it |
|------|-------------------------|
| [Debate](/en/usage/debate) | Confront two positions and work through the disagreements. |
| [Relay](/en/usage/relay) | Connect specific conversations: Claude Code or Codex as mission lead, advice/reviews to a closed target, action in open Codex on Windows with its permissions. |
| [Ask](/en/usage/ask) | Collect up to four independent opinions before comparing them. |
| [Chat](/en/usage/chat) | Move forward with one agent, ask for a one-off second opinion, continue after a summary. |

The skill follows the open [agentskills.io](https://agentskills.io) standard, so it is portable across Claude Code, Codex, Hermes Agent, and any skills-compatible agent.

The skill does not replace the CLI: it drives `palabre` locally. Palabre CLI remains the source of truth for agents, presets, conversations, and exports.

## Install the skill

The skill is a folder: [`skills/palabre`](https://github.com/JuReyms/Palabre/tree/main/skills/palabre) in the repository, and `skills/palabre` in the installed npm package. Copy the whole folder, references included, to the location your agent expects.

| Agent | For all your projects | For one project |
|-------|-----------------------|-----------------|
| Claude Code | `~/.claude/skills/palabre/` | `.claude/skills/palabre/` |
| Codex | `~/.agents/skills/palabre/` | `.agents/skills/palabre/` |
| Hermes Agent | `hermes skills install JuReyms/Palabre/skills/palabre` | — |

For Codex, `~/.agents/skills/` is the user location given by the [Codex documentation](https://learn.chatgpt.com/docs/build-skills#where-codex-loads-local-skills). The older `~/.codex/skills/` location is still read by Codex 0.151.0.

For Claude desktop or another agent, follow its own skill-install procedure pointing at this folder.

After updating Palabre, copy the folder again: the installed copy is not updated automatically.

To start, tell Claude Code or Codex: "Use PALABRE to ask the other agent to review the plan in docs/plan.md without changing files. Keep the conversation for follow-up." You choose the mission lead. From Codex desktop, each command to Claude needs one-time host approval; follow [Your first Relay](/en/get-started/first-relay).

## When the agent sees the skill

An agent loads its skill list when a conversation starts or resumes. After installing, open a new conversation or resume one: a conversation that is already running may not see the skill.

| Agent | New conversation | Conversation resumed after installing |
|-------|-------------|----------------------------------|
| Claude Code 2.1.85 and 2.1.292 | Skill visible | Skill visible |
| Codex 0.151.0 | Skill visible | Skill visible |

These behaviors were verified in non-interactive mode (`claude -p`, `codex exec`), with a project skill and throwaway conversations. User locations, the TUI, desktop apps, and IDEs were not verified. These behaviors may change with other versions. If the agent does not mention Palabre, remind it that the `palabre` skill is available.

Keep a single active copy of the skill. If an older version is also installed, for example a `palabre` skill added to your Claude account and then synced, the agent may follow the older one: update or remove it.

## Requirements

- Palabre CLI installed on the same machine (`npm install --global palabre`);
- at least one compatible agent configured or detected by Palabre; two or more are recommended for comparisons;
- a host agent compatible with the agentskills.io standard.

Verify the installation from a terminal:

```bash
palabre --version
palabre doctor
palabre agents
```

## What the skill adds

### Naming PALABRE tasks

Your agent names each PALABRE task `Palabre <mode>: <subject>`, for example `Palabre Relay: send the review to Codex`. The skill asks it to do this; your agent's application decides what it actually displays.

In a terminal, PALABRE displays its name and mode in the window title, for example `Palabre · Relay`. It restores the old title at the end when the terminal allows it. Nothing is added when PALABRE is launched by a program or with `--json`. On Windows, Task Manager continues to show `node`.

### Choosing and following the path

- **Path selection**: Debate, Relay, Ask, or Chat depending on the need, without running Palabre for a simple task or forcing a Debate for every second-opinion request.
- **Chat driven properly**: the agent uses the [NDJSON stream](/en/integrations/ndjson) and JSON commands on stdin (`chat-send`, `chat-consult`, `chat-use`, `chat-agents`, `chat-end`), never an imitation of the TUI. It knows Chat's bounded memory: six recent messages, no resume after the process ends.
- **Three kinds of resume kept apart**: the host agent's conversation, Palabre [checkpoints](/en/reference/cli#resume-a-session) for Debate and Ask, and resuming an external conversation through Relay.
- **Careful Relay**: target chosen by you; PALABRE header, ℹ️ warning and « 🤖 Message for the agent »; optional `--subject`, unauthenticated sender, history modified, no automatic resend; `usage-limit` or `read-unavailable` diagnostic preserved.
- **Controlled context**: `--files` or `--context`, with a warning before sending sensitive content; Ollama to stay local.
- **You stay in control**: installation, authentication, configuration, config approval, and updates remain your decisions. The `implementer` role is a proposal instruction, not a permission to write.
- **Restitution**: the agent reads the export (`.chat.md`, `.debate.md`, `.ask.md`, or `.relay.md`, plus `.mission.md` for the Mission option) and gives you decisions, disagreements, limits, and next steps.

The Mission option and `--task review` are frozen. `--write` is experimental, frozen and outside the default path: the skill uses it only on an explicit human request. These features remain documented; only security fixes are accepted.

The agent never edits or approves a policy granting itself rights: it shows you the `relay allow-repo` or approval command and waits for your action. To locate the installed package skill, run `npm root -g` (or `pnpm root -g`), then use the `palabre/skills/palabre` subfolder.
