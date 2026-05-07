# PALABRE

<p>
  <a href="https://www.npmjs.com/package/palabre"><img src="https://img.shields.io/npm/v/palabre.svg?style=flat&colorA=18181B&colorB=7C3AED" alt="Version"></a>
  <a href="https://www.npmjs.com/package/palabre"><img src="https://img.shields.io/npm/dm/palabre.svg?style=flat&colorA=18181B&colorB=7C3AED" alt="Downloads"></a>
  <a href="https://github.com/JuReyms/Palabre/blob/main/LICENSE"><img src="https://img.shields.io/github/license/JuReyms/Palabre.svg?style=flat&colorA=18181B&colorB=7C3AED" alt="License"></a>
  <a href="https://palab.re"><img src="https://img.shields.io/badge/docs-palab.re-18181B?logo=netlify&logoColor=7C3AED" alt="Documentation"></a>
</p>

![PALABRE](docs/assets/palabre-logo-text-og.png)

[Français](#français) | [English](#english)

## Français

PALABRE est un orchestrateur CLI qui fait dialoguer plusieurs agents IA installés sur votre machine : Claude Code, Codex CLI, Gemini CLI, OpenCode et Ollama.

Il ne remplace pas vos outils : il les pilote. Vous gardez vos abonnements, vos modèles par défaut, vos habitudes de terminal et vos fichiers en local. PALABRE exporte ensuite le débat en Markdown.

### Documentation

- https://palab.re
- https://palabre.netlify.app

Pages utiles : [Installation](https://palab.re/get-started/installation), [Configuration](https://palab.re/get-started/configuration), [Premier débat](https://palab.re/get-started/first-debate), [Référence CLI](https://palab.re/reference/cli), [Dépannage](https://palab.re/troubleshooting), [Roadmap](https://palab.re/roadmap).

### Installation

Prérequis : Node.js 20 ou plus, et au moins deux agents déjà installés/authentifiés si vous voulez les faire débattre.

```bash
npm install -g palabre
palabre --version
palabre --help
```

### Démarrage rapide

```bash
palabre init
palabre doctor
palabre new
```

Exemples directs :

```bash
palabre codex-claude "Critique ce plan" -t 4
palabre -s "Compare ces deux approches" -t 2
palabre codex-claude "Relis cette architecture" --context src docs
palabre claude-ollama "Critique ce fichier" --files README.md
palabre codex-claude "Preview" --context src --show-prompt
```

### Agents supportés

- Claude Code via `claude --print`
- Codex CLI via `codex exec`
- Gemini CLI via `gemini --prompt -`
- OpenCode via `opencode run`
- Ollama via l'API locale HTTP

PALABRE ne liste pas les modèles : ils changent souvent et dépendent de chaque CLI ou compte utilisateur. `--model-a`, `--model-b` et `--summary-model` transmettent simplement la valeur brute à l'agent concerné.

### Confidentialité

PALABRE tourne localement et n'envoie aucune donnée à un serveur appartenant à PALABRE. Les données envoyées aux agents dépendent des outils que vous utilisez : vérifiez les politiques de confidentialité de Claude Code, Codex CLI, Gemini CLI, OpenCode, Ollama ou de tout autre agent configuré.

### Développement local

```bash
git clone https://github.com/JuReyms/Palabre.git
cd Palabre
pnpm install
pnpm build
pnpm link --global
palabre --version
```

Commandes utiles : `pnpm check`, `pnpm test`, `pnpm build`.

Roadmap publique : [docs/guide/roadmap.md](./docs/guide/roadmap.md). Guide agents/contributeurs : [AGENTS.md](./AGENTS.md).

### Licence

MIT. Voir [LICENSE](./LICENSE).

## English

PALABRE is a CLI orchestrator that lets multiple AI agents installed on your machine talk to each other: Claude Code, Codex CLI, Gemini CLI, OpenCode, and Ollama.

It does not replace your tools: it drives them. You keep your subscriptions, default models, terminal habits, and local files. PALABRE then exports the debate as Markdown.

### Documentation

- https://palab.re
- https://palabre.netlify.app

Useful pages: [Installation](https://palab.re/get-started/installation), [Configuration](https://palab.re/get-started/configuration), [First debate](https://palab.re/get-started/first-debate), [CLI reference](https://palab.re/reference/cli), [Troubleshooting](https://palab.re/troubleshooting), [Roadmap](https://palab.re/roadmap).

### Installation

Requirements: Node.js 20 or newer, and at least two already installed/authenticated agents if you want them to debate.

```bash
npm install -g palabre
palabre --version
palabre --help
```

### Quick Start

```bash
palabre init
palabre doctor
palabre new
```

Direct examples:

```bash
palabre codex-claude "Review this plan" -t 4
palabre -s "Compare these two approaches" -t 2
palabre codex-claude "Review this architecture" --context src docs
palabre claude-ollama "Review this file" --files README.md
palabre codex-claude "Preview" --context src --show-prompt
```

### Supported Agents

- Claude Code via `claude --print`
- Codex CLI via `codex exec`
- Gemini CLI via `gemini --prompt -`
- OpenCode via `opencode run`
- Ollama via the local HTTP API

PALABRE does not list models: they change often and depend on each CLI or user account. `--model-a`, `--model-b`, and `--summary-model` simply pass the raw value to the selected agent.

### Privacy

PALABRE runs locally and does not send data to a PALABRE-owned server. Data sent to agents depends on the tools you use: check the privacy policies of Claude Code, Codex CLI, Gemini CLI, OpenCode, Ollama, or any custom agent you configure.

### Local Development

```bash
git clone https://github.com/JuReyms/Palabre.git
cd Palabre
pnpm install
pnpm build
pnpm link --global
palabre --version
```

Useful commands: `pnpm check`, `pnpm test`, `pnpm build`.

Public roadmap: [docs/guide/roadmap.md](./docs/guide/roadmap.md). Agent/contributor guide: [AGENTS.md](./AGENTS.md).

### License

MIT. See [LICENSE](./LICENSE).
