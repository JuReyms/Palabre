---
title: Integrate Palabre
description: Drive Palabre from an extension or another process without duplicating its product logic.
---

Palabre CLI is the source of truth for agents, presets, context, orchestration, errors, and exports. An integration launches the CLI as a child process and renders its public contracts, without parsing the TUI or reimplementing its decisions.

| Need | Contract |
|------|----------|
| Agents | `palabre agents --json` |
| Pairs | `palabre presets --json` |
| Context | `palabre context scan --json` |
| History | `palabre history --json` |
| Preview | `--dry-run --renderer ndjson` |
| Session | `--renderer ndjson` |
| Identity | `PALABRE_CLIENT`, `PALABRE_CLIENT_VERSION` |

Outputs carry a `v` field. Optional additions remain compatible; removing, renaming, or changing a field's meaning requires a new version.

## Start a session

```bash
palabre run --mode debate --subject "Subject" --agent-a codex --agent-b claude --renderer ndjson
palabre run --mode ask --subject "Subject" --agents codex claude --renderer ndjson
palabre chat --agent-a codex --renderer ndjson
```

Chat receives messages through stdin. An integration reads stdout line by line, keeps stderr separate, and waits for process termination.

See [JSON catalogs](/en/integrations/json-contracts), [NDJSON v1](/en/integrations/ndjson), and [Lifecycle](/en/integrations/client-lifecycle).
