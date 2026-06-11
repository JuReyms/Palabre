---
title: Palabre skill
description: Install the Palabre skill to run debates directly from a skills-compatible AI agent.
---

Palabre ships a ready-to-use skill that teaches an AI agent when and how to orchestrate a debate with the Palabre CLI. The agent then knows how to frame a subject, pick an agent pair, inject context, and retrieve the exported summary.

The skill follows the open [agentskills.io](https://agentskills.io) standard, so it is portable across Hermes Agent, Claude, Codex, Gemini CLI, and any skills-compatible agent.

The skill does not replace the CLI: it drives `palabre` locally. Palabre CLI remains the source of truth for agents, presets, and exports.

## Install the skill

In **Hermes Agent**:

```bash
hermes skills install JuReyms/Palabre/skills/palabre
```

For other agents (Claude desktop, Claude Code…), follow that agent's own skill-install procedure pointing at [`skills/palabre`](https://github.com/JuReyms/Palabre/tree/main/skills/palabre) in the repository.

## Requirements

- Palabre CLI installed on the same machine (`npm install -g palabre`);
- at least two compatible agents configured or detected by Palabre;
- a host agent compatible with the agentskills.io standard.

Verify the installation from a terminal:

```bash
palabre --version
palabre doctor
palabre agents
```

## What the skill adds

- automatic debate triggering when the user asks to compare two approaches, get a critical review, or a contradictory second opinion;
- selection of a complementary agent pair (proposer / reviewer);
- targeted context injection through `--files` or `--context`;
- retrieval of the summary and the transcript exported to `.palabre/<slug>.debate.md`.
