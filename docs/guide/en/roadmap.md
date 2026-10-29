---
title: Roadmap
description: Discover what is already available in Palabre and the improvements planned for upcoming versions.
seo:
  title: What is shipped and what is planned
  description: See what Palabre already does today and which improvements are planned for upcoming releases.
---

This page gives an overview of the planned evolution of Palabre. It helps users understand where the project is headed, without committing to delivery dates.

## Product direction

Palabre helps you **make better decisions before acting**. It is a harness for orchestrated collective intelligence: it lets your chosen AI tools exchange views, organizes disagreement, and makes decisions explicit.

Future improvements belong to one shared session rather than a growing set of separate modes:

- **Consult**: talk with one agent, request several opinions, or run a debate;
- **Decide**: synthesize, explore a conclusion further, prepare or review a plan;
- **Act**: prepare an action and, only after explicit confirmation, delegate it to an appropriate tool.

Acting is optional and remains under the user's control. Palabre is not intended to replace coding assistants or specialized tools: its role is to clarify a decision and provide a clean path to the next step when you choose it.

## Available today

PALABRE offers four modes: **Debate**, **Relay**, **Ask** and **Chat**, with your installed agents.

- Contradictory Debate, independent Ask (1–4 agents) and Chat with an explicit second opinion; after Debate/Ask, Chat continues from subject and summary.
- Relay to closed Codex or Claude Code; `--open` to open Codex on Windows, macOS, or Linux (pilot, `python3` required on POSIX), with its own tools and permissions, without guaranteed immediate display.
- GitHub COMMENT review on a repository authorized through `palabre relay allow-repo`; PALABRE header, optional subject, JSON and `.relay.md` export.
- Relay's Mission option: read-only steps within a scope and budget agreed with you.
- Local/global configuration, conservative agent discovery/synchronization, presets and CLI-selected models.
- [TUI](/en/usage/tui), agent skill and VS Code extension.
- `--files` / `--context`, previews, Debate/Ask summaries and Markdown exports; Debate/Ask/Chat history.
- Opt-in Debate/Ask checkpoints and resume without replaying accepted answers; partial export where possible after failure.
- `usage-limit` and `readAccess` diagnostics, retry information when supplied, no automatic resend.
- `palabre doctor`, JSON/NDJSON contracts and `palabre update` with confirmation.

## Upcoming improvements

1. **Relay to OpenCode, in the CLI and Desktop**: another viewpoint with free or local models ([#136](https://github.com/JuReyms/Palabre/issues/136)).
2. **Quotas**: display each agent's remaining quota and offer choices to the human ([#41](https://github.com/JuReyms/Palabre/issues/41)).
3. **Codex reading on Windows**: provide a solution to the refused command launches reported by `readAccess` ([#128](https://github.com/JuReyms/Palabre/issues/128)).
4. **OpenAI-compatible local agents** (llama.cpp, LM Studio…) for Debate, Ask and Chat ([#120](https://github.com/JuReyms/Palabre/issues/120)).

## Under exploration

- **Relay to an open Claude Code conversation**: research into an official mechanism and reliable reply correlation ([#193](https://github.com/JuReyms/Palabre/issues/193)). No timeline or guarantee; sending to an open Claude conversation is not possible today.

## Philosophy

Palabre will remain centered on a simple principle: drive the AI tools you already have installed, without replacing their accounts, models, subscriptions, or privacy policies. Its differentiator is organized disagreement, explicit synthesis, and controlled action.
