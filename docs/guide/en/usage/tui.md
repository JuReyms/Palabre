---
title: Use the TUI
description: Understand the TUI home screen, choose modes, and configure a session without memorizing CLI options.
seo:
  title: Run a session from the terminal UI
  description: Use the Palabre TUI to pick a mode, choose agents, and configure a session without memorizing CLI flags.
---

```bash
palabre
```

The TUI is the recommended interface for human use. It creates the global configuration on first launch, refreshes known agents, and keeps navigation context between sessions.

## Home screen

The home screen summarizes the current session on two lines: mode, agents, roles, response count, and summary agent. It then shows essential shortcuts, the `--context` and `--files` syntaxes, and the working directory. If an agent required by the session is unavailable, a warning appears below the directory and points to `/agents` or `/config`, depending on the setting that needs attention.

Enter a subject directly to run the current mode. Type `/` to open the contextual command list; use the arrow keys, `Tab`, or `→` to complete, then press `Enter` to run.

`/help` groups commands around the user journey: start, prepare, continue, then navigate. `/config` first shows the active session and common settings; type `/` in its composer to reach advanced settings. An unknown command now produces an explicit message on every screen instead of silently changing views.

`/update` opens a dedicated card: installed version, available npm version when Palabre comes from a package, detected channel, and the exact action. From a Git checkout, it simply identifies the checkout version and offers to synchronize it; it does not compare it with npm. Choose **Update now** or **Sync checkout** only after checking that action; **Not now** returns home. The card links to release notes for package installations.

## Compose a new session

`/new` opens one guided flow for Chat, Debate, and Ask. Choose the mode, agents, and subject. Palabre then shows a compact summary and lets you launch, customize, or cancel the session.

Customization covers the response count, model identifiers passed to agents, summary settings, context, and rendering options. Model identifiers belong to the relevant CLI; Palabre does not maintain a catalog of remote models.

## Main commands

| Command | Effect |
|---------|--------|
| `/` | Displays commands that are useful in the current view. |
| `/new` | Composes a Chat, Debate, or Ask session step by step. |
| `/debate` | Switches to the primary Debate mode. Alias: `/debat`. |
| `/chat` | Opens a conversation. |
| `/ask` | Switches to independent answers. |
| `/agents` | Displays or changes agents. |
| `/roles` | Displays or changes roles. |
| `/config` | Opens settings. |
| `/history` | Displays recent exports. |
| `/update` | Checks and proposes the update matching the installation. |
| `/help` | Displays all commands. |
| `/home` | Returns home. |
| `/quit` | Quits Palabre. |

## Add context

```text
Review this module --files src/auth.ts README.md
Review the architecture --context src docs
```

Paths containing spaces must be provided with a direct command.

## Ending Chat

`/end` ends and saves; `/home` returns without saving; an error produces a partial transcript when possible. The export records the termination reason.

Use `--terminal` for raw human output. For an integration, use `--renderer ndjson` and the [NDJSON documentation](/en/integrations/ndjson).
