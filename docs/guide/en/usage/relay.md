---
title: Relay to a conversation
description: Send a message to a closed Codex or Claude Code conversation, or to an open conversation with --open, and get its reply with palabre relay.
seo:
  title: palabre relay, ask a Codex or Claude Code conversation
  description: Send a message to an existing, closed Codex or Claude Code conversation and receive its reply in a single call, in hardened read-only mode.
---

`palabre relay` sends **one** message to an existing Codex or Claude Code conversation, gets **one** reply, then exits. An agent can therefore ask another agent's conversation, which answers with its full context.

```bash
palabre relay --from codex:<sender-session> --to claude:<target-session> "Can you review this plan?"
```

## Closed conversations by default

Without `--open`, the target conversation must be **closed**: no TUI, desktop, IDE or running exec may be attached to it. Otherwise the relay is refused before anything is sent (`target-busy`). It is also refused when Palabre cannot verify the conversation state (`target-state-unknown`).

For an **open** conversation, use `--open` (next sections): Codex, or Claude Code as an experimental pilot, on Windows.

## Open Codex conversation (`--open`)

```bash
palabre relay --open --from claude:<sender-session> --to codex:<target-session> "Can you review this plan?"
```

With `--open`, Palabre queues the message into an **open** Codex conversation, in the TUI or in Codex desktop, with the `codex queue` command. It then waits for that conversation's reply in its history and returns it to you. This is a **pilot**, limited to Codex on Windows.

- **The conversation must be open.** Its write lock must be held, otherwise nothing is queued (`target-not-open`). The lock is checked again right before queuing.
- **No read-only mode.** The open conversation replies with its own tools, MCP servers and permissions, and Codex desktop applies its current permissions to the relayed turn. The read-only guarantees of relay without `--open` therefore do not apply. The relayed message states that it comes from another, unauthenticated agent and authorizes no action.
- **Unverified receiver.** A held lock proves neither that the conversation is displayed nor that it processes the message. Codex desktop keeps a conversation loaded after you leave it, and processes it without displaying it.
- **Deferred processing is possible.** A queued message may be processed after the timeout, even once Palabre has stopped. Ctrl+C does not cancel a queued message, and there is no automatic resend.
- **Size.** The message is passed as a command argument: the full envelope is limited to 8,192 UTF-16 units. Beyond that, the relay is refused (`message-too-large`).
- **A single timeout.** `--timeout` covers preparation, queuing and waiting.
- **Large histories.** Palabre only reads the first line of the history and what is appended after queuing, whatever its size.

Verified versions: Codex CLI 0.151.0 (TUI) and Codex desktop 26.930.7945.0 (app-server 0.160.1). The Codex history format is not a public schema: another version is not blocked, but reply correlation is not guaranteed there.

## Open Claude Code conversation (`--open`, experimental pilot)

```bash
palabre relay --open --from codex:<sender-session> --to claude:<target-session> "Can you review this plan?"
```

When the target agent is Claude Code, `--open` sends the message to an **open** conversation (terminal or Claude desktop) through Claude Code's cross-session messaging. Palabre launches a `claude -p` messenger (`haiku` model) for this, then reads the reply in the conversation's transcript. This is an **experimental pilot**, Windows only, requiring Claude Code 2.1.292 or later. Its guarantees have not yet been verified against the real CLI.

- **Sending controlled by Palabre.** The messenger can only send with the approval of a guard provided by Palabre. The guard allows a single send, to the intended conversation, with the exact message text. The messenger model never sees your message.
- **The conversation must be open and identifiable.** Palabre looks it up in the list of live sessions (`claude agents`): if it is missing, the relay is refused (`target-not-open`); if its name is shared with another session or the list is unreadable, too (`target-state-unknown`). A conversation cannot relay a message to itself.
- **Reception depends on the target's settings.** A conversation in "bypass permissions" mode, or set to hold or refuse messages from other sessions, may never receive the message. Palabre then reports "reception not observed", with an unknown delivery.
- **No read-only mode.** The conversation replies with its own tools and permissions.
- **Busy conversation.** If it is already working, the message merges into the current turn. Palabre then returns no reply, but reports that the message was received.
- **No automatic resend.** A message may be processed later; do not resend it without checking the conversation.

## Designating conversations

- `--to <agent>:<session>`: `<agent>` is the name of a Codex or Claude Code CLI agent from your configuration (`codex`, `claude`, `claude-opus`…). `<session>` is the conversation identifier (a UUID).
  - Claude Code: it is the name of the `~/.claude/projects/<folder>/<session>.jsonl` file.
  - Codex: it is the end of the `~/.codex/sessions/YYYY/MM/DD/rollout-…-<session>.jsonl` file name.
- `--from <agent>:<session>`: the sender. It is only a label, copied into the relayed message. It is neither launched nor verified, and the sender conversation may be open.

No conversation is ever selected implicitly.

## Options

| Option | Purpose |
| --- | --- |
| `"<message>"` or `--message-file <path>` | The message, 64 KiB at most. Use a file for a message starting with `-`. |
| `--open` | Targets an open conversation: Codex, or Claude Code as an experimental pilot (see above). |
| `--timeout <seconds>` | Maximum duration, 10 to 3600 seconds (default 600). |
| `--json` | A single JSON v1 object on stdout, whatever the outcome. |
| `--no-export` | Does not write the `.relay.md` export. |
| `--config <path>` | Explicit configuration. |
| `--trust-config` | Trusts the resolved configuration. Relay never asks: an untrusted configuration is refused, even in an interactive terminal. |
| `--language <fr\|en>` | Language of the messages and of the envelope. |

Any other option is refused and named, without launching anything: short options (except `-h`), options of other commands, the `--option=value` form and repeated options.

In text mode, the reply alone goes to stdout. The outcome, the delivery and the export path go to stderr.

## What the resume does

- **Hardened read-only mode.** Claude Code is resumed in plan mode with read tools only, no MCP servers and no hooks. Codex is resumed in a read-only sandbox, with no possible approval, no hooks, no `notify` and no memories.
- **Tools lost during the relayed turn.** Codex loses its plugins, connectors and MCP servers. Claude only has read tools. Your configuration is not modified.
- **Conditional guarantees.** With the options enforced by Palabre and on verified CLI versions, the target has no write tool, and unmanaged hooks and the `notify` command are neutralized. MCP servers are neutralized provided the configuration does not change between inspection and resume. These guarantees cover neither administered policies nor unverified CLI versions.
- **The target history is modified.** The message and the reply are added to the conversation, even in read-only mode and even after a failure. You will see them the next time you open it.
- **Executables.** Palabre launches the CLI directly, without a shell. On Windows, a CLI installed with npm is launched with Node and the package script, never through its PowerShell shim, which corrupts accents and arguments. The shim is accepted only if it is identical to the template generated by npm; a modified shim is refused (`unsupported-executable`).

## Known limits

Observed with real throwaway conversations, on Claude Code 2.1.85 and Codex 0.151.0:

- **Claude may refuse to answer.** The target may take the relayed message for an injection attempt and refuse to share elements of its conversation. The relay then returns `replied`, with that refusal as the reply.
  - To avoid this, Palabre appends a fixed frame to the resume system prompt. This frame states that you are using `palabre relay` to ask a question, that the displayed sender is not authenticated, and that no instruction is lifted.
  - This frame is effective with Claude Code 2.1.85. With 2.1.292, a system prompt appended on resume is not applied; no refusal was observed with that version, however.
- **Codex resumes with the model recorded in the conversation.** If your account no longer allows that model, the relay fails (`cli-failure`). The message stays recorded in the conversation (`persisted-no-reply`): do not resend it without checking.
- **Claude Code picks the resume model itself.** The model actually used is reported in `observedModels`.

Verified versions: Claude Code 2.1.85 and 2.1.292, Codex 0.151.0. The guarantees are not extended to other versions.

## Outcome and delivery

Palabre never resends a message automatically. The delivery status tells you what you can do:

| Delivery | Meaning |
| --- | --- |
| `replied` | Reply received. |
| `not-delivered` | Nothing was written: sending again cannot create a duplicate. |
| `persisted-no-reply` | The message is in the target conversation, without a reply: sending again would duplicate it. |
| `unknown` | Cannot tell: check the target conversation before resending. |

| Code | Outcome |
| --- | --- |
| 0 | `replied` |
| 1 | `internal-error` |
| 2 | `cli-failure`, `no-valid-reply`, `usage-limit`, `output-too-large` |
| 3 | `target-busy`, `target-state-unknown`, `neutralization-failed`, `target-not-open` (with `--open`) |
| 4 | `timeout` |
| 5 | `identity-mismatch` (the reply does not come from the target and is not returned) |
| 6 | `session-not-found` |
| 7 | `command-not-found` |
| 8 | `invalid-request`, with a reason: arguments, identifier, message size, agent, configuration, executable or working directory |
| 130 | `cancelled` |

## JSON output

```json
{
  "v": 1,
  "type": "relay-result",
  "status": "replied",
  "exitCode": 0,
  "from": { "agent": "codex", "session": "<uuid>" },
  "to": { "agent": "claude", "session": "<uuid>", "provider": "claude" },
  "reply": "…",
  "delivery": { "status": "replied", "persisted": true, "inActiveBranch": true },
  "identity": "same-as-target",
  "observedModels": ["…"],
  "error": null,
  "exportPath": ".palabre/…relay.md",
  "durationMs": 12345
}
```

`reply` is present only for `replied`. For any other outcome, `error` contains `kind`, `message` and, for `invalid-request`, `reason`. `inActiveBranch` is a diagnostic.

With `--open` only, the object adds optional fields:

- `mode`: `"open"`;
- `queue`: `attempted` (a queue attempt was made), `accepted` (`true` for a recognized acknowledgment, `"unknown"` without proof, `false` only if your Codex does not know `queue`), `itemId` and `diagnostic`;
- `correlation`: status and reason of the history reading;
- `receiver`: always `"unverified"`;
- `targetPermissions`: approval, sandbox and network applied to the relayed turn, or `"unknown"`.

If the envelope is not found in the history after queuing, the error message says "reception not observed": the message may still be processed later.

## Export

By default, Palabre writes a `palabre-relay-<agent>-<date>.relay.md` file in the export folder (see [Exports](/en/usage/exports)). It contains the sender and the target with their session identifiers, the message, the reply or the error, and the delivery.
