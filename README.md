# PALABRE

<p>
  <a href="https://www.npmjs.com/package/palabre"><img src="https://img.shields.io/npm/v/palabre.svg?style=flat&colorA=18181B&colorB=7C3AED" alt="Version"></a>
  <a href="https://www.npmjs.com/package/palabre"><img src="https://img.shields.io/npm/dm/palabre.svg?style=flat&colorA=18181B&colorB=7C3AED" alt="Downloads"></a>
  <a href="https://github.com/JuReyms/Palabre/blob/main/LICENSE"><img src="https://img.shields.io/github/license/JuReyms/Palabre.svg?style=flat&colorA=18181B&colorB=7C3AED" alt="License"></a>
  <a href="https://palab.re"><img src="https://img.shields.io/badge/docs-palab.re-18181B?logo=netlify&logoColor=7C3AED" alt="Documentation"></a>
  <a href="https://marketplace.visualstudio.com/items?itemName=JuReyms.palabre-vscode"><img src="https://img.shields.io/badge/VS%20Code-Marketplace-7C3AED?style=flat&colorA=18181B&logo=visualstudiocode&logoColor=white" alt="VS Code Marketplace"></a>
</p>

![PALABRE](docs/assets/palabre-logo-text-og.png)

[English](#english) | [Français](#français)

## English

**Let your AI tools work together. Compare their views. Make better decisions.**

From your usual tools, Palabre lets you delegate a task, bring another tool's reply back, collect independent opinions or work through disagreements. You decide what happens next.

### Tools, models, agents: what do we mean?

Claude Code, Codex, Antigravity CLI, OpenCode and Mistral Vibe are examples of **AI tools**. **Models** are the engines those tools use; some tools offer models from several providers. In Palabre's configuration, an **agent** is a named entry connected to one of these tools, or to Ollama for local models. It is not one of the tool's internal subagents. Multiple entries can use the same tool with different settings.

### Relay: cooperate from your usual conversation

Ask the tool you are talking to to consult a teammate, then bring the reply back — without copying messages between windows yourself.

```text
You → Your tool (lead) → Palabre Relay → Teammate
          ↑                               │
          └────────── reply ───────────────┘
```

For example, from Codex:

> Use Palabre to ask Claude Code to review these changes without modifying files. Explain its findings and any disagreements.

Relay can create a new conversation or reach the exact one you designate. Each send is explicit; it does not start an autonomous conversation loop. The [Palabre skill](https://palab.re/en/get-started/skill) teaches your host tool how to choose the route, retain the target and explain the result.

**Current Relay scope:** Claude Code or Codex can lead. Codex targets can be closed or open; Claude Code targets must be closed for a supported send. Opening to view is separate from sending. Platform requirements and the OpenCode pilot: [Relay guide](https://palab.re/en/usage/relay).

### Other ways to consult and decide

| Mode | When it helps | Shape |
| --- | --- | --- |
| **Debate** | Work through two positions and their disagreements. | `A ↔ B → summary` |
| **Ask** | Compare 1–4 independent opinions, without mutual influence. | `question → separate answers → comparison` |
| **Chat** | Advance with one interlocutor and occasionally request another opinion. | `you ↔ A`, with a one-off consultation of B |

These three modes support Claude Code, Codex, Antigravity CLI, OpenCode, Mistral Vibe and Ollama, according to your configuration; this does not mean each is a Relay target.

**Roles complement Debate, Ask and Chat.** For example, an `implementer` proposes a solution while a `reviewer` looks for risks. Roles change the instruction, not the model or permissions. They do not configure Relay; “lead” and “teammate” describe coordination instead. [Roles and configuration](https://palab.re/en/get-started/configuration).

### Install and try

The commands below require Node.js 20+ and pnpm — [other package managers](https://palab.re/en/get-started/installation). You also need an installed, authenticated AI tool (or a configured local Ollama model). A Debate needs two configured agents. Your tools' own subscriptions, costs and quotas still apply.

```powershell
pnpm add --global palabre
palabre
```

The first interactive launch creates the global configuration if needed and detects installed tools. Use `palabre doctor` for diagnostics.

To use Relay from your host tool, install its skill, then reload the skill in that host:

```powershell
palabre skill --install codex
# For Claude Code instead: palabre skill --install claude
```

Or request a review directly from your terminal, after setup:

```powershell
palabre relay --new --background --to claude --subject "Review the plan" "Read docs/plan.md without changing files."
```

[Your first Relay](https://palab.re/en/get-started/first-relay) · [Installation and other package managers](https://palab.re/en/get-started/installation)

For a Debate from the terminal:

```powershell
palabre codex-claude --mode debate "Challenge this plan" -t 4 --files docs/plan.md
```

### What stays under your control

- Relay messages grant no rights. Ordinary background Codex/Claude calls restrict tools; an open Codex target keeps that conversation's permissions. No automatic resend after uncertain delivery.
- Palabre runs locally, without a Palabre-owned server. Prompts and context still go to the tools you choose and, where applicable, their remote services. Local Ollama models can keep inference on your machine.
- Markdown exports make exchanges reviewable. Mission, `--task review` and experimental `--write` are frozen and outside the default path.

### Documentation and integrations

Full documentation: **[palab.re](https://palab.re/en)** — [Relay](https://palab.re/en/usage/relay), [Debate](https://palab.re/en/get-started/first-debate), [CLI reference](https://palab.re/en/reference/cli), [Troubleshooting](https://palab.re/en/troubleshooting).

[VS Code extension](https://marketplace.visualstudio.com/items?itemName=JuReyms.palabre-vscode): Debate, Ask and Chat from a sidebar. [Integration contracts](https://palab.re/en/integrations/ndjson): JSON/NDJSON for other clients.

[Contributing and local development](./AGENTS.md) · [Changelog](./CHANGELOG.md) · [Roadmap](https://palab.re/en/roadmap) · [MIT license](./LICENSE)

## Français

**Faites coopérer vos outils IA. Croisez leurs avis. Décidez de la suite.**

Depuis vos outils habituels, Palabre permet de confier une tâche, de récupérer la réponse d'un autre outil, de recueillir des avis indépendants ou de travailler les désaccords. Vous gardez la décision.

### Outils, modèles, agents : de quoi parle-t-on ?

Claude Code, Codex, Antigravity CLI, OpenCode et Mistral Vibe sont des exemples d'**outils IA**. Les **modèles** sont les moteurs qu'ils utilisent ; certains outils proposent des modèles de plusieurs fournisseurs. Dans la configuration Palabre, un **agent** est une entrée nommée reliée à l'un de ces outils, ou à Ollama pour des modèles locaux. Ce n'est pas un sous-agent interne de l'outil. Plusieurs entrées peuvent utiliser le même outil avec des réglages différents.

### Relay : coopérer depuis votre conversation habituelle

Demandez à l'outil avec lequel vous échangez de consulter un équipier, puis de vous rapporter sa réponse — sans copier vous-même les messages entre les fenêtres.

```text
Vous → Votre outil (chef de mission) → Palabre Relay → Équipier
               ↑                                       │
               └────────────── réponse ─────────────────┘
```

Par exemple, depuis Codex :

> Avec Palabre, demande à Claude Code de relire ces changements sans modifier de fichier. Explique-moi ses remarques et les éventuels désaccords.

Relay peut créer une nouvelle conversation ou joindre celle que vous désignez précisément. Chaque envoi est explicite ; il ne déclenche pas de boucle autonome entre les conversations. Le [skill Palabre](https://palab.re/fr/get-started/skill) apprend à votre outil hôte à choisir le parcours, garder la cible et restituer le résultat.

**Périmètre Relay actuel :** Claude Code ou Codex peut être chef de mission. Une cible Codex peut être fermée ou ouverte ; une cible Claude Code doit être fermée pour un envoi pris en charge. Ouvrir pour consulter reste distinct d'envoyer. Prérequis par plateforme et pilote OpenCode : [guide Relay](https://palab.re/fr/usage/relay).

### D'autres façons de consulter et décider

| Mode | Quand l'utiliser | Schéma |
| --- | --- | --- |
| **Débat** | Travailler deux positions et leurs désaccords. | `A ↔ B → synthèse` |
| **Ask** | Comparer 1 à 4 avis indépendants, sans influence mutuelle. | `question → réponses séparées → comparaison` |
| **Chat** | Avancer avec un interlocuteur et demander parfois un autre avis. | `vous ↔ A`, avec consultation ponctuelle de B |

Ces trois modes prennent en charge Claude Code, Codex, Antigravity CLI, OpenCode, Mistral Vibe et Ollama selon votre configuration ; cela ne signifie pas que chacun est une cible Relay.

**Les rôles complètent Débat, Ask et Chat.** Par exemple, un `implementer` propose une solution et un `reviewer` cherche les risques. Ils changent la consigne, pas le modèle ni les permissions. Ils ne règlent pas Relay ; « chef de mission » et « équipier » décrivent plutôt la coordination. [Rôles et configuration](https://palab.re/fr/get-started/configuration).

### Installer et essayer

Pour les commandes ci-dessous : Node.js 20+ et pnpm — [autres gestionnaires de paquets](https://palab.re/fr/get-started/installation). Il faut aussi un outil IA installé et connecté (ou un modèle Ollama local configuré). Un Débat demande deux agents configurés. Les abonnements, coûts et quotas propres à vos outils continuent de s'appliquer.

```powershell
pnpm add --global palabre
palabre
```

Au premier lancement interactif, Palabre crée la configuration globale si nécessaire et détecte les outils installés. `palabre doctor` fournit les diagnostics.

Pour utiliser Relay depuis votre outil hôte, installez son skill, puis rechargez-le dans cet outil :

```powershell
palabre skill --install codex
# Pour Claude Code : palabre skill --install claude
```

Ou demandez une relecture directement depuis le terminal, après configuration :

```powershell
palabre relay --new --background --to claude --subject "Relire le plan" "Lis docs/plan.md sans modifier de fichier."
```

[Premier Relay](https://palab.re/fr/get-started/first-relay) · [Installation et autres gestionnaires de paquets](https://palab.re/fr/get-started/installation)

Pour un Débat depuis le terminal :

```powershell
palabre codex-claude --mode debate "Critique ce plan" -t 4 --files docs/plan.md
```

### Ce qui reste sous votre contrôle

- Un message Relay n'accorde aucun droit. Les appels ordinaires Codex/Claude en arrière-plan limitent les outils ; une cible Codex ouverte garde les permissions de sa conversation. Aucun renvoi automatique après une délivrance incertaine.
- Palabre fonctionne localement, sans serveur Palabre. Les prompts et le contexte partent néanmoins vers les outils choisis et, selon leur fonctionnement, leurs services distants. Avec Ollama et un modèle local, l'inférence peut rester sur votre machine.
- Les exports Markdown permettent de relire les échanges. Mission, `--task review` et `--write` expérimental sont gelés et hors parcours par défaut.

### Documentation et intégrations

Documentation complète : **[palab.re](https://palab.re/fr)** — [Relay](https://palab.re/fr/usage/relay), [Débat](https://palab.re/fr/get-started/first-debate), [Référence CLI](https://palab.re/fr/reference/cli), [Dépannage](https://palab.re/fr/troubleshooting).

[Extension VS Code](https://marketplace.visualstudio.com/items?itemName=JuReyms.palabre-vscode) : Débat, Ask et Chat dans une barre latérale. [Contrats d'intégration](https://palab.re/fr/integrations/ndjson) : JSON/NDJSON pour les autres clients.

[Contribution et développement local](./AGENTS.md) · [Changelog](./CHANGELOG.md) · [Roadmap](https://palab.re/fr/roadmap) · [Licence MIT](./LICENSE)
