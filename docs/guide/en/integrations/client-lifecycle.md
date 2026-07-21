---
title: Lifecycle, errors, and identity
description: Handle exit codes, partial exports, cancellation, and integration provenance.
---

| Code | Meaning |
|------|---------|
| `0` | Success. |
| `1` | Validation, configuration, or runtime error. |
| `130` | Cancellation. |

Always wait for process termination. `error` describes the business failure; the code confirms final state.

An `error` event may include phase, agent, role, turn, a stable `kind`, message, and details. Kinds include `command-not-found`, `spawn-failed`, `timeout`, `idle-timeout`, `output-too-large`, `empty-output`, `non-zero-exit`, `usage-limit`, `model-unavailable`, `model-pull-failed`, `http-error`, and `cancelled`. Branch on `kind`, not message text.

Palabre attempts to preserve responses in a partial export after failure. Accept `done` with a path followed by a non-zero code. Cancellation must remain distinct from an error.

## Client identity

```text
PALABRE_CLIENT=my-integration
PALABRE_CLIENT_VERSION=2.3.0
```

The name is open-ended. Palabre sanitizes these values and records them with its own version in exports. Without a declaration, the source is `direct-cli`. These fields are diagnostic, not a security boundary.
