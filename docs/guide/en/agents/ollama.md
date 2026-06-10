---
title: Ollama
description: Use Ollama with Palabre to bring in local models or models compatible with your Ollama configuration.
---

This is useful for adding a local, lower-cost perspective, or for assigning a small model a targeted role: critic, exploration, or lightweight summary.

Ollama may have a slower response time than other agents, especially if the model is not already loaded. It is recommended to check that the model is loaded before starting a debate with Ollama. Or to be patient.

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

If Ollama was installed after `palabre init`, synchronize the configuration:

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
