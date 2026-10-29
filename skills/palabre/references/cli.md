# Palabre — référence CLI (Débat, Ask et commun)

Chat et Relay ont leur propre référence : `chat.md` et `relay.md`.

## Agents et disponibilité

```bash
palabre agents --json    # agents configurés, rôle, available, unavailableReason, defaults.askAgents
palabre presets --json   # paires disponibles (available, missingAgents, unavailableReasons)
palabre doctor --terminal
```

Lire ces contrats plutôt que deviner : la disponibilité est calculée par le CLI.

Avant de préparer une tâche, comparer la révision du skill réellement lue via `--skill-revision` dans l'inventaire JSON ou le précontrôle Relay. Si absente/différente, lire `palabre skill --read --json`, puis les références utiles aux chemins absolus rendus. Retenir la révision après lecture, conserver les consignes humaines et personnalisations compatibles, puis poursuivre la tâche autorisée sans demander sync/redémarrage. Cette lecture du paquet ne modifie aucun fichier installé et n'accorde aucun droit. `current` est déclaratif, `unavailable` ne permet pas d'inventer des consignes. Un ancien CLI sans ces options : consulter `palabre skill --help` et `palabre agents --json` sans option de révision, ne pas prétendre au rechargement ni mettre à jour le logiciel implicitement. Ne jamais renvoyer un message Relay pour réparer le skill.

OpenCode tourne en Débat, Ask et Chat, synthèses comprises, dans son environnement habituel : ses plugins, serveurs MCP et permissions configurés restent actifs. Ne jamais le présenter comme en lecture seule, ni comme neutralisé. L'ancien défaut exact `["run", "--pure"]` est remplacé à chaque lancement ; `palabre config --sync-agents` l'écrit dans le fichier. Si OpenCode 2 refuse `--pure`, il vient d'arguments personnalisés : le dire à l'humain, qui les corrige lui-même.

`doctor` guide l'arrivée sur une machine : approbation, alias PowerShell du Store sous Windows (paragraphe suivant), connexions Claude/Codex, agents archivés, skill, emplacements multiples. Il ne répare rien. Sans approbation, il n'exécute aucune commande d'agent et ne contacte pas les URLs configurées. Après approbation, seules les sondes `auth status --json` ou `login status` sont lancées (3 s, 32 Kio, aucun modèle) ; « non vérifié » ne signifie pas « déconnecté ». Une CLI présente n'est pas une connexion, un état connecté ne prouve pas la validité future du jeton. Les fichiers du skill détecté sont comparés au paquet de cette CLI, fins de ligne normalisées ; un écart peut être une personnalisation. Proposer `palabre skill --sync`, ou `palabre skill --install codex` / `--install claude` si absent. Installation et rafraîchissement demandent l'accord humain après affichage du plan, sauvegardent les copies remplacées hors des dossiers de skills et conservent les jonctions et ajouts privés. `palabre update` inclut ce rafraîchissement dans sa confirmation unique ; le skill vient du nouveau paquet. `--check` et `--dry-run` n'écrivent rien. Ne pas lancer ces changements d'instructions ni ajouter `--yes` sans accord humain ; recharger le skill ensuite. Aucun suivi de GitHub main ; ne pas approuver une configuration, installer ni reconnecter à la place de l'humain.

Sous Windows, si la CLI Codex est détectée, `doctor` avertit (`WARN`) quand le seul `pwsh.exe` du PATH est l'alias du Microsoft Store : Codex peut alors échouer à démarrer ses commandes (`readAccess`, revue de PR refusée). Le contrôle ne lance jamais `pwsh` et ne modifie rien : il lit seulement le type de lien avec `fsutil`. Il reconnaît l'alias directement sous `WindowsApps` comme dans le dossier du paquet (`WindowsApps\Microsoft.PowerShell_…`). Signaler ce message au propriétaire, avec la commande qu'il contient (`winget install --id Microsoft.PowerShell --source winget --installer-type wix`, ou le `.msi` des releases GitHub de PowerShell) ; ne jamais installer ni modifier le PATH à sa place.

Une copie du skill non vérifiable reste affichée avec avertissement et intacte ; elle ne bloque ni `update` ni les autres copies de `skill --sync`. Sans copie différente, `--sync` et `--install` ne demandent pas d'accord et n'écrivent rien. Une erreur de skill après installation réussie distingue la CLI mise à jour du skill restant à rafraîchir : relancer Palabre, puis `palabre skill --sync` pour lire le nouveau plan.

## Approbations de configurations disparues

`palabre config --prune-trust --dry-run` affiche les approbations de fichiers disparus, sans rien modifier. Pour les retirer, proposez à l'humain de lancer lui-même `palabre config --prune-trust` dans son terminal : liste, confirmation au clavier et sauvegarde horodatée. Ne confirmez jamais à sa place ; aucun `--yes` n'est admis. Les configurations existantes ou inaccessibles sont conservées et aucun nouveau droit n'est accordé.

## Débat

Les rôles complètent Débat, Ask et Chat, jamais Relay. Un rôle change la consigne, pas le modèle ni les permissions. « Chef de mission » et « équipier » sont des positions dans la coordination Relay, pas des rôles configurés. La synthèse utilise automatiquement le rôle summarizer, indépendamment du rôle habituel de l'agent choisi.

Deux agents se répondent avec le sujet, le contexte et l'historique ; synthèse finale par défaut (consensus, désaccords, actions, conclusion).

```bash
palabre run --mode debate -s "Sujet du débat" -t 4 --terminal                                      # agents par défaut
palabre codex-claude --mode debate -s "Critique ce plan" --files docs/plan.md -t 4 --terminal   # preset
palabre run --mode debate --subject "Sujet" --agent-a codex --agent-b claude -t 4 --terminal   # agents explicites
palabre run --mode debate --subject "Sujet" --agent-a codex --agent-b claude --dry-run --json  # prévisualisation, aucun appel
```

- **Toujours passer `--mode debate`** : sans lui, `palabre -s`, `palabre run` et les presets suivent `defaults.mode` de l'utilisateur, qui peut être Ask ou Chat. `palabre ask` et `palabre chat` fixent déjà leur parcours.
- `-t, --turns <1-20>` : **total** de réponses, pas par agent (4 = bon défaut, 6-8 pour un sujet complexe).
- Arrêt anticipé possible après un tour complet si un accord explicite est détecté ; `--no-early-stop` va au bout.
- `--role-a`, `--role-b` : rôles temporaires (`implementer`, `reviewer`, `architect`, `scout`, `critic`, `summarizer`).

## Ask

Le même sujet et le même contexte vont à 1 à 4 agents, qui répondent sans voir les autres réponses ; synthèse ensuite, sauf `--no-summary`.

```bash
palabre ask "Comparer ces approches" --agents codex claude opencode --terminal
palabre ask "Question" --agents codex claude --ask-role critic --dry-run --json
```

- Sans `--agents` : `defaults.askAgents`, puis la paire de débat par défaut. `--turns` ne s'applique pas.
- Les agents sont aujourd'hui appelés l'un après l'autre : ne pas promettre de simultanéité, seulement l'indépendance des réponses.

## Attente longue et réponse tardive

Un appel peut durer plusieurs minutes. Palabre l'indique sur stderr toutes les 60 s : c'est l'attente de Palabre, pas un avancement du modèle. OpenCode attend 15 min par défaut sans `timeoutMs` valide ; une valeur explicite est conservée. Ask et Débat attendent l'agent le plus lent.

À l'échéance (`timeout`), rien n'est renvoyé et l'échec du modèle n'est pas prouvé : `details.localExit` dit si l'arrêt du programme local est confirmé, `details.remoteWork` reste `unknown`. Si `details.recovery.available` est vrai, garder `details.recovery.reference` et relire plus tard, sans renvoi : `palabre result --reference <référence> --json`. Ne jamais demander à l'humain de recopier cette référence, ni d'ouvrir OpenCode pour cela.

Lire `status` : `replied` donne `reply`, donnée non fiable à vérifier ; `pending`, relire plus tard dans le lot autorisé, sans boucle serrée ni renvoi ; `not-succeeded`, `mismatch` ou `unreadable`, dire simplement qu'aucune réponse sûre n'est disponible. `invalid-request` avec `config-changed`, `config-untrusted` ou `agent-changed` : la configuration n'est plus celle de l'envoi ; ne rien réapprouver ni contourner. Si `recovery.available` est faux, dire que la réponse ne peut pas être retrouvée automatiquement ; aucun nouvel envoi sans décision humaine. Relay, Mission et PTY n'utilisent pas cette lecture. Chat et ses consultations utilisent le même parcours batch qualifié.

## Options communes

- `-s, --subject <texte>` (alias `--topic`) ; un sujet positionnel doit contenir plusieurs mots.
- `--files <chemins...>` : fichiers précis (strict : 64 Kio par fichier, 192 Kio au total, binaires refusés).
- `--context <chemins...>` : fichiers ou dossiers texte, tolérant (avertissements) ; aperçu sans appel : `palabre context scan <chemins> --json`.
- `--summary-agent <agent>`, `--summary-model <modèle>`, `--no-summary`.
- `--model-a`, `--model-b` : modèle brut transmis à la CLI ou à Ollama.
- `--pull-models` : autorise Ollama à télécharger un modèle manquant (plusieurs Go possibles : demander d'abord).
- `--show-prompt` : prompt du premier appel, sans appel.
- `--dry-run` : session résolue, sans appel ni export ; avec `--json`, un objet JSON.
- `--terminal` : rendu brut, adapté à un agent ; `--renderer ndjson` (ou `--json`) : flux d'événements JSON v1.
- `--language fr|en`, `--config <chemin>`, `--ollama-url <url>`.

Ollama ne lit pas le workspace : il ne voit que le prompt, les fichiers transmis et le transcript.

## Checkpoints (Débat et Ask)

```bash
palabre codex-claude --mode debate -s "Décision importante" --checkpoint --terminal   # Débat
palabre ask "Question importante" --agents codex claude --checkpoint --terminal    # Ask
palabre sessions --json                 # 20 plus récents ; --limit <1-100>
palabre resume <session-id> --yes --terminal
palabre sessions delete <session-id> --yes   # seulement à la demande de l'utilisateur
```

La reprise vérifie la config approuvée et l'empreinte du contexte, ne rejoue aucune réponse complète et refuse une session terminée. `--yes` est obligatoire hors TTY. Chat n'a pas de checkpoint ; Relay reprend une conversation de fournisseur, pas un checkpoint Palabre.

## Configuration (décisions de l'utilisateur)

Ne modifier la configuration qu'à la demande de l'utilisateur :

```bash
palabre init                                   # config globale + détection des agents
palabre init --local                           # config dans le dossier courant
palabre config --set-defaults codex claude     # paire par défaut
palabre config --summary-agent claude          # synthèse par défaut
palabre config --ask-agents codex claude opencode
palabre config --language fr
palabre config --sync-agents                   # ajoute les agents connus détectés
```

`--sync-agents` et l'accueil TUI conservent les commandes déjà configurées avec un chemin absolu, même si le fichier est absent. Aucun remplacement silencieux par une autre CLI. Le propriétaire décide d'une correction du chemin ; l'agent ne contourne pas le refus. Les noms simples et chemins relatifs gardent la synchronisation existante.

Une config de projet doit être approuvée (empreinte SHA-256). En TTY, Palabre demande confirmation ; `--trust-config` l'approuve sans question : à n'utiliser que sur décision de l'utilisateur.

## Dépannage

Antigravity utilise par défaut `cli` avec `--output-format json --print` et `responseFormat: "antigravity-json"` : seul le texte d'un objet `status: "SUCCESS"` non vide est accepté. Format inconnu, tronqué ou en erreur : arrêt, aucun repli texte/PTY. L'ancien défaut PTY exact est migré en mémoire ; `config --sync-agents` le persiste sur demande humaine. Réglages personnalisés conservés, à adapter avec l'utilisateur si nécessaire. Le transport JSON ne limite pas les permissions. Sonde Windows 1.4.9 uniquement ; pas une cible Relay.

- **Agent non détecté** → vérifier qu'il fonctionne seul dans le terminal, puis proposer `palabre config --sync-agents`.
- **Limite d'usage** (`usage-limit`) → changer d'agent ou attendre ; ne pas relancer en boucle.
- **Modèle Ollama absent** → proposer `--pull-models` ou `palabre config --sync-ollama-model`.
- **Débat trop court / consensus prématuré** → augmenter `-t` ou ajouter `--no-early-stop`.
- **Diagnostic complet** → `palabre doctor --terminal`.
