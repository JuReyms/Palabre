---
title: Roadmap
description: Discover what is already available in Palabre and the improvements planned for upcoming versions.
---

This page gives an overview of the planned evolution of Palabre. It helps users understand where the project is headed, without committing to delivery dates.

## Available today

Palabre already lets you run debates between two agents installed on your machine, or Ask requests where several agents answer independently before a comparative summary: Claude Code, Codex CLI, Antigravity CLI, OpenCode, Mistral Vibe, or Ollama.

The main features are available:

- global or local configuration;
- detection of installed agents;
- automatic global configuration on first TUI launch, with conservative refresh of detected known agents;
- TUI-first interface with `palabre`, `/agents`, `/roles`, `/config`, `/history`, and `/home`;
- interactive assistant `palabre new`;
- `ask` mode with 1 to 4 agents and `.ask.md` export;
- presets such as `codex-claude`, `claude-antigravity`, `codex-antigravity`, or `opencode-ollama`;
- French or English interface and prompts through `--language`, `--lang`, `PALABRE_LANGUAGE`, or configuration;
- adding context with `--files` or `--context`;
- previewing the context scan with `palabre context scan --json` for integrations;
- final summary with consensus, disagreements, proposed actions, and conclusion;
- Markdown export `.debate.md` or `.ask.md` with a name based on the subject;
- local export history with `palabre history`, `palabre history --json`, and `/history` in the TUI;
- partial export preserved if an agent fails during the debate or final summary;
- diagnostics with `palabre doctor`;
- machine-readable output with `palabre agents --json`, `palabre presets --json`, `palabre context scan --json`, and the NDJSON renderer;
- structured errors for integrations, with an NDJSON versioning policy;
- a more robust CLI parser for boolean flags such as `--terminal`, `--json`, or `--no-summary`;
- stricter runtime contracts: non-zero CLI exits are rejected, Ollama pull progress stays off NDJSON stdout, and missing `--context` paths are reported as warnings;
- automated tests for the CLI adapter, parser, NDJSON renderer, presets, context scan, prompts, and output configuration without calling real AI services.

## Upcoming improvements

### More useful diagnostics

`palabre doctor` is the first reflex when something goes wrong. It displays a readable diagnostic by sections and keeps `--terminal` for logs. Future improvements will continue to make its messages more actionable for common issues: agent not found, incomplete configuration, missing Ollama model, incorrect PATH, or provider quota reached.

### More robust integrations

Palabre already exposes JSON contracts for presets, context scanning, and NDJSON debate rendering. Upcoming improvements will keep these contracts stable, well documented, and easier for the VS Code extension or other integrations to consume.

### Simpler configuration

The `palabre config` command, the TUI `/config` view, first-run configuration, and known-agent synchronization already cover common settings: default agents, roles, number of turns, summary agent, default mode, default interface, and detected agent refresh. Future improvements will focus on clearer messages, better validation, and richer wizards for choices that benefit from discovery.

### Conversation after the debate

After the final summary, Palabre could offer to briefly continue the discussion with the same agents. The goal would be to ask for a clarification, dig into a disagreement, or have an agent react to the summary, then add this follow-up in a separate section of the Markdown export.

### Tests and stability

Reproducible tests already cover the CLI adapter, the NDJSON renderer, preset availability, and output directory resolution. The next step is to gradually expand this coverage to other sensitive behaviors, without calling real AI services during automated tests.

## Next

These topics are considered after the CLI stabilizes:

- resuming a debate from an existing transcript;
- OpenAI-compatible local provider for LM Studio, LocalAI, vLLM, or equivalent;
- ongoing maintenance of the French and English documentation;
- continued refinement of the multilingual French/English CLI interface, with a future interactive language choice in first-run or configuration flows;
- more advanced TUI with scrolling, persistent panes, pause, and resume;
- reliable model display when Palabre can know them without unnecessary noise.

## Philosophy

Palabre will remain centered on a simple principle: drive the AI tools you already have installed, without replacing their accounts, models, subscriptions, or privacy policies.
