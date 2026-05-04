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

Pendant l'initialisation, Chicane détecte `codex`, `claude`, `gemini` et l'API locale Ollama. Quand une paire fiable est trouvée, elle devient le défaut de la config générée.

## Premier débat

```bash
pnpm start -- run --preset codex-claude --subject "Comment structurer l'auth d'une app Nuxt ?"
```

Chicane va faire débattre Codex et Claude sur ce sujet pendant 4 tours (par défaut), puis générer une synthèse finale. La session est exportée dans un fichier `.debate.md`.

Pour donner du contexte projet sans choisir les fichiers un par un :

```bash
pnpm start -- run --preset codex-claude --subject "Critique cette architecture" --context src docs --turns 2
```

`--context` scanne les fichiers texte, respecte les exclusions courantes et affiche des avertissements pour les fichiers ignorés.

## Installation globale locale

Depuis le repo :

```bash
pnpm build
pnpm link --global
chicane --version
```

Tu peux ensuite lancer `chicane` depuis un autre projet.

```bash
chicane codex-claude "Comment structurer l'auth d'une app Nuxt ?" -t 4
chicane -s "Critique rapide" -t 2
```

`--subject` est le nom long recommande pour le sujet. `-s` est son alias court, et `--topic` reste accepte pour compatibilite.

Pour afficher les etapes de mise a jour :

```bash
chicane update
```

Si Chicane est installe depuis ce repo git, tu peux aussi appliquer la mise a jour :

```bash
chicane update --apply
```

## Vérifier l'installation

```bash
pnpm start -- --version
pnpm start -- --help
```
