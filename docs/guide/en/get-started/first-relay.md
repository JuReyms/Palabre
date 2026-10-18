---
title: Your first Relay
description: Ask Codex for advice from Claude, get its reply and continue with the same conversation.
seo:
  title: Your first Relay, connect Claude Code and Codex
  description: Create a Codex conversation with Palabre, ask it for a review from Claude Code and continue without copying messages between agents.
---

Relay is like calling a teammate working next door. You ask a question; the reply comes back where you started the request. You keep the decision.

## Before you start

Install [PALABRE](/en/get-started/installation), Claude Code and Codex, then sign in to both agents using their usual tools. In a terminal opened in your project folder, check:

```text
palabre doctor
```

If no configuration exists, run `palabre init`. Also check that `palabre relay --help` lists `--new`; otherwise, [update PALABRE](/en/get-started/installation). Each request uses the chosen agent's account and model. Before sharing a sensitive file, check what you are sending.

## I work with Claude and want advice from Codex

You do not need to prepare a Codex conversation. From the project folder, run:

```text
palabre relay --new --to codex --from claude "Review src/prices.js. Point out possible errors without changing any file."
```

Replace `src/prices.js` with a file in your project. PALABRE creates a Codex conversation, asks it to read the file, then displays its reply. It also gives you the conversation ID, a command to continue and the path to the `.relay.md` export.

`--from claude` only labels who is asking the question. You can leave it out when asking from the terminal yourself.

To work in another folder, add `--dir "../other-project"` when creating the conversation. To ask Claude Code instead, replace `--to codex` with `--to claude`.

## Continue with the same conversation

Keep the returned ID and use the continuation command shown by PALABRE. For example, replace `<id>` with that ID:

```text
palabre relay --to codex:<id> "Which test would check the first risk?"
```

Do not add `--new` again: Codex keeps the context of the first exchange. Each command sends one question and waits for a single reply. Keep this conversation closed in Desktop and other tools during the call.

An ID can be returned even if the first question fails. That does not mean a reply was received. Read the diagnostic before sending anything again; PALABRE never retries automatically.

## Ask a conversation that already knows the project

Have you already worked on this project with Codex or Claude Code? Close that conversation, keep its ID, then address your question to it directly:

```text
palabre relay --to claude:<id> "Review the plan we discussed and point out what is missing, without changing anything."
```

PALABRE never picks "the latest conversation" for you. To find the ID, see [Designating conversations](/en/usage/relay#designating-conversations). A conversation created by the CLI may not appear immediately in Desktop.

## Let my agent do it

With the [Palabre skill installed](/en/get-started/skill), simply tell Claude Code:

> Use Palabre to ask Codex to review src/prices.js without changing anything.

Your agent creates a teammate with `--new` if you have not named a conversation, forwards the request and reports the reply to you. It keeps the ID for an explicit follow-up:

> Ask the same Codex which test to add. Do not change anything.

You do not have to copy messages between agents. Your agent should tell you what was checked, any limits encountered and what needs your decision. An installed copy of the skill must be updated manually when the skill shipped with PALABRE changes.

## What Relay does not do yet

This workflow is for reviews and advice, not writing files. The `--open` option is separate from `--new`: it only targets an open Codex conversation on Windows, preserves its permissions and does not guarantee read-only access.

For statuses, errors and other possibilities, continue with the [full Relay guide](/en/usage/relay).
