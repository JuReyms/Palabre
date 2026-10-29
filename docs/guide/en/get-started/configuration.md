---
title: First configuration
description: Create a Palabre configuration, detect installed agents, and set useful default settings.
seo:
  title: Create your config and detect installed agents
  description: Create a Palabre configuration, let it detect the AI CLIs already installed on your machine, and set sensible defaults.
---

## Automatic first configuration

In an interactive terminal, the simplest first step is:

```bash
palabre
```

If no configuration exists yet, Palabre creates the global configuration at:

```text
~/.palabre/palabre.config.json
```

It detects locally available tools, chooses useful defaults when possible, then opens the TUI home screen.

## Explicit initialization

You can still initialize Palabre explicitly:

```bash
palabre init
```

This creates the same global configuration:

```text
~/.palabre/palabre.config.json
```

It also detects locally available tools: Codex, Claude, Antigravity, OpenCode, Mistral Vibe, and Ollama.
After creation, Palabre shows the active language and the quick command to switch to the other language.

For a configuration specific to the current project:

```bash
palabre init --local
```

## Choose the language

By default, Palabre uses French. To switch the interface and the prompts sent to agents to English:

```bash
palabre config --language en
```

To switch back to French:

```bash
palabre config --language fr
```

You can also choose the language directly during initialization:

```bash
palabre init --language en
```

## Verify the installation

```bash
palabre doctor
```

`doctor` does not launch any AI agent. It checks the configuration, available commands, Ollama, and declared local models.

## View declared agents

```bash
palabre agents
```

or:

```bash
palabre -a
```

This command displays the agents present in your configuration and indicates whether they are detected on your machine.

## Choose default agents

The simplest way is to use the assistant:

```bash
palabre config
```

You can also set default agents directly:

```bash
palabre config --set-defaults codex claude --summary-agent claude -t 4
```

Here:

- `codex` responds first;
- `claude` responds second;
- `claude` produces the final summary;
- `-t 4` requests up to four responses in total (two per agent if all are played, excluding the summary).

## Roles complementing the modes

Roles shape agent instructions in **Debate, Ask and Chat**, not Relay. They complement the selected mode: an `implementer` proposes, a `reviewer` looks for risks, a `critic` challenges assumptions, an `architect` structures options and a `scout` explores. They change neither the model nor permissions. The final summary automatically uses the `summarizer` instruction, regardless of the chosen agent's usual role.

For one session: `--role-a` / `--role-b` in Debate, `--ask-role` in Ask, `--role-a` for the initial interlocutor in Chat. For a default role: `palabre agent-role <agent> <role>`. In Relay, “lead” and “teammate” describe who delegates and who receives the task; they are not these configurable roles. See the [CLI reference](/en/reference/cli).

## Add agents detected later

If you install Claude Code, Codex, Antigravity, OpenCode, Mistral Vibe, or Ollama after creating the configuration:

```bash
palabre config --sync-agents
```

This command adds missing detected known agents and refreshes known command names without overwriting your custom agents or existing defaults. The TUI home screen performs the same conservative synchronization automatically when it starts.

Commands already configured with an absolute path are preserved, even if that path is missing; there is no silent fallback to another installation.

## Next step

You can now [start your first session](/en/get-started/first-debate).

## Other settings and approval

```powershell
palabre config --mode ask --ask-agents codex claude opencode
palabre config --interface terminal
palabre config --clear-defaults
```

`--clear-defaults` removes defaults; it does not uninstall agents. See `palabre config --help`.

`palabre init --local` creates `./palabre.config.json`, which takes precedence over global configuration in that folder. A configuration can run commands with your rights: PALABRE requires approval for implicit project configuration and configurations used by Relay, local or global. `init` approves the file it creates; manual edits invalidate that approval. Read the file, then confirm in a terminal or run `palabre config --config <file> --trust-config`. An agent must never approve a policy to grant itself rights.

To authorize the sole Relay review task on a repository, run `palabre relay allow-repo owner/repository` yourself in your visible terminal: keyboard confirmation is required. See [Relay](/en/usage/relay).
