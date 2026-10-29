---
title: Your first Relay
description: Complete a first Relay exchange between Codex and Claude Code, recognize the result and continue with the same teammate.
seo:
  title: Your first Relay, connect Claude Code and Codex
  description: "Ask Claude Code for advice from Codex, or the other way round, receive the reply without copying and pasting and continue the same conversation."
---

With Relay mode, the agent you are talking to asks another AI tool, called the teammate, for advice, then reports its reply back in your conversation, without copying and pasting. This page walks you through a first exchange and its follow-up; the [full Relay guide](/en/usage/relay) covers the rest.

## Before you start

- [PALABRE installed](/en/get-started/installation), along with Codex and Claude Code, each signed in with its usual account.
- A [trusted configuration](/en/get-started/configuration#other-settings-and-approval): `palabre init` creates and trusts it; `palabre doctor` checks everything without querying a model.
- The [Palabre skill](/en/get-started/skill) installed in the agent you talk to, then reloaded, or a new conversation opened.

These preparations are yours: an agent can guide you, but you decide on and confirm installation, sign-in and approval. Your request and the files read are sent to the chosen tool; avoid sensitive data for this first try.

## 1. Ask for advice

From a Codex conversation opened in your project folder, send for example:

> Use PALABRE to ask Claude Code for its opinion on this fictional plan, without changing files. Fictional plan: 1) publish the website's new Pricing page; 2) check all its links; 3) test its contact form. I want one main risk and one improvement. Create a new conversation and keep it for follow-up.

This fictional plan is in the message: no website or file to prepare. From Claude Code, send the same text with "Claude Code" replaced by "Codex".

From Codex Desktop, Codex asks you to allow the PALABRE command outside its sandbox. Read it and approve **this time only**: no full access, no permanent rule. Each later command asks for its own approval. The "Approve on my behalf" setting may accept without showing you the request: leave it disabled if you want to approve yourself, because a launched command does not prove that you clicked. This path has been verified on Windows; for other setups, see the [path from Codex](/en/usage/relay#codex-as-mission-lead).

The exchange may take a while: its duration depends on the tools, models and your quotas.

## 2. Recognize success

Your agent reports back in the original conversation:

- **the teammate's opinion**: one risk and one improvement, in plain words;
- **the mode**: background. The teammate worked without a window; PALABRE requests read-only access and limits its tools during the call, under the [conditions described in the guide](/en/usage/relay#what-the-resume-does);
- **receipt, separate from the result**: receiving a reply does not prove the opinion is right or the task succeeded. The agent separates what arrived, what the teammate concludes and the evidence supporting it. A reply can also be a refusal;
- **the record**: a `.relay.md` file in the [exports](/en/usage/exports) folder (`.palabre/` by default). Ask "Show me the export of this exchange" to read it.

## 3. Continue with the same teammate

> Continue with the same teammate: detail the main risk and suggest a simple check, without changing files.

The agent resumes the conversation created in step 1: no new conversation, nothing to copy. If the teammate is Claude and you opened its conversation to read it, close it first: sending to an open Claude conversation is not available.

In a new conversation, your agent no longer has this thread. Say "Find the recent Relay exchange about the Pricing page": it checks the exports and asks you to confirm the exchange before continuing ([Find a recent exchange](/en/usage/relay#find-a-recent-exchange)).

## If something blocks

- **Untrusted configuration** (`config-untrusted`): nothing is sent. Read the file shown, then trust it yourself with `palabre config --config <file> --trust-config`, replacing `<file>` with the path shown (in quotes if it contains spaces), before asking again. The agent does not trust it for you.
- **Unknown delivery or message without reply** (`unknown`, `persisted-no-reply`): do not resend the request, it may already have arrived. First check the teammate's conversation or the export; PALABRE never resends automatically. See [Outcome and delivery](/en/usage/relay#outcome-and-delivery).
- **The teammate is waiting for permission**: your agent cannot grant it. It tells you where to approve and stops; continuing will be a new request from you.

## Choose where the teammate works

**Background is the default**: the teammate replies without a window, with the limited tools described above. For advice without changes like this one, your agent keeps it explicitly (`--background`).

You can also designate a Codex conversation you have open and ask to work there. This explicit choice (`--open`) keeps that conversation's tools and permissions, including writing if allowed. If a background review targets an open conversation, nothing is sent and your agent does not switch on its own to this more permissive path: you close the conversation, or you knowingly choose `--open`. Making it your habit is a setting you confirm yourself, explained in the [full Relay guide](/en/usage/relay).

## Go further

The [full Relay guide](/en/usage/relay) describes opening conversations in the applications, [commands without an agent](/en/usage/relay#start-a-new-conversation), the [path from Codex](/en/usage/relay#codex-as-mission-lead), verified systems, statuses and experimental or frozen features (`--write`, Mission, review). On a new machine, start with [Change machines](/en/get-started/change-machine).
