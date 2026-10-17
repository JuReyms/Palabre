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
- Relay to closed Codex or Claude Code; `--open` to open Codex on Windows (pilot), with its own tools and permissions, without guaranteed immediate display.
- GitHub COMMENT review on a repository authorized through `palabre relay allow-repo`; PALABRE header, optional subject, JSON and `.relay.md` export.
- Relay's Mission option: read-only steps within a scope and budget agreed with you.
- Local/global configuration, conservative agent discovery/synchronization, presets and CLI-selected models.
- [TUI](/en/usage/tui), agent skill and VS Code extension.
- `--files` / `--context`, previews, Debate/Ask summaries and Markdown exports; Debate/Ask/Chat history.
- Opt-in Debate/Ask checkpoints and resume without replaying accepted answers; partial export where possible after failure.
- `usage-limit` and `read-unavailable` diagnostics, retry information when supplied, no automatic resend.
- `palabre doctor`, JSON/NDJSON contracts and `palabre update` with confirmation.

## Upcoming improvements

### More useful diagnostics

`palabre doctor` is the first reflex when something goes wrong. It displays a readable diagnostic by sections and keeps `--terminal` for logs. Future improvements will continue to make its messages more actionable for common issues: agent not found, incomplete configuration, missing Ollama model, incorrect PATH, or provider quota reached.

### More robust integrations

Palabre already exposes JSON contracts for presets, context scanning, and NDJSON debate rendering. Upcoming improvements will keep these contracts stable, well documented, and easier for the VS Code extension or other integrations to consume.

### Simpler configuration

The `palabre config` command, the TUI `/config` view, first-run configuration, and known-agent synchronization already cover common settings: default agents, roles, number of turns, summary agent, default mode, default interface, and detected agent refresh. Future improvements will focus on clearer messages, better validation, and richer wizards for choices that benefit from discovery.

### Conversation after the debate

After the final summary of a Debate or Ask session, `/chat` can now continue with one active agent. The transferred context records its provenance and carries over the subject with the final summary, or the six most recent exchanges when no summary exists. The conversation remains stateless and bounded; persistent Chat sessions and streaming remain separate future work.

### Tests and stability

Reproducible tests already cover the CLI adapter, the NDJSON renderer, preset availability, and output directory resolution. The next step is to gradually expand this coverage to other sensitive behaviors, without calling real AI services during automated tests.

## Next

These topics are considered after the CLI stabilizes:

- resuming a debate from an existing Markdown export, distinct from `palabre resume`, which resumes a Palabre checkpoint;
- OpenAI-compatible local provider for LM Studio, LocalAI, vLLM, or equivalent;
- ongoing maintenance of the French and English documentation;
- continued refinement of the multilingual French/English CLI interface, with a future interactive language choice in first-run or configuration flows;
- more advanced TUI with scrolling, persistent panes, pause, and resume;
- reliable model display when Palabre can know them without unnecessary noise.

## Philosophy

Palabre will remain centered on a simple principle: drive the AI tools you already have installed, without replacing their accounts, models, subscriptions, or privacy policies. Its differentiator is organized disagreement, explicit synthesis, and controlled action.
