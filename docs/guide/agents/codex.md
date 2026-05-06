# Codex

Palabre peut le lancer comme agent de débat, souvent en agent A pour proposer une première solution.

## À installer avant Palabre

Installez Codex depuis la documentation officielle d'OpenAI, puis authentifiez la CLI dans votre terminal.

Documentation officielle : [https://developers.openai.com/codex/cli](https://developers.openai.com/codex/cli)

Vérifiez ensuite que la commande fonctionne :

```bash
codex --version
```

Si Codex a été installé après `palabre init`, synchronisez la configuration :

```bash
palabre config --sync-agents
```

## Abonnement et limites

Codex utilise les règles d'accès de votre compte OpenAI. Palabre ne contourne pas les quotas, limites d'usage ou abonnements.

Si Codex atteint une limite, Palabre affiche une erreur courte et vous pouvez attendre que votre quota d'utilisation soit réinitialisé ou utiliser une autre paire d'agents.

## Configuration typique

```json
"codex": {
  "type": "cli",
  "command": "codex",
  "args": ["exec", "--skip-git-repo-check", "--color", "never", "--sandbox", "read-only", "-"],
  "promptMode": "stdin",
  "shell": true,
  "role": "implementer"
}
```

Sur Windows, `shell: true` est souvent nécessaire pour les wrappers installés via npm ou PowerShell.

## Utilisation

```bash
palabre codex-claude "Critique cette architecture" -t 4
palabre codex-opencode "Compare ces deux approches" -t 3
```
