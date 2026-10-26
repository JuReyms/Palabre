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

**Let your AI tools work together. Compare views. Move your work and decisions forward.**

Palabre offers several ways to work with your usual AI tools: cooperate, examine a proposal or inform a decision. Choose the mode that fits your need; you stay in control.

Palabre calls the AI assistants you bring into the work **agents**, for example through Codex, Claude Code, OpenCode or a local model with Ollama. **Models** are the AI engines those tools use.

### Your data, your tools

**Palabre does not collect your data: no Palabre account, no telemetry, no Palabre server receiving your conversations.** It runs on your machine.

- **Local AI exchanges:** Debate, Ask and Chat can use a local Ollama server and local models, including for summaries. Launch them from your terminal, without a remote AI assistant, to keep these exchanges on your machine.
- **Your choice of providers:** if you include a remote tool or model, it receives the prompts and context it needs, under its own privacy policy. Palabre adds no intermediary collecting your conversations.
- **Local records:** Palabre saves its Markdown exports on your machine. You choose whether to share them.

[Privacy and what stays local](https://palab.re/en/get-started/introduction#privacy)

### Where can you use Palabre?

- **In your usual AI assistant**, in its CLI or desktop app: ask it to use Palabre in plain language. With the Palabre skill and permission to run local commands, it can launch Relay, Debate, Ask or Chat and report back to you.
- **In a terminal**: run `palabre` for interactive menus (TUI) to use Debate, Ask and Chat, or use the direct commands, including Relay.

The conversational route works with compatible assistants such as Codex and Claude Code, not with every chat app. If your app supports voice input, you can dictate the same request: voice comes from your app, not Palabre.

### One product, four modes

| Mode | When it helps | Shape |
| --- | --- | --- |
| **Relay** | Delegate a task to another agent and bring its reply back. | `you → A → B → A → you` |
| **Debate** | Work through two positions and their disagreements. | `A ↔ B → summary` |
| **Ask** | Compare 1–4 independent opinions, without mutual influence. | `question → separate answers → comparison` |
| **Chat** | Advance with one interlocutor and occasionally request another opinion. | `you ↔ A`, with a one-off consultation of B |

Debate, Ask and Chat start new exchanges; unlike Relay, they do not pick up your existing Codex or Claude Code conversations.

### Relay mode: cooperate from your usual conversation

Talk to your usual tool, the lead. It sends a task or review request to a teammate and brings the result back — without you copying messages between windows. This lead/teammate workflow belongs to **Relay**.

```text
You → Your tool (lead) → Palabre Relay → Teammate
          ↑                               │
          └────────── reply ───────────────┘
```

For example, from Codex:

> Use Palabre to ask Claude Code to review these changes without modifying files. Explain its findings and any disagreements.

Relay can create a new conversation or continue one you choose. Each send is explicit; it does not start an autonomous conversation loop. The [Palabre skill](https://palab.re/en/get-started/skill) gives your assistant instructions for using Palabre and reporting back to you.

Each tool keeps its own conversation and quotas. The request must carry the useful context; Relay does not automatically share their memories. Cross-checking can help catch errors, but agreement between tools is not proof of correctness.

**Relay currently connects Codex and Claude Code conversations.** Relay can also send a message to a Codex conversation you are already using in its app or terminal. Sending to Claude Code while its conversation is in use in a terminal or desktop app is not yet supported. See the [Relay guide](https://palab.re/en/usage/relay) for setup, platform requirements and the OpenCode pilot.

#### A real example: writing this README

Codex drafted this README and asked Claude Code for a critical review through Palabre Relay. Their exchanges revealed ambiguities; the maintainer chose the changes to apply. Finally, a test of the Relay copy pilot checked what OpenCode understood from the document.

You can use the same approach:

> Write the README with me. Use Palabre Relay to ask Claude Code for a critical review, discuss its findings, then present the proposed changes to me before applying them.

### Which tools work with which modes?

These are the tools Palabre can call, once installed and configured — regardless of which compatible assistant you use to launch Palabre.

| AI tool | Relay | Debate | Ask | Chat |
| --- | --- | --- | --- | --- |
| Codex | Yes | Yes | Yes | Yes |
| Claude Code | Yes, in the background | Yes | Yes | Yes |
| OpenCode | Experimental, on a copy (1) | Yes | Yes | Yes |
| Antigravity CLI | No | Yes | Yes | Yes |
| Mistral Vibe | No | Yes | Yes | Yes |
| Ollama (local models) | No | Yes | Yes | Yes |

> **Note (1) — OpenCode Relay:** this pilot works on a copy of an existing conversation. Windows, CLI 2.0.32 only, not yet released; Desktop use has not been verified. [Relay requirements and limits](https://palab.re/en/usage/relay).

Codex and Claude Code can also coordinate Relay exchanges.

**Roles complement Debate, Ask and Chat.** For example, an `implementer` proposes a solution while a `reviewer` looks for risks. Roles change the instruction, not the model or permissions. They do not configure Relay; “lead” and “teammate” describe coordination instead. [Roles and configuration](https://palab.re/en/get-started/configuration).

### Install and try

The commands below require Node.js 20+ and pnpm — [other package managers](https://palab.re/en/get-started/installation). You also need an installed, authenticated AI tool (or a configured local Ollama model). A Debate needs two configured agents. Your tools' own subscriptions, costs and quotas still apply.

```powershell
pnpm add --global palabre
palabre
```

The first interactive launch creates the global configuration if needed and detects installed tools. Use `palabre doctor` for diagnostics.

#### From your assistant — desktop app or CLI

Install the skill for the assistant you use, then reload it in that assistant:

```powershell
palabre skill --install codex
# For Claude Code instead: palabre skill --install claude
```

Continue in your usual conversation. No Palabre command to memorize:

> Use Palabre Relay to ask Claude Code to review this plan without changing files.

Or, to have two agents challenge the plan together:

> Use Palabre Debate to have Codex and Claude Code discuss this plan, challenge each other's proposals and summarize their agreements and disagreements.

Ask and Chat are also available for independent opinions or a conversation with one agent. Type your request, or dictate it if your app supports voice input. Your assistant runs Palabre locally and brings the result back into your conversation.

[Set up the skill](https://palab.re/en/get-started/skill) · [Your first Relay](https://palab.re/en/get-started/first-relay)

#### Directly from a terminal

Run `palabre` to choose a mode from the menus. For direct commands instead:

```powershell
palabre relay --new --background --to claude --subject "Review the plan" "Read docs/plan.md without changing files."
palabre codex-claude --mode debate "Challenge this plan" -t 4 --files docs/plan.md
```

### What stays under your control

Relay messages grant no extra permissions. Background Codex/Claude calls restrict the teammate's tools; sending into a conversation in the Codex app uses that conversation's own permissions. If delivery is uncertain, Palabre does not send again automatically.

### Keep a record of your exchanges

Palabre saves exchanges as Markdown files in `.palabre/` by default: `.relay.md`, `.debate.md`, `.ask.md` and `.chat.md`. Debate and Ask also include a summary when enabled. Read them again, keep them with your project or share them after checking for sensitive information. [Export details](https://palab.re/en/usage/exports).

### Documentation and integrations

Full documentation: **[palab.re](https://palab.re/en)** — [Relay](https://palab.re/en/usage/relay), [Debate](https://palab.re/en/get-started/first-debate), [CLI reference](https://palab.re/en/reference/cli), [Troubleshooting](https://palab.re/en/troubleshooting).

For agents: operating instructions in [`skills/palabre/SKILL.md`](./skills/palabre/SKILL.md).

[VS Code extension](https://marketplace.visualstudio.com/items?itemName=JuReyms.palabre-vscode): Debate, Ask and Chat from a sidebar. [Integration contracts](https://palab.re/en/integrations/ndjson): JSON/NDJSON for other clients.

[Contributing and local development](./AGENTS.md) · [Changelog](./CHANGELOG.md) · [Roadmap](https://palab.re/en/roadmap) · [MIT license](./LICENSE)

## Français

**Faites coopérer vos outils IA, croisez leurs avis et avancez dans vos décisions comme dans votre travail.**

Palabre propose plusieurs façons de travailler avec vos outils IA habituels : coopérer, examiner une proposition ou éclairer une décision. Choisissez le mode adapté ; vous gardez la main.

Palabre appelle **agents** les assistants IA que vous faites participer, par exemple via Codex, Claude Code, OpenCode ou un modèle local avec Ollama. Les **modèles** sont les moteurs IA de ces outils.

### Vos données, vos outils

**Palabre ne collecte pas vos données : aucun compte Palabre, aucune télémétrie, aucun serveur Palabre pour recevoir vos conversations.** Il fonctionne sur votre machine.

- **Des échanges IA locaux :** Débat, Ask et Chat peuvent utiliser un serveur Ollama et des modèles locaux, y compris pour la synthèse. Lancez-les depuis votre terminal, sans assistant IA distant, pour garder ces échanges sur votre machine.
- **Vos fournisseurs, votre choix :** si vous faites participer un outil ou un modèle distant, il reçoit les prompts et le contexte nécessaires, selon sa propre politique de confidentialité. Palabre n'ajoute pas d'intermédiaire qui collecte vos conversations.
- **Des traces locales :** Palabre enregistre ses exports Markdown sur votre machine. Vous choisissez de les partager ou non.

[Confidentialité et données locales](https://palab.re/fr/get-started/introduction#confidentialité)

### Où utiliser Palabre ?

- **Dans votre assistant IA habituel**, en ligne de commande (CLI) ou dans son application de bureau (Desktop) : demandez-lui d'utiliser Palabre en langage naturel. Avec le skill Palabre et l'autorisation d'exécuter des commandes locales, il peut lancer Relay, Débat, Ask ou Chat et vous en rapporter le résultat.
- **Dans un terminal** : lancez `palabre` pour utiliser Débat, Ask et Chat avec des menus interactifs (TUI), ou utilisez les commandes directes, y compris pour Relay.

Le parcours conversationnel fonctionne avec des assistants compatibles comme Codex et Claude Code, pas avec toutes les applications de chat. Si votre application propose la saisie vocale, vous pouvez dicter la même demande : la voix vient de votre application, pas de Palabre.

### Un produit, quatre modes

| Mode | Quand l'utiliser | Schéma |
| --- | --- | --- |
| **Relay** | Confier une tâche à un autre agent et récupérer sa réponse. | `vous → A → B → A → vous` |
| **Débat** | Travailler deux positions et leurs désaccords. | `A ↔ B → synthèse` |
| **Ask** | Comparer 1 à 4 avis indépendants, sans influence mutuelle. | `question → réponses séparées → comparaison` |
| **Chat** | Avancer avec un interlocuteur et demander parfois un autre avis. | `vous ↔ A`, avec consultation ponctuelle de B |

Débat, Ask et Chat lancent de nouveaux échanges ; contrairement à Relay, ils ne reprennent pas vos conversations existantes dans Codex ou Claude Code.

### Mode Relay : coopérer depuis votre conversation habituelle

Échangez avec votre outil habituel, le chef de mission. Il confie une tâche ou une relecture à un équipier et vous rapporte le résultat — sans copier vous-même les messages entre les fenêtres. Ce parcours chef de mission/équipier est propre au **mode Relay**.

```text
Vous → Votre outil (chef de mission) → Palabre Relay → Équipier
               ↑                                       │
               └────────────── réponse ─────────────────┘
```

Par exemple, depuis Codex :

> Avec Palabre, demande à Claude Code de relire ces changements sans modifier de fichier. Explique-moi ses remarques et les éventuels désaccords.

Relay peut créer une nouvelle conversation ou poursuivre celle que vous choisissez. Chaque envoi est explicite ; il ne déclenche pas de boucle autonome entre les conversations. Le [skill Palabre](https://palab.re/fr/get-started/skill) donne à votre assistant les consignes pour utiliser Palabre et vous rendre compte du résultat.

Chaque outil garde sa conversation et ses quotas. Le contexte utile doit accompagner la demande ; Relay ne partage pas automatiquement leurs mémoires. Croiser les regards peut aider à repérer des erreurs, mais un accord entre outils ne prouve pas qu'une proposition est correcte.

**Relay relie aujourd'hui les conversations Codex et Claude Code.** Relay peut aussi envoyer un message à une conversation Codex que vous utilisez déjà dans l'application ou le terminal. L'envoi à Claude Code pendant que sa conversation est utilisée dans le terminal ou l'application de bureau n'est pas encore pris en charge. Installation, prérequis par plateforme et pilote OpenCode : [guide Relay](https://palab.re/fr/usage/relay).

#### Un exemple réel : la rédaction de ce README

Codex a rédigé ce README et demandé à Claude Code une relecture critique via Palabre Relay. Leurs échanges ont fait ressortir des ambiguïtés ; le mainteneur a choisi les modifications à appliquer. Enfin, un essai du pilote Relay sur copie a permis de vérifier ce qu'OpenCode comprenait du document.

Vous pouvez reprendre cette méthode :

> Rédige le README avec moi. Utilise Palabre Relay pour demander à Claude Code une relecture critique, discute ses remarques, puis présente-moi les changements proposés avant de les appliquer.

### Quels outils pour quels modes ?

Voici les outils que Palabre peut appeler, une fois installés et configurés — quel que soit l'assistant compatible depuis lequel vous lancez Palabre.

| Outil IA | Relay | Débat | Ask | Chat |
| --- | --- | --- | --- | --- |
| Codex | Oui | Oui | Oui | Oui |
| Claude Code | Oui, en arrière-plan | Oui | Oui | Oui |
| OpenCode | Expérimental, sur copie (1) | Oui | Oui | Oui |
| Antigravity CLI | Non | Oui | Oui | Oui |
| Mistral Vibe | Non | Oui | Oui | Oui |
| Ollama (modèles locaux) | Non | Oui | Oui | Oui |

> **Note (1) — OpenCode Relay :** ce pilote travaille sur une copie d'une conversation existante. Windows, CLI 2.0.32 seulement, pas encore publié ; l'utilisation depuis Desktop n'est pas encore validée. [Prérequis et limites Relay](https://palab.re/fr/usage/relay).

Codex et Claude Code peuvent aussi coordonner les échanges Relay.

**Les rôles complètent Débat, Ask et Chat.** Par exemple, un `implementer` propose une solution et un `reviewer` cherche les risques. Ils changent la consigne, pas le modèle ni les permissions. Ils ne règlent pas Relay ; « chef de mission » et « équipier » décrivent plutôt la coordination. [Rôles et configuration](https://palab.re/fr/get-started/configuration).

### Installer et essayer

Pour les commandes ci-dessous : Node.js 20+ et pnpm — [autres gestionnaires de paquets](https://palab.re/fr/get-started/installation). Il faut aussi un outil IA installé et connecté (ou un modèle Ollama local configuré). Un Débat demande deux agents configurés. Les abonnements, coûts et quotas propres à vos outils continuent de s'appliquer.

```powershell
pnpm add --global palabre
palabre
```

Au premier lancement interactif, Palabre crée la configuration globale si nécessaire et détecte les outils installés. `palabre doctor` fournit les diagnostics.

#### Depuis votre assistant — application de bureau ou CLI

Installez le skill correspondant à votre assistant, puis rechargez-le dans cet outil :

```powershell
palabre skill --install codex
# Pour Claude Code : palabre skill --install claude
```

Continuez dans votre conversation habituelle. Aucune commande Palabre à mémoriser :

> Avec Palabre Relay, demande à Claude Code de relire ce plan sans modifier de fichier.

Ou, pour faire examiner le plan par deux agents qui se répondent :

> Avec Palabre Débat, fais débattre Codex et Claude Code sur ce plan. Qu'ils confrontent leurs propositions, puis résument leurs accords et désaccords.

Ask et Chat restent disponibles pour recueillir des avis indépendants ou échanger avec un agent. Écrivez votre demande, ou dictez-la si votre application le permet. Votre assistant exécute Palabre localement et vous rapporte le résultat dans la conversation.

[Configurer le skill](https://palab.re/fr/get-started/skill) · [Premier Relay](https://palab.re/fr/get-started/first-relay)

#### Directement depuis un terminal

Lancez `palabre` pour choisir un mode dans les menus. Pour utiliser plutôt les commandes directes :

```powershell
palabre relay --new --background --to claude --subject "Relire le plan" "Lis docs/plan.md sans modifier de fichier."
palabre codex-claude --mode debate "Critique ce plan" -t 4 --files docs/plan.md
```

### Ce qui reste sous votre contrôle

Un message Relay n'accorde aucun droit supplémentaire. Les appels Codex/Claude en arrière-plan limitent les outils de l'équipier ; un envoi dans une conversation de l'application Codex utilise les permissions de cette conversation. Si la délivrance est incertaine, Palabre ne renvoie pas le message automatiquement.

### Garder une trace des échanges

Palabre enregistre les échanges dans des fichiers Markdown, dans `.palabre/` par défaut : `.relay.md`, `.debate.md`, `.ask.md` et `.chat.md`. Débat et Ask y ajoutent leur synthèse lorsqu'elle est activée. Vous pouvez les relire, les conserver avec votre projet ou les partager après avoir vérifié les informations sensibles. [Détail des exports](https://palab.re/fr/usage/exports).

### Documentation et intégrations

Documentation complète : **[palab.re](https://palab.re/fr)** — [Relay](https://palab.re/fr/usage/relay), [Débat](https://palab.re/fr/get-started/first-debate), [Référence CLI](https://palab.re/fr/reference/cli), [Dépannage](https://palab.re/fr/troubleshooting).

Pour les agents : consignes d'utilisation dans [`skills/palabre/SKILL.md`](./skills/palabre/SKILL.md).

[Extension VS Code](https://marketplace.visualstudio.com/items?itemName=JuReyms.palabre-vscode) : Débat, Ask et Chat dans une barre latérale. [Contrats d'intégration](https://palab.re/fr/integrations/ndjson) : JSON/NDJSON pour les autres clients.

[Contribution et développement local](./AGENTS.md) · [Changelog](./CHANGELOG.md) · [Roadmap](https://palab.re/fr/roadmap) · [Licence MIT](./LICENSE)
