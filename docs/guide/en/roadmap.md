---
title: Roadmap
description: Discover what is already available in Palabre and the improvements planned for upcoming versions.
---

This page gives an overview of the planned evolution of Palabre. It helps users understand where the project is headed, without committing to delivery dates.

## Available today

Palabre already lets you run debates between two agents installed on your machine: Claude Code, Codex CLI, Gemini CLI, OpenCode, or Ollama.

The main features are available:

- global or local configuration;
- detection of installed agents;
- interactive assistant `palabre new`;
- presets such as `codex-claude`, `claude-gemini`, or `opencode-ollama`;
- adding context with `--files` or `--context`;
- final summary with consensus, disagreements, proposed actions, and conclusion;
- Markdown export `.debate.md` with a name based on the subject;
- diagnostics with `palabre doctor`;
- machine-readable output with `palabre presets --json` and the NDJSON renderer;
- automated tests for the CLI adapter, NDJSON renderer, presets, and output configuration without calling real AI services.

## Upcoming improvements

### More useful diagnostics

`palabre doctor` is the first reflex when something goes wrong. It displays a readable diagnostic by sections and keeps `--plain` for logs. Future improvements will continue to make its messages more actionable for common issues: agent not found, incomplete configuration, missing Ollama model, incorrect PATH, or provider quota reached.

### Simpler configuration

The `palabre config` command already covers common settings: default agents, number of turns, summary agent, and synchronization of installed agents after initialization. Future improvements will focus on clearer messages, better validation, and a more guided experience.

### Conversation after the debate

After the final summary, Palabre could offer to briefly continue the discussion with the same agents. The goal would be to ask for a clarification, dig into a disagreement, or have an agent react to the summary, then add this follow-up in a separate section of the Markdown export.

### Tests and stability

Reproducible tests already cover the CLI adapter, the NDJSON renderer, preset availability, and output directory resolution. The next step is to gradually expand this coverage to other sensitive behaviors, without calling real AI services during automated tests.

## Next

These topics are considered after the CLI stabilizes:

- local debate history;
- resuming a debate from an existing transcript;
- OpenAI-compatible local provider for LM Studio, LocalAI, vLLM, or equivalent;
- ongoing maintenance of the French and English documentation;
- multilingual French/English CLI interface, with a configured language and per-command override;
- real interactive TUI with scrolling, pause, and resume;
- reliable model display when Palabre can know them without unnecessary noise.

## Philosophy

Palabre will remain centered on a simple principle: drive the AI tools you already have installed, without replacing their accounts, models, subscriptions, or privacy policies.
