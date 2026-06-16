---
title: Installation
description: Installer Palabre depuis npm, vérifier la commande et préparer les agents IA utilisés par les débats.
---

## Prérequis

Palabre nécessite :

- Node.js 20 ou plus ;
- au moins deux agents déjà installés sur votre machine parmi Claude Code, Codex CLI, Gemini CLI, Antigravity CLI, OpenCode, Mistral Vibe ou Ollama.

Vous pouvez utiliser Palabre avec un seul agent configuré, mais l'intérêt principal est de faire dialoguer deux agents.

## Installer Palabre

Depuis npm :

```bash
npm install -g palabre
```

Vérifiez ensuite que la commande est disponible :

```bash
palabre --version
palabre --help
```

## Installer depuis le dépôt source

Cette section concerne les personnes qui veulent tester Palabre depuis le dépôt Git. Elle nécessite `pnpm`.

```bash
pnpm install
pnpm build
pnpm link --global
palabre --version
```

Dans le reste de cette documentation, les exemples utilisent toujours la commande utilisateur finale `palabre`.

## Installer les agents

Palabre pilote des outils externes. Installez et authentifiez les agents que vous souhaitez utiliser avant de lancer Palabre.

**OpenCode** et **Gemini** peuvent être utilisés gratuitement avec certains modèles et des limites propres à leurs providers, tandis que **Claude Code** et **Codex** nécessitent un abonnement.

**Ollama** est gratuit en utilisation locale. Si vous utilisez une offre cloud ou distante, les quotas et limites viennent de cette offre, pas de Palabre.

Pages utiles :

- [Claude Code](/fr/agents/claude-code)
- [Codex](/fr/agents/codex)
- [Gemini](/fr/agents/gemini)
- [Antigravity](/fr/agents/antigravity)
- [OpenCode](/fr/agents/opencode)
- [Mistral Vibe](/fr/agents/vibe)
- [Ollama](/fr/agents/ollama)

## Étape suivante

Lancez maintenant [la première configuration](/fr/get-started/configuration). Si vous utilisez VS Code, vous pouvez aussi installer [l'extension Palabre](/fr/get-started/vscode-extension). Pour piloter Palabre depuis un agent IA, installez [le skill Palabre](/fr/get-started/skill).
