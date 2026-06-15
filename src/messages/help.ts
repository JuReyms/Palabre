import type { Language } from "../types.js";

export interface HelpMessages {
  render(presets: string): string;
  renderCommand(command: string): string | undefined;
}

const frCommandHelp: Record<string, string> = {
  init: `
Initialise une configuration Palabre.

Usage:
  palabre init [flags]

Flags:
  --local              cree ./palabre.config.json
  --language <fr|en>   definit la langue
  --config <path>      chemin de config explicite
`,
  agents: `
Liste les agents declares dans la config.

Usage:
  palabre agents [flags]

Flags:
  --config <path>      chemin de config explicite
  --language <fr|en>   force la langue
`,
  presets: `
Liste les presets de paires d'agents.

Usage:
  palabre presets [flags]

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
  palabre config --language <fr|en>

Flags:
  --clear-defaults     supprime les parametres par defaut
  --sync-agents        ajoute les agents detectes manquants
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
  --plain              sortie simple pour logs
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
  --renderer <kind>    auto, pretty, plain, tui ou ndjson
  --show-prompt        affiche le prompt sans appeler d'agent
`
};

const enCommandHelp: Record<string, string> = {
  init: `
Initializes a Palabre configuration.

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
`,
  presets: `
Lists agent-pair presets.

Usage:
  palabre presets [flags]

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
  palabre config --language <fr|en>

Flags:
  --clear-defaults     clears default settings
  --sync-agents        adds missing detected agents
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
  --plain              simple output for logs
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
  palabre [flags]
  palabre [command]
  palabre "Sujet"
  palabre <preset> "Sujet"
  palabre ask "Sujet" --agents codex claude

Demarrage rapide:
  palabre init
  palabre new
  palabre "Faut-il ajouter une TUI a Palabre ?"
  palabre codex-claude "Comparer deux solutions" -t 4

Commandes:
  init       Creer une configuration
  new        Assistant interactif de debat
  ask        Demande multi-agents independante
  agents     Lister les agents configures
  presets    Lister les presets disponibles
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
  --language <fr|en>      force la langue
  --config <path>         chemin de config explicite

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
  palabre [flags]
  palabre [command]
  palabre "Subject"
  palabre <preset> "Subject"
  palabre ask "Subject" --agents codex claude

Quick start:
  palabre init
  palabre new
  palabre "Should Palabre add a TUI?"
  palabre codex-claude "Compare two solutions" -t 4

Commands:
  init       Create a configuration
  new        Interactive debate assistant
  ask        Independent multi-agent request
  agents     List configured agents
  presets    List available presets
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
  --language <fr|en>      force language
  --config <path>         explicit config path

Full documentation:
  https://palab.re/en

Use "palabre [command] --help" for more information about a command.
`,
    renderCommand: (command) => enCommandHelp[command]
  }
};
