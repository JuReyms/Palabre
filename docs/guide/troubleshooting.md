# Dépannage

Commence par lancer le diagnostic :

```bash
palabre doctor
```

Depuis le repo, utilise :

```bash
pnpm start -- doctor
```

Le doctor ne lance aucun agent IA. Il vérifie la config, les agents déclarés, les CLIs disponibles, Ollama et les modèles configurés.

## Config absente

Message typique :

```text
[ERREUR] Config absente: ...
```

Actions :

```bash
palabre init
```

Ou, si tu veux une config propre au projet courant :

```bash
palabre init --local
```

Palabre cherche la config dans cet ordre : `./palabre.config.json`, `./chicane.config.json`, `~/.palabre/palabre.config.json`, puis `~/.palabre/chicane.config.json`.

## Config illisible

Message typique :

```text
[ERREUR] Config illisible: ...
```

Actions :

- vérifie que le JSON n'a pas de virgule finale ;
- vérifie les guillemets autour des clés et valeurs ;
- relance `palabre init --config <nouveau-fichier>` si tu veux repartir d'une config propre.

## Agent par défaut inconnu

Message typique :

```text
[ERREUR] defaults.agentA pointe vers un agent inconnu: ...
```

Action : corrige `defaults.agentA`, `defaults.agentB` ou `defaults.summaryAgent` pour pointer vers une entrée existante dans `agents`.

Exemple :

```json
"defaults": {
  "agentA": "codex",
  "agentB": "claude",
  "summaryAgent": "claude",
  "turns": 4
}
```

## CLI introuvable

Message typique :

```text
[WARN] Codex CLI: non detecte dans PATH.
```

Actions :

- installe la CLI concernée ;
- authentifie-la hors de Palabre ;
- ferme et rouvre le terminal pour recharger le `PATH` ;
- corrige `command` dans la config si la commande a un autre nom.

Sur Windows, les wrappers npm/PowerShell comme `codex`, `gemini` et `opencode` peuvent nécessiter :

```json
"shell": true
```

Claude fonctionne souvent mieux avec :

```json
"command": "claude.exe",
"shell": false
```

## Ollama non joignable

Message typique :

```text
[WARN] Ollama installe mais API non joignable: http://localhost:11434
```

Actions :

```bash
ollama serve
```

Puis relance :

```bash
palabre doctor
```

Si ton Ollama n'écoute pas sur `http://localhost:11434`, corrige `baseUrl` dans l'agent Ollama.

## Modèle Ollama absent

Message typique :

```text
[WARN] ollama-local [ollama:critic] model=... absent.
```

Actions :

```bash
ollama pull le-modele
```

Ou autorise Palabre à le télécharger au lancement du débat :

```bash
palabre codex-ollama "Sujet" --model-b le-modele --pull-models
```

Tu peux aussi l'autoriser dans la config de l'agent :

```json
"autoPullModel": true
```

Attention : certains modèles pèsent plusieurs Go. Sur une machine modeste, privilégie un modèle local raisonnable.

## Ollama ne voit pas mes fichiers

Ollama ne lit pas le filesystem par lui-même. Il reçoit uniquement le prompt construit par Palabre.

Actions :

```bash
palabre codex-ollama "Critique ce module" --files src/module.ts
```

Ou :

```bash
palabre codex-ollama "Critique l'architecture" --context src docs
```

## Limite d'usage Codex, Claude, Gemini ou OpenCode

Message typique :

```text
Erreur: codex a atteint une limite d'utilisation: ...
```

Actions :

- attends l'heure indiquée par la CLI ;
- change de modèle dans ta CLI ou avec `--model-a` / `--model-b` ;
- utilise une autre paire d'agents ;
- désactive temporairement l'agent concerné dans ta config.

## Sortie CLI vide

Message typique :

```text
produced empty output
```

Actions :

- teste la commande hors de Palabre ;
- vérifie que la CLI accepte bien un prompt via `stdin` ou en argument positionnel ;
- ajuste `args`, `promptMode`, `shell` ou `timeoutMs` dans la config.

`allowEmptyOutput` existe, mais il vaut mieux le garder désactivé sauf cas très spécifique.

## Mise à jour

Pour voir les étapes :

```bash
palabre update
```

Pour appliquer depuis un checkout git :

```bash
palabre update --apply
```

Si `update --apply` échoue, vérifie que tu es bien dans un dépôt git Palabre et que `pnpm` est disponible.
