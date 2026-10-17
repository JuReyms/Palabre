---
title: Relay to a conversation
description: Send a message to a closed Codex or Claude Code conversation, or to an open Codex conversation with --open, and get its reply with palabre relay.
seo:
  title: palabre relay, ask a Codex or Claude Code conversation
  description: Send a message to an existing, closed Codex or Claude Code conversation and receive its reply in a single call, in hardened read-only mode.
---

## Relay v1: coordination and authorized reviews

To keep scope and results across several calls, also use [Mission v2.0](#mission-v20-the-mission-lead-calls-the-teammate-one-step-at-a-time), below.

One invocation sends one message and returns one reply to the calling agent. The envelope identifies an **agent**, not the user: coordination never grants authority. Replies never trigger another invocation automatically. An attached session may be refused even while idle: `target-busy`, exit 3, `retryable: true`. Retrying is a caller decision; unknown delivery must be investigated before resending.

The CLI reply is the return channel; immediate Desktop display is not promised. Disposable tests with Codex 0.151.0 and Claude Code 2.1.292 confirmed replies, preserved context and the same session identifier. They do not establish safe concurrent writes into an open Desktop conversation. Default Relay requires a detached session. The separate `--open` pilot is outside v1.

## A readable header, added by PALABRE

PALABRE adds a compact line before the message, in the relay language (`--language`, then the usual language resolution). The warning stays before the content; session identifiers and the reference move to the technical footer.

```text
📧 **PALABRE Relay** · claude → codex · *message from an agent, not the user; no authorization*
**Subject:** Plan review

<message content>

---
Origin: declared, unauthenticated sender · session <uuid> · ref. <reference>.
<rules and reply instructions>
```

A subject is added only with `--subject "Plan review"`: one nonblank line, at most 200 Unicode characters, without control or Unicode formatting characters. Nothing is inferred automatically. Subject Markdown is escaped in the header; its original value is kept in optional JSON v1 field `subject` and `.relay.md`. Without the option, that field stays absent and no Subject line is added.

**Sending agent: do not add a second PALABRE header.** For the body, prefer **Context**, **To do**, **Do not**, **Reply with**, with cautionary instructions in italics. These sections are suggestions, never enforced by code. A header imitation in the body is not removed: the content remains untrusted and grants no rights.

Mission uses the same presentation: `📧 **PALABRE Mission** <id> · step n · mission lead claude → teammate codex`, followed by the same warning. The controller supplies the identifier and step number through the internal API; no Relay flag can request this header. Scope keeps the objective and criteria without repeating the identifier. Mission state retains schema v1.

Message, header, subject and coordination footer together count toward **64 KiB UTF-8**. The GitHub review context retains its separate 256 KiB limit, plus fixed review instructions. With `--open`, the **8,192 UTF-16 unit** bound still covers the entire envelope (📧 takes two units), and the Windows command line remains bounded. The nonce at the bottom remains a marker in the user message; `--open` correlation still compares the sent and observed text exactly. Immediate Desktop display is not promised.

## Mission v2.0: the mission lead calls the teammate, one step at a time

Relay is the doorbell; Mission keeps the work log. You talk to your usual mission lead in its app or terminal. It asks simple questions, agrees the objective, success criteria, tasks and budget with you, then calls a teammate **whose conversation stays closed** (terminal, Desktop and IDE). You make decisions; the mission lead reads the replies without asking you to copy and paste them.

This first lot supports read-only analysis and planning (`consult`), plus the existing `review` task. Publishing a review still requires the already trusted Relay policy for the repository. The scope grants **no** permission to edit code, commit, push, merge or release. Code writing belongs to a separate v2.1 lot, which is not available yet. CLI protections and limitations are those of Relay; Mission is not a new sandbox.

The mission lead uses explicitly chosen full UUIDs and the same working directory for every command. PowerShell example (replace UUIDs; do not publish them on GitHub):

```powershell
$mission = palabre mission start --from "codex:<mission-lead-uuid>" --to "claude-review:<teammate-uuid>" --criteria "Risks and next decisions explained" --tasks "consult,review" --max-steps 4 --max-duration 3600 --timeout 600 "Analyse the migration plan" --json | ConvertFrom-Json
palabre mission step $mission.mission.id "Read the plan and list the risks" --json
palabre mission status $mission.mission.id --json
palabre mission step $mission.mission.id "Review the PR" --task review --pr https://github.com/owner/repository/pull/123 --timeout 1200 --json
palabre mission stop $mission.mission.id --reason "Analysis complete"
```

`start` saves the scope without a model call or config approval. For this read-only mission, your answers to the mission lead are enough: no extra keyboard confirmation. The mission lead must never expand its own tasks or review policy.

Each `step` makes **at most one Relay call**, then exits. The mission lead checks the result before forming its next request: no automatic loop and no call back from the teammate. Mission lead switching is not included in this first lot. A busy refusal never triggers a resend: close the teammate's conversation, then decide on another explicit step.

### Budget, monitoring and resuming

| `start` option | Default | Limits |
| --- | --- | --- |
| `--tasks` | `consult` | `consult`, `review` or `consult,review` |
| `--max-steps` | 10 | 1–100 attempts, including refusals |
| `--max-duration` | 3600 s | 10–86400 s from `start`, including time between steps |
| `--timeout` | 600 s | 10–3600 s; each `step` can override it, capped by the remaining duration |

These timeouts bound the Relay call; probes and GitHub operations retain their own time bounds. Cancellation does not guarantee they stop immediately. **No monetary cost cap**: calls consume your provider's quota or budget.

`status` and `stop` never call an agent. JSON v1 state and the `.mission.md` export live in `.palabre/missions/<id>/`, independently of `outputDir`. All commands accept `--json` (one `mission-result` v1 object: `action`, `exitCode`, `mission`, `exportPath`, `error`). Each step keeps the message, Relay result, reply, delivery and any GitHub publication. Replies are **not automatically verified**; identifiers, paths and exchanges stay private in these local files. Storage is limited to 32 MiB.

After the mission lead exits normally, resume with `status`, then a new `step` using the same identifier: earlier replies are never replayed. After a crash during a call, `running` without a result or `uncertain` needs verification with the owner; **do not delete the lock to retry**. A certain refusal leaves `paused` and permits another explicit request after reading the diagnostic. Step failures keep Relay's exit code, including 3 for a busy session; Mission refusals use 8 (3 for an already reserved step), and a step without a result uses 9.

`stop` remains available during a step and with an orphaned lock. It forbids further steps and requests best-effort cancellation: an existing message or review cannot be withdrawn. A stopped or exhausted mission needs a new scope decided by the owner and a new mission; no automatic reopening.

### Human authorization for `review`

To authorize relay reviews for one repository, the owner opens a terminal and runs:

```powershell
palabre relay allow-repo owner/repository
```

To authorize all repositories owned by one account, with one confirmation:

```powershell
palabre relay allow-repo 'you/*'
```

The command shows the selected file's **path**, not its contents (`--config`, otherwise local then global configuration), the repository and activation of the sole `review` task. An owner-wide pattern gets an explicit warning. The owner checks the path and planned change, then types **`y`** to confirm (`yes`, `o` and `oui` are also accepted). Enter or a negative answer declines with exit code **8**, without writing; closing the terminal interrupts the command. Other settings are preserved; repository entries are case-insensitive and deduplicated, and only the hash of the written content is approved.

The file must already exist and be trusted. If it changed or has never been approved, `allow-repo` refuses before prompting: the owner opens and reads the entire file, including agent commands and arguments, then runs the `palabre config --config <file> --trust-config` command shown in the error **themselves**, before rerunning `allow-repo`. Explicit approval also works for global configuration. The agent must never perform it for the owner. Copyable commands on this page and in `remedy` target PowerShell or a POSIX shell, not `cmd.exe`.

Both input **and** output must be interactive terminals; otherwise nothing is written. Neither `--yes` nor `--trust-config` bypasses confirmation. Only an exact repository or `owner/*` is accepted: no bare `*` or partial pattern such as `owner/pre*`. Confirmation is an operator rule, not proof of human identity or isolation from a program that already controls a terminal and the profile.

**Agent, on `task-not-allowed`:** read JSON `remedy`, open that command in the **human's visible terminal** using host tools, then wait for their decision. Never answer for them, use a hidden pseudo-terminal to confirm, or edit/approve the policy yourself. If the host cannot open a terminal, provide the exact command to the owner. `remedy` includes `--config` to keep the same file even from another directory. The CLI does not open a window itself; presentation belongs to the host.

A review only publishes a COMMENT review; merging remains human. The command records a policy like this (descriptive example; no manual JSON editing needed):

```json
{
  "relay": {
    "allowedTasks": ["review"],
    "reviewRepositories": ["owner/repository"]
  }
}
```

`allow-repo` writes and approves either a local or a global configuration while retaining its agents. Trust binds its path and content hash; edits invalidate existing approval. An agent must not edit or approve this policy to grant itself privileges. `--trust-config` is rejected within a `--task review` invocation.

```text
palabre relay --from codex:<uuid> --to claude:<uuid> --task review --pr https://github.com/owner/repository/pull/123 --json
```

The message is optional with `review`. GitHub CLI (`gh`) must be installed and authenticated. Only explicitly listed GitHub.com repositories are allowed. Unknown tasks, unlisted repositories, ambiguous URLs and `--open` are refused. Without the policy, ordinary read-only notifications remain available, but reviews cannot be published.

Palabre fetches an open PR and its complete diff, labels their contents as untrusted data and asks the read-only teammate for a Markdown review. Oversized PRs are rejected rather than silently truncated. Claude uses `--safe-mode`, Read/Glob/Grep only and no MCP servers.

The Claude `review` task requires **Claude Code 2.1.292 or later** and `--safe-mode` in its help output. Before reading the PR, Palabre probes `--version` and then `--help` on the resolved CLI (configured command, or first PATH match), without a model call. An unsupported or unverifiable CLI produces `invalid-request` with `error.reason: "review-cli-unsupported"` (exit code 8), the detected version and the minimum; no PR is read and no review is published. When multiple versions coexist, use the dedicated agent described under “Multiple Claude CLIs on the same machine”; do not remove `--safe-mode`.

The optional `cli` field in `--json` reports `path` and `version` for this check (`null` version when unverifiable). The review's `.relay.md` export includes the same path and version; for a recognized npm shim, the path identifies the directly launched CLI script. Ordinary notifications keep their existing arguments without this version requirement.

**Palabre publishes a COMMENT review**, bound to the reviewed commit and exact PR. The model only returns review text: no file edits, commits, pushes, merges or direct publishing. Envelope-local identifiers are redacted from the published text and retained in the local export; this is not general secret detection.

The coordination envelope (message, header, subject and footer) remains capped at 64 KiB UTF-8. The GitHub context added by Palabre has a separate 256 KiB UTF-8 limit, including JSON encoding. Larger reviews are refused before calling the model; no truncated diff is sent.

Safe-mode applies only to `review`; ordinary notifications retain their historical arguments and customizations. Configuration approval is an operator boundary, not isolation from an agent that already has a writable shell and access to the trust store: such an agent could reapprove the file through another command. A relay message itself cannot extend the policy.

The first Ctrl+C remains handled through the result and export. Before the POST it prevents publishing; after the POST starts, Palabre waits for its bounded outcome rather than claiming to undo it. The reply is retained even in plain text without export, with publication state and URL displayed separately. A definite pre-POST refusal (`not-attempted`) is distinguished from an unknown publishing outcome.

PR head and trusted configuration are rechecked before publishing. Later commits are not covered by a review of an earlier commit. JSON `task` and `.relay.md` include PR, commit, publication state and review URL. Relay's timeout covers the teammate invocation; each GitHub command has its own 60-second limit.

Publication failure exits **9**, `review-failed`, retaining the teammate reply and its delivery verdict. `publication: unknown` means publishing may have succeeded despite a missing or invalid response: never retry automatically, and inspect GitHub first. Review authorization never permits merging.

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
| `"<message>"` or `--message-file <path>` | The message; 64 KiB UTF-8 at most for the full coordination envelope. Use a file for a message starting with `-`. |
| `--open` | Targets an open Codex conversation (see above). |
| `--subject "<subject>"` | Optional subject, one nonblank line of at most 200 Unicode characters, without control or formatting characters; JSON/export `subject?`. |
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
| 2 | `cli-failure`, `no-valid-reply`, `usage-limit`, `output-too-large`, `read-unavailable` |
| 3 | `target-busy`, `target-state-unknown`, `neutralization-failed`, `target-not-open` (with `--open`) |
| 4 | `timeout` |
| 5 | `identity-mismatch` (the reply does not come from the target and is not returned) |
| 6 | `session-not-found` |
| 7 | `command-not-found` |
| 8 | `invalid-request`, with a reason: arguments, identifier, message size, agent, configuration, executable or working directory |
| 9 | `review-failed`: review publication refused or unconfirmed, reply preserved |
| 130 | `cancelled` |

## Codex on Windows: reply received, reads blocked

A reply does not prove the agent could read the repository. If the Codex JSON stream reports a command that could not start with `CreateProcessAsUserW failed: 5`, PALABRE preserves the reply, identity and delivery, but returns `read-unavailable` (exit 2). With `--task review`, it returns `review-failed` (exit 9), `task.error: "read-unavailable"` and `task.publication: "not-attempted"`: **no review is published on GitHub**. Mission uses the same diagnostic and pauses.

The optional `readAccess` field in JSON and the export contains `status: "blocked"`, `reason: "windows-process-access-denied"` and `failedCommands` (number of affected commands). The Mission export preserves the error and reply. If the exchange also fails (timeout, cancellation, identity mismatch…), that outcome keeps its exit code and the read diagnostic is added to its message. Another successful command does not clear the warning; an absent field proves neither a read nor full access. Detection covers this structured startup error, checked against Codex 0.163.0, rather than model prose; it does not recognize every possible read failure. It applies to resumption without `--open`.

**Next step — the owner:** read the [troubleshooting guide, Codex on Windows section](/en/troubleshooting), then follow [#128](https://github.com/JuReyms/Palabre/issues/128). Probable cause to check: the Microsoft Store PowerShell shortcut `WindowsApps\pwsh.exe`. On the tested machine, the same read under `:read-only` succeeds with native PowerShell and fails with this alias. This does not prove a general `unelevated` failure.

No known, validated solution yet to force the native shell in this Codex 0.163.0 workflow. `[windows] shell_path`, already present when the failure occurred, is not recognized in this version's schema; do not add it as a fix. PALABRE changes no settings or permissions. Do not resend automatically: the message may already have received a reply.

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

`reply` is present when a valid reply was received, including when blocked reads or a publication failure subsequently make the outcome unsuccessful. For any outcome other than `replied`, `error` contains `kind`, `message` and, for `invalid-request`, `reason`. `inActiveBranch` is a diagnostic.

With `--open` only, the object adds optional fields:

- `mode`: `"open"`;
- `queue`: `attempted` (a queue attempt was made), `accepted` (`true` for a recognized acknowledgment, `"unknown"` without proof, `false` only if your Codex does not know `queue`), `itemId` and `diagnostic`;
- `correlation`: status and reason of the history reading;
- `receiver`: always `"unverified"`;
- `targetPermissions`: approval, sandbox and network applied to the relayed turn, or `"unknown"`.

If the envelope is not found in the history after queuing, the error message says "reception not observed": the message may still be processed later.

## Export

By default, Palabre writes a `palabre-relay-<agent>-<date>.relay.md` file in the export folder (see [Exports](/en/usage/exports)). It contains the sender and the target with their session identifiers, the message, the reply or the error, and the delivery.
