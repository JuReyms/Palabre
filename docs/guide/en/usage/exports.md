---
title: Exports
description: Learn where Palabre writes Markdown exports and what they contain for Debate, Relay, Ask, Chat and the Mission option.
seo:
  title: Markdown exports of every session
  description: Find Debate, Relay, Ask, Chat and Mission-option exports, their diagnostics and their limits.
---

Exports use `outputDir` (`.palabre/` by default):

- `.debate.md` for Debate;
- `.relay.md` for Relay, except with `--no-export` or a refusal before launch;
- `.ask.md` for Ask;
- `.chat.md` for Chat after `/end` or on failure, when writing is possible.

Relay's Mission option writes state and `.mission.md` to `.palabre/missions/<id>/`, independently of `outputDir`.

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

## Details and privacy

Debate and Ask preserve an interruption section on failure; their exports and Chat's include the PALABRE version and declared client provenance. A `.relay.md` includes the PALABRE version, sender, target and UUIDs, optional subject, message, reply or error, delivery, diagnostics and any review publication. A `retryAfter` indication appears only when the path supplies it. Remove identifiers and sensitive data before public sharing.

Relay example: `palabre-relay-codex-2026-05-06T08-52-43-000Z.relay.md`; its name comes from the target agent, not the subject. Relative `outputDir` paths resolve from the launch directory. Edit local or global configuration and reapprove its content after manual changes.

`/history` and `palabre history` list only Debate, Ask and Chat. Find Relay in `outputDir` and Mission with `palabre mission status <id>`.
