import type { Language } from "../types.js";

export interface HelpMessages {
  render(presets: string): string;
  renderCommand(command: string): string | undefined;
}

const frCommandHelp: Record<string, string> = {
  init: `
Initialise explicitement une configuration Palabre.

Note:
  palabre sans argument cree deja la configuration globale au premier lancement TUI.

Usage:
  palabre init [flags]

Flags:
  --local              cree ./palabre.config.json
  --language <fr|en>   definit la langue
  --config <path>      chemin de config explicite
`,
  "agent-role": `
Modifie le rôle durable d'un agent dans la configuration.

Usage:
  palabre agent-role <agent> <role>

Exemple:
  palabre agent-role claude critic

Roles:
  implementer, reviewer, architect, scout, critic, summarizer
`,
  agents: `
Liste les agents declares dans la config.

Usage:
  palabre agents [flags]

Flags:
  --config <path>      chemin de config explicite
  --language <fr|en>   force la langue
  --json               sortie JSON pour les integrations
`,
  presets: `
Liste les presets de paires d'agents.

Usage:
  palabre presets [flags]

Flags:
  --json               sortie structuree pour integrations
  --config <path>      chemin de config explicite
`,
  history: `
Liste les derniers exports Palabre.

Usage:
  palabre history [flags]
  palabre historique [flags]

Flags:
  --json               sortie structuree pour integrations
  --config <path>      chemin de config explicite
`,
  historique: `
Liste les derniers exports Palabre.

Usage:
  palabre history [flags]
  palabre historique [flags]

Flags:
  --json               sortie structuree pour integrations
  --config <path>      chemin de config explicite
`,
  context: `
Scanne le contexte projet avec les memes regles que --context.

Usage:
  palabre context scan [paths...] [flags]

Flags:
  --json               sortie structuree pour integrations
  --language <fr|en>   force la langue des avertissements
`,
  config: `
Configure les agents par defaut, la synthese, le nombre de reponses et la langue.

Usage:
  palabre config
  palabre config --set-defaults <agentA> <agentB>
  palabre config -t <number>
  palabre config --summary-agent <name|none>
  palabre config --ask-summary-agent <name|none>
  palabre config --mode <debate|ask>
  palabre config --ask-agents <names...>
  palabre config --interface <tui|terminal>
  palabre config --language <fr|en>

Flags:
  --clear-defaults     supprime les parametres par defaut
  --sync-agents        ajoute les agents detectes manquants et rafraichit les commandes connues
  --config <path>      chemin de config explicite
`,
  new: `
Assistant interactif pour preparer un debat.

Usage:
  palabre new [flags]

Flags:
  --config <path>      chemin de config explicite
  --language <fr|en>   force la langue
`,
  doctor: `
Verifie la config et les outils locaux.

Usage:
  palabre doctor [flags]

Flags:
  --terminal           sortie simple pour logs
  --config <path>      chemin de config explicite
  --language <fr|en>   force la langue
`,
  update: `
Affiche ou execute les etapes de mise a jour.

Usage:
  palabre update [flags]

Flags:
  --apply              execute les etapes de mise a jour
  --config <path>      chemin de config explicite
`,
  run: `
Lance un debat entre deux agents.

Usage:
  palabre "Sujet"
  palabre -s "Sujet" -t 4
  palabre <preset> "Sujet" -t 4

Flags:
  -s, --subject <text> sujet du debat
  -t, --turns <n>      nombre total de reponses
  --preset <name>      preset d'agents
  --agent-a <name>     premier agent
  --agent-b <name>     second agent
  --ollama-url <url>   surcharge l'adresse Ollama pour cette session
  --tui                force l'interface TUI
  --terminal           force le rendu terminal brut
  --renderer <kind>    auto, pretty, plain, tui ou ndjson
  --show-prompt        affiche le prompt sans appeler d'agent
`,
  ask: `
Lance une demande avec plusieurs reponses independantes.

Usage:
  palabre ask "Sujet" --agents codex claude
  palabre run --mode ask --agents codex claude -s "Sujet"

Flags:
  --agents <names...>  agents qui repondent, 4 maximum
  --summary-agent <n>  agent de synthese pour ce lancement
  --ask-role <role>    rôle commun temporaire pour les agents Ask
  --ollama-url <url>   surcharge l'adresse Ollama pour cette session
  --tui                force l'interface TUI
  --terminal           force le rendu terminal brut
  --renderer <kind>    auto, pretty, plain, tui ou ndjson
  --show-prompt        affiche le prompt sans appeler d'agent
`
};

const enCommandHelp: Record<string, string> = {
  init: `
Explicitly initializes a Palabre configuration.

Note:
  palabre without arguments already creates the global configuration on first TUI launch.

Usage:
  palabre init [flags]

Flags:
  --local              creates ./palabre.config.json
  --language <fr|en>   sets the language
  --config <path>      explicit config path
`,
  agents: `
Lists agents declared in the config.

Usage:
  palabre agents [flags]

Flags:
  --config <path>      explicit config path
  --language <fr|en>   forces the language
  --json               JSON output for integrations
`,
  presets: `
Lists agent-pair presets.

Usage:
  palabre presets [flags]

Flags:
  --json               structured output for integrations
  --config <path>      explicit config path
`,
  history: `
Lists recent Palabre exports.

Usage:
  palabre history [flags]
  palabre historique [flags]

Flags:
  --json               structured output for integrations
  --config <path>      explicit config path
`,
  historique: `
Lists recent Palabre exports.

Usage:
  palabre history [flags]
  palabre historique [flags]

Flags:
  --json               structured output for integrations
  --config <path>      explicit config path
`,
  context: `
Scans project context with the same rules as --context.

Usage:
  palabre context scan [paths...] [flags]

Flags:
  --json               structured output for integrations
  --language <fr|en>   forces warning language
`,
  config: `
Configures default agents, summary, response count, and language.

Usage:
  palabre config
  palabre config --set-defaults <agentA> <agentB>
  palabre config -t <number>
  palabre config --summary-agent <name|none>
  palabre config --ask-summary-agent <name|none>
  palabre config --mode <debate|ask>
  palabre config --ask-agents <names...>
  palabre config --interface <tui|terminal>
  palabre config --language <fr|en>

Flags:
  --clear-defaults     clears default settings
  --sync-agents        adds missing detected agents and refreshes known commands
  --config <path>      explicit config path
`,
  new: `
Interactive assistant to prepare a debate.

Usage:
  palabre new [flags]

Flags:
  --config <path>      explicit config path
  --language <fr|en>   forces the language
`,
  doctor: `
Checks config and local tools.

Usage:
  palabre doctor [flags]

Flags:
  --terminal           simple output for logs
  --config <path>      explicit config path
  --language <fr|en>   forces the language
`,
  update: `
Shows or applies update steps.

Usage:
  palabre update [flags]

Flags:
  --apply              runs update steps
  --config <path>      explicit config path
`,
  run: `
Runs a debate between two agents.

Usage:
  palabre "Subject"
  palabre -s "Subject" -t 4
  palabre <preset> "Subject" -t 4

Flags:
  -s, --subject <text> debate subject
  -t, --turns <n>      total number of responses
  --preset <name>      agent preset
  --agent-a <name>     first agent
  --agent-b <name>     second agent
  --ollama-url <url>   overrides the Ollama address for this session
  --tui                forces the TUI interface
  --terminal           forces raw terminal rendering
  --renderer <kind>    auto, pretty, plain, tui, or ndjson
  --show-prompt        shows the prompt without calling an agent
`,
  ask: `
Runs a request with several independent responses.

Usage:
  palabre ask "Subject" --agents codex claude
  palabre run --mode ask --agents codex claude -s "Subject"

Flags:
  --agents <names...>  responding agents, 4 maximum
  --summary-agent <n>  summary agent for this run
  --ask-role <role>    temporary shared role for Ask agents
  --ollama-url <url>   overrides the Ollama address for this session
  --tui                forces the TUI interface
  --terminal           forces raw terminal rendering
  --renderer <kind>    auto, pretty, plain, tui, or ndjson
  --show-prompt        shows the prompt without calling an agent
`
};

export const helpMessages: Record<Language, HelpMessages> = {
  fr: {
    render: () => `
PALABRE

Debats entre agents IA dans votre terminal.

Usage:
  palabre
  palabre [flags]
  palabre [command]
  palabre "Sujet"
  palabre <preset> "Sujet"
  palabre ask "Sujet" --agents codex claude

Demarrage rapide:
  palabre
  palabre new
  palabre "Faut-il ajouter une TUI a Palabre ?"
  palabre codex-claude "Comparer deux solutions" -t 4

Commandes:
  init       Creer explicitement une configuration
  new        Assistant interactif de debat
  ask        Demande multi-agents independante
  agents     Lister les agents configures
  agent-role Modifier le role durable d'un agent
  presets    Lister les presets disponibles
  history    Lister les derniers exports
  context    Scanner le contexte projet
  config     Modifier les parametres par defaut
  doctor     Verifier la config et les outils locaux
  update     Afficher ou appliquer les etapes de mise a jour
  help       Afficher l'aide
  version    Afficher la version

Flags:
  -h, --help              aide pour Palabre
  -v, --version           affiche la version
  -s, --subject <text>    sujet du debat
  -t, --turns <number>    nombre total de reponses
  --role-a <role>         role temporaire de l'agent A
  --role-b <role>         role temporaire de l'agent B
  --ask-role <role>       role commun temporaire en Ask
  --tui                   force l'interface TUI
  --terminal              force le rendu terminal brut
  --language <fr|en>      force la langue
  --config <path>         chemin de config explicite
  --trust-config          approuve l'empreinte de la config locale

Documentation complete:
  https://palab.re/fr

Utilisez "palabre [command] --help" pour plus d'informations sur une commande.
`,
    renderCommand: (command) => frCommandHelp[command]
  },
  en: {
    render: () => `
PALABRE

Debates between AI agents in your terminal.

Usage:
  palabre
  palabre [flags]
  palabre [command]
  palabre "Subject"
  palabre <preset> "Subject"
  palabre ask "Subject" --agents codex claude

Quick start:
  palabre
  palabre new
  palabre "Should Palabre add a TUI?"
  palabre codex-claude "Compare two solutions" -t 4

Commands:
  init       Explicitly create a configuration
  new        Interactive debate assistant
  ask        Independent multi-agent request
  agents     List configured agents
  agent-role Update one agent persistent role
  presets    List available presets
  history    List recent exports
  context    Scan project context
  config     Edit default settings
  doctor     Check config and local tools
  update     Show or apply update steps
  help       Show help
  version    Show version

Flags:
  -h, --help              help for Palabre
  -v, --version           show version
  -s, --subject <text>    debate subject
  -t, --turns <number>    total number of responses
  --role-a <role>         temporary role for agent A
  --role-b <role>         temporary role for agent B
  --ask-role <role>       temporary shared role in Ask
  --tui                   forces the TUI interface
  --terminal              forces raw terminal rendering
  --language <fr|en>      force language
  --config <path>         explicit config path
  --trust-config          trusts the local config fingerprint

Full documentation:
  https://palab.re/en

Use "palabre [command] --help" for more information about a command.
`,
    renderCommand: (command) => enCommandHelp[command]
  }
};
