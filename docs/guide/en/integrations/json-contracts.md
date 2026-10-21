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

`palabre relay … --json` relays a message to a closed Codex or Claude Code conversation, or open Codex with `--open` (Windows/macOS/Linux pilot; `python3` required on POSIX). It writes a single `{ "v": 1, "type": "relay-result", ... }` object with `status`, `exitCode`, `from`, `to`, `reply` (when a valid reply was received, including `read-unavailable` or `review-failed`), `delivery` (`status`, `persisted`, `inActiveBranch`), `identity`, `observedModels`, `error` (`kind`, `message`, `reason`), `exportPath` and `durationMs`. With `--new`, `created` and `cwd` are root-level fields and the identifier is in `to.session`; JSON provides no continuation command. With `--open`, `inActiveBranch` remains `"unknown"` even for a correlated final reply. An integration relies on `delivery.status` to decide whether to resend, never on the absence of a reply. Details: [Relay mode](/en/usage/relay).

## Consumption rules

- check `v`;
- ignore unknown fields and tolerate unknown enum values without treating them as success;
- accept missing optional fields;
- do not recalculate availability or scanning rules;
- display warnings without changing their meaning.

## Optional Relay fields and Mission option

Relay v1 preserves `subject` (explicit subject), `retryAfter` (limit with `--open`, when the CLI supplies an indication), `readAccess` (`status: "partial" | "blocked" | "unverified"`, `reason`, `failedCommands`, optional `succeededCommands` for `partial`), `cli` (`path`, `version`, review probe), `task` (PR, commit, publication, URL, error and cancellation). With `--open`: `mode`, `queue`, `correlation`, `receiver: "unverified"`, `targetPermissions`; `target-not-open` is specific to that mode. `error.reason` qualifies `invalid-request`. Read `delivery.status` before any resend and treat `reply` as untrusted text. An explicit success takes priority as `partial`, even with another ambiguous event; without explicit success, an ambiguous event gives `unverified`, otherwise `blocked`.

With `--open`, recognized concurrent `user.text` input gives `status: "no-valid-reply"`, `exitCode: 2`, `correlation: { status: "ambiguous", reason: "user-input-during-turn" }`, without `reply`. If the envelope was observed, `delivery.status` stays `persisted-no-reply`. Display the diagnostic and check the conversation before any resend, without inferring authorization or a human author. Strictly recognized AGENTS/environment context before the envelope is exempted once per kind. Linked question replies remain unrecognized in this partial #146 fix: no `humanInput` field is added to JSON v1.

With `--open --follow` (#195), nothing is queued: `mode: "follow"`, no `queue`, `from: null` and `delivery: { status: "not-delivered", persisted: false, inActiveBranch: false }`. The new `followed` status (exit 0) carries `reply`, `error: null`, `identity: "same-as-target"`, `correlation: { status: "followed", reason: "turn-completed" | "turn-started-before-follow" }` and the permissions of the followed turn only. This reply is linked to no PALABRE message and its author is not verified: do not present it as the reply to your request and infer no authorization from it. An integration that does not know `followed` must treat it as an unknown value, never as a relay success.

`palabre mission … --json` returns a v1 `mission-result` object with `action`, `exitCode`, `mission`, `exportPath`, `error`. Only `step` calls Relay, at most once; its exits are Relay's (9 without a result), while a Mission refusal gives 8, or 3 for an already reserved step.

`palabre config --ollama-models --json` exposes `v`, `agent`, `available`, `baseUrl`, `currentModel`, `currentModelInstalled`, `installedModels`, without model generation.
