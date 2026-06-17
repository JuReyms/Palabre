---
title: Summaries
description: Understand the final summary, choose the summary agent, and disable the summary if needed.
---

At the end of a debate or Ask request, Palabre can ask an agent to produce a final summary.

## Summary format

The final summary requests four sections:

1. `Consensus`
2. `Disagreements / uncertainties`
3. `Proposed actions`
4. `Conclusion`

The first three sections are structured as lists. `Conclusion` is a short prose paragraph for quickly understanding what to take away.

## Summary agent

In debate mode, Palabre uses `defaults.summaryAgent` when it exists. Otherwise, it uses agent B.

In Ask mode, Palabre uses `defaults.askSummaryAgent` when it exists, then `defaults.summaryAgent`, then the last Ask agent.

To choose the summary agent for a command:

```bash
palabre codex-claude "Critique this plan" --summary-agent claude
```

To configure a summary agent specific to Ask mode:

```bash
palabre config --ask-summary-agent opencode
```

To also choose the model:

```bash
palabre codex-ollama "Critique this plan" --summary-agent ollama-local --summary-model gemma4:e4b
```

## Disable the summary

```bash
palabre codex-claude "Critique this plan" --no-summary
```

## Readability

In the terminal, the standard rendering formats the summary headings to make them easier to scan.

In the `.debate.md` or `.ask.md` export, the final summary is separated from the transcript or responses by a horizontal rule and begins with a table indicating the agent, role, and production date.
