---
title: Gemini
description: Configure Gemini CLI in Palabre and use it in debates with other agents.
---

Gemini CLI lets you use Google Gemini models from the terminal.

Palabre can use it as a review, comparison, or summary agent.

## Install before Palabre

Install Gemini CLI from the official Google documentation, then authenticate the CLI in your terminal.

Official documentation: [https://google-gemini.github.io/gemini-cli/docs/cli/](https://google-gemini.github.io/gemini-cli/docs/cli/)

Then verify that the command works:

```bash
gemini --version
```

If Gemini was installed after `palabre init`, synchronize the configuration:

```bash
palabre config --sync-agents
```

## Models and limits

Available models and usage limits depend on your Gemini CLI configuration and your Google account.

Palabre does not list Gemini models, as they can evolve. By default, Gemini CLI uses the model configured on its side. If you add `--model-a`, `--model-b`, or `--summary-model`, Palabre passes this string to Gemini CLI via the configured model option. If the model does not exist or is not authorized, Gemini CLI will return the error.

## Windows

On Windows, `shell: true` is often required for npm or PowerShell wrappers such as `gemini`.

## Typical configuration

```json
"gemini": {
  "type": "cli",
  "command": "gemini",
  "args": [],
  "promptMode": "stdin",
  "shell": true,
  "role": "reviewer"
}
```

## Usage

```bash
palabre claude-gemini "Critique this product decision" -t 4
palabre gemini-opencode "Compare these arguments" -t 3
```
