# Installation

Cette page décrit l'installation pour un utilisateur final.

## Prérequis

Palabre nécessite :

- Node.js 20 ou plus ;
- au moins deux agents utilisables parmi Claude Code, Codex CLI, Gemini CLI, OpenCode ou Ollama.

Vous pouvez utiliser Palabre avec un seul agent configuré, mais l'intérêt principal est de faire dialoguer deux agents.

## Installer Palabre

Quand le package est disponible sur npm :

```bash
npm install -g palabre
```

Vérifiez ensuite que la commande est disponible :

```bash
palabre --version
palabre --help
```

## Installer depuis le dépôt source

Cette section concerne les personnes qui veulent tester Palabre depuis le dépôt Git.

```bash
pnpm install
pnpm build
pnpm link --global
palabre --version
```

Dans le reste de cette documentation, les exemples utilisent toujours la commande utilisateur finale `palabre`.

## Installer les agents

Palabre pilote des outils externes. Installez et authentifiez les agents que vous souhaitez utiliser avant de lancer Palabre.

Pages utiles :

- [Claude Code](/agents/claude-code)
- [Codex](/agents/codex)
- [Gemini](/agents/gemini)
- [OpenCode](/agents/opencode)
- [Ollama](/agents/ollama)

## Étape suivante

Lancez maintenant [la première configuration](/get-started/configuration).
