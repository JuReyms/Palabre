---
title: Installation
description: Installer Palabre depuis npm, vérifier la commande et préparer les agents IA utilisés par les débats et demandes Ask.
---

## Prérequis

Palabre nécessite :

- Node.js 20 ou plus ;
- au moins un agent déjà installé sur votre machine parmi Claude Code, Codex CLI, Antigravity CLI, OpenCode, Mistral Vibe ou Ollama.

Deux agents ou plus sont recommandés : un débat a besoin d'une paire, et le mode Ask devient surtout utile quand plusieurs réponses indépendantes sont comparées.

## Installer Palabre

Palabre est publié comme package Node.js sur npm. Installez-le globalement avec le gestionnaire de paquets de votre choix :

```bash
# npm
npm install --global palabre

# pnpm
pnpm add --global palabre

# Yarn
yarn global add palabre

# Bun
bun add --global palabre
```

Palabre n'est pas un package Python : `pip` ne peut pas l'installer. Il n'existe pas non plus d'installateur officiel via `curl` ; n'utilisez pas de commande `curl ... | sh` non documentée.

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

**OpenCode**, **Mistral Vibe** et **Ollama** peuvent être utilisés avec des modèles ou limites propres à leurs providers, tandis que **Claude Code** et **Codex** nécessitent généralement un abonnement.

**Ollama** est gratuit en utilisation locale. Si vous utilisez une offre cloud ou distante, les quotas et limites viennent de cette offre, pas de Palabre.

Pages utiles :

- [Claude Code](/fr/agents/claude-code)
- [Codex](/fr/agents/codex)
- [Antigravity](/fr/agents/antigravity)
- [OpenCode](/fr/agents/opencode)
- [Mistral Vibe](/fr/agents/vibe)
- [Ollama](/fr/agents/ollama)

## Étape suivante

Lancez maintenant `palabre` dans un terminal interactif. Au premier lancement, Palabre crée la configuration globale si nécessaire, détecte les agents installés et ouvre l'accueil TUI.

Pour un setup explicite, des scripts ou une configuration locale au projet, consultez [la configuration](/fr/get-started/configuration). Si vous utilisez VS Code, vous pouvez aussi installer [l'extension Palabre](/fr/get-started/vscode-extension). Pour piloter Palabre depuis un agent IA, installez [le skill Palabre](/fr/get-started/skill).
