---
title: NDJSON v1 stream
description: Read Palabre session events from stdout and build a robust integration UI.
---

`--renderer ndjson` writes one valid JSON object per line to stdout. Every event contains `v: 1` and a `type` field.

| Type | Purpose |
|------|---------|
| `start` | Mode, subject, agents, context, and options. |
| `notice`, `warning` | Information ordered in the stream. |
| `thinking-start`, `thinking-end` | Agent waiting state. |
| `turn-start`, `message` | Debate turn and answer. |
| `ask-response-start`, `ask-response` | Ask answer. |
| `summary-start`, `summary-message` | Summary. |
| `error` | Structured failure. |
| `done` | Business completion and export path, possibly null. |

Chat adds `chat-agents`, `chat-user-message`, `chat-message`, `chat-consultation-start`, `chat-consultation`, and `chat-agent-changed`. Its commands are sent through stdin one line at a time.

```json
{"v":1,"type":"thinking-start","agent":"codex","role":"implementer"}
{"v":1,"type":"message","turn":1,"agent":"codex","role":"implementer","content":"..."}
{"v":1,"type":"thinking-end"}
{"v":1,"type":"done","outputPath":"C:\\project\\.palabre\\session.debate.md"}
```

stdout belongs to NDJSON. stderr may contain diagnostics and Ollama progress. Preserve order, ignore unknown types, wait for the exit code, and render agent content as untrusted text, never executable HTML.
