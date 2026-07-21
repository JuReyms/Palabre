---
title: Debate mode
description: Make two agents answer each other, configure turns, and obtain a comparative summary.
---

Debate is Palabre's primary mode. Two agents answer each other on one subject with the context and previous responses.

## From the TUI

```bash
palabre
```

Then:

```text
/debat
/agents codex claude
/roles architect critic
Review this plan and resolve the important disagreements
```

Each response receives the subject, context, injected files, and history. The final summary organizes consensus, disagreements, proposed actions, and a short conclusion.

The response count is between 1 and 20. It is the total, not the count per agent. Palabre may stop after a complete round when explicit agreement is detected.

## Direct commands

```bash
palabre codex-claude "Review this plan" -t 4
palabre run --subject "Review this plan" --agent-a codex --agent-b claude --turns 4
```

Add `--no-early-stop`, `--no-summary`, or `--summary-agent <agent>` as needed. `--dry-run` previews the session without calling an agent. The export uses `.debate.md`.
