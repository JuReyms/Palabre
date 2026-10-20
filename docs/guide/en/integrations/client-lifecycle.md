---
title: Lifecycle, errors, and identity
description: Handle exit codes, partial exports, cancellation, and integration provenance.
seo:
  title: Exit codes, cancellation, and partial exports
  description: Handle Palabre exit codes, partial exports, and cancellation, and declare your integration's provenance.
---

| Code | Meaning |
|------|---------|
| `0` | Success. |
| `1` | Validation, configuration, or runtime error. |
| `130` | Cancellation. |

This table covers Debate, Ask and Chat sessions and catalogs. Relay and its Mission option use their own table, including exits 2 through 9: see [Relay](/en/usage/relay). Handle Relay using both `status` **and** `delivery.status`, not only the exit code.

Always wait for process termination. `error` describes the business failure; the code confirms final state.

An `error` event may include phase, agent, role, turn, a stable `kind`, message, and details. Kinds include `command-not-found`, `spawn-failed`, `timeout`, `idle-timeout`, `output-too-large`, `empty-output`, `non-zero-exit`, `usage-limit`, `unsupported-model`, `model-unavailable`, `model-pull-failed`, `http-error`, and `cancelled`. For a `usage-limit`, `retryAfter` may be present: duration in seconds, ISO timestamp, or local `HH:mm` time. It is best-effort; branch on `kind`, not message text.

Palabre attempts to preserve responses in a partial export after failure. Accept `done` with a path followed by a non-zero code. Cancellation must remain distinct from an error.

## Client identity

```text
PALABRE_CLIENT=my-integration
PALABRE_CLIENT_VERSION=2.3.0
```

The name is open-ended. Palabre sanitizes these values and records them with its own version in exports. Without a declaration, the source is `direct-cli`. These fields are diagnostic, not a security boundary.

Relay has its own outcomes: `usage-limit` (2), `read-unavailable` (2), `target-not-open` (3), `review-failed` (9), `invalid-request` with `error.reason` (8). Refused command launches on Windows fill `readAccess`: `partial` and `unverified` preserve the outcome; `blocked` may produce `read-unavailable` without removing reply or delivery. `retryAfter` may be only a time, without a date or time zone: show it as supplied and await a human decision, without scheduled resend. Client provenance fields described here apply to Debate/Ask/Chat exports; Relay reports its PALABRE version.
