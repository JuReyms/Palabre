---
title: Context and files
description: Add context to a debate with --files or --context while keeping control over the data transmitted.
---

Palabre can send project context to agents. This is essential for requesting a critique of code, architecture, or documentation.

## Two modes

| Option | Usage |
|--------|-------|
| `--files` | You explicitly choose the files. An invalid path stops the command. |
| `--context` | Palabre scans text files or folders with limits and exclusions. |

## Explicit files

```bash
palabre codex-claude "Review this module" --files src/auth.ts README.md
```

Use `--files` when you know exactly which files should be sent.

## Context scan

```bash
palabre codex-claude "Critique this architecture" --context src docs
```

`--context` ignores common technical folders such as `.git`, `node_modules`, and `dist`. It keeps known text files and displays warnings for ignored files.

## Preview the scan as JSON

```bash
palabre context scan src docs --json
```

This command exposes the same scan as `--context`, without starting a debate. It returns versioned JSON with the scanned root, requested paths, retained folders and files, and warnings. Integrations such as the VS Code extension should use this command instead of reimplementing exclusion or limit rules.

## Ollama and files

Ollama does not read the filesystem on its own. It only receives the prompt built by Palabre.

If an Ollama agent takes part in a debate about your project, explicitly add context:

```bash
palabre codex-ollama "Critique this module" --context src
```

## View the prompt being sent

```bash
palabre codex-claude "Subject" --context src --show-prompt
```

This command does not launch any agent. It lets you verify what Palabre will send on the first turn.
