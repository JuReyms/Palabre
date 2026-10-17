---
title: Ask mode
description: Compare up to four independent answers before a faithful summary.
seo:
  title: "Ask mode: compare up to four independent AI answers"
  description: Send one question to one to four AI agents, compare their independent answers, then get a faithful summary.
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

## Summary, options and failure

Agents run one after another; their durations add up. The [summary](/en/usage/summaries) covers each opinion, compares, notes uncertainties, proposes actions and concludes. Summary agent: `--summary-agent`, then `defaults.askSummaryAgent`, `defaults.summaryAgent`, then the last Ask agent; `--no-summary` disables it.

Options: `--ask-role critic` (temporary shared role, like `/roles critic`), `--files`, `--context`, `--checkpoint`. Equivalent: `palabre run --mode ask --agents codex claude -s "Subject"`. Persistent default: `palabre config --mode ask --ask-agents codex claude opencode`.

On failure, PALABRE attempts a partial export. With `--checkpoint`, `palabre resume <session-id>` resumes the next agent that has not answered, then the remaining agents and summary; no replay of accepted answers.
