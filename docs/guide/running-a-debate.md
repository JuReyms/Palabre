# Lancer un débat

## Mode guidé

```bash
pnpm start -- new
```

`palabre new` compose un débat pas à pas : choix des agents détectés, sujet, puis lancement immédiat avec les défauts ou passage par les options avancées. Le wizard affiche aussi la commande équivalente, pratique pour apprendre la syntaxe CLI.

## Commande de base

```bash
pnpm start -- run --subject "Ton sujet ici"
```

Les agents et le nombre de tours utilisent les valeurs de `defaults` dans ta config.

Une fois Palabre installe globalement, la syntaxe courte est aussi supportee :

```bash
palabre "Ton sujet ici"
palabre -s "Ton sujet ici" -t 2
```

`--subject` est le nom long recommande pour le sujet. `-s` est son alias court, et `--topic` reste accepte pour compatibilite.

---

## Choisir les agents

### Via les agents de ta config

```bash
pnpm start -- run --subject "Refacto de l'auth" --agent-a claude --agent-b codex
```

### Via un preset

Les presets sont des paires d'agents prédéfinies :

```bash
pnpm start -- run --preset codex-claude --subject "Stratégie de cache"
pnpm start -- run --preset claude-ollama --subject "Critique du MVP"
pnpm start -- run --preset gemini-ollama --subject "Gemini comme reviewer ?"
pnpm start -- run --preset claude-opencode --subject "OpenCode comme reviewer ?"
```

Syntaxe courte equivalente :

```bash
palabre claude-gemini "quel jour sommes nous ?" -t 4
```

Presets disponibles : `codex-claude`, `claude-codex`, `codex-ollama`, `claude-ollama`, `gemini-ollama`, `claude-opencode`, `codex-opencode`, `opencode-ollama` et leurs variantes inversées.

> Un preset choisit les agents, pas les modèles. Les modèles restent ceux configurés dans les CLIs.

---

## Nombre de tours

```bash
pnpm start -- run --preset codex-claude --subject "Sujet" --turns 6
palabre codex-claude "Sujet" -t 6
```

`--turns` est une limite haute. Si les agents expriment clairement un accord complet apres un tour complet, Palabre peut s'arreter avant la limite.

Pour forcer exactement le nombre de tours demande :

```bash
pnpm start -- run --preset codex-claude --subject "Sujet" --turns 6 --no-early-stop
```

---

## Choisir un modèle à la volée

```bash
pnpm start -- run --preset codex-claude --model-a 5.5 --model-b opus --subject "Compare les approches"
pnpm start -- run --preset codex-ollama --model-b gemma4:e4b --subject "Critique locale"
```

Palabre transmet la valeur brute à l'agent sans validation. Pour Ollama, il vérifie que le modèle est installé si `validateModel` est actif.

Pour autoriser le téléchargement automatique d'un modèle Ollama manquant :

```bash
pnpm start -- run --preset codex-ollama --model-b nemotron-3-nano:4b --pull-models --subject "Critique locale"
```

---

## Injecter du contexte projet

### Fichiers explicites

```bash
pnpm start -- run --subject "Critique le batch adapter" --files README.md src/adapters/cli.ts --agent-a claude --agent-b ollama-local
```

Les fichiers sont envoyés à tous les agents. Limites actuelles : 64 KiB par fichier, 192 KiB au total. Les dossiers et fichiers binaires sont refusés.

### Scan borné

```bash
pnpm start -- run --preset codex-ollama --subject "Critique l'architecture" --context src docs --turns 2
```

`--context` accepte des fichiers et dossiers, scanne récursivement les fichiers texte, respecte les exclusions courantes et affiche des avertissements pour les fichiers ignorés.

> Si Ollama participe sans `--files` ni `--context`, Palabre affiche un avertissement : Ollama ne lit pas le filesystem, il ne verra que le sujet et le transcript.

---

## Prévisualiser le prompt

Pour voir le prompt exact du premier tour sans lancer le débat :

```bash
pnpm start -- run --preset codex-claude --subject "Preview" --files README.md --show-prompt
pnpm start -- run --preset codex-claude --subject "Preview" --context src docs --show-prompt
```

Le prompt inclut toujours un contexte de session fourni par Palabre :

- date locale ;
- fuseau horaire ;
- dossier courant ;
- horodatage de début de session.

Ce bloc est visible par tous les agents du débat.

---

## Synthèse finale

Par défaut, Palabre demande à `defaults.summaryAgent` de produire une synthèse à la fin du débat. Si ce champ n'existe pas, Palabre utilise l'agent B.

```bash
# Changer l'agent de synthèse
pnpm start -- run --preset codex-claude --subject "Sujet" --summary-agent claude

# Choisir aussi le modèle de synthèse
pnpm start -- run --preset codex-claude --subject "Sujet" --summary-agent ollama-local --summary-model nemotron-3-nano:4b

# Désactiver la synthèse
pnpm start -- run --preset codex-claude --subject "Sujet" --no-summary
```

---

## Rendu console

Le rendu par défaut est un affichage coloré avec en-têtes, séparateurs et état "agent en cours" pendant les générations. Pour un rendu brut compatible avec les logs :

```bash
pnpm start -- run --preset codex-claude --subject "Sujet" --plain
```

Les couleurs sont automatiquement désactivées si la variable d'environnement `NO_COLOR` est définie.

---

## Erreurs de limites CLI

Si Codex, Claude, Gemini ou OpenCode atteint une limite d'usage, un quota ou un rate limit, Palabre affiche une erreur courte avec la ligne utile de la CLI. Le stderr complet reste dans les détails internes de l'erreur, mais le message console évite de recopier tout le prompt.

---

## Export

Chaque session génère un fichier `.debate.md` dans le dossier défini par `outputDir` dans ta config (par défaut : le dossier courant).

L'export inclut aussi une table d'en-tête avec la date locale, le fuseau horaire, le dossier courant, l'horodatage de debut de session, le nombre de tours joues et la raison d'un eventuel arret anticipe.
