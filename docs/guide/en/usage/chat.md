---
title: Chat mode
description: Talk with one active agent, request a second opinion, and understand Chat's bounded memory.
---

Chat fits situations where one agent is enough, with the option to consult another agent when useful.

## From the TUI

Run `palabre`, then `/chat`. Chat uses default agent A. `/agents codex` selects the active agent.

| Command | Effect |
|---------|--------|
| `/consult claude` | Requests a second opinion without replacing the active agent. |
| `/use claude` | Continues with Claude. |
| `/agents` | Displays available agents. |
| `/end` | Saves and ends. |
| `/home` | Returns without saving. |

After Debate or Ask, `/chat` carries over the subject and final summary, or the six recent exchanges without a summary.

## Memory and limits

Chat is stateless for external agents. Every response starts a batch call and reinjects at most six recent messages. It does not promise a persistent provider session, token streaming, or recovery after restart.

## Direct command

```bash
palabre chat --agent-a codex
```

`--role-a`, `--model-a`, `--language`, `--files`, and `--context` remain available. The `.chat.md` export preserves the transcript, time, and termination reason, without an automatic summary.
