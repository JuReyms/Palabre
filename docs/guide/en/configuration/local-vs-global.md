---
title: Local vs global configuration
description: Choose between a global user configuration and a local configuration specific to a project.
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

A local configuration can run the commands declared by its agents and contact configured Ollama
servers. Palabre therefore asks for approval before first use and records its fingerprint in
`~/.palabre/trusted-configs.json`. Any external file change invalidates that approval. In a
non-interactive workflow, review the file and use `--trust-config` once to record its new
fingerprint.

`palabre doctor` remains available before approval so you can inspect the configuration. In that
case, it does not call Ollama URLs declared by the untrusted file.

## Resolution order

Palabre looks for configuration in this order:

1. `./palabre.config.json`
2. `~/.palabre/palabre.config.json`

You can force a specific file:

```bash
palabre run -s "Subject" --config ./palabre.config.json
palabre agents --config ./palabre.config.json
```
