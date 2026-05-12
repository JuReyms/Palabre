---
title: Dépannage
description: Résoudre les problèmes courants de configuration, de détection d'agents, d'Ollama ou de limites d'usage.
---

Commencez par lancer le diagnostic :

```bash
palabre doctor
```

`doctor` ne lance aucun agent IA. Il affiche un diagnostic par sections : configuration, outils locaux, agents et points à vérifier. Il contrôle les agents déclarés, les paramètres par défaut, le nombre de réponses, `outputDir`, les CLIs disponibles, Ollama et les modèles configurés.

Pour obtenir une sortie brute adaptée aux logs ou aux scripts :

```bash
palabre doctor --plain
```

## Palabre ne trouve pas ma configuration

Message typique :

```text
[ERREUR] Config absente: ...
```

Créez une configuration :

```bash
palabre init
```

ou une configuration locale au projet courant :

```bash
palabre init --local
```

## La configuration est illisible

Message typique :

```text
[ERREUR] Config illisible: ...
```

Vérifiez que le JSON ne contient pas de virgule finale, que les clés sont entre guillemets et que le fichier est bien encodé en UTF-8.

Pour repartir d'une configuration propre :

```bash
palabre init --config ./nouvelle-config.json
```

## Un agent par défaut est inconnu

Message typique :

```text
[ERREUR] defaults.agentA pointe vers un agent inconnu: ...
```

Listez les agents disponibles :

```bash
palabre agents
```

Puis corrigez les agents par défaut :

```bash
palabre config --set-defaults codex claude
```

## Un agent installé n'apparaît pas dans la config

Message typique :

```text
[WARN] Agent(s) detecte(s) mais absent(s) de la config: opencode.
```

Synchronisez les agents détectés :

```bash
palabre config --sync-agents
```

Cette commande ajoute les agents manquants sans écraser vos réglages existants.

## Le nombre de réponses par défaut est invalide

Message typique :

```text
[ERREUR] defaults.turns invalide: 99.
```

Choisissez un nombre entre 1 et 20 :

```bash
palabre config -t 4
```

## Le dossier d'export pose problème

Message typique :

```text
[ERREUR] outputDir pointe vers un fichier, pas un dossier: ...
```

Corrigez `outputDir` dans `palabre.config.json`, ou supprimez ce champ pour écrire les exports dans le dossier `.palabre/` par défaut.
## Une CLI est introuvable

Message typique :

```text
[WARN] Codex CLI: non détecté dans PATH.
```

Actions :

- installez la CLI concernée ;
- authentifiez-la hors de Palabre ;
- fermez et rouvrez le terminal ;
- relancez `palabre doctor` ;
- corrigez `command` dans la configuration si la commande porte un autre nom.

Sur Windows, les wrappers npm ou PowerShell comme `codex`, `gemini` et `opencode` peuvent nécessiter `shell: true` dans la configuration.

Claude fonctionne souvent mieux avec `claude.exe` et `shell: false`.

## Ollama ne répond pas

Message typique :

```text
[WARN] Ollama installé mais API non joignable: http://localhost:11434
```

Démarrez Ollama :

```bash
ollama serve
```

Puis relancez :

```bash
palabre doctor
```

Si Ollama utilise une autre URL, corrigez `baseUrl` dans l'agent Ollama.

## Le modèle Ollama est absent

Message typique :

```text
[WARN] ollama-local [ollama:critic] model=... absent.
```

Installez le modèle :

```bash
ollama pull le-modele
```

ou autorisez Palabre à le télécharger au lancement :

```bash
palabre codex-ollama "Sujet" --model-b le-modele --pull-models
```

Certains modèles pèsent plusieurs Go. Sur une machine modeste, privilégiez un modèle local raisonnable.

## Ollama ne voit pas mes fichiers

Ollama ne lit pas le filesystem directement. Ajoutez le contexte au prompt :

```bash
palabre codex-ollama "Critique ce module" --files src/module.ts
```

ou :

```bash
palabre codex-ollama "Critique l'architecture" --context src docs
```

## Une CLI atteint une limite d'usage

Message typique :

```text
Erreur: codex a atteint une limite d'utilisation: ...
```

Actions possibles :

- attendez l'heure indiquée par la CLI ;
- changez de modèle dans la CLI ou avec `--model-a` / `--model-b` ;
- utilisez une autre paire d'agents ;
- désactivez temporairement l'agent concerné dans votre configuration.

## La sortie d'un agent est vide

Message typique :

```text
produced empty output
```

Testez la commande hors de Palabre, puis vérifiez `args`, `promptMode`, `shell` et les timeouts dans la configuration.

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

`update --apply` concerne surtout les installations depuis le dépôt source.
