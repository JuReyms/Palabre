---
title: Chat mode
description: Talk with one active agent, request a second opinion, and understand Chat's bounded memory.
seo:
  title: "Chat mode: talk to one agent, consult another"
  description: Hold a conversation with one active agent, pull in a second opinion when you need it, and understand Chat's bounded memory.
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

In the TUI, with the direct command, and in an NDJSON integration, a blank line does not end the conversation. `/end` saves it; `/exit`, `/home`, or the end of input finish it without an export. If an agent fails, Palabre saves the partial transcript. `--dry-run` is not available in Chat: the command is refused without running anything.

Integrations drive Chat through the [NDJSON stream](/en/integrations/ndjson).

## Other commands and integrations

In TUI Chat, `/home`, `/back`, `/quit` and `/exit` return home without an export; they do not save Chat. `/use <agent>` makes that agent active. `/end` saves the conversation.

```powershell
palabre chat "Let’s discuss this module" --agent-a codex --files src/auth.ts
```

For agents and integrations: `--renderer ndjson`, then one JSON action per stdin line (`chat-send`, `chat-consult`, `chat-use`, `chat-agents`, `chat-end`), never simulated slash commands. A usage limit is reported as `usage-limit`, with a retry indication when supplied by the CLI; no automatic resend.

Chat retains no reusable provider session: each reply is a new call with at most six recent messages. To write to an existing conversation with its context, use [Relay](/en/usage/relay).
