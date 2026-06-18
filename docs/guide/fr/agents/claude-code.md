---
title: Claude Code
description: Configurer Claude Code dans Palabre et comprendre ce que Palabre transmet à la CLI Claude.
---

Claude Code est la CLI d'Anthropic pour travailler avec Claude depuis le terminal.

Palabre peut l'utiliser comme agent de débat ou comme agent de synthèse.

## À installer avant Palabre

Installez Claude Code depuis la documentation officielle d'Anthropic, puis authentifiez la CLI dans votre terminal.

Documentation officielle : [https://code.claude.com/docs/](https://code.claude.com/docs/)

Vérifiez ensuite que la commande fonctionne :

```bash
claude --version
```

Sur Windows, la commande détectée peut être `claude.exe`.

Si Claude Code a été installé après votre première configuration Palabre, relancez `palabre` ou synchronisez explicitement :

```bash
palabre config --sync-agents
```

## Abonnement et limites

Claude Code utilise les règles d'accès de votre compte Anthropic ou Claude. Palabre ne contourne pas les quotas, limites d'usage ou abonnements.

Si Claude atteint une limite, Palabre affiche une erreur courte et vous pouvez attendre que votre quota d'utilisation soit réinitialisé ou utiliser une autre paire d'agents.

## Windows

Claude fonctionne souvent mieux avec `claude.exe` et `shell: false`, car ce binaire est généralement directement exécutable. Cette différence avec Codex ou OpenCode vient du fait que ces derniers sont souvent des wrappers npm ou PowerShell sur Windows.

## Configuration typique

```json
"claude": {
  "type": "cli",
  "command": "claude.exe",
  "args": ["--print", "--output-format", "text", "--no-session-persistence"],
  "promptMode": "stdin",
  "shell": false,
  "role": "reviewer"
}
```

Claude fonctionne souvent bien comme `reviewer` ou `summarizer`.

## Utilisation

```bash
palabre codex-claude "Critique ce plan" -t 4
palabre run -s "Synthétise ces options" --summary-agent claude
```
