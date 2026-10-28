---
title: Command reference
description: Reference for commands and options available in the Palabre CLI.
seo:
  title: "CLI reference: every command and flag"
  description: Full reference for Palabre commands and options, including debate, chat, ask, config, and their flags.
---

This page lists the main Palabre commands.

## Startup commands

| Command | Description |
|---------|-------------|
| `palabre` | Opens the TUI home screen, creates the global configuration on first launch, and refreshes detected known agents. |
| `palabre init` | Explicitly creates the global configuration and detects agents. |
| `palabre init --local` | Creates a configuration in the current folder. |
| `palabre doctor` | Displays a diagnostic by sections: configuration, local tools, agents, and items to check. |
| `palabre agents` | Lists declared agents and their local detection. |
| `palabre -a` | Shortcut for `palabre agents`. |
| `palabre history`, `palabre historique` | Lists recent Palabre Markdown exports. |
| `palabre sessions` | Lists resume checkpoints in the current directory. |
| `palabre context scan --json` | Previews the project context Palabre would retain. |

## Configuration

The TUI home screen performs the same conservative known-agent synchronization as `palabre config --sync-agents`: it adds newly detected known agents and refreshes known command names while preserving custom agents and user defaults. If the configuration file changed after it was loaded, nothing is written: a warning says so and the home screen continues with the loaded configuration, but saves no setting for the rest of the session; restart `palabre` to reload the file. `palabre config --sync-agents` and the `palabre config` wizard stop the same way, without writing.

| Command | Description |
|---------|-------------|
| `palabre config` | Opens the configuration assistant. |
| `palabre config --set-defaults codex claude` | Sets the default agents. |
| `palabre agent-role claude critic` | Sets one agent persistent role. |
| `palabre config -t 4` | Sets the default number of turns. |
| `palabre config --summary-agent claude` | Sets the default summary agent. |
| `palabre config --summary-agent none` | Removes the default summary agent. |
| `palabre config --ask-summary-agent opencode` | Sets the default summary agent for ask mode. |
| `palabre config --mode chat` | Sets the default mode (`chat`, `debate`, or `ask`). |
| `palabre config --ask-agents codex claude opencode` | Sets the default ask agents, 4 maximum. |
| `palabre config --interface tui` | Sets the default interface (`tui` or `terminal`). |
| `palabre config --language en` | Sets the Palabre and agent prompt language. |
| `palabre config --clear-defaults` | Removes default settings. |
| `palabre config --sync-agents` | Adds missing detected agents and refreshes known commands. |
| `palabre config --ollama-models --json` | Lists installed Ollama models and the configured model status. |
| `palabre config --set-ollama-model <model>` | Sets the model for the `ollama-local` agent. |
| `palabre config --sync-ollama-model` | Replaces the configured Ollama model if it is no longer installed. |

## Debates

| Command | Description |
|---------|-------------|
| `palabre new` | Composes a Chat, Debate, or Ask session, shows its summary, and then lets you launch or customize it. |
| `palabre -s "Subject" -t 4` | Launches with default agents. |
| `palabre codex-claude "Subject" -t 4` | Launches with a preset. |
| `palabre run --subject "Subject" --agent-a codex --agent-b claude` | Launches with explicit agents. |
| `palabre run --subject "Subject" --agent-a codex --agent-b claude --role-a architect --role-b critic` | Launches with temporary roles. |
| `palabre ask "Subject" --agents codex claude` | Runs a request with independent responses. |
| `palabre chat --agent-a codex` | Opens a continued conversation with one agent. |

## Resume a session

Add `--checkpoint` to a Debate or Ask request to save atomic state under `.palabre/sessions/`. Palabre then prints the session id and matching resume command.

```bash
palabre codex-claude "Compare two options" --checkpoint
palabre sessions
palabre resume <session-id>
palabre sessions delete <session-id>
```

Resume keeps every complete response and calls only the next Debate turn, remaining Ask agents, or the summary. Before any call, Palabre verifies that the configuration is still trusted and unchanged, then compares the context file fingerprints. Any difference blocks resume so the decision cannot change silently. Interactive terminals ask for confirmation; use `--yes` for non-interactive execution. A completed session cannot be resumed.

`palabre sessions` shows the 20 most recent checkpoints by default, including their status, mode, response count, and next phase. `--limit <1-100>` bounds the list. A corrupted JSON file is reported as invalid without hiding other entries. Deletion displays the exact target and asks for confirmation; non-interactive use requires `--yes`. It never removes Markdown exports or sibling checkpoints.

## Relay

To find an exchange without sending or opening: `palabre relay recent [--limit 1-100] [--json] [--config <path>] [--language fr|en]`.
Confirm date, subject and tool before resuming; exports are unauthenticated
metadata. [Find an exchange](/en/usage/relay#find-a-recent-exchange).

| Command | Description |
| --- | --- |
| `palabre relay --from <agent>:<uuid> --to <agent>:<uuid> "Message"` | Closed Codex or Claude Code conversation, resumed read-only. |
| `palabre relay --open --from <agent>:<uuid> --to codex:<uuid> "Message"` | Open Codex conversation, Windows/macOS/Linux pilot (`python3` on POSIX); target's own tools and permissions. |
| `palabre relay --from <agent>:<uuid> --to <agent>:<uuid> --task review --pr https://github.com/owner/repository/pull/123` | Writes and publishes a COMMENT review when authorized. |
| `palabre relay allow-repo owner/repository` | Authorizes review after the owner's keyboard confirmation. |

Options: `--message-file <path>`, `--subject "<subject>"` (one line, 200 characters), `--timeout <seconds>` (10–3600, default 600), `--json`, `--no-export`, `--config`, `--trust-config` (refused with review), `--language`. History may change; no automatic resend. Delivery, diagnostics and limits: [Relay](/en/usage/relay).

Relay's Mission option keeps several read-only steps within an agreed scope and budget; it is not another mode.

### Mission option (`palabre mission`)

| Command | Description |
| --- | --- |
| `palabre mission start --from <mission-lead>:<uuid> --to <teammate>:<uuid> --criteria "…" "Objective"` | Saves the scope agreed with the owner, without an agent call. |
| `palabre mission step <id> "Request" [--timeout <seconds>]` | At most one read-only call to the closed teammate; task defaults to `consult`. |
| `palabre mission step <id> "Review" --task review --pr https://github.com/owner/repo/pull/123` | Reuses the review task and its already trusted Relay policy. |
| `palabre mission status <id> --json` | Reloads scope and results without an agent call. |
| `palabre mission stop <id> --reason "…"` | Permanently stops further steps and requests best-effort cancellation of the call. |

start options: `--tasks "consult,review"` (default `consult`), `--max-steps` (1–100, default 10), `--max-duration` (10–86400 seconds, default 3600), `--timeout` (10–3600 seconds, default 600), `--config`, `--language fr|en`. `step` can override the timeout; `--json` is available throughout. Scope and `.mission.md` export live under `.palabre/missions/<id>/`; no automatic resend after a crash or unknown delivery. See [Mission and Relay](/en/usage/relay).

## Conversation with one agent

`palabre chat --agent-a <agent>` opens a terminal conversation. The first message becomes its initial context; `"Subject"` remains accepted as an optional way to prefill that context. For every message, Palabre starts a new call to the selected CLI and injects the accumulated history into it. The result can therefore remain coherent in the current session without relying on a persistent interactive session inside Codex, Claude, or another tool.

Unlike Ask, which collects one or more independent answers to a single question before an optional summary, Chat maintains a multi-turn conversation with one active agent.

Use `/agents` to show available agents. `/end` saves the conversation in `.palabre/`, shows its file and folder, then returns home; `/home` returns without saving. `/consult <agent>` explicitly requests a second opinion on the six most recent retained messages; that opinion is added to the conversation. `/use <agent>` then switches the active agent, or you can continue with the initial agent. `--role-a`, `--model-a`, `--language`, `--files`, and `--context` remain available. Without `--agent-a`, Palabre uses the configured default agent A.

Chat keeps no persistent provider session. The context sent with each call is bounded to the six most recent messages; Palabre reports when older messages are no longer sent. Consultation remains explicit: an agent may suggest it, but the user keeps the initiative.

After a Debate or Ask completes in the TUI, `/chat` directly opens a conversation whose context shows its provenance and carries over the subject with the final summary, or the six recent exchanges when no summary is available.

## TUI Commands

These commands are available from the TUI home screen or from `/config` depending on context.

| Command | Description |
|---------|-------------|
| `/` | Displays the contextual list of canonical commands; arrow keys, `Tab`, or `→` complete the selection. |
| `/new` | Opens the guided flow for composing a Chat, Debate, or Ask session. |
| `/chat` | Opens a conversation with the default agent A. `/home` or `/exit` returns to the home screen. |
| `/ask` | Switches the TUI home screen to Ask mode. |
| `/debate` | Switches the TUI home screen to debate mode. Alias: `/debat`. |
| `/agents` | Displays available agents or updates active agents when names are provided. |
| `/roles` | Displays available roles or updates active roles when roles are provided. In Ask mode, a single role such as `/roles critic` applies to all Ask agents. |
| `/config` | Opens TUI settings. |
| `/history` | Shows recent Markdown exports. Alias: `/historique`. |
| `/update` | Opens the update screen for the detected installation channel. |
| `/ollama` | Displays the configured Ollama model and installed models from `/config`. |
| `/ollama-url <url|default>` | Configures the address of every Ollama agent from `/config`. |
| `/ollama-model <model>` | Changes the configured `ollama-local` model from `/config`. |
| `/ollama-sync` | Replaces the configured Ollama model with an installed model when the current one is missing. |
| `/language fr`, `/language en` | Changes the language from `/config`. Alias: `/lang`. |
| `/interface tui`, `/interface terminal` | Changes the default interface from `/config`. |
| `/home` | Returns to the TUI home screen. |
| `/quit` | Exits the TUI. |
| `/back` | Returns to the previous screen. |
| `/retry` | Explicitly runs the last session again. |
| `/consult <agent>`, `/use <agent>`, `/end` | Chat commands; see the Chat guide. |

## Integrations

An integration launching Palabre can declare its identity in the child process
environment:

```text
PALABRE_CLIENT=palabre-vscode
PALABRE_CLIENT_VERSION=1.7.1
```

Palabre records this information, together with its own version, in
`.debate.md`, `.chat.md`, and `.ask.md` exports. Client names are open so
future integrations can identify themselves without a hard-coded registry.
When no client is declared, the invocation source is `direct-cli`.

| Command | Description |
|---------|-------------|
| `palabre agents --json` | Lists configured agents, their role, type, and availability as JSON v1. |
| `palabre presets --json` | Lists presets and their local availability. |
| `palabre history --json` | Lists the 10 most recent Markdown exports as JSON v1. |
| `palabre history --json --limit 30` | Lists up to 30 exports (maximum: 100). |
| `palabre sessions --json` | Lists up to 20 valid or invalid checkpoints as JSON v1. |
| `palabre sessions --json --limit 30` | Lists up to 30 checkpoints (maximum: 100). |
| `palabre sessions delete <session-id> --yes --json` | Deletes exactly one checkpoint and confirms its id as JSON v1. |
| `palabre relay --from <agent>:<session> --to <agent>:<session> "…" --json` | Relays a message to a closed conversation or open Codex with `--open` and returns a `relay-result` JSON v1 object, whatever the outcome. |
| `palabre config --ollama-models --json` | Returns local Ollama state as JSON v1 for integrations. |
| `palabre context scan [paths...] --json` | Returns the folders, files, and warnings from the `--context` scan as JSON v1. |

## General options

| Option | Description |
|--------|-------------|
| `-h`, `--help` | Displays help. |
| `-v`, `--version` | Displays the version. |
| `--config <path>` | Uses an explicit configuration file. |
| `--trust-config` | Records approval of the resolved local or global configuration after human review; never to grant an agent rights. |
| `--language <fr\|en>`, `--lang <fr\|en>` | Forces the Palabre and agent prompt language for this command. |
| `--tui` | Forces the TUI interface, even if configuration asks for terminal rendering. |
| `--terminal`, `--no-tui` | Uses raw terminal rendering. Also useful with `palabre doctor` for logs. |
| `--plain` | Historical alias for `--terminal`. |
| `--json` | Requests JSON output from commands that support it, or the resolved `dry-run` object. |
| `--renderer <auto\|pretty\|plain\|tui\|ndjson>` | Selects the terminal or integration renderer. `tui` enables the full-terminal interface. |

## Debate options

| Option | Description |
|--------|-------------|
| `-s`, `--subject <text>` | Session subject. |
| `--topic <text>` | Compatible alias for `--subject`. |
| `--preset <name>` | Selects an agent pair. |
| `--agent-a <name>` | First agent. |
| `--agent-b <name>` | Second agent. |
| `--role-a <role>` | Temporary role for the first agent, without editing config. |
| `--role-b <role>` | Temporary role for the second agent, without editing config. |
| `--ask-role <role>` | Temporary shared role applied to all Ask agents. |
| `--mode <debate\|ask\|chat>` | Selects the orchestration mode. |
| `--agents <names...>` | Ask mode agents, 4 maximum. |
| `-t`, `--turns <number>` | Total number of turns, between 1 and 20. |
| `--no-early-stop` | Disables early stopping. |
| `--model-a <model>` | Model passed to agent A. |
| `--model-b <model>` | Model passed to agent B. |
| `--ollama-url <url>` | Overrides the address of every Ollama agent for this session. |
| `--pull-models` | Allows Ollama to download a missing model. |
| `--checkpoint` | Saves versioned machine state under `.palabre/sessions/` for future resume. |
| `--yes` | Explicitly confirms `palabre resume` or checkpoint deletion in non-interactive mode. |
| `--summary-agent <name>` | Summary agent. |
| `--summary-model <model>` | Summary model. |
| `--no-summary` | Disables the final summary. |
| `--files <paths...>` | Injects specific files. |
| `--context <paths...>` | Scans text files or folders. |
| `--show-prompt` | Displays the first turn prompt without calling any agent. |
| `--dry-run` | Previews the resolved Debate or Ask session without calling agents or writing an export. Refused in Chat. |

## Update

| Command | Description |
|---------|-------------|
| `palabre update` | Displays the plan then asks for TTY confirmation before a safe update. |
| `palabre update --check` | Checks the version and channel without changing the machine. |
| `palabre update --dry-run` | Displays the exact steps without running them. |
| `palabre update --yes` | Applies a safe plan without interactive confirmation. |
| `palabre update --apply` | Compatible alias for `--yes`. |
| `palabre skill` | Compares skill copies with the running package, without writing or network access. |
| `palabre skill --sync` | Displays the copies to refresh and asks for confirmation; backups stay outside skill directories and junctions are preserved. |
| `palabre skill --install codex` | Installs this CLI's skill into `~/.agents/skills/palabre`, after confirmation. Use `--install claude` for Claude Code. |
| `palabre skill --sync --dry-run` | Preview without writes; `--check` is also read-only. |

The single `palabre update` confirmation also covers detected skill copies, refreshed from the newly installed package. See [Palabre skill](/en/get-started/skill) for customization, backups and reloading in the agent.

`palabre mission status <id> --json` returns a `mission-result` v1 object without calling an agent. Relay exports include the PALABRE version, but not the `PALABRE_CLIENT` provenance fields present in Debate, Ask and Chat exports.
