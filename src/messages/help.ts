import type { Language } from "../types.js";

export interface HelpMessages {
  render(presets: string): string;
}

export const helpMessages: Record<Language, HelpMessages> = {
  fr: {
    render: (presets) => `
PALABRE
_____________________________________________

Usage rapide:

  palabre init
      Crée une config globale et détecte les agents IA disponibles sur la machine.

  palabre agents
      Affiche les agents déclarés dans la config.

  palabre config
      Assistant pour définir ou supprimer les paramètres par défaut.

  palabre new
      Assistant interactif pour choisir les agents, le sujet et les options.

  palabre claude-gemini "Sujet" -t 4
      Lance avec un preset et un sujet positionnel.

  palabre "Sujet"
      Lance le débat avec paramètres par défaut de la config.

_____________________________________________


Commandes:

  palabre init [--local]
      Crée une config locale et détecte Codex, Claude, Gemini, OpenCode et Ollama.

  palabre agents [--config <path>]
      Liste les agents déclarés dans la config et leur détection locale.

  palabre presets [--json]
      Liste les presets de paires d'agents. \`--json\` émet la liste structurée
      pour les intégrations (extension VS Code, scripts).

  palabre config
      Assistant pour définir ou supprimer les paramètres par défaut.

  palabre config --set-defaults <agentA> <agentB> [-t <n>] [--summary-agent <name>]
      Définit les agents par défaut, et optionnellement les réponses et la synthèse.

  palabre config -t <n>
      Définit seulement le nombre de réponses par défaut.

  palabre config --summary-agent <name|none>
      Définit ou retire seulement l'agent de synthèse par défaut.

  palabre config --language <fr|en>
      Définit la langue de l'interface Palabre.

  palabre config --clear-defaults
      Supprime les paramètres par défaut.

  palabre doctor [--config <path>]
      Vérifie la config et les outils locaux.

  palabre update [--apply]
      Affiche ou exécute les étapes de mise à jour d'un checkout git.

  palabre help
      Affiche cette aide. Identique à -h ou --help.

  palabre version
      Affiche la version. Identique à -v ou --version.

_____________________________________________


Notation:

  [option] signifie facultatif. Ne tape pas les crochets.
  <valeur> signifie qu'il faut remplacer ce texte par ta valeur.

Options générales:

  -h, --help              Affiche cette aide
  -v, --version           Affiche la version
  -a, --agents            Liste les agents. Identique à palabre agents
  --config <path>         Chemin vers un fichier de config explicite
  --language <fr|en>      Force la langue de l'interface (alias : --lang)
  --plain                 Utilise le rendu console simple sans habillage TUI
  --json                  Émet un événement NDJSON par ligne sur stdout (alias de --renderer ndjson)
  --renderer <kind>       Force le renderer : auto | pretty | plain | ndjson

Sujet et lancement:

  -s, --subject <text>    Sujet du débat, option recommandée
  --topic <text>          Alias compatible de --subject
  --agent-a <name>        Premier agent
  --agent-b <name>        Second agent
  --preset <name>         Preset de paire d'agents. Exemples: codex-claude, claude-gemini
  -t, --turns <number>    Nombre total de réponses (1 à 20)
  --no-early-stop         Désactive l'arrêt anticipé si les agents sont clairement d'accord

Modèles:

  --model-a <model>       Modèle brut transmis à l'agent A
  --model-b <model>       Modèle brut transmis à l'agent B
  --pull-models           Autorise Ollama à télécharger un modèle manquant

Synthèse:

  --summary-agent <name>  Agent utilisé pour produire la synthèse finale
  --summary-model <model> Modèle brut transmis à l'agent de synthèse
  --no-summary            Désactive la synthèse finale

Contexte:

  --files <paths...>      Fichiers texte à injecter explicitement dans le contexte
  --context <paths...>    Scanne fichiers/dossiers texte en respectant les limites de contexte
  --show-prompt           Affiche le prompt du premier tour sans appeler d'agent

Configuration:

  --local                 Avec init/setup, crée ./palabre.config.json
  --set-defaults <a b>    Avec config, définit les agents par défaut
  --summary-agent <name>  Avec config, définit l'agent de synthèse par défaut
  --summary-agent none    Avec config, retire l'agent de synthèse par défaut
  --language <fr|en>      Avec config/init/run, définit ou force la langue d'interface
  --clear-defaults        Avec config, supprime les paramètres par défaut
  --sync-agents           Avec config, ajoute les agents détectés manquants

Mise à jour:

  --apply                 Avec update, exécute les étapes de mise à jour

_____________________________________________


Presets disponibles:

  ${presets}

_____________________________________________

`
  },
  en: {
    render: (presets) => `
PALABRE
_____________________________________________

Quick usage:

  palabre init
      Creates a global config and detects AI agents available on this machine.

  palabre agents
      Shows agents declared in the config.

  palabre config
      Assistant to define or clear default settings.

  palabre new
      Interactive assistant to choose agents, subject, and options.

  palabre claude-gemini "Subject" -t 4
      Runs with a preset and positional subject.

  palabre "Subject"
      Runs the debate with default settings from the config.

_____________________________________________


Commands:

  palabre init [--local]
      Creates a local config and detects Codex, Claude, Gemini, OpenCode, and Ollama.

  palabre agents [--config <path>]
      Lists agents declared in the config and their local detection status.

  palabre presets [--json]
      Lists agent-pair presets. \`--json\` emits the structured list for integrations
      (VS Code extension, scripts).

  palabre config
      Assistant to define or clear default settings.

  palabre config --set-defaults <agentA> <agentB> [-t <n>] [--summary-agent <name>]
      Sets default agents, and optionally turns and summary.

  palabre config -t <n>
      Sets only the default number of responses.

  palabre config --summary-agent <name|none>
      Sets or removes only the default summary agent.

  palabre config --language <fr|en>
      Sets the Palabre interface language.

  palabre config --clear-defaults
      Clears default settings.

  palabre doctor [--config <path>]
      Checks config and local tools.

  palabre update [--apply]
      Shows or applies update steps from a git checkout.

  palabre help
      Shows this help. Same as -h or --help.

  palabre version
      Shows the version. Same as -v or --version.

_____________________________________________


Notation:

  [option] means optional. Do not type the brackets.
  <value> means you should replace this text with your value.

General options:

  -h, --help              Shows this help
  -v, --version           Shows the version
  -a, --agents            Lists agents. Same as palabre agents
  --config <path>         Path to an explicit config file
  --language <fr|en>      Forces the interface language (alias: --lang)
  --plain                 Uses the simple console renderer without TUI styling
  --json                  Emits one NDJSON event per line on stdout (alias for --renderer ndjson)
  --renderer <kind>       Forces renderer: auto | pretty | plain | ndjson

Subject and launch:

  -s, --subject <text>    Debate subject, recommended option
  --topic <text>          Compatible alias for --subject
  --agent-a <name>        First agent
  --agent-b <name>        Second agent
  --preset <name>         Agent-pair preset. Examples: codex-claude, claude-gemini
  -t, --turns <number>    Total number of responses (1 to 20)
  --no-early-stop         Disables early stop when agents clearly agree

Models:

  --model-a <model>       Raw model passed to agent A
  --model-b <model>       Raw model passed to agent B
  --pull-models           Allows Ollama to download a missing model

Summary:

  --summary-agent <name>  Agent used to produce the final summary
  --summary-model <model> Raw model passed to the summary agent
  --no-summary            Disables the final summary

Context:

  --files <paths...>      Text files to inject explicitly into context
  --context <paths...>    Scans text files/folders while respecting context limits
  --show-prompt           Shows the first-turn prompt without calling an agent

Configuration:

  --local                 With init/setup, creates ./palabre.config.json
  --set-defaults <a b>    With config, sets default agents
  --summary-agent <name>  With config, sets the default summary agent
  --summary-agent none    With config, removes the default summary agent
  --language <fr|en>      With config/init/run, sets or forces interface language
  --clear-defaults        With config, clears default settings
  --sync-agents           With config, adds missing detected agents

Update:

  --apply                 With update, runs update steps

_____________________________________________


Available presets:

  ${presets}

_____________________________________________

`
  }
};
