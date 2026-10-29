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

Install the skill matching your CLI without downloading from GitHub:

```text
palabre skill --install codex
palabre skill --install claude
```

Run only the command for your intended agent. The plan shows the destination and asks for confirmation. For existing copies, `palabre skill --sync` uses the running package's skill without network access. `palabre skill` only displays status; `--check` and `--dry-run` never write, including with `--sync` or `--install`. `--yes` is explicit consent after reviewing the plan; agents must not add it without your consent.

`palabre doctor` compares all bundled files with each detected copy, normalizing line endings. A difference can mean an old skill or customization. Private additions are preserved and do not date the skill. An unreadable copy or internal link remains unverified and cannot be replaced.

`palabre update` includes refreshing detected copies in its plan and single confirmation. After updating, it uses the new package's skill, including when pnpm changes stores. If the CLI is already current, refreshing a different skill is still offered. Missing copies are never installed implicitly.

Before replacement, each physical copy is backed up under `~/.palabre/skill-backups/`, with a timestamp and unique suffix, outside directories loaded by agents. Root junctions remain intact; a directory shared by Claude and Codex is backed up only once. Customized bundled files are replaced after this consent; additional private files are preserved. An edit since the plan was displayed makes the refresh fail. Reload the skill or resume the agent conversation afterwards.

These commands follow the CLI package, not GitHub `main`. External tools such as `npx skills add/update` follow the repository and may provide a different skill from the installed CLI. On an older CLI without the `skill` command, manually copying the bundled folder remains possible.

To start, tell Claude Code or Codex: "Use PALABRE to ask the other agent to review the plan in docs/plan.md without changing files. Keep the conversation for follow-up." You choose the mission lead. From Codex desktop, each command to Claude needs one-time host approval; follow [Your first Relay](/en/get-started/first-relay).

An unverified copy is displayed with a warning and left untouched: it blocks neither the CLI update nor other skill copies. If no copy differs, `--sync` and `--install` do not ask for consent or write anything. If the CLI updates successfully but the skill refresh then fails, the message distinguishes these outcomes: restart Palabre, then run `palabre skill --sync` to inspect the new plan.

## When the agent sees the skill

Updating files does not guarantee that a running conversation has reread its instructions. Before preparing a task, the skill now asks the agent to compare its declared revision with the running Palabre package. If it is missing or different, the agent reads the current instructions and relevant references, then continues within existing authorization. You do not need to synchronize a directory or restart the conversation for this read. An old or customized installed copy remains untouched.

This check is local. The technical command `palabre skill --read --json` supplies the skill text and reference paths from the running package, without configuration, network, installation or an AI call. The `agents --json` inventory and `relay --check --json` can compare the revision the agent says it read. Matching revisions do not prove its internal memory. An old conversation still needs to encounter this diagnostic or reread the skill to benefit; Palabre does not control applications' internal reload mechanisms.

If the package is incomplete or unreadable, the agent explains the limitation when it blocks work. An old CLI that does not support this check must not be presented as compatible: consult its help and distinguish reading instructions from updating software. Never automatically resend a Relay to repair a skill.

The following observations concern native skill discovery by applications, separate from the agent reading the package:

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

The entrypoint covers shared decisions and safeguards; the agent then loads the reference for the relevant route. Relay separates the basics, Desktop opening/follow-up, the OpenCode pilot and frozen features. Details for unrelated routes are not loaded by default.

To continue a consultation, the agent checks the conversation before sending and respects your preference. With no saved preference, it can continue with Codex already in use, within existing authorization, explaining its usual permissions: no identifier to copy or window to close. An explicit background or limited-tools choice is still respected. A review makes no changes regardless of the path. No fallback after a refused send; opening to view and sending remain separate. See [Relay mode](/en/usage/relay).

Here, a Palabre agent is a configured entry connected to an AI tool (such as Claude Code or Codex) or to Ollama, not a model or a subagent. Roles complement Debate, Ask and Chat; they do not configure Relay or grant permissions.

### Naming PALABRE tasks

Your agent names each PALABRE task `Palabre <mode>: <subject>`, for example `Palabre Relay: send the review to Codex`. The skill asks it to do this; your agent's application decides what it actually displays.

In a terminal, PALABRE displays its name and mode in the window title, for example `Palabre · Relay`. It restores the old title at the end when the terminal allows it. Nothing is added when PALABRE is launched by a program or with `--json`. On Windows, Task Manager continues to show `node`.

### Choosing and following the path

- **Path selection**: Debate, Relay, Ask, or Chat depending on the need, without running Palabre for a simple task or forcing a Debate for every second-opinion request.
- **Chat driven properly**: the agent uses the [NDJSON stream](/en/integrations/ndjson) and JSON commands on stdin (`chat-send`, `chat-consult`, `chat-use`, `chat-agents`, `chat-end`), never an imitation of the TUI. It knows Chat's bounded memory: six recent messages, no resume after the process ends.
- **Three kinds of resume kept apart**: the host agent's conversation, Palabre [checkpoints](/en/reference/cli#resume-a-session) for Debate and Ask, and resuming an external conversation through Relay.
- **Careful Relay**: target chosen by you; PALABRE header, ℹ️ warning and « 🤖 Message for the agent »; optional `--subject`, unauthenticated sender, history modified, no automatic resend; `usage-limit` diagnostic preserved, and `readAccess` distinguishes a partial fallback from a block without removing reply or delivery.
- **Controlled context**: `--files` or `--context`, with a warning before sending sensitive content; Ollama to stay local.
- **You stay in control**: installation, authentication, configuration, config approval, and updates remain your decisions. The `implementer` role is a proposal instruction, not a permission to write.
- **Restitution**: the agent reads the export (`.chat.md`, `.debate.md`, `.ask.md`, or `.relay.md`, plus `.mission.md` for the Mission option) and gives you decisions, disagreements, limits, and next steps. After a Relay, the report stays simple: what the teammate did, what is blocked, the decision needed and, when needed, a single action for you (for example the command that opens the conversation in Codex Desktop). The agent keeps the conversation identifier itself: say "continue" or "ask the same Codex" to go on. It only shows you the identifier, folder, export or `palabre relay` command if you ask for them, or to explain a failure.

The Mission option and `--task review` are frozen. `--write` is experimental, frozen and outside the default path: the skill uses it only on an explicit human request. These features remain documented; only security fixes are accepted.

The agent never edits or approves a policy granting itself rights: it shows you the `relay allow-repo` or approval command and waits for your action. To locate the installed package skill, run `npm root -g` (or `pnpm root -g`), then use the `palabre/skills/palabre` subfolder.
