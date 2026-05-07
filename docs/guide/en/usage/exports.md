---
title: Exports
description: Learn where Palabre writes Markdown exports and what they contain after a debate.
---

Each debate generates a `.debate.md` file in the folder defined by `outputDir`.

By default, the export is created in the folder from which you run `palabre`. At the end of the debate, the terminal displays a `Debate exported:` line followed by the full path to the file.

## Export contents

The file contains:

- a header table with the subject, agents, models, local date, and timezone;
- the list of files injected into the context;
- the full transcript;
- the final summary if it is enabled.

## File name

The name contains a short version of the subject and a timestamp. This makes debates easier to find while keeping a unique name:

```text
palabre-critique-this-technical-plan-2026-05-06T08-52-43-000Z.debate.md
```

If the subject contains no usable characters, Palabre uses `debate` as the short name.

## Final summary

The summary is separated from the transcript by a horizontal rule. It begins with a short table: agent, role, and date.

## Windows preview

Some Windows previews interpret `:**` as an emoji. Palabre replaces this sequence with `&#58;**` in exported content.

The Markdown rendering remains visually equivalent, but the Windows preview avoids emoji interpretation.

## Change the output folder

In the advanced configuration:

```json
{
  "outputDir": "debates"
}
```

Future exports will be placed in this folder.
