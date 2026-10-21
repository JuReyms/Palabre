---
title: Your first Relay
description: Delegate a task to a teammate through your agent, keep the decision and find the completed work.
seo:
  title: Your first Relay, connect Claude Code and Codex
  description: "Delegate a task from Claude Code or Codex, find a specific conversation and receive its reply without copying and pasting."
---

Relay lets your agent delegate a task to another agent (Claude Code, Codex) and bring its reply back to you, without copying and pasting: in a new conversation, or in a specific conversation you have already had with it. Each keeps its own permissions, and you decide what happens next.

You choose the **mission lead**: Claude Code or Codex. Your agent can become the mission lead in any conversation, even one you have just opened: PALABRE only needs to be installed on the machine and the agent needs to have the PALABRE skill.

## How it works

The mission lead is the agent you talk to. The **teammate** receives the task. PALABRE sends the message and returns the reply; the agents carry out the work with their permissions.

| How you work | Directions and current possibilities |
| --- | --- |
| Two Desktop applications | Claude Code can reach an open Codex conversation on Windows, macOS, or Linux with `--open` (`python3` required on POSIX). Codex desktop can reach a closed Claude conversation, with one-time host approval for each command. Sending to open Claude is not yet available. |
| Two CLI terminals | Claude to open Codex with `--open` remains a pilot with limited testing. Codex CLI to closed Claude still needs testing. |
| A background teammate, with no window to open | A new or existing closed conversation can receive a request for advice or a review. Codex desktop to closed Claude and Claude to closed Codex have been verified on Windows. |

In an open Codex conversation, the teammate can act with its usual permissions. Ordinary calls to a closed conversation provide advice and reviews, with restricted tools during the call. Relay grants no additional rights. The Codex lock is supported on Windows and, with `python3`, on macOS/Linux.

## Relay vocabulary

- **Mission lead**: the agent you talk to. It delegates the task and reports back to you.
- **Teammate**: the agent receiving the task.
- **Open conversation**: a conversation currently displayed in Codex desktop or in a terminal. The teammate works there with its usual settings, as if you were writing to it yourself.
- **Closed conversation**: an existing conversation that no window is displaying. PALABRE reopens it for one exchange, then closes it.
- **Background**: the teammate works without a window. PALABRE launches it for a single task, waits for its reply, then stops.
- **Conversation identifier**: the number identifying a specific conversation. Keep it to continue with the same teammate.
- **Delivery**: knowing whether the message arrived. A delivered message does not mean the task succeeded.
- **One-time approval**: your keyboard confirmation for a single writing task. It can only be used once.
- **Worktree**: a separate copy of your project where the teammate can modify files without changing the original.

## Prepare once

On another machine or an old computer that needs updating, start with [Change machines](/en/get-started/change-machine). PALABRE does not transfer conversations or approvals from the previous computer.

Install [PALABRE](/en/get-started/installation), Claude Code and Codex, then sign in to the agents with their usual tools. In the project folder, run `palabre init` if no configuration exists, then check:

```text
palabre doctor
palabre relay --help
```

Help must list `--new`. Otherwise, use a PALABRE version that includes it; see [Installation and updates](/en/get-started/installation).

Also install the [Palabre skill](/en/get-started/skill) for your usual agent. Copy the entire folder, including references, then open a new conversation so the agent can see it. After a skill update, its installed copy must be updated manually.

Each call uses the selected agent's account and model. Check what you share before delegating sensitive files.

## Delegate a task through your agent

From your conversation with Claude Code, say for example:

> Use PALABRE to ask Codex to review the plan in docs/plan.md and identify risks, without changing files. Create a conversation and keep its identifier for follow-up.

The skill creates a conversation if you have not designated one. If you choose an existing conversation, it keeps that specific target, never "the latest".

To work in an already open Codex conversation on Windows, macOS, or Linux, identify it and describe the task. The mission lead uses `--open`; on POSIX, `python3` must be available. The teammate keeps its permissions, with no rights added by the message.

### Codex as mission lead

From a Codex desktop conversation opened in the project folder, say for example:

> Use PALABRE to ask Claude Code to review the plan in docs/plan.md, without changing files. Create a conversation and keep its identifier for follow-up.

Codex asks for permission to run each PALABRE command **outside its sandbox**. Read the displayed command, then approve **this time only**. Do not grant full access, permanent rights or "always allow". The follow-up command needs its own approval.

This approval lets the Claude CLI use its connection and save the exchange in its history. It grants no additional rights to the teammate. Codex desktop's **"Approve on my behalf"** setting may grant these requests without showing a prompt: leave it disabled if you want to confirm each command yourself.

This path has been verified on Windows from Codex desktop. It still needs testing from Codex CLI and on macOS.

### Continue and find the result

> Continue with the same Claude to clarify the main risk, without changing files.

The mission lead reuses the identifier, reads the reply and reports back to you. The exchange stays in the teammate's conversation; PALABRE also gives you the `.relay.md` export path. With the verified Codex versions, a conversation created by `--new` is not listed in Codex Desktop, but Relay can keep reaching it. To follow it in the app, open the `codex://threads/<identifier>` link shown after creation; once open in Desktop, reach it with `--open`. The reply returns to the caller without being added automatically to the sender's conversation. Opening this Desktop link is verified on Windows only; macOS and Linux remain unverified.

If the teammate changes files in an open conversation, they stay in its working directory. They appear on GitHub only after a separately authorized commit and push. Receiving a reply does not prove the work or tests succeeded.

## Without an agent

You can operate Relay yourself from the project folder:

```text
palabre relay --new --to claude "Review the plan in docs/plan.md and identify risks, without changing files."
```

Keep the returned identifier to continue, without `--new`:

```text
palabre relay --to claude:<identifier> "Clarify the main risk, without changing files."
```

To target an already open Codex conversation, follow the [full Relay guide](/en/usage/relay#open-codex-conversation-open).

## Experimental path: background writing

`--new --write` to Codex on Windows is **experimental and frozen**, outside the default path. An ordinary request never enables it: you must explicitly ask your agent for it. It then prepares the task; you must read and confirm it yourself with `approve-write` before the single `run-write` call.

This path keeps a separate Git copy, or **worktree**, without your uncommitted changes. One-time approval can only be used once. Steps and restrictions remain documented in [Delegate a task that changes files](/en/usage/relay#delegate-a-task-that-changes-files), then [Retrieve the result](/en/usage/relay#retrieve-the-result).

## Good to know

Mission and `--task review` are frozen: retained and documented, with no scope expansion; only security fixes are accepted.

- Keep the returned identifier to explicitly continue advice or a review with `--to codex:<identifier>` or `--to claude:<identifier>`, without `--new`. Never choose “the latest conversation” instead of the target.
- Without `--open`, an existing conversation must be closed during the call. With `--open`, only Codex is supported, on Windows, macOS, or Linux (`python3` on POSIX); the two-terminal path still needs more testing.
- Receiving an identifier does not prove task success. Read status, delivery and the report's evidence. After a failure, never resend the request automatically.
- In the experimental path, `--write` permits no commit, push, merge or dependency installation by the teammate. A blocked test stays reported; PALABRE does not widen permissions to make it pass. Approval is consumed even on failure.
- To create the teammate in another project, use `--dir "../other-project"` with `--new`. The experimental writing path requires the root of a Git repository.

Details, statuses and limits for each path are in the [full Relay guide](/en/usage/relay).
