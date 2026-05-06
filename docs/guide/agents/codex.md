# Codex

Codex CLI permet d'utiliser Codex depuis le terminal.

Palabre peut le lancer comme agent de débat, souvent en agent A pour proposer une première solution.

## À installer avant Palabre

Installez et configurez Codex CLI hors de Palabre, puis vérifiez la commande :

```bash
codex --version
```

## Compte, modèle et limites

Codex garde sa propre configuration : fournisseur, modèle par défaut, sandbox, approbations et limites d'usage.

Palabre transmet seulement le prompt. Si vous indiquez `--model-a` ou `--model-b`, la valeur est transmise telle quelle à la CLI via son argument modèle configuré.

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
