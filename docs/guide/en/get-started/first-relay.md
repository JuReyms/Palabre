---
title: Your first Relay
description: Delegate a task to a teammate through your agent, keep the decision and find the completed work.
seo:
  title: Your first Relay, delegate a task to Claude Code or Codex
  description: "Make your agents cooperate with PALABRE: advice, review or a fix with one-time approval, from Desktop, a terminal or in the background."
---

Relay means delegating a task to a teammate. Your agent hands the work to the other agent and reports back to you. You no longer copy and paste their exchanges; you keep the decision.

## How it works

The agent you talk to is the **mission lead**. The one receiving the task is the **teammate**. They can work in three ways:

| How you work | Directions and current possibilities |
| --- | --- |
| Two Desktop applications | Claude Code can delegate a task to an open Codex conversation on Windows with `--open`. It acts with its existing permissions. Sending to an open Claude Code conversation is not yet available. |
| Two CLI terminals | The same direction to open Codex on Windows with `--open`, but this path remains a pilot with limited testing. Sending to open Claude Code is unavailable. |
| A background teammate, with no window to open | Claude Code and Codex can delegate advice or reviews in either direction. Codex can also fix files and run tests on Windows with `--new --write`, after your approval for the task. Claude Code cannot yet act this way on native Windows. |

You can delegate background work from Desktop or a terminal. For advice or a review without changes, PALABRE creates a conversation with `--new`, or resumes an existing closed conversation. To act in an already open Codex conversation, `--open` keeps its permissions: the message grants no additional rights.

If Codex is the mission lead, its environment may ask you to authorize the network call to Claude Code. This authorization never replaces writing approval.

## Prepare once

Install [PALABRE](/en/get-started/installation), Claude Code and Codex, then sign in to the agents with their usual tools. In the project folder, run `palabre init` if no configuration exists, then check:

```text
palabre doctor
palabre relay --help
```

Help must list `--new` and `--write` to follow the whole guide. Otherwise, use a PALABRE version that includes them; see [Installation and updates](/en/get-started/installation).

Also install the [Palabre skill](/en/get-started/skill) for your usual agent. Copy the entire folder, including references, then open a new conversation so the agent can see it. After a skill update, its installed copy must be updated manually.

Each call uses the selected agent's account and model. Check what you share before delegating sensitive files.

## Delegate a task through your agent

From your usual conversation with Claude Code, say for example:

> Use PALABRE to have Codex fix the calculation in src/prices.js and run the existing tests. Prepare the task and show me what I need to confirm.

On Windows, your agent prepares a `--new --write` task. You review the task, project and proposed working copy, then confirm yourself in your terminal with `approve-write`. Your agent can then run `run-write`, once only. It never confirms on your behalf.

Codex works in a separate Git copy, called a **worktree**, starting from the announced commit. Your uncommitted changes are not included. Your main project keeps its files; the teammate's work is retained, even on failure.

For a review without changes, say instead:

> Use PALABRE to delegate this plan's review to Claude Code, without changing anything.

The skill selects the appropriate path. Without a designated conversation, it creates one; otherwise, it keeps your chosen target. For follow-up advice or a review:

> Continue with the same Codex to review the result, without changing anything.

The mission lead keeps the identifier and tells you what was done, which tests actually ran, any blockers and what awaits your decision. A new background writing task requires a new conversation and a new one-time approval.

### Where to find the work

- The exchange belongs to the teammate's own conversation, whose identifier PALABRE provides. Immediate Desktop visibility is not guaranteed.
- Changed files stay in the worktree identified in the report.
- They appear on GitHub after a separately authorized commit and push, and can then be reviewed in a PR.

Nothing automatically returns to the conversation of the agent that delegated the task. The mission lead reads the reply and report returned by PALABRE, then reports back to you. To integrate and clean up the work, follow [Retrieve the result](/en/usage/relay#retrieve-the-result).

## Without an agent

You can also operate Relay yourself. For a fix with Codex on Windows, start at the root of a Git repository with at least one commit:

```text
palabre relay --new --write --to codex "Fix the calculation in src/prices.js and run the existing tests, without installing dependencies."
```

This command prepares the request without starting a model. Replace `<request>` below with the displayed identifier, then confirm yourself:

```text
palabre relay approve-write <request>
```

After approval, run once only:

```text
palabre relay run-write <request> --json
```

For advice without changes, one call is enough, to Claude Code or Codex:

```text
palabre relay --new --to claude "Review the plan and identify risks, without changing files."
```

To target an already open conversation with `--open`, follow the [full Relay guide](/en/usage/relay#open-codex-conversation---open).

## Good to know

- Keep the returned identifier to explicitly continue advice or a review with `--to codex:<identifier>` or `--to claude:<identifier>`, without `--new`. Never choose “the latest conversation” instead of the target.
- Without `--open`, an existing conversation must be closed during the call. With `--open`, only Codex on Windows is supported; the two-terminal path still needs more testing.
- Receiving an identifier does not prove task success. Read status, delivery and the report's evidence. After a failure, never resend the request automatically.
- `--write` permits no commit, push, merge or dependency installation by the teammate. A blocked test stays reported; PALABRE does not widen permissions to make it pass. Approval is consumed even on failure.
- To create the teammate in another project, use `--dir "../other-project"` with `--new`. Writing requires the root of a Git repository.

Details, statuses and limits for each path are in the [full Relay guide](/en/usage/relay).
