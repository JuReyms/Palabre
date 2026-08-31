---
title: Utiliser plusieurs agents IA dans le terminal
description: Choisir entre Débat, Chat et Ask pour orchestrer plusieurs agents IA avec une seule CLI et conserver un résultat exploitable.
seo:
  title: CLI multi-agents IA pour débattre et comparer des réponses
  description: Utilisez Palabre comme CLI multi-agents pour faire débattre Codex et Claude Code, comparer jusqu'à quatre réponses ou consulter un second agent.
---

Palabre est une CLI multi-agents qui orchestre les outils IA déjà installés sur votre machine. Il peut faire dialoguer deux agents, comparer plusieurs réponses indépendantes ou vous laisser converser avec un agent tout en consultant ponctuellement un second avis.

Palabre n'est pas un provider supplémentaire. Chaque agent conserve son authentification, son modèle, ses quotas et ses règles d'accès.

## Choisir le bon mode multi-agent

| Mode | Agents | Interaction | Usage principal |
|------|--------|-------------|-----------------|
| Débat | 2 | Les agents se répondent | Challenger une décision et résoudre des désaccords |
| Chat | 1 actif, consultations explicites | Conversation suivie | Avancer avec un agent et demander un second avis au besoin |
| Ask | 1 à 4 | Réponses indépendantes | Comparer plusieurs analyses sans influence mutuelle |

## Faire débattre deux agents

Un débat réinjecte l'historique dans chaque nouveau tour :

```bash
palabre codex-claude "Évalue les risques de cette architecture" -t 4
```

Les presets choisissent une paire et son ordre de parole. Ils ne changent pas automatiquement les modèles ou les rôles configurés.

Consultez le guide [Faire débattre Codex et Claude Code](/fr/usage/codex-claude-debate) pour un workflow complet avec rôles et contexte projet.

## Comparer plusieurs réponses avec Ask

Ask envoie le même sujet à plusieurs agents sans partager leurs réponses intermédiaires :

```bash
palabre ask "Compare ces stratégies de migration" \
  --agents codex claude opencode
```

Une synthèse finale peut ensuite présenter les convergences et les différences. Ask est particulièrement utile lorsque vous voulez éviter qu'une première réponse influence les suivantes.

## Converser et consulter un autre agent

Ouvrez la TUI, puis passez en Chat :

```bash
palabre
```

```text
/chat
/agents codex
```

Utilisez `/consult` lorsque vous souhaitez un avis complémentaire. Chat garde une mémoire bornée des échanges récents et exporte la session avec `/end`.

## Ajouter des agents

Palabre détecte les CLIs connues et synchronise prudemment la configuration :

```bash
palabre config --sync-agents
palabre agents --json
palabre presets --json
```

Les agents supportés incluent notamment [Codex](/fr/agents/codex), [Claude Code](/fr/agents/claude-code), [Antigravity](/fr/agents/antigravity), OpenCode, Mistral Vibe et Ollama.

## Donner du contexte aux agents

Ajoutez des fichiers précis avec `--files` ou scannez un dossier avec `--context` :

```bash
palabre codex-claude "Relis cette implémentation" \
  --context src tests \
  -t 4
```

Les agents CLI peuvent aussi avoir leur propre accès au workspace selon leurs outils. Ollama ne voit que le contexte explicitement injecté par Palabre.

## Conserver une trace exploitable

Chaque session produit un export Markdown sous `.palabre/` :

- `.debate.md` pour Débat ;
- `.ask.md` pour Ask ;
- `.chat.md` pour Chat.

Ces fichiers conservent le sujet, les agents, le transcript et la synthèse éventuelle. Ils constituent une trace partageable et peuvent être consommés par une intégration comme l'extension VS Code.

Continuez avec [Choisir un mode](/fr/usage/running-a-debate), [Contexte et fichiers](/fr/usage/context-and-files) ou la [présentation des agents](/fr/agents/overview).
