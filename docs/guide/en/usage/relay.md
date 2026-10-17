---
title: Relay to a conversation
description: Send a message to a closed Codex or Claude Code conversation, or to an open Codex conversation with --open, and get its reply with palabre relay.
seo:
  title: palabre relay, ask a Codex or Claude Code conversation
  description: Send a message to an existing, closed Codex or Claude Code conversation and receive its reply in a single call, in hardened read-only mode.
---

## Relay v1: coordination and authorized reviews

One invocation sends one message and returns one reply to the calling agent. The envelope identifies an **agent**, not the user: coordination never grants authority. Replies never trigger another invocation automatically. An attached session may be refused even while idle: `target-busy`, exit 3, `retryable: true`. Retrying is a caller decision; unknown delivery must be investigated before resending.

The CLI reply is the return channel; immediate Desktop display is not promised. Disposable tests with Codex 0.151.0 and Claude Code 2.1.292 confirmed replies, preserved context and the same session identifier. They do not establish safe concurrent writes into an open Desktop conversation. Default Relay requires a detached session. The separate `--open` pilot is outside v1.

### Human authorization for `review`

The owner explicitly adds this fragment to the local `palabre.config.json`, keeping its existing agents:

```json
{
  "relay": {
    "allowedTasks": ["review"],
    "reviewRepositories": ["owner/repository"]
  }
}
```

From that local configuration directory, its owner can approve the file with `palabre config --trust-config`. Trust binds its path and content hash; edits invalidate existing approval. An agent must not edit or approve this policy to grant itself privileges. `--trust-config` is rejected within a `--task review` invocation.

```text
palabre relay --from codex:<uuid> --to claude:<uuid> --task review --pr https://github.com/owner/repository/pull/123 --json
```

The message is optional with `review`. GitHub CLI (`gh`) must be installed and authenticated. Only explicitly listed GitHub.com repositories are allowed. Unknown tasks, unlisted repositories, ambiguous URLs and `--open` are refused. Without the policy, ordinary read-only notifications remain available, but reviews cannot be published.

Palabre fetches an open PR and its complete diff, labels their contents as untrusted data and asks the read-only colleague for a Markdown review. Oversized PRs are rejected rather than silently truncated. Claude uses `--safe-mode`, Read/Glob/Grep only and no MCP servers.

The Claude `review` task requires **Claude Code 2.1.292 or later** and `--safe-mode` in its help output. Before reading the PR, Palabre probes `--version` and then `--help` on the resolved CLI (configured command, or first PATH match), without a model call. An unsupported or unverifiable CLI produces `invalid-request` with `error.reason: "review-cli-unsupported"` (exit code 8), the detected version and the minimum; no PR is read and no review is published. When multiple versions coexist, use the dedicated agent described under “Multiple Claude CLIs on the same machine”; do not remove `--safe-mode`.

The optional `cli` field in `--json` reports `path` and `version` for this check (`null` version when unverifiable). The review's `.relay.md` export includes the same path and version; for a recognized npm shim, the path identifies the directly launched CLI script. Ordinary notifications keep their existing arguments without this version requirement.

**Palabre publishes a COMMENT review**, bound to the reviewed commit and exact PR. The model only returns review text: no file edits, commits, pushes, merges or direct publishing. Envelope-local identifiers are redacted from the published text and retained in the local export; this is not general secret detection.

The coordination message remains capped at 64 KiB UTF-8. The GitHub context added by Palabre has a separate 256 KiB UTF-8 limit, including JSON encoding. Larger reviews are refused before calling the model; no truncated diff is sent.

Safe-mode applies only to `review`; ordinary notifications retain their historical arguments and customizations. Configuration approval is an operator boundary, not isolation from an agent that already has a writable shell and access to the trust store: such an agent could reapprove the file through another command. A relay message itself cannot extend the policy.

The first Ctrl+C remains handled through the result and export. Before the POST it prevents publishing; after the POST starts, Palabre waits for its bounded outcome rather than claiming to undo it. The reply is retained even in plain text without export, with publication state and URL displayed separately. A definite pre-POST refusal (`not-attempted`) is distinguished from an unknown publishing outcome.

PR head and trusted configuration are rechecked before publishing. Later commits are not covered by a review of an earlier commit. JSON `task` and `.relay.md` include PR, commit, publication state and review URL. Relay's timeout covers the colleague invocation; each GitHub command has its own 60-second limit.

Publication failure exits **9**, `review-failed`, retaining the colleague reply and its delivery verdict. `publication: unknown` means publishing may have succeeded despite a missing or invalid response: never retry automatically, and inspect GitHub first. Review authorization never permits merging.

Mission v2 will add controlled orchestration, roles, budgets and human decisions. Desktop-to-desktop wake-up remains separate, paused research.

`palabre relay` sends **one** message to an existing Codex or Claude Code conversation, gets **one** reply, then exits. An agent can therefore ask another agent's conversation, which answers with its full context.

```bash
palabre relay --from codex:<sender-session> --to claude:<target-session> "Can you review this plan?"
```

## Multiple Claude CLIs on the same machine

PATH ordering can cause an older Claude CLI to be detected before the newer installation. An absolute path in `agents.claude.command` is now preserved at TUI startup and by `palabre config --sync-agents`: a detected installation no longer overwrites it. If the path is missing, it is retained and launching fails explicitly without falling back to another CLI.

You can also keep a dedicated `claude-review` agent to choose the review role and CLI separately, within the existing `agents` in `palabre.config.json`, preserving the rest of the configuration and its `relay` policy:

```json
{
  "agents": {
    "claude-review": {
      "type": "cli",
      "command": "C:/Tools/Claude/claude.exe",
      "args": ["--print", "--output-format", "text", "--no-session-persistence", "--tools", "Read,Glob,Grep"],
      "promptMode": "stdin",
      "shell": false,
      "role": "reviewer"
    }
  }
}
```

Replace the example path with the absolute path to your **Claude Code 2.1.292 or later** CLI. Copy the same `args` as your `claude` agent; the example shows the defaults. Relay builds its own resume arguments. After editing, the owner must approve the updated configuration as described above.

Synchronization only updates known agent keys, including `claude`, and leaves `claude-review` untouched. Relay recognizes Claude by normalizing the program name (`claude.exe`), independently of the agent name. The `review-cli-unsupported` check still verifies the selected CLI before any GitHub read.

```text
palabre relay --from codex:<uuid> --to claude-review:<session> --task review --pr https://github.com/owner/repository/pull/123 --json
```

## Closed conversations by default

Without `--open`, the target conversation must be **closed**: no TUI, desktop, IDE or running exec may be attached to it. Otherwise the relay is refused before anything is sent (`target-busy`). It is also refused when Palabre cannot verify the conversation state (`target-state-unknown`).

For an **open** Codex conversation, use `--open` (next section). Relaying to an open Claude Code conversation is not available yet; it is tracked in issue [#96](https://github.com/JuReyms/Palabre/issues/96).

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
| `--open` | Targets an open Codex conversation (see above). |
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
