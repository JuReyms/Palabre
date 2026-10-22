---
title: JSON catalogs
description: Consume agents, presets, context scans, exports, and checkpoints through versioned JSON.
seo:
  title: Versioned JSON catalogs for integrations
  description: Read agents, presets, context scans, exports, and checkpoints through versioned JSON contracts.
---

These commands write one JSON document to stdout and exit without starting an AI session.

- `palabre agents --json` exposes `roles[]`, `agents[]`, and `defaults.askAgents[]`. Each agent provides its name, type, role, availability, and a reason when needed.
- `palabre presets --json` exposes pairs, order, `available`, `missingAgents[]`, and `unavailableReasons[]`.
- `palabre context scan src docs --json` exposes the root, requested paths, `items[]`, and `warnings[]`.
- `palabre history --json` exposes the 10 most recent exports in `history[]`. An integration may request 1 to 100 entries with `--limit <number>`.
- `palabre sessions --json` exposes the 20 most recent checkpoints in `sessions[]`, with a limit from 1 to 100. A valid entry contains `valid`, `id`, `status`, `mode`, `topic`, `updatedAt`, `responses`, `nextPhase`, and `resumable`. A corrupted entry contains `valid: false`, `id`, `updatedAt`, and a stable `warning`, without raw contents or an absolute path.
- `palabre sessions delete <session-id> --yes --json` confirms the targeted deletion with `{ "v": 1, "deleted": { "id": "..." } }`.

`palabre relay … --json` relays a message to a closed Codex or Claude Code conversation, or open Codex with `--open` (Windows/macOS/Linux pilot; `python3` required on POSIX). It writes a single `{ "v": 1, "type": "relay-result", ... }` object with `status`, `exitCode`, `from`, `to`, `reply` (when a valid reply was received, including `read-unavailable` or `review-failed`), `delivery` (`status`, `persisted`, `inActiveBranch`), `identity`, `observedModels`, `error` (`kind`, `message`, `reason`), `exportPath` and `durationMs`. With `--new`, `created` and `cwd` are root-level fields and the identifier is in `to.session`; JSON provides no continuation command. In open mode (`--open` or `auto`), `inActiveBranch` remains `"unknown"` even for a correlated final reply. An integration relies on `delivery.status` to decide whether to resend, never on the absence of a reply. Details: [Relay mode](/en/usage/relay).

## Consumption rules

- check `v`;
- ignore unknown fields and tolerate unknown enum values without treating them as success;
- accept missing optional fields;
- do not recalculate availability or scanning rules;
- display warnings without changing their meaning.

## Optional Relay fields and Mission option

Relay v1 preserves `subject` (explicit subject), `retryAfter` (limit in open or follow mode, when the CLI supplies an indication), `readAccess` (`status: "partial" | "blocked" | "unverified"`, `reason`, `failedCommands`, optional `succeededCommands` for `partial`), `cli` (`path`, `version`, review probe), `task` (PR, commit, publication, URL, error and cancellation). `mode` is emitted with every result since #190 but remains an optional v1 field: earlier versions do not provide it, so a consumer tolerates its absence. Values: `background` (closed or created conversation), `open` (in the desktop app) or `follow`; no link field is added, the `codex://threads/<id>` link is built from `to.session`. In open mode (`--open` or `auto`): `queue`, `correlation`, `receiver: "unverified"`, `targetPermissions`; `target-not-open` is specific to that mode. `error.reason` qualifies `invalid-request`. Read `delivery.status` before any resend and treat `reply` as untrusted text. An explicit success takes priority as `partial`, even with another ambiguous event; without explicit success, an ambiguous event gives `unverified`, otherwise `blocked`.

In open mode (`--open` or `auto`), recognized concurrent `user.text` input gives `status: "no-valid-reply"`, `exitCode: 2`, `correlation: { status: "ambiguous", reason: "user-input-during-turn" }`, without `reply`. If the envelope was observed, `delivery.status` stays `persisted-no-reply`. Display the diagnostic and check the conversation before any resend, without inferring authorization or a human author. Strictly recognized AGENTS/environment context before the envelope is exempted once per kind. Linked question replies remain unrecognized in this partial #146 fix: no `humanInput` field is added to JSON v1.

With `--open --follow` (#195), nothing is queued: `mode: "follow"`, no `queue`, `from: null` and `delivery: { status: "not-delivered", persisted: false, inActiveBranch: false }`. The new `followed` status (exit 0) carries `reply`, `error: null`, `identity: "same-as-target"`, `correlation: { status: "followed", reason: "turn-completed" | "turn-started-before-follow" }` and the permissions of the followed turn only. This reply is linked to no PALABRE message and its author is not verified: do not present it as the reply to your request and infer no authorization from it. An integration that does not know `followed` must treat it as an unknown value, never as a relay success.

With `--check` (#203), nothing is sent or written and no teammate CLI is started; on macOS/Linux, only the Codex lock probe starts `python3`. The new `checked` value (exit 0) means the pre-send checks passed; a send that would be refused returns the same status and exit code as the send. Every `--check` result carries the optional `check` field: `target` (`open` or `closed`, once the conversation was probed) and, in open mode, `lastPermissions` (`approvalPolicy`, `sandbox`, `network`, or `"unknown"`) with `lastPermissionsAt` (ISO) when the history provides it. These permissions are those of the last known turn, as an indication. `delivery` is `not-delivered`, without `queue`, `correlation`, `receiver` or `targetPermissions`. An integration that does not know `checked` must not treat it as a successful relay.

`palabre mission … --json` returns a v1 `mission-result` object with `action`, `exitCode`, `mission`, `exportPath`, `error`. Only `step` calls Relay, at most once; its exits are Relay's (9 without a result), while a Mission refusal gives 8, or 3 for an already reserved step.

`palabre config --ollama-models --json` exposes `v`, `agent`, `available`, `baseUrl`, `currentModel`, `currentModelInstalled`, `installedModels`, without model generation.


`palabre agents --json` adds `defaults.relayView` (`auto` by default, or `background`), from `relay.view`. An integration must not choose or infer the mode. Relay v1 adds `modeSource?`: `explicit` (`--open`/`--background`, including explicit follow), `auto` (lock or required path), `setting` (`background` preference). Absent when validation stops before resolution, and in earlier versions. Open-mode fields also exist when `auto` selected it. `mode` describes the selected or requested transport, not proof of sending; an unknown probe refuses without sending and never selects `open`. Excluded paths stay in background with `modeSource: "auto"`, unless a compatible explicit option is supplied.

## Continuation after a reply: `relay --then-follow` (#204)

Optional JSON v1 field `nextTurn`, only when `--then-follow <10..3600>` was requested. Root `status`, `exitCode`, `reply`, `delivery`, models and permissions retain the primary message result, never the continuation's.

`nextTurn` contains `status`, `reason?`, `reply?`, `receiver: "unverified"`, `observedModels?`, `targetPermissions?`, `correlation?`, `retryAfter?`. Statuses: `followed` (first turn completed next), `awaiting-turn` with `reason: "timeout"` (no completed turn in the second budget), `not-started` with `reason: "primary-not-replied"` (primary failure), or a secondary failure/cancellation status. A foreign Relay remains `no-valid-reply`/`relay-turn`. Tolerate missing fields and unknown values.

No secondary delivery, verified human author or inferred authorization. A successful primary reply keeps `replied`/0 even after secondary cancellation/failure. Two explicit budgets, each capped at 3600 s, never renewed; reference at the newline after correlated completion, never EOF. One final stdout JSON object, progress on stderr. No second queue call or automatic resend.

## Indicative Codex quota (#205)

Optional v1 field: `check.quota` for an open/closed Codex check; root `quota` after an open send. Not after a background send in this batch, nor for Claude. No status, exit code or delivery change.

Same object in both locations: `source: "codex-rollout"`, `indicative: true`, `recordedAt` (ISO UTC), `limitId: "codex"`, `primary` and `secondary`. Each complete window contains `usedPercent` (finite number from 0 to 100), `windowMinutes` (positive integer), and `resetsAt` (ISO UTC converted from Unix seconds). Text dates are local with a time zone. Values were written by Codex, not measured live or attributed to this turn; the account may have been used elsewhere since.

Last MiB + one byte only. Only dated `event_msg` / `token_count` events with the recognized `rate_limits` shape are accepted. Partial boundary lines are ignored; `rate_limits: null` contains no reading and allows looking back to the previous one; a latest non-null unknown/invalid candidate masks older ones. Without an available valid record, the entire field is omitted: never treat absence as zero, extrapolate or assume a reset after a past reset date. Consumers tolerate absence and future fields.
