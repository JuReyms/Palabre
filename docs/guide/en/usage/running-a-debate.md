---
title: Debate and Ask
description: Choose Debate or Ask mode, agents, roles, turns, and main options to start a Palabre session.
---

## TUI home screen

```bash
palabre
```

The TUI home screen is the recommended starting point. It shows active agents, roles, summary, current folder, and useful commands.

From this screen:

- type a subject to launch the current mode;
- use `/ask` or `/debat` to switch mode;
- use `/agents` to choose agents;
- use `/roles` to apply roles;
- use `/config` to change settings without leaving the TUI.

`palabre new` remains available as the historical guided assistant.

## Debate mode

`debate` mode makes two agents talk turn by turn. It is the right choice when you want to confront two viewpoints, build real contradiction, request a critical review, or turn a fuzzy topic into a decision.

Each turn receives:

- the subject;
- the session context;
- files or folders injected with `--files` or `--context`;
- the history already produced by the agents.

At the end, Palabre asks for a final summary. This summary covers the consensus, disagreements or uncertainties, proposed actions, and a short conclusion.

## With default agents

```bash
palabre -s "Critique this plan" -t 4
```

This command uses the agents defined in your configuration.

## With a preset

```bash
palabre codex-claude "Critique this plan" -t 4
```

A preset quickly selects an agent pair. Order matters: `codex-claude` has Codex respond first, then Claude.

## With explicit agents

```bash
palabre run --subject "Critique this plan" --agent-a codex --agent-b claude --turns 4
```

This form is longer, but makes the command fully explicit.

## Ask mode

```bash
palabre ask "Compare these two options" --agents codex claude opencode
```

Ask mode sends the same subject and context to several agents, without a shared transcript between them. Each agent answers alone. Then the summary agent faithfully summarizes what each agent said and compares the responses.

Ask is useful when you want to compare several independent answers, get multiple formulations, check whether agents converge without influencing each other, or ask several profiles to analyze the same request in parallel.

Without `--agents`, Palabre uses `defaults.askAgents` if defined, otherwise the default debate pair.

Ask mode accepts 1 to 4 agents:

```bash
palabre ask "Which approach should we choose?" --agents codex claude opencode gemini
```

The export uses the `.ask.md` extension.

`--turns` does not control the number of responses in Ask mode: the number of responses depends on the selected agents. To change the default Ask agents:

```bash
palabre config --ask-agents codex claude opencode
palabre config --ask-summary-agent opencode
```

From the TUI home screen, `/ask` switches to Ask mode, `/agents` chooses active agents, and `/roles` applies roles.

## Number of turns

`--turns` or `-t` sets the total number of turns, between 1 and 20.

Example with `codex` as agent A and `claude` as agent B:

| Value | Flow |
|-------|------|
| `-t 2` | codex, then claude |
| `-t 3` | codex, claude, codex |
| `-t 4` | codex, claude, codex, claude |

By default, Palabre may stop before the limit if agents clearly express full agreement after a complete turn.

To force all requested turns:

```bash
palabre codex-claude "Subject" -t 4 --no-early-stop
```

## Choose a model on the fly

Palabre does not list CLI models, as they change frequently. It simply passes the value to the agent. If the model does not exist or is not authorized by your account, the CLI will return the error.

```bash
palabre codex-claude "Subject" --model-a <codex-model> --model-b <claude-model>
```

For Ollama:

```bash
palabre codex-ollama "Subject" --model-b <installed-ollama-model>
```

## Preview without calling AI

```bash
palabre codex-claude "Subject" --show-prompt
```

This command displays the first turn prompt, the agents, and the summary options, then stops. This is useful for verifying the context being sent without consuming an AI request.

## TUI interface and raw terminal rendering

By default, Palabre favors the TUI interface when output is a real terminal. `palabre` opens the home screen, and a direct command such as `palabre codex-claude "Subject" -t 4` runs the session with the TUI renderer.

To get raw rendering suitable for logs:

```bash
palabre codex-claude "Subject" --terminal
```

To make that the default behavior:

```bash
palabre config --interface terminal
```
