---
title: Ollama
description: Use Ollama with Palabre to bring in local models or models compatible with your Ollama configuration.
seo:
  title: Run AI debates locally with Ollama
  description: Use Ollama with Palabre to run debates on local models, cut API costs, and mix a local agent with a cloud one.
---

Ollama runs models on your machine. With a local server and model, requests stay local; a remote server receives the data. The first response may take time while loading: `ollama ps` lists loaded models.

## Install before Palabre

Install Ollama from the official documentation, then download a model.

Official documentation: [https://docs.ollama.com/](https://docs.ollama.com/)

CLI reference: [https://docs.ollama.com/cli](https://docs.ollama.com/cli)

Then verify that the command works:

```bash
ollama list
```
or:
```bash
ollama ls
```

If Ollama was installed after your first Palabre configuration, open `palabre` again or synchronize explicitly:

```bash
palabre config --sync-agents
```

If needed, start Ollama:

```bash
ollama serve
```

## Installing a model

```bash
ollama pull gemma4:e4b
```

Choose a model appropriate for your machine. Large models may be too heavy for smooth use.

In local use, the main limits come from your machine: memory, CPU/GPU, and response time. If you use a cloud, paid, or remote Ollama offering, quotas and limits come from that offering, not from Palabre.

## Choose the model used by Palabre

Palabre reads the model from the `ollama-local` agent in your configuration. To list installed models and check whether the configured model still exists:

```bash
palabre config --ollama-models --json
```

To change Palabre's default Ollama model:

```bash
palabre config --set-ollama-model gemma4:e4b
```

If you removed the configured model and want Palabre to pick an installed model that is available:

```bash
palabre config --sync-ollama-model
```

These commands update the Palabre configuration. For a one-off debate override, use `--model-a`, `--model-b`, or `--summary-model` depending on where the Ollama agent is used.

## Typical configuration

Excerpt from the `agents` block:

```json
"ollama-local": {
  "type": "ollama",
  "baseUrl": "http://localhost:11434",
  "model": "gemma4:e4b",
  "role": "critic",
  "temperature": 0.2,
  "validateModel": true,
  "unloadOtherModels": true
}
```

## Use a remote Ollama server

For one session, override the address of every Ollama agent:

```powershell
palabre codex-ollama "Critique this plan" --ollama-url gpu-box:11434
```

You can also define `OLLAMA_HOST` in the process environment:

```powershell
$env:OLLAMA_HOST = "gpu-box:11434"
palabre codex-ollama "Critique this plan"
```

Palabre accepts addresses with or without an HTTP scheme. The priority is:

1. `--ollama-url`
2. `OLLAMA_HOST`
3. `baseUrl` in the agent configuration
4. `http://localhost:11434`

From the TUI, open `/config`, then use:

```text
/ollama-url gpu-box:11434
/ollama-url default
```

This command persistently updates `baseUrl` for every configured Ollama agent.
The flag and environment variable do not modify the configuration file.

## Check if a model is loaded in Ollama

Ollama must load a model to respond quickly.

```bash
ollama ps
```

## Automatically download a missing model

By default, Palabre does not install a model automatically. To allow it at startup:

```bash
palabre codex-ollama "Critique this plan" --pull-models
```

You can also enable `autoPullModel` in the agent configuration.

## Give context to Ollama

Ollama does not read your files directly. Use:

```bash
palabre codex-ollama "Critique this module" --files src/module.ts
```

or:

```bash
palabre codex-ollama "Critique the architecture" --context src docs
```

## Defaults and diagnostics

At initialization, PALABRE prefers `nemotron-3-nano:4b` if installed, otherwise the first installed model; without an installed model, that same name is the fallback. `gemma4:e4b` in the example is an explicit choice, not a mandatory default.

`--set-ollama-model` modifies only `ollama-local` and requires an installed model. For another agent, edit its `model` field and reapprove the file after reading it. `palabre doctor` checks server and model availability; `model-unavailable` signals a missing model, while network failure may have an HTTP diagnostic.

Advanced options: `keepAlive`, `pullTimeoutMs` (30 minutes by default) and `maxOutputBytes`. See [Configuration](/en/reference/config-file).
