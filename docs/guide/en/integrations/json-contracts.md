---
title: JSON catalogs
description: Consume agents, presets, context scans, and recent exports through versioned JSON.
---

These commands write one JSON document to stdout and exit without starting an AI session.

- `palabre agents --json` exposes `roles[]`, `agents[]`, and `defaults.askAgents[]`. Each agent provides its name, type, role, availability, and a reason when needed.
- `palabre presets --json` exposes pairs, order, `available`, `missingAgents[]`, and `unavailableReasons[]`.
- `palabre context scan src docs --json` exposes the root, requested paths, `items[]`, and `warnings[]`.
- `palabre history --json` exposes recent exports in `history[]`.

## Consumption rules

- check `v`;
- ignore unknown fields;
- accept missing optional fields;
- do not recalculate availability or scanning rules;
- display warnings without changing their meaning.
