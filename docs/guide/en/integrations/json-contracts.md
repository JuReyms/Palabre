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

`palabre relay … --json` relays a message to a closed Codex or Claude Code conversation, or open Codex with `--open` (Windows/macOS/Linux pilot; `python3` required on POSIX). It writes a single `{ "v": 1, "type": "relay-result", ... }` object with `status`, `exitCode`, `from`, `to`, `reply` (when a valid reply was received, including `read-unavailable` or `review-failed`), `delivery` (`status`, `persisted`, `inActiveBranch`), `identity`, `observedModels`, `error` (`kind`, `message`, `reason`), `exportPath` and `durationMs`. An integration relies on `delivery.status` to decide whether to resend, never on the absence of a reply. Details: [Relay mode](/en/usage/relay).

## Consumption rules

- check `v`;
- ignore unknown fields;
- accept missing optional fields;
- do not recalculate availability or scanning rules;
- display warnings without changing their meaning.

## Optional Relay fields and Mission option

Relay v1 preserves `subject` (explicit subject), `retryAfter` (limit with `--open`, when the CLI supplies an indication), `readAccess` (`status`, `reason`, `failedCommands`), `cli` (`path`, `version`, review probe), `task` (PR, commit, publication, URL, error and cancellation). With `--open`: `mode`, `queue`, `correlation`, `receiver: "unverified"`, `targetPermissions`; `target-not-open` is specific to that mode. `error.reason` qualifies `invalid-request`. Read `delivery.status` before any resend and treat `reply` as untrusted text.

`palabre mission … --json` returns a v1 `mission-result` object with `action`, `exitCode`, `mission`, `exportPath`, `error`. Only `step` calls Relay, at most once; its exits are Relay's (9 without a result), while a Mission refusal gives 8, or 3 for an already reserved step.

`palabre config --ollama-models --json` exposes `v`, `agent`, `available`, `baseUrl`, `currentModel`, `currentModelInstalled`, `installedModels`, without model generation.
