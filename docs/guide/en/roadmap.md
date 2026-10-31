---
title: Roadmap
description: Discover what is already available in Palabre and the improvements planned for upcoming versions.
seo:
  title: What is shipped and what is planned
  description: See what Palabre already does today and which improvements are planned for upcoming releases.
---

This page gives an overview of the planned evolution of Palabre. It helps users understand where the project is headed, without committing to delivery dates.

## Product direction

Palabre helps you **make better decisions and get work done** by making your chosen AI tools cooperate. Different viewpoints can expose errors, omissions or another approach; agreement between agents still needs evidence and checks. You keep control of decisions, budget and tool choices.

The four modes address complementary needs:

- **Relay**: delegate analysis, coding or review through supported paths, exchange messages directly and retrieve results;
- **Ask**: gather independent opinions;
- **Debate**: compare arguments and make tradeoffs explicit;
- **Chat**: work with one interlocutor and consult another agent.

Relay keeps a lead controlled by the user and optional GitHub tracking for each piece of work. Useful results may be recorded on an issue or PR within authorized work; intermediate exchanges and work without GitHub stay simple. Each tool retains its subscriptions, models, quotas and permissions; savings or correction of errors are never guaranteed.

## Available today

PALABRE offers four modes: **Debate**, **Relay**, **Ask** and **Chat**, with your installed agents.

- Contradictory Debate, independent Ask (1–4 agents) and Chat with an explicit second opinion; after Debate/Ask, Chat continues from subject and summary.
- Relay to closed Codex or Claude Code; `--open` to open Codex on Windows, macOS, or Linux (pilot, `python3` required on POSIX), with its own tools and permissions, without guaranteed immediate display.
- Short, proportionate Relay reporting; optional declared GitHub link and participant in messages and local records, without GitHub access or publication.
- Separate publication of a selected Relay report on an existing issue or PR: exact preview, account/visibility, human keyboard confirmation, attributed comment and confirmed link; no global policy added.
- Historical Mission, GitHub COMMENT review and `--write` paths: frozen, outside the default workflow; security fixes only.
- Local/global configuration, conservative agent discovery/synchronization, presets and CLI-selected models.
- [TUI](/en/usage/tui), agent skill and VS Code extension.
- `--files` / `--context`, previews, Debate/Ask summaries and Markdown exports; Debate/Ask/Chat history.
- Opt-in Debate/Ask checkpoints and resume without replaying accepted answers; partial export where possible after failure.
- `usage-limit` and `readAccess` diagnostics, retry information when supplied, no automatic resend.
- `palabre doctor`, JSON/NDJSON contracts and `palabre update` with confirmation.

## Upcoming improvements

1. **Summaries on GitHub**: explore explicitly selecting an Ask/Debate summary for the same publication core, without publishing the complete export ([#122](https://github.com/JuReyms/Palabre/issues/122)).
2. **Work continuity**: retrieve a result after interruption without resending the request; qualify remaining ambiguous cases separately ([#146](https://github.com/JuReyms/Palabre/issues/146)).
3. **OpenCode**: extend qualification of the copy pilot before adding CLI/Desktop paths ([#136](https://github.com/JuReyms/Palabre/issues/136)).
4. **Budget and diagnostics**: dated provider information or explicit estimates, without automatic switching ([#41](https://github.com/JuReyms/Palabre/issues/41)).
5. **OpenAI-compatible local agents** (llama.cpp, LM Studio…) for Debate, Ask and Chat ([#120](https://github.com/JuReyms/Palabre/issues/120)).

## Under exploration

- **Relay to an open Claude Code conversation**: research into an official mechanism and reliable reply correlation ([#193](https://github.com/JuReyms/Palabre/issues/193)). No timeline or guarantee; sending to an open Claude conversation is not possible today.

## Philosophy

Palabre will remain centered on a simple principle: drive the AI tools you already have installed, without replacing their accounts, models, subscriptions, or privacy policies. Its differentiator is organized disagreement, explicit synthesis, and controlled action.
