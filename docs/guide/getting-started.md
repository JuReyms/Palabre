# Démarrage rapide

## Prérequis

- Node.js 20 ou plus
- pnpm 10
- Au moins un agent IA installé et configuré sur ta machine :
  - [Claude Code](https://claude.ai/code) (`claude` ou `claude.exe`)
  - [Codex CLI](https://github.com/openai/codex) (`codex`)
  - [Gemini CLI](https://github.com/google-gemini/gemini-cli) (`gemini`)
  - [Ollama](https://ollama.com) pour les modèles locaux

## Installation

```bash
pnpm install
pnpm build
```

## Initialiser la configuration

```bash
pnpm start -- init
```

Cette commande crée un fichier `chicane.config.json` dans le dossier courant si il n'existe pas encore. Tu peux ensuite l'éditer pour y déclarer tes agents.

## Premier débat

```bash
pnpm start -- run --preset codex-claude --topic "Comment structurer l'auth d'une app Nuxt ?"
```

Chicane va faire débattre Codex et Claude sur ce sujet pendant 4 tours (par défaut), puis générer une synthèse finale. La session est exportée dans un fichier `.debate.md`.

## Vérifier l'installation

```bash
pnpm start -- --version
pnpm start -- --help
```
