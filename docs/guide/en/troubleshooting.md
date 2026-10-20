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

**What happened:** Codex cannot start a command (`CreateProcessAsUserW failed: 5`). PALABRE reports it in `readAccess`. If a command succeeds afterwards, the relay stays `replied` (0) with `status: "partial"` and `succeededCommands`. With no later success, a received reply becomes `read-unavailable` (2) with `status: "blocked"`, while preserving the reply and delivery. An ambiguous event gives `unverified` without degrading the outcome. With review, no review is published (`review-failed`, 9), because publishing cannot be undone.

**Confirmed cause on the tested machine:** the Microsoft Store PowerShell alias, `WindowsApps\pwsh.exe`. Under the same `:read-only` policy, the alias fails, native PowerShell reads the file, and writes remain denied.

### What PALABRE does automatically

For closed Relay, `--new`, Mission and the review task targeting Codex, PALABRE checks the preferred shell. On Windows it removes the `WindowsApps` directory from **its child process only** if that directory's `pwsh.exe` is a confirmed execution alias and native PowerShell remains available. A native PowerShell already taking priority causes no change. An unavailable check or uncertain fallback leaves PATH unchanged.

No user setting, global PATH or write permission is changed. The `readAccess` diagnostic is still reported while a launch is refused. No automatic resend or sandbox change. `--open` keeps the Desktop conversation's behavior and does not use this fix.

**Limit:** other aliases in the removed directory (for example Python or Windows Terminal) can no longer be found by name through that directory, for this child only. PALABRE resolves the Codex CLI before filtering; its own terminal, GitHub commands and other agents keep their environment. This does not fix every possible cause of error 5.

### Owner option: install PowerShell 7 outside the Store

This is optional: native Windows PowerShell may be enough for the fix. If you prefer PowerShell 7, the [Microsoft documentation](https://learn.microsoft.com/en-us/powershell/scripting/install/install-powershell-on-windows) gives this command to select the **MSI** package, when available:

```powershell
winget install --id Microsoft.PowerShell --source winget --installer-type wix
```

Choosing MSI matters: `--source winget` alone may install an MSIX package. If MSI is unavailable, follow Microsoft's MSI or ZIP instructions. PALABRE does not install anything for you. Reopen your terminal and app after installation; check the proposed path with:

```powershell
Get-Command pwsh -All | Select-Object Source
```

The native path is usually `C:\Program Files\PowerShell\7\pwsh.exe`. If reads remain blocked, keep the result and consult [#128](https://github.com/JuReyms/Palabre/issues/128) before deciding whether to send again. Do not widen permissions.

### Technical details

The alias is identified by its `AppExecLink` tag (`0x8000001b`), read by native `fsutil` without launching the alias. Its entry is inspected without following its target: Node may return `existsSync=false` for an alias that is present. Only that alias directory is removed, including duplicates; all other entries keep their order. The local probe is bounded to 3 seconds and 8 KiB.

[Codex 0.163.0 shell selection](https://github.com/openai/codex/blob/rust-v0.163.0/codex-rs/shell-command/src/shell_detect.rs) looks for `pwsh` before `powershell`. `[windows] shell_path` is absent from its [official schema](https://github.com/openai/codex/blob/rust-v0.163.0/codex-rs/core/config.schema.json): do not add it as a fix. Switching to `elevated` remains a separate owner decision, unnecessary for the successful test here.

The evidence covers Windows and Codex 0.163.0: a fictional file unreadable before the fix was read afterwards through `relay --new`, without changing the read-only policy. Other versions and environments need verification. Mission and review use the same provider exchange; their protections and the prohibition on publishing a blind review remain unchanged.

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

Refusals before sending (`not-delivered`): `config-untrusted` (8), `task-not-allowed` (8, owner: run `remedy` in your terminal), `review-cli-unsupported` (8, Claude ≥ 2.1.292 and `--safe-mode` required), `target-busy` (3, close the target or choose `--open` for Codex on Windows, macOS, or Linux), `target-not-open` (3, open the Codex target). On macOS/Linux, `target-state-unknown` asks you to check `python3 --version`. See [Relay](/en/usage/relay).

A recognized limit gives `usage-limit`. Retry information is shown only when supplied: `retryAfter` in NDJSON errors, or Relay with `--open`. Without `--open`, Relay classifies the limit but does not expose that field. No automatic resend even after the stated time; no date or time zone is inferred from a time alone. With Relay, check delivery before any new request. Mission preserves the result and pauses on a known failure; unknown delivery needs human verification. With `--checkpoint`, `resume` preserves accepted answers.
