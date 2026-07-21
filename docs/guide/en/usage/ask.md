---
title: Ask mode
description: Compare up to four independent answers before a faithful summary.
---

Ask sends the same subject and context to several agents. Each answers without seeing the others, then a summary agent summarizes and compares them.

## From the TUI

```text
/ask
/agents codex claude opencode
Compare these two migration strategies
```

Ask accepts 1 to 4 agents. `/roles critic` applies one shared role to all active Ask agents.

Use Ask to check convergence without mutual influence, compare strategies, or obtain several analyses before a summary. The answer count depends on selected agents; `--turns` does not apply.

## Direct command

```bash
palabre ask "Compare these approaches" --agents codex claude opencode
```

Without `--agents`, Palabre uses `defaults.askAgents`, then the default debate pair. The export uses `.ask.md`.
