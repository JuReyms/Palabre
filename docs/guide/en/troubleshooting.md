---
title: Troubleshooting
description: Resolve common issues with configuration, agent detection, Ollama, or usage limits.
seo:
  title: Fix agent detection, Ollama, and quota errors
  description: "Resolve the most common Palabre issues: configuration, agent detection, Ollama connectivity, and usage limits."
---

Start by running the diagnostic:

```bash
palabre doctor
```

`doctor` does not launch any AI agent. It displays a diagnostic by sections: configuration, local tools, agents, and items to check. It verifies declared agents, default settings, number of responses, `outputDir`, available CLIs, Ollama, and configured models.

To get raw output suitable for logs or scripts:

```bash
palabre doctor --terminal
```

## Codex on Windows: error 5 despite read-only access

**What happened:** without `--open`, Codex cannot start its read commands. PALABRE preserves its reply but returns `read-unavailable` (2); with review, nothing is published.

**Probable cause:** the Microsoft Store `WindowsApps\pwsh.exe` alias. **Next step:** follow [#128](https://github.com/JuReyms/Palabre/issues/128); no validated solution yet. Do not resend the message or widen permissions.

### Technical details


`CreateProcessAsUserW failed: 5` here means Codex could not start a command, even to read. On the machine tested with Codex 0.163.0, the same read under `:read-only` succeeds with native Windows PowerShell and fails with the `WindowsApps\pwsh.exe` alias. Check the selected shell rather than concluding that the entire `unelevated` sandbox is unusable.

**No known, validated solution yet to force native PowerShell in this Relay workflow with Codex 0.163.0; tracked in [#128](https://github.com/JuReyms/Palabre/issues/128).** The owner can follow that issue; no configuration change is requested for now.

`[windows] shell_path` already pointed to native PowerShell in the tested machine's configuration, yet Codex launched the Microsoft Store alias. This setting is absent from the [official Codex 0.163.0 schema](https://github.com/openai/codex/blob/rust-v0.163.0/codex-rs/core/config.schema.json): do not present it as supported configuration. This version's [shell selection code](https://github.com/openai/codex/blob/rust-v0.163.0/codex-rs/shell-command/src/shell_detect.rs) looks for `pwsh` before `powershell`. A successful read with an explicitly selected executable does not establish how to enforce that choice for all commands in a resumed session.

PALABRE changes neither shell selection nor machine security. Do not enable writes or unrestricted access to bypass the failure. Switching to `elevated` remains a separate owner decision, not a solution demonstrated by these tests.

Relay preserves the reply but reports `read-unavailable`/2 if this error is observed in Codex command events. Mission pauses; the review task does not publish the review (`review-failed`/9, `not-attempted`). Do not resend automatically. See evidence, limits and JSON fields in the [Relay guide](/en/usage/relay).

## Palabre cannot find my configuration

Typical message:

```text
[ERROR] Config missing: ...
```

In an interactive terminal, the simplest fix is to let Palabre create the global configuration:

```bash
palabre
```

For scripts or setup without opening the TUI, initialize explicitly:

```bash
palabre init
```

For a configuration local to the current project:

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

Open `palabre` again to let the TUI synchronize detected known agents, or synchronize explicitly:

```bash
palabre config --sync-agents
```

This command adds missing known agents and refreshes known command names without overwriting your existing settings.

## The default number of responses is invalid

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

On Windows, retain generated settings: `shell: true` enables conservative wrapper resolution, which launches recognized npm/pnpm shims directly without a shell. Do not force another value to bypass an error. See [Agents on Windows](/en/agents/overview#windows). An absolute `command` path is preserved by synchronization.

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

To check without changing the machine:

```bash
palabre update --check
```

`palabre update` detects a Git checkout or global npm, pnpm, Yarn, or Bun installation and displays the exact action. In an interactive terminal, it asks once before any mutation. Use `--dry-run` to preview the steps or `--yes` in explicitly authorized automation.

With recent pnpm versions, `palabre@latest` can temporarily stay on an older version because of supply-chain safeguards. Palabre therefore uses the exact npm version when it is available:

```bash
pnpm add --global palabre@<version>
```

Adapt the number to the version printed by `palabre update` or by:

```bash
pnpm view palabre version
```

If the channel is unknown or ambiguous, Palabre changes nothing. Reinstall with the package manager used initially, for example:

```bash
pnpm add --global palabre@latest
```

`--apply` remains a compatible alias for `--yes`.

## Approval and Relay refusals

Manual edits invalidate the approved fingerprint. For an implicit project configuration or a Relay call, read the file then run `palabre config --config <file> --trust-config` yourself. Agents wait for your action; they do not grant themselves rights.

Refusals before sending (`not-delivered`): `config-untrusted` (8), `task-not-allowed` (8, owner: run `remedy` in your terminal), `review-cli-unsupported` (8, Claude ≥ 2.1.292 and `--safe-mode` required), `target-busy` (3, close the target or choose `--open` for Codex on Windows), `target-not-open` (3, open the Codex target). See [Relay](/en/usage/relay).

A recognized limit gives `usage-limit`. Retry information is shown only when supplied: `retryAfter` in NDJSON errors, or Relay with `--open`. Without `--open`, Relay classifies the limit but does not expose that field. No automatic resend even after the stated time; no date or time zone is inferred from a time alone. With Relay, check delivery before any new request. Mission preserves the result and pauses on a known failure; unknown delivery needs human verification. With `--checkpoint`, `resume` preserves accepted answers.
