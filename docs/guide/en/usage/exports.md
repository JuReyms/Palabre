---
title: Exports
description: Learn where Palabre writes Markdown exports and what they contain after a Debate, Chat, or Ask session.
---

Each session generates a Markdown export in the folder defined by `outputDir`:

- `.debate.md` for a debate;
- `.chat.md` for a conversation;
- `.ask.md` for an Ask request.

By default, exports are grouped in a `.palabre/` folder under the directory from which you run `palabre`. At the end of a TUI session, Palabre displays the exported file and its folder with clickable links in compatible terminals. The `/history` command lets you find recent exports again from the TUI home screen.

## Export contents

The file contains:

- a header table with the subject, agents, models, local date, and timezone;
- the list of files injected into the context;
- the full conversation or debate transcript, or independent agent responses in Ask mode;
- the reason and time a Chat conversation ended, including the error message when it failed;
- the final Debate or Ask summary if enabled.

## File name

The name contains a short version of the subject and a timestamp. This makes debates easier to find while keeping a unique name:

```text
palabre-critique-this-technical-plan-2026-05-06T08-52-43-000Z.debate.md
palabre-clarify-this-architecture-2026-05-06T08-52-43-000Z.chat.md
palabre-compare-these-approaches-2026-05-06T08-52-43-000Z.ask.md
```

If the subject contains no usable characters, Palabre uses `debate`, `chat`, or `ask` as the short name depending on the mode.

## Final summary

In Debate and Ask, the summary is separated from the transcript by a horizontal rule. It begins with a short table: agent, role, and date. Chat does not add an automatic summary: it preserves the conversation and its termination reason.

## Windows preview

Some Windows previews interpret `:**` as an emoji. Palabre replaces this sequence with `&#58;**` in exported content.

The Markdown rendering remains visually equivalent, but the Windows preview avoids emoji interpretation.

## Change the output folder

In the advanced configuration:

```json
{
  "outputDir": ".palabre"
}
```

Future exports will be placed in this folder.

## History

From the TUI:

```text
/history
```

The history view displays recent `.debate.md`, `.chat.md`, and `.ask.md` exports, their mode, agents, turn or response count, file, and output folder. Outside the TUI, use `palabre history` or `palabre history --json`.
