---
title: Local vs global configuration
description: Choose between a global user configuration and a local configuration specific to a project.
---

Palabre can use a global configuration for all your projects, or a local configuration for a specific project.

## Global configuration

```bash
palabre init
```

File created:

```text
~/.palabre/palabre.config.json
```

Use this option if you want the same default agents everywhere.

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

1. `./palabre.config.json`
2. `~/.palabre/palabre.config.json`

You can force a specific file:

```bash
palabre run -s "Subject" --config ./palabre.config.json
palabre agents --config ./palabre.config.json
```
