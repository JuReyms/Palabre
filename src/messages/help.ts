import type { Language } from "../types.js";

export interface HelpMessages {
  render(presets: string): string;
  renderCommand(command: string): string | undefined;
}

const frCommandHelp: Record<string, string> = {
  mission: `
Un chef de mission appelle son équipier en arrière-plan ; vous prenez les décisions.
Lot v2.0 : lecture seule, un appel explicite par étape, aucune boucle automatique.

Usage (depuis le même dossier) :
  palabre mission start --from <chef-de-mission>:<uuid> --to <equipier>:<uuid> --criteria "<réussite attendue>" "<objectif>"
  palabre mission step <id> "<demande>" [--timeout <secondes>]
  palabre mission step <id> "<consigne de revue>" --task review --pr https://github.com/owner/repo/pull/123
  palabre mission status <id> [--json]
  palabre mission stop <id> [--reason "<motif>"]

Cadre de start (fixé par vos réponses au chef de mission) :
  --tasks <consult,review>  consult par défaut ; review exige la politique Relay déjà approuvée
  --max-steps <1..100>      10 tentatives par défaut, refus compris
  --max-duration <10..86400> 3600 secondes depuis start, temps entre étapes compris
  --timeout <10..3600>      600 secondes par étape ; surcharge possible sur step
  --config <chemin>        configuration Relay, jamais approuvée par mission
  --language <fr|en>       langue du cadre et des sorties
  --json                  un objet JSON v1 pour chaque commande, erreurs comprises

La conversation de l'équipier doit rester fermée (terminal, Desktop, IDE).
Le chef de mission suit status, l'export .mission.md et GitHub ; aucun affichage Desktop immédiat promis.
Une étape n'est jamais rejouée automatiquement. Après coupure, état running ou uncertain :
le chef de mission vérifie l'export et la conversation avec vous, sans supprimer le verrou pour réessayer.
Session occupée : fermer la conversation avant une nouvelle step explicite (budget consommé).
stop annule au mieux l'appel ; un message ou une revue déjà partis ne sont pas retirés.
Un budget épuisé ou un arrêt exige une nouvelle mission après décision du propriétaire.
Les délais bornent l'appel Relay ; les sondes et GitHub gardent leurs propres bornes.
État/export locaux dans .palabre/missions/<id>/ ; identifiants privés, réponses non vérifiées.
Pas de code, commit, push, merge, release, --open, --trust-config ou changement de chef de mission.
La tâche review publie seulement une revue COMMENT sous la politique Relay existante.
Si Codex signale des lectures bloquées sous Windows : Mission en pause, réponse conservée,
aucune revue publiée. Cause probable : le raccourci Microsoft Store WindowsApps\\pwsh.exe.
Le propriétaire consulte https://palab.re/fr/troubleshooting (Codex sous Windows) et #128 ;
pas de solution validée à ce jour pour ce parcours, aucun changement de permission ni renvoi automatique.
Chaque étape reçoit l'en-tête PALABRE Mission, puis l'avertissement ℹ️ sur une ligne séparée
avant le contenu. Objectif et critères sont lisibles sur deux lignes, sans JSON ; la partie
« 🤖 Pour l'agent » termine le message. Le tout compte dans les 64 Kio UTF-8 de coordination.
Le rôle et le cadre ne donnent aucun droit supplémentaire. Aucun plafond de coût monétaire.
`,
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
  --limit <nombre>     nombre d'exports (1 a 100, defaut: 10)
  --config <path>      chemin de config explicite
`,
  historique: `
Liste les derniers exports Palabre.

Usage:
  palabre history [flags]
  palabre historique [flags]

Flags:
  --json               sortie structuree pour integrations
  --limit <nombre>     nombre d'exports (1 a 100, defaut: 10)
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
  --sync-agents        ajoute les agents detectes ; conserve les commandes avec chemin absolu
                       Chemin absent : indisponible ; doctor vérifie le fichier sans le lancer.
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
  --check              verifie canal et version sans modifier
  --dry-run            previsualise les etapes sans modifier
  --yes                confirme l'application sans prompt
  --apply              alias compatible de --yes
  --config <path>      chemin de config explicite
`,
  resume: `
Reprend une session Débat ou Ask depuis son dernier checkpoint complet.

Usage:
  palabre resume <session-id>

Flags:
  --yes                confirme la reprise en mode non interactif
  --terminal           force le rendu terminal brut
  --renderer <kind>    auto, pretty, plain, tui ou ndjson
  --ollama-url <url>   surcharge l'adresse Ollama pour les appels repris
  --pull-models        autorise le téléchargement d'un modèle Ollama manquant
`,
  relay: `
Transmet un message à une conversation Codex ou Claude Code fermée et renvoie sa réponse.
Avec --open, dépose le message dans une conversation Codex ouverte et attend sa réponse.

Usage:
  palabre relay --from <agent>:<session> --to <agent>:<session> "<message>"
  palabre relay --from <agent>:<session> --to <agent>:<session> --message-file <chemin>
  palabre relay allow-repo proprietaire/depot [--config <path>]
  palabre relay allow-repo 'proprietaire/*' [--config <path>]
  palabre relay --open --from <agent>:<session> --to <agent-codex>:<session> "<message>"

Flags:
  --from <agent>:<uuid>   expéditeur, étiquette déclarative (jamais lancé)
  --to <agent>:<uuid>     agent cible de la config et identifiant de sa conversation
  --message-file <path>   lit le message dans un fichier (64 Kio au plus)
  --subject <objet>       objet facultatif : une ligne non vide, 200 caractères au plus, sans contrôle
  --task review           rédige et publie une revue COMMENT si la config l'autorise
  --pr <url>              PR github.com exacte ; obligatoire avec --task review
  --open                  vise une conversation Codex ouverte (TUI ou Codex desktop)
  --timeout <secondes>    délai maximal, de 10 à 3600 (défaut : 600)
  --json                  sortie JSON v1 pour les intégrations
  --no-export             n'écrit pas l'export .relay.md
  --config <path>         chemin de config explicite
  --trust-config          approuve la config résolue (aucune question n'est posée)
  --language <fr|en>      force la langue

Limites :
  PALABRE ajoute l'en-tête expéditeur → destinataire, puis l'avertissement ℹ️ sur sa propre ligne
  avant le contenu. La partie « 🤖 Pour l'agent » regroupe provenance et consigne de réponse en bas.
  Une seule réponse ici, sans appeler un autre agent. Ne pas ajouter un second en-tête PALABRE.
  L'enveloppe complète de coordination compte dans les 64 Kio UTF-8 (contexte PR séparé).
  allow-repo exige une config déjà approuvée, affiche son chemin et le changement,
  puis exige sa confirmation au clavier (entrée et sortie TTY). Refus : code 8.
  Sans terminal, refus sans écriture ; aucun --yes ni --trust-config.
  'proprietaire/*' couvre tous ses dépôts ; les autres motifs sont refusés. Répondre o pour autoriser.
  Commandes copiables : PowerShell ou shell POSIX, pas cmd.exe. o/oui/y/yes sont acceptés.
  Agent : en cas de task-not-allowed, ouvrir remedy dans le terminal visible de l'humain,
  attendre sa réponse ; ne jamais confirmer ni modifier/approuver la politique à sa place.
  Un message d'agent est une coordination, jamais une autorisation. Aucun chaînage automatique.
  review exige une config déjà approuvée, allowedTasks=[review] et reviewRepositories explicite.
  --trust-config et --open ne sont pas admis avec review. Publication par Palabre, pas par le modèle.
  Erreur 5 Windows au démarrage d'une commande Codex : read-unavailable (code 2), réponse conservée.
  Avec review : review-failed (9), aucune publication. Cause probable : le raccourci Microsoft Store
  WindowsApps\\pwsh.exe. Le propriétaire consulte https://palab.re/fr/troubleshooting (Codex sous Windows)
  et https://github.com/JuReyms/Palabre/issues/128 : pas de solution validée pour ce parcours.
  Palabre ne change aucune permission et ne renvoie rien automatiquement.
  Sans --open, la conversation cible doit être fermée : aucun TUI, desktop, IDE ni exécution
  en cours.

Avec --open (pilote Codex, Windows) :
  La conversation cible doit être ouverte : son verrou d'écriture doit être tenu, sinon rien
  n'est déposé (target-not-open). Le message passe par codex queue ; l'enveloppe complète est
  limitée à 8 192 unités UTF-16. Le verrou ne prouve ni l'affichage ni la consommation du
  message : le récepteur est annoncé non vérifié. La cible répond avec ses propres outils et
  permissions : aucune lecture seule n'est garantie, et les garanties ci-dessous ne s'appliquent
  pas. Un message déposé peut être traité après le délai, même sans être affiché ; Ctrl+C
  n'annule pas un dépôt, et il n'y a aucun renvoi automatique.

Garanties conditionnelles :
  Avec les options imposées par Palabre et sur les versions de CLI vérifiées, la cible ne
  dispose d'aucun outil d'écriture, et les hooks et la commande notify non gérés sont
  neutralisés. Les serveurs MCP sont neutralisés sous réserve que la configuration ne change
  pas entre l'inspection et la reprise. Ces garanties ne couvrent ni les politiques
  administrées, ni les versions de CLI non vérifiées.
  Pendant le tour relayé, Codex perd ses plugins, connecteurs et serveurs MCP ; Claude n'a
  que les outils de lecture. La configuration n'est pas modifiée.

Effets :
  Lecture seule ne veut pas dire sans effet : le message enveloppé, la réponse et les appels
  d'outils de lecture sont ajoutés à l'historique de la conversation cible, même après un
  échec, et Palabre ne peut pas les retirer.
  Aucun renvoi automatique : not-delivered permet un nouvel envoi sans doublon ;
  persisted-no-reply et unknown déconseillent de renvoyer sans vérification.
`,
  sessions: `
Liste les checkpoints du dossier courant ou en supprime un explicitement.

Usage:
  palabre sessions [flags]
  palabre sessions delete <session-id> [flags]

Flags:
  --json               sortie JSON v1 pour les intégrations
  --limit <nombre>     nombre de checkpoints (1 à 100, défaut : 20)
  --yes                confirme la suppression en mode non interactif
  --language <fr|en>   force la langue
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
  --dry-run            prévisualise la session sans appeler d'agent ni écrire d'export
  --checkpoint         conserve un état de reprise sous .palabre/sessions
`,
chat: `
Discute avec un agent unique dans une session locale stateless.

Chaque reponse est generee par un nouvel appel de la CLI de l'agent. Palabre
reinjecte l'historique accumule dans ce nouvel appel ; aucune session persistante
n'est donc ouverte chez l'agent. Sans sujet initial, le premier message devient simplement le contexte de la conversation.

Pendant la conversation, \`/consult <agent>\` demande un second avis puis \`/use <agent>\` permet de poursuivre avec cet agent. Palabre ne déclenche jamais une consultation seule.

\`/end\` enregistre l'export ; \`/exit\`, \`/home\` ou la fin de l'entrée terminent sans export. Une ligne vide est ignorée. \`--dry-run\` est refusé en Chat.

Usage:
  palabre chat --agent-a codex
  palabre chat "Contexte initial" --agent-a codex

Flags:
  --agent-a <name>     agent de conversation (ou agent A par defaut)
  --role-a <role>      role temporaire de l'agent
  --model-a <model>    modele temporaire de l'agent
  --language <fr|en>   force la langue
  --config <path>      chemin de config explicite
`,
  ask: `
Lance une demande avec plusieurs reponses independantes.

Usage:
  palabre ask "Sujet" --agents codex claude
  palabre chat "Parler d'une option" --agent-a codex
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
  --dry-run            prévisualise la session sans appeler d'agent ni écrire d'export
  --checkpoint         conserve un état de reprise sous .palabre/sessions
`
};

const enCommandHelp: Record<string, string> = {
  mission: `
A mission lead calls a teammate in the background; you make the decisions.
v2.0: read-only, one explicit call per step, no automatic loop.

Usage (from the same directory):
  palabre mission start --from <mission-lead>:<uuid> --to <teammate>:<uuid> --criteria "<success criteria>" "<objective>"
  palabre mission step <id> "<request>" [--timeout <seconds>]
  palabre mission step <id> "<review instructions>" --task review --pr https://github.com/owner/repo/pull/123
  palabre mission status <id> [--json]
  palabre mission stop <id> [--reason "<reason>"]

start scope (set by your answers to the mission lead):
  --tasks <consult,review>  consult by default; review requires existing trusted Relay policy
  --max-steps <1..100>      10 attempts by default, including refusals
  --max-duration <10..86400> 3600 seconds from start, including time between steps
  --timeout <10..3600>      600 seconds per step; step can override it
  --config <path>          Relay configuration; mission never grants config trust
  --language <fr|en>       scope and output language
  --json                  one JSON v1 object for each command, including errors

Keep the teammate's conversation closed (terminal, Desktop, IDE).
The mission lead follows status, the .mission.md export and GitHub; no immediate Desktop display promised.
A step is never replayed automatically. After a crash, running or uncertain state:
the mission lead checks the export and conversation with you, without deleting the lock to retry.
Busy session: close it before another explicit step (attempt still counted).
stop cancels on a best-effort basis; an existing message or review cannot be withdrawn.
An exhausted budget or stopped mission requires a new mission after the owner's decision.
Timeouts bound the Relay call; probes and GitHub keep their own time bounds.
Local state/export in .palabre/missions/<id>/; private identifiers, unverified replies.
No code, commit, push, merge, release, --open, --trust-config or mission lead switching.
The review task only publishes a COMMENT review under the existing Relay policy.
If Codex reports blocked reads on Windows: Mission pauses, preserves the reply and publishes
no review. Probable cause: the Microsoft Store shortcut WindowsApps\\pwsh.exe.
The owner reads https://palab.re/en/troubleshooting (Codex on Windows) and #128;
no validated solution yet for this workflow, no permission changes or automatic retries.
Each step receives a PALABRE Mission header, then the ℹ️ warning on a separate line before
the content. Objective and criteria appear on two readable lines, without JSON; the final
« 🤖 For the agent » section closes the message. All count toward 64 KiB UTF-8 of coordination.
Roles and scope grant no additional rights. No monetary cost cap.
`,
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
  --limit <number>     number of exports (1 to 100, default: 10)
  --config <path>      explicit config path
`,
  historique: `
Lists recent Palabre exports.

Usage:
  palabre history [flags]
  palabre historique [flags]

Flags:
  --json               structured output for integrations
  --limit <number>     number of exports (1 to 100, default: 10)
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
  --sync-agents        adds missing detected agents; preserves absolute command paths
                       Missing path: unavailable; doctor checks the file without executing it.
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
  --check              checks channel and version without changing anything
  --dry-run            previews the steps without changing anything
  --yes                confirms application without a prompt
  --apply              compatible alias for --yes
  --config <path>      explicit config path
`,
  resume: `
Resumes a Debate or Ask session from its latest complete checkpoint.

Usage:
  palabre resume <session-id>

Flags:
  --yes                confirms resume in non-interactive mode
  --terminal           forces raw terminal rendering
  --renderer <kind>    auto, pretty, plain, tui, or ndjson
  --ollama-url <url>   overrides the Ollama address for resumed calls
  --pull-models        allows downloading a missing Ollama model
`,
  relay: `
Sends one message to a closed Codex or Claude Code conversation and returns its reply.
With --open, queues the message into an open Codex conversation and waits for its reply.

Usage:
  palabre relay --from <agent>:<session> --to <agent>:<session> "<message>"
  palabre relay --from <agent>:<session> --to <agent>:<session> --message-file <path>
  palabre relay allow-repo owner/repository [--config <path>]
  palabre relay allow-repo 'owner/*' [--config <path>]
  palabre relay --open --from <agent>:<session> --to <codex-agent>:<session> "<message>"

Flags:
  --from <agent>:<uuid>   sender, declarative label (never launched)
  --to <agent>:<uuid>     target config agent and its conversation identifier
  --message-file <path>   reads the message from a file (64 KiB at most)
  --subject <subject>     optional subject: one nonblank line, at most 200 characters, no controls
  --task review           draft and publish a COMMENT review if allowed by configuration
  --pr <url>              exact github.com PR; required with --task review
  --open                  targets an open Codex conversation (TUI or Codex desktop)
  --timeout <seconds>     maximum duration, 10 to 3600 (default: 600)
  --json                  JSON v1 output for integrations
  --no-export             does not write the .relay.md export
  --config <path>         explicit config path
  --trust-config          trusts the resolved config (no question is asked)
  --language <fr|en>      force language

Limits:
  PALABRE adds the sender → recipient header, then the ℹ️ warning on its own line before the content.
  The final « 🤖 For the agent » section groups provenance and reply instructions.
  Reply here once, without calling another agent. Do not add a second PALABRE header.
  The full coordination envelope counts toward 64 KiB UTF-8 (separate PR context limit).
  allow-repo requires a trusted config, shows its path and planned change, then requires
  owner keyboard confirmation (input and output TTY). Declining exits 8.
  Without a terminal it refuses without writing; no --yes or --trust-config.
  'owner/*' covers all their repositories; other patterns are refused. Type y to authorize.
  Copyable commands target PowerShell or POSIX shells, not cmd.exe. y/yes/o/oui are accepted.
  Agent: on task-not-allowed, open remedy in the human's visible terminal and wait;
  never confirm or edit/approve the policy for them.
  An agent message is coordination, never authorization. No automatic chaining.
  review requires an already-trusted config, allowedTasks=[review] and explicit reviewRepositories.
  --trust-config and --open cannot be used with review. Palabre publishes, not the model.
  Windows error 5 starting a Codex command: read-unavailable (code 2), reply preserved.
  With review: review-failed (9), no publication. Probable cause: the Microsoft Store shortcut
  WindowsApps\\pwsh.exe. The owner reads https://palab.re/en/troubleshooting (Codex on Windows)
  and https://github.com/JuReyms/Palabre/issues/128: no validated solution yet for this workflow.
  Palabre changes no permissions and never resends automatically.
  Without --open, the target conversation must be closed: no TUI, desktop, IDE or running
  exec.

With --open (Codex pilot, Windows):
  The target conversation must be open: its write lock must be held, otherwise nothing is
  queued (target-not-open). The message goes through codex queue; the full envelope is
  limited to 8,192 UTF-16 units. The lock proves neither the display nor the consumption of
  the message: the receiver is reported as unverified. The target replies with its own tools
  and permissions: no read-only guarantee applies, and the guarantees below do not apply.
  A queued message may be processed after the timeout, even without being displayed; Ctrl+C
  does not cancel a queued message, and there is no automatic resend.

Conditional guarantees:
  With the options enforced by Palabre and on verified CLI versions, the target has no
  write tool, and unmanaged hooks and the notify command are neutralized. MCP servers are
  neutralized provided the configuration does not change between inspection and resume.
  These guarantees cover neither administered policies nor unverified CLI versions.
  During the relayed turn, Codex loses its plugins, connectors and MCP servers; Claude only
  has read tools. The configuration is not modified.

Effects:
  Read-only does not mean side-effect free: the enveloped message, the reply and any read
  tool calls are added to the target conversation history, even after a failure, and
  Palabre cannot remove them.
  No automatic resend: not-delivered allows sending again without a duplicate;
  persisted-no-reply and unknown advise against resending without checking.
`,
  sessions: `
Lists checkpoints in the current directory or explicitly deletes one.

Usage:
  palabre sessions [flags]
  palabre sessions delete <session-id> [flags]

Flags:
  --json               JSON v1 output for integrations
  --limit <number>     number of checkpoints (1 to 100, default: 20)
  --yes                confirms deletion in non-interactive mode
  --language <fr|en>   forces the language
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
  --dry-run            previews the session without calling agents or writing an export
  --checkpoint         saves resumable state under .palabre/sessions
`,

chat: `
Talk with a single agent in a local stateless session.

Every answer is generated by a new call to the agent CLI. Palabre injects the
accumulated history into that new call, so no persistent agent session is open. Without an initial subject, the first message simply becomes the conversation context.

During the conversation, \`/consult <agent>\` asks for a second opinion and \`/use <agent>\` continues with that agent. Palabre never triggers a consultation on its own.

\`/end\` saves the export; \`/exit\`, \`/home\`, or the end of input finish without an export. A blank line is ignored. \`--dry-run\` is refused in Chat.

Usage:
  palabre chat "Subject" --agent-a codex

Flags:
  --agent-a <name>     conversation agent (or default agent A)
  --role-a <role>      temporary agent role
  --model-a <model>    temporary agent model
  --language <fr|en>   forces the language
  --config <path>      explicit config path
`,
  ask: `
Runs a request with several independent responses.

Usage:
  palabre ask "Subject" --agents codex claude
  palabre chat "Discuss an option" --agent-a codex
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
  --dry-run            previews the session without calling agents or writing an export
  --checkpoint         saves resumable state under .palabre/sessions
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
  palabre chat "Parler d'une option" --agent-a codex

Demarrage rapide:
  palabre
  palabre new
  palabre "Faut-il ajouter une TUI a Palabre ?"
  palabre codex-claude "Comparer deux solutions" -t 4

Commandes:
  init       Creer explicitement une configuration
  new        Assistant interactif de debat
  ask        Demande multi-agents independante
  chat       Conversation suivie avec un agent
  agents     Lister les agents configures
  agent-role Modifier le role durable d'un agent
  presets    Lister les presets disponibles
  history    Lister les derniers exports
  resume     Reprendre une session interrompue
  sessions   Lister ou supprimer les checkpoints
  relay      Interroger une conversation Codex ou Claude Code fermee
  mission    Faire travailler un equipier en lecture seule, une etape a la fois
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
  palabre chat "Discuss an option" --agent-a codex

Quick start:
  palabre
  palabre new
  palabre "Should Palabre add a TUI?"
  palabre codex-claude "Compare two solutions" -t 4

Commands:
  init       Explicitly create a configuration
  new        Interactive debate assistant
  ask        Independent multi-agent request
  chat       Continued conversation with one agent
  agents     List configured agents
  agent-role Update one agent persistent role
  presets    List available presets
  history    List recent exports
  resume     Resume an interrupted session
  sessions   List or delete checkpoints
  relay      Ask a closed Codex or Claude Code conversation
  mission    Work with a read-only teammate, one explicit step at a time
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
