---
title: Troubleshooting
description: Resolve common issues with configuration, agent detection, Ollama, or usage limits.
---

Start by running the diagnostic:

```bash
palabre doctor
```

`doctor` does not launch any AI agent. It displays a diagnostic by sections: configuration, local tools, agents, and items to check. It verifies declared agents, default settings, number of turns, `outputDir`, available CLIs, Ollama, and configured models.

To get raw output suitable for logs or scripts:

```bash
palabre doctor --plain
```

## Palabre cannot find my configuration

Typical message:

```text
[ERROR] Config missing: ...
```

Create a configuration:

```bash
palabre init
```

or a configuration local to the current project:

```bash
palabre init --local
```

## The configuration is unreadable

Typical message:

```text
[ERROR] Config unreadable: ...
```

Check that the JSON does not contain a trailing comma, that keys are quoted, and that the file is encoded in UTF-8.

To start from a clean configuration:

```bash
palabre init --config ./new-config.json
```

## A default agent is unknown

Typical message:

```text
[ERROR] defaults.agentA points to an unknown agent: ...
```

List available agents:

```bash
palabre agents
```

Then fix the default agents:

```bash
palabre config --set-defaults codex claude
```

## An installed agent does not appear in the config

Typical message:

```text
[WARN] Agent(s) detected but missing from config: opencode.
```

Synchronize detected agents:

```bash
palabre config --sync-agents
```

This command adds missing agents without overwriting your existing settings.

## The default number of turns is invalid

Typical message:

```text
[ERROR] defaults.turns invalid: 99.
```

Choose a number between 1 and 20:

```bash
palabre config -t 4
```

## The export folder is problematic

Typical message:

```text
[ERROR] outputDir points to a file, not a folder: ...
```

Fix `outputDir` in `palabre.config.json`, or remove this field to write exports to the default `.palabre/` folder.

## A CLI is not found

Typical message:

```text
[WARN] Codex CLI: not detected in PATH.
```

Actions:

- install the relevant CLI;
- authenticate it outside of Palabre;
- close and reopen the terminal;
- run `palabre doctor` again;
- fix `command` in the configuration if the command has a different name.

On Windows, npm or PowerShell wrappers such as `codex`, `gemini`, and `opencode` may require `shell: true` in the configuration.

Claude often works better with `claude.exe` and `shell: false`.

## Ollama is not responding

Typical message:

```text
[WARN] Ollama installed but API unreachable: http://localhost:11434
```

Start Ollama:

```bash
ollama serve
```

Then run again:

```bash
palabre doctor
```

If Ollama uses a different URL, fix `baseUrl` in the Ollama agent configuration.

## The Ollama model is missing

Typical message:

```text
[WARN] ollama-local [ollama:critic] model=... missing.
```

Install the model:

```bash
ollama pull the-model
```

or choose an already installed model for Palabre:

```bash
palabre config --ollama-models --json
palabre config --set-ollama-model installed-model
```

If you simply want to replace the missing configured model with an available installed model:

```bash
palabre config --sync-ollama-model
```

or allow Palabre to download it at startup:

```bash
palabre codex-ollama "Subject" --model-b the-model --pull-models
```

Some models are several GB. On a modest machine, prefer a reasonable local model.

## Ollama cannot see my files

Ollama does not read the filesystem directly. Add context to the prompt:

```bash
palabre codex-ollama "Critique this module" --files src/module.ts
```

or:

```bash
palabre codex-ollama "Critique the architecture" --context src docs
```

## A CLI hits a usage limit

Typical message:

```text
Error: codex has reached a usage limit: ...
```

Possible actions:

- wait until the time indicated by the CLI;
- change the model in the CLI or with `--model-a` / `--model-b`;
- use a different agent pair;
- temporarily disable the affected agent in your configuration.

## An agent's output is empty

Typical message:

```text
produced empty output
```

Test the command outside of Palabre, then check `args`, `promptMode`, `shell`, and timeouts in the configuration.

`allowEmptyOutput` exists, but it is best kept disabled except for very specific cases.

## Update

To see the steps:

```bash
palabre update
```

With recent pnpm versions, `palabre@latest` can temporarily stay on an older version because of supply-chain safeguards. In that case, `palabre update` also prints a command with the exact version when it can read npm:

```bash
pnpm add --global palabre@0.7.0
```

Adapt the number to the version printed by `palabre update` or by:

```bash
pnpm view palabre version
```

To apply from a git checkout:

```bash
palabre update --apply
```

`update --apply` is primarily for installations from the source repository.
