---
title: Introduction
description: Understand what Palabre does, how it orchestrates your AI agents, and what privacy guarantees it provides.
---

Palabre is a CLI/TUI orchestrator for AI agents already installed on your machine.

The goal is simple: you give a subject, Palabre orchestrates the agents, displays their responses in the terminal, then exports the full transcript with a final summary.

Two modes are available:

- `debate`: two agents take turns discussing a subject;
- `ask`: several agents answer the same request independently, then a summary agent faithfully summarizes each response and compares them.

Palabre does not replace Claude Code, Codex CLI, Gemini CLI, Antigravity CLI, OpenCode, Mistral Vibe, or Ollama. It drives them. You therefore keep your tools, subscriptions, default models, and terminal habits.

Palabre runs locally on your machine. It does not send any data to a server owned by Palabre. Prompts, files, and transcripts are only transmitted to the agents you choose to use.

Privacy therefore depends on the agents selected. Before sending code, documents, or sensitive data to Claude Code, Codex CLI, Gemini CLI, Antigravity CLI, OpenCode, Mistral Vibe, Ollama, or any other configured agent, check their own privacy policies and your account settings.

## What is Palabre for?

Palabre is useful for:

- comparing two agents on the same question;
- comparing several independent answers with Ask mode;
- getting a critical review of an idea;
- pitting a local Ollama model against a more powerful CLI;
- producing a shareable Markdown transcript;
- turning an AI discussion into consensus, disagreements, proposed actions, and conclusion.

## What Palabre does

Palabre:

- detects CLIs available on your machine;
- opens a TUI by default with `palabre` in an interactive terminal;
- launches agents in batch mode;
- injects the subject, session context, and debate history into each turn;
- can run Ask requests without conversation between agents;
- can add project files or folders to the context;
- generates a final summary;
- exports the session to a `.debate.md` or `.ask.md` file.

## What Palabre does not do

Palabre does not provide paid access to models. It does not create a Claude, OpenAI, Google, or Ollama account. Each agent must be installed and authenticated separately.

Palabre also does not keep an interactive session open with the CLIs. Each response is produced by a batch call. Debate memory comes from the transcript that Palabre reinjects at each turn.

## Next

Start by [installing Palabre](/en/get-started/installation), then proceed to [the first configuration](/en/get-started/configuration).
