---
title: Local vs global configuration
description: Choose between a global user configuration and a local configuration specific to a project.
seo:
  title: "Local vs global config: which one wins"
  description: Choose between a global user configuration and a per-project local one, and know which takes precedence.
---

Palabre can use a global configuration for all your projects, or a local configuration for a specific project.

## Global configuration

In an interactive terminal, `palabre` creates this global configuration automatically on first launch.

```bash
palabre init
```

File created:

```text
~/.palabre/palabre.config.json
```

Use `palabre init` explicitly if you want to prepare the global config without opening the TUI, or if you want the same default agents everywhere.

## Local configuration

```bash
palabre init --local
```

File created:

```text
./palabre.config.json
```

Use this option if a project needs its own agents, models, or export folder.

## Resolution order

Palabre looks for configuration in this order:

0. `--config <path>`, when supplied;
1. `./palabre.config.json`;
2. `./chicane.config.json` (legacy);
3. `~/.palabre/palabre.config.json`;
4. `~/.palabre/chicane.config.json` (legacy).

You can force a specific file:

```bash
palabre run -s "Subject" --config ./palabre.config.json
palabre agents --config ./palabre.config.json
```

## Approval

A configuration can launch commands and contact its Ollama servers. Approval binds canonical path and SHA-256 fingerprint in `~/.palabre/trusted-configs.json`; external changes invalidate that fingerprint. `init` approves the file it creates. Subsequent PALABRE writes refresh only an existing approval.

The general guard requires approval for an implicit project configuration. Relay and `relay allow-repo` require it for the resolved file, **local or global**. Explicit approval also works for a global file; this does not mean every other command automatically checks its fingerprint.

Read the file, then run `palabre config --config <file> --trust-config`. An agent must not approve it to grant itself rights. For an unapproved project configuration, `doctor` stays available and does not contact its Ollama URLs.

Relay policy follows the resolved file: `palabre relay allow-repo owner/repository` shows the chosen path and requires your keyboard confirmation. All new configurations should be named `palabre.config.json`.

## Remove approvals for missing files

After deleting a project or temporary folder, its approval may remain in the registry. To preview what would be removed without changing anything:

```bash
palabre config --prune-trust --dry-run
```

To clean up, run this command yourself in your terminal:

```bash
palabre config --prune-trust
```

PALABRE lists the affected paths and asks for keyboard confirmation. Before writing, it creates a timestamped backup beside `~/.palabre/trusted-configs.json` and prints its path. Only approvals for missing files are removed. An existing or inaccessible path is kept, even if the file's content has changed. Cleanup does not approve any configuration.

Without confirmation, nothing changes. There is no `--yes` option: an agent may suggest the command, but must never answer on your behalf. If the registry changes during confirmation, PALABRE stops; run the command again to review the new list.
