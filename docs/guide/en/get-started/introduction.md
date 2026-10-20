---
title: Introduction
description: Understand what PALABRE does, how it orchestrates your AI agents, and what privacy guarantees it provides.
seo:
  title: Multi-agent AI debates from your terminal
  description: PALABRE orchestrates Claude Code, Codex, and Ollama into structured debates from your terminal. See how it works and what stays on your machine.
---

PALABRE lets the AI agents already installed on your machine cooperate to **make better decisions before acting**. You keep your tools, subscriptions and models; PALABRE organizes the exchanges and keeps a Markdown record.

## Four modes, depending on your need

- **Debate**: two agents respond to each other, then a summary sets out agreements and disagreements.
- **Relay**: an agent sends a message to an existing Codex or Claude Code conversation and receives its reply, without copy-paste from you.
- **Ask**: up to four agents answer independently, then a summary covers each answer and compares them.
- **Chat**: you talk to one active agent and can request a second opinion with `/consult`.

For several read-only steps within an agreed scope and budget, Relay offers the [Mission option](/en/usage/relay#mission-option). You make decisions; the mission lead calls the teammate one explicit step at a time.

## What is PALABRE for?

Compare approaches, challenge a plan, confront opinions, or hand off to a conversation that already knows your project. Debate and Ask can produce a final summary, disabled with `--no-summary`; Chat and Relay do not add one.

## What PALABRE does

- detects installed agents and opens a TUI with `palabre` in an interactive terminal;
- supplies the subject, context and useful history to Debate, Ask and Chat calls;
- can send selected files with `--files` or `--context`;
- makes Debate or Ask resumable with `--checkpoint` and `palabre resume`;
- relays a message to an existing conversation with `palabre relay`;
- exports exchanges as `.debate.md`, `.relay.md`, `.ask.md` or `.chat.md`, and the Mission option as `.mission.md`.

## What stays under your control

PALABRE does not create accounts or provide model access. Each agent must be installed and, where required, authenticated separately. A role or a message from another agent never authorizes an action on your behalf.

Debate, Ask and Chat make a new agent call for each reply. PALABRE supplies the whole Debate transcript, or at most the six recent Chat messages. Relay instead resumes an existing conversation and can modify its history: closed by default, or open with `--open` for Codex on Windows, macOS, or Linux (pilot; `python3` required on POSIX). It never resends a message automatically.

## Privacy

PALABRE runs locally and has no server. Prompts, files and exchanges go to your chosen agents, subject to their policies and your settings. With Ollama **and a local model on your machine**, requests stay local; a remote Ollama server receives the data sent to it.

## Next

Start by [installing PALABRE](/en/get-started/installation), then [run your first session](/en/get-started/first-debate). To hand off, read [Relay](/en/usage/relay); for settings, read [configuration](/en/get-started/configuration).
