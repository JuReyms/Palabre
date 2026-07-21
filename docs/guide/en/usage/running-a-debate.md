---
title: Choose a mode
description: Choose between Debate, Chat, and Ask based on the number of agents and the kind of answer you need.
---

Palabre provides three modes. **Debate remains the primary mode**: the home screen shows it first and it makes full use of contradictory orchestration.

| Mode | Agents | Exchanges | Summary | Export |
|------|--------|-----------|---------|--------|
| Debate | 2 | Agents answer each other. | Yes, by default | `.debate.md` |
| Chat | 1 active, optional consultation | The user talks with the active agent. | No | `.chat.md` |
| Ask | 1 to 4 | Agents answer independently. | Yes, by default | `.ask.md` |

## Debate first

Choose Debate to challenge a decision, find blind spots, or obtain a recommendation built from explicit disagreement.

```text
/debat
/agents codex claude
Review this architecture and recommend a decision
```

See the [Debate mode guide](/en/usage/debate).

## Chat to continue

Choose Chat when one agent is enough, with a second opinion through `/consult`. After Debate or Ask, it can carry over the subject and summary. See the [Chat guide](/en/usage/chat).

## Ask to compare without influence

Choose Ask to collect up to four independent answers before comparing them. See the [Ask guide](/en/usage/ask).

For human use, start with `palabre` and use the [TUI](/en/usage/tui). Extensions should consume the [integration contracts](/en/integrations/overview), not parse TUI output.
