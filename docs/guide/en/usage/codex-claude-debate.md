---
title: Run a Codex and Claude Code debate
description: Configure Codex and Claude Code in Palabre, assign complementary roles, and produce an actionable summary.
seo:
  title: Run a Codex vs Claude Code debate in your terminal
  description: Start a Codex and Claude Code debate with Palabre, add project context, assign roles, and export the discussion with an actionable summary.
---

Palabre can make Codex CLI and Claude Code discuss a technical decision before you move to implementation. Each agent receives the same subject and context, then answers the previous analysis.

Use this workflow to challenge an architecture, review a migration plan, compare two strategies, or uncover risks missed by the first proposal.

## Prepare Codex and Claude Code

Install and authenticate both CLIs through their usual mechanisms. Palabre does not replace their accounts or subscriptions.

Then verify availability:

```bash
codex --version
claude --version
palabre config --sync-agents
palabre doctor
```

The following command should report the preset as available:

```bash
palabre presets --json
```

## Start the debate

The `codex-claude` preset makes Codex speak first and Claude Code second:

```bash
palabre codex-claude "Compare these architectures and recommend the more robust option" -t 4
```

The reverse variant makes Claude Code speak first:

```bash
palabre claude-codex "Review this migration plan and resolve the disagreements" -t 4
```

Position controls speaking order. Roles still come from your configuration unless you override them for the session.

## Assign complementary roles

A pair is more useful when the agents do not receive exactly the same mission. For example:

```bash
palabre run \
  --subject "Should this service be split in two?" \
  --agent-a codex \
  --agent-b claude \
  --role-a architect \
  --role-b critic \
  --turns 4
```

Codex then structures an architecture proposal while Claude Code looks for fragile assumptions and unaddressed consequences.

## Add project context

Use `--files` for a strict and reproducible selection:

```bash
palabre codex-claude "Review this caching strategy" \
  --files src/cache.ts src/config.ts \
  -t 4
```

Use `--context` to scan a folder tolerantly:

```bash
palabre codex-claude "Propose an incremental migration" \
  --context src docs/architecture \
  -t 4
```

Palabre marks files as untrusted data inside prompts. Size limits and exclusions are documented in [Context and files](/en/usage/context-and-files).

## Read the summary

After the transcript, the summary agent organizes:

- consensus points;
- disagreements and uncertainty;
- proposed actions;
- a short conclusion.

The session is exported under `.palabre/` as a `.debate.md` file. This export preserves the opposing arguments instead of keeping only the conclusion.

## Choose Debate or Ask

Use Debate when agents should answer each other's objections. Use [Ask](/en/usage/ask) when you first want two independent answers without mutual influence.

For a broader workflow overview, see [Use multiple AI agents from the terminal](/en/usage/multi-agent-cli) and [Debate mode](/en/usage/debate).
