---
title: Debate mode
description: Make two agents answer each other, configure turns, and obtain a comparative summary.
seo:
  title: "Debate mode: make two AI agents argue"
  description: Make two AI agents answer each other in turns, set the number of rounds, and get a summary of where they disagree.
---

Debate is Palabre's primary mode. Two agents answer each other on one subject with the context and previous responses.

## From the TUI

```bash
palabre
```

Then:

```text
/debate
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

## Roles, context and failures

`/roles architect critic` assigns temporary roles in agent order: a structured proposal, then a search for flaws. Roles: `implementer`, `reviewer`, `architect`, `scout`, `critic`, `summarizer`. `--role-a` and `--role-b` do not modify configuration; `palabre agent-role <agent> <role>` sets a persistent role.

The default limit is 4 responses, configurable with `palabre config -t <n>`; early stopping may produce fewer. To request the whole limit, use `--no-early-stop`. A positional subject must have several words; for one word, use `-s "word"`.

```powershell
palabre codex-claude "Review this plan" --context src docs -t 4
```

See [Context and files](/en/usage/context-and-files). On agent failure (quota, timeout, empty reply), PALABRE attempts to preserve a partial export with an interruption section. With `--checkpoint`, `palabre resume <session-id>` resumes the next missing response or summary, without replaying an accepted answer. No automatic retry.

After Debate, [Chat](/en/usage/chat) can continue from the subject and summary. To consult a conversation that already knows the project, use [Relay](/en/usage/relay).
