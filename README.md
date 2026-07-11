# PALABRE

<p>
  <a href="https://www.npmjs.com/package/palabre"><img src="https://img.shields.io/npm/v/palabre.svg?style=flat&colorA=18181B&colorB=7C3AED" alt="Version"></a>
  <a href="https://www.npmjs.com/package/palabre"><img src="https://img.shields.io/npm/dm/palabre.svg?style=flat&colorA=18181B&colorB=7C3AED" alt="Downloads"></a>
  <a href="https://github.com/JuReyms/Palabre/blob/main/LICENSE"><img src="https://img.shields.io/github/license/JuReyms/Palabre.svg?style=flat&colorA=18181B&colorB=7C3AED" alt="License"></a>
  <a href="https://palab.re"><img src="https://img.shields.io/badge/docs-palab.re-18181B?logo=netlify&logoColor=7C3AED" alt="Documentation"></a>
  <a href="https://marketplace.visualstudio.com/items?itemName=JuReyms.palabre-vscode"><img src="https://img.shields.io/badge/VS%20Code-Marketplace-7C3AED?style=flat&colorA=18181B&logo=visualstudiocode&logoColor=white" alt="VS Code Marketplace"></a>
</p>

![Palabre CLI orchestrating a debate between AI agents](docs/assets/palabre-cli-orchestre-debates-between-AI-agents.png)

[English](#english) | [Français](#français)

## English

PALABRE is a TUI-first CLI orchestrator that lets multiple AI agents installed on your machine work together: Claude Code, Codex CLI, Antigravity CLI, OpenCode, Mistral Vibe, and Ollama.

It does not replace your tools: it drives them. You keep your subscriptions, default models, terminal habits, and local files. Run `palabre` to open the interactive TUI, then launch a Debate between two agents or an Ask session where several agents answer independently before a comparative summary. PALABRE exports each session as Markdown.

PALABRE helps you make better decisions before acting: it is a harness for orchestrated collective intelligence. A session can consult one or several agents, make a decision explicit through a synthesis, then optionally prepare an action that always remains under your control.

### Documentation

- https://palab.re
- https://palabre.netlify.app

Useful pages: [Installation](https://palab.re/en/get-started/installation), [Configuration](https://palab.re/en/get-started/configuration), [First session](https://palab.re/en/get-started/first-debate), [CLI reference](https://palab.re/en/reference/cli), [Troubleshooting](https://palab.re/en/troubleshooting), [Roadmap](https://palab.re/en/roadmap).

### Installation

Requirements: Node.js 20 or newer, and at least two already installed/authenticated agents if you want them to debate.

```bash
npm install -g palabre
# or: pnpm add --global palabre
# or: yarn global add palabre
# or: bun add --global palabre
palabre --version
palabre --help
```

### Quick Start

```bash
palabre doctor
palabre
```

Scriptable CLI examples:

```bash
palabre codex-claude "Review this plan" -t 4
palabre ask "Compare these two approaches" --agents codex claude opencode
palabre -s "Compare these two approaches" -t 2
palabre codex-claude "Review this architecture" --context src docs
palabre claude-ollama "Review this file" --files README.md
palabre codex-claude "Preview" --context src --show-prompt
palabre context scan src docs --json
```

In an interactive terminal, `palabre` opens the TUI by default. The home screen creates the global config on first launch when needed, refreshes detected known agents, and gives you a composer for Debate or Ask sessions. `/ask` switches from debate to independent answers, `/agents` and `/roles` help you choose the active setup, `/history` shows recent exports, and `/home` returns to the home screen. `--terminal` forces the raw renderer for logs and scripts. `palabre init` remains available for explicit setup, especially with `--local`.

### VS Code extension

Prefer a visual workflow inside your editor? Install [Palabre for VS Code](https://marketplace.visualstudio.com/items?itemName=JuReyms.palabre-vscode). The extension opens a Palabre sidebar, lets you choose Debate or Ask sessions, attach workspace context, follow the conversation live, and open the Markdown export from VS Code.

It remains a thin client: the extension launches the local `palabre` CLI and consumes the public JSON/NDJSON contracts documented below.

### Supported Agents

- Claude Code via `claude --print`
- Codex CLI via `codex exec`
- Antigravity CLI via `agy --print` in a pseudo-terminal
- OpenCode via `opencode run`
- Mistral Vibe via `vibe --output text --trust --prompt`
- Ollama via the local HTTP API

PALABRE does not list models: they change often and depend on each CLI or user account. `--model-a`, `--model-b`, and `--summary-model` simply pass the raw value to the selected agent.

### Integrations

PALABRE exposes versioned JSON outputs for external clients:

- `palabre agents --json` to read configured agents and CLI-owned availability;
- `palabre presets --json` to read available agent pairs;
- `palabre context scan --json` to preview the context `--context` would retain;
- `--renderer ndjson` or `--json` to follow a debate event by event.

The NDJSON v1 stream is treated as a public integration API. Compatible additions do not break v1; breaking changes must change the `v` field.

### Skill for AI agents

PALABRE ships a ready-to-use skill that teaches an AI agent when and how to run Palabre sessions. It follows the open [agentskills.io](https://agentskills.io) standard, so it is portable across Hermes Agent, Claude, Codex, and any skills-compatible agent.

Install it in **Hermes Agent**:

```bash
hermes skills install JuReyms/Palabre/skills/palabre
```

For other agents (Claude desktop, Claude Code…), see the docs: [Palabre skill](https://palab.re/en/get-started/skill).

The skill is versioned under [skills/palabre](./skills/palabre).

### Privacy

PALABRE runs locally and does not send data to a PALABRE-owned server. Data sent to agents depends on the tools you use: check the privacy policies of Claude Code, Codex CLI, Antigravity CLI, OpenCode, Mistral Vibe, Ollama, or any custom agent you configure.

If an agent fails during the debate or final summary, PALABRE keeps the partial Markdown export with an interruption section whenever possible.

### Contributing / local development

```bash
git clone https://github.com/JuReyms/Palabre.git
cd Palabre
pnpm install
pnpm build
pnpm link --global
palabre --version
```

Useful commands: `pnpm check`, `pnpm test`, `pnpm build`.

Before publishing, `pnpm smoke:real-presets -- --mode both --keep-going` runs real Debate and Ask sessions for the 10 active priority CLI pairs to validate the full agent → NDJSON → summary → export flow. This smoke test calls real AI CLIs and may consume quota, so it is not part of `pnpm test`.

Public roadmap: [docs/guide/fr/roadmap.md](./docs/guide/fr/roadmap.md). Changes: [CHANGELOG.md](./CHANGELOG.md). Agent/contributor guide: [AGENTS.md](./AGENTS.md).

### License

MIT. See [LICENSE](./LICENSE).

![PALABRE](docs/assets/palabre-logo-text-og.png)

## Français

PALABRE est un orchestrateur CLI orienté TUI qui fait travailler plusieurs agents IA installés sur votre machine : Claude Code, Codex CLI, Antigravity CLI, OpenCode, Mistral Vibe et Ollama.

Il ne remplace pas vos outils : il les pilote. Vous gardez vos abonnements, vos modèles par défaut, vos habitudes de terminal et vos fichiers en local. Lancez `palabre` pour ouvrir la TUI interactive, puis démarrez un débat entre deux agents ou une demande Ask où plusieurs agents répondent indépendamment avant une synthèse comparative. PALABRE exporte chaque session en Markdown.

PALABRE aide à mieux décider avant d’agir : c’est un harnais d’intelligence collective orchestrée. Une session permet de consulter un ou plusieurs agents, de rendre une décision explicite grâce à une synthèse, puis éventuellement de préparer une action qui reste toujours sous votre contrôle.

### Documentation

- https://palab.re
- https://palabre.netlify.app

Pages utiles : [Installation](https://palab.re/fr/get-started/installation), [Configuration](https://palab.re/fr/get-started/configuration), [Première session](https://palab.re/fr/get-started/first-debate), [Référence CLI](https://palab.re/fr/reference/cli), [Dépannage](https://palab.re/fr/troubleshooting), [Roadmap](https://palab.re/fr/roadmap).

### Installation

Prérequis : Node.js 20 ou plus, et au moins deux agents déjà installés/authentifiés si vous voulez les faire débattre.

```bash
npm install -g palabre
# ou : pnpm add --global palabre
# ou : yarn global add palabre
# ou : bun add --global palabre
palabre --version
palabre --help
```

### Démarrage rapide

```bash
palabre doctor
palabre
```

Exemples CLI scriptables :

```bash
palabre codex-claude "Critique ce plan" -t 4
palabre ask "Compare ces deux approches" --agents codex claude opencode
palabre -s "Compare ces deux approches" -t 2
palabre codex-claude "Relis cette architecture" --context src docs
palabre claude-ollama "Critique ce fichier" --files README.md
palabre codex-claude "Preview" --context src --show-prompt
palabre context scan src docs --json
```

Dans un terminal interactif, `palabre` ouvre la TUI par défaut. L'accueil crée la config globale au premier lancement si nécessaire, rafraîchit les agents connus détectés et fournit un composer pour les sessions Débat ou Ask. `/ask` passe du débat aux réponses indépendantes, `/agents` et `/roles` aident à choisir la configuration courante, `/history` affiche les derniers exports, et `/home` revient à l'accueil. `--terminal` force le rendu brut pour les logs et les scripts. `palabre init` reste disponible pour un setup explicite, notamment avec `--local`.

### Extension VS Code

Vous préférez piloter Palabre depuis l'éditeur ? Installez [Palabre pour VS Code](https://marketplace.visualstudio.com/items?itemName=JuReyms.palabre-vscode). L'extension ajoute une barre latérale Palabre, permet de choisir Débat ou Ask, d'ajouter du contexte de workspace, de suivre la conversation en direct et d'ouvrir l'export Markdown depuis VS Code.

Elle reste un client mince : l'extension lance le CLI local `palabre` et consomme les contrats JSON/NDJSON publics documentés ci-dessous.

### Agents supportés

- Claude Code via `claude --print`
- Codex CLI via `codex exec`
- Antigravity CLI via `agy --print` en pseudo-terminal
- OpenCode via `opencode run`
- Mistral Vibe via `vibe --output text --trust --prompt`
- Ollama via l'API locale HTTP

PALABRE ne liste pas les modèles : ils changent souvent et dépendent de chaque CLI ou compte utilisateur. `--model-a`, `--model-b` et `--summary-model` transmettent simplement la valeur brute à l'agent concerné.

### Intégrations

PALABRE expose des sorties JSON versionnées pour les clients externes :

- `palabre agents --json` pour lire les agents configurés et leur disponibilité calculée par le CLI ;
- `palabre presets --json` pour lire les paires d'agents disponibles ;
- `palabre context scan --json` pour prévisualiser le contexte que `--context` retiendrait ;
- `--renderer ndjson` ou `--json` pour suivre un débat événement par événement.

Le flux NDJSON v1 est traité comme une API publique d'intégration. Les ajouts compatibles se font sans casser v1 ; les changements cassants doivent changer le champ `v`.

### Skill pour agents IA

PALABRE fournit un skill prêt à l'emploi qui apprend à un agent IA quand et comment lancer des sessions Palabre. Il suit le standard ouvert [agentskills.io](https://agentskills.io) : il est donc portable entre Hermes Agent, Claude, Codex et tout agent compatible skills.

Installation dans **Hermes Agent** :

```bash
hermes skills install JuReyms/Palabre/skills/palabre
```

Pour les autres agents (Claude desktop, Claude Code…), voir la doc : [Skill Palabre](https://palab.re/fr/get-started/skill).

Le skill est versionné dans [skills/palabre](./skills/palabre).

### Confidentialité

PALABRE tourne localement et n'envoie aucune donnée à un serveur appartenant à PALABRE. Les données envoyées aux agents dépendent des outils que vous utilisez : vérifiez les politiques de confidentialité de Claude Code, Codex CLI, Antigravity CLI, OpenCode, Mistral Vibe, Ollama ou de tout autre agent configuré.

Si un agent échoue pendant le débat ou la synthèse, PALABRE conserve l'export Markdown partiel avec une section d'interruption quand c'est possible.

### Contribution / développement local

```bash
git clone https://github.com/JuReyms/Palabre.git
cd Palabre
pnpm install
pnpm build
pnpm link --global
palabre --version
```

Commandes utiles : `pnpm check`, `pnpm test`, `pnpm build`.

Avant une publication, `pnpm smoke:real-presets -- --mode both --keep-going` lance des sessions Debate et Ask réelles sur les 10 paires CLI prioritaires actives afin de vérifier le flux complet agent → NDJSON → synthèse → export. Ce smoke test appelle de vraies CLIs IA et peut consommer des quotas ; il n'est donc pas lancé par `pnpm test`.

Roadmap publique : [docs/guide/fr/roadmap.md](./docs/guide/fr/roadmap.md). Changements : [CHANGELOG.md](./CHANGELOG.md). Guide agents/contributeurs : [AGENTS.md](./AGENTS.md).

### Licence

MIT. Voir [LICENSE](./LICENSE).
