# Lancer un débat

## Commande de base

```bash
pnpm start -- run --topic "Ton sujet ici"
```

Les agents et le nombre de tours utilisent les valeurs de `defaults` dans ta config.

---

## Choisir les agents

### Via les agents de ta config

```bash
pnpm start -- run --topic "Refacto de l'auth" --agent-a claude --agent-b codex
```

### Via un preset

Les presets sont des paires d'agents prédéfinies :

```bash
pnpm start -- run --preset codex-claude --topic "Stratégie de cache"
pnpm start -- run --preset claude-ollama --topic "Critique du MVP"
pnpm start -- run --preset gemini-ollama --topic "Gemini comme reviewer ?"
```

Presets disponibles : `codex-claude`, `claude-codex`, `codex-ollama`, `claude-ollama`, `gemini-ollama` et leurs variantes inversées.

> Un preset choisit les agents, pas les modèles. Les modèles restent ceux configurés dans les CLIs.

---

## Nombre de tours

```bash
pnpm start -- run --preset codex-claude --topic "Sujet" --turns 6
```

`--turns` est une limite haute. Si les agents expriment clairement un accord complet apres un tour complet, Chicane peut s'arreter avant la limite.

Pour forcer exactement le nombre de tours demande :

```bash
pnpm start -- run --preset codex-claude --topic "Sujet" --turns 6 --no-early-stop
```

---

## Choisir un modèle à la volée

```bash
pnpm start -- run --preset codex-claude --model-a 5.5 --model-b opus --topic "Compare les approches"
pnpm start -- run --preset codex-ollama --model-b gemma4:e4b --topic "Critique locale"
```

Chicane transmet la valeur brute à l'agent sans validation. Pour Ollama, il vérifie que le modèle est installé si `validateModel` est actif.

Pour autoriser le téléchargement automatique d'un modèle Ollama manquant :

```bash
pnpm start -- run --preset codex-ollama --model-b nemotron-3-nano:4b --pull-models --topic "Critique locale"
```

---

## Injecter du contexte projet

### Fichiers explicites

```bash
pnpm start -- run --topic "Critique le batch adapter" --files README.md src/adapters/cli.ts --agent-a claude --agent-b ollama-local
```

Les fichiers sont envoyés à tous les agents. Limites actuelles : 64 KiB par fichier, 192 KiB au total. Les dossiers et fichiers binaires sont refusés.

### Scan borné

```bash
pnpm start -- run --preset codex-ollama --topic "Critique l'architecture" --context src docs --turns 2
```

`--context` accepte des fichiers et dossiers, scanne récursivement les fichiers texte, respecte les exclusions courantes et affiche des avertissements pour les fichiers ignorés.

> Si Ollama participe sans `--files` ni `--context`, Chicane affiche un avertissement : Ollama ne lit pas le filesystem, il ne verra que le sujet et le transcript.

---

## Prévisualiser le prompt

Pour voir le prompt exact du premier tour sans lancer le débat :

```bash
pnpm start -- run --preset codex-claude --topic "Preview" --files README.md --show-prompt
pnpm start -- run --preset codex-claude --topic "Preview" --context src docs --show-prompt
```

Le prompt inclut toujours un contexte de session fourni par Chicane :

- date locale ;
- fuseau horaire ;
- dossier courant ;
- horodatage de début de session.

Ce bloc est visible par tous les agents du débat.

---

## Synthèse finale

Par défaut, Chicane demande à l'agent B de produire une synthèse à la fin du débat.

```bash
# Changer l'agent de synthèse
pnpm start -- run --preset codex-claude --topic "Sujet" --summary-agent claude

# Choisir aussi le modèle de synthèse
pnpm start -- run --preset codex-claude --topic "Sujet" --summary-agent ollama-local --summary-model nemotron-3-nano:4b

# Désactiver la synthèse
pnpm start -- run --preset codex-claude --topic "Sujet" --no-summary
```

---

## Rendu console

Le rendu par défaut est un affichage coloré avec en-têtes, séparateurs et état "agent en cours" pendant les générations. Pour un rendu brut compatible avec les logs :

```bash
pnpm start -- run --preset codex-claude --topic "Sujet" --plain
```

Les couleurs sont automatiquement désactivées si la variable d'environnement `NO_COLOR` est définie.

---

## Export

Chaque session génère un fichier `.debate.md` dans le dossier défini par `outputDir` dans ta config (par défaut : le dossier courant).

L'export inclut aussi la date locale, le fuseau horaire, le dossier courant, l'horodatage de debut de session, le nombre de tours joues et la raison d'un eventuel arret anticipe.
