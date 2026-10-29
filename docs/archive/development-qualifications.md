# Qualifications de développement historiques

Ces notes sont extraites de l’ancien `AGENTS.md` lors de son allègement le 26 octobre 2026. Elles conservent des constats et un ancien état de chantier, sans constituer des consignes actuelles ni une preuve de compatibilité des versions présentes. Pour agir, lire [AGENTS.md](../../AGENTS.md) puis les références indiquées.

## Ancienne note A0–A5, devenue obsolète

> État : la commande `palabre relay` est disponible (lots A0 à A4, non publiée). Elle vit dans `src/commands/relay.ts`, le socle et les adapters dans `src/externalSessions/`. Le smoke réel avec de vrais agents (A5) reste à faire avant publication.

Cette note d’avant qualification contredit les observations A5 ajoutées ensuite. Elle ne doit plus être utilisée pour annoncer que Relay n'est pas publié ou que le premier smoke A5 reste à faire. Les limites techniques et les observations de cet essai sont conservées dans [le contrat Relay](../dev/relay.md#engagements-et-limites).

## Anciens essais batch, contexte et TUI

Combinaisons validees localement :

- `ollama ↔ ollama` avec `gemma4:e4b`
- changement Ollama `nemotron-3-nano:4b` vers `gemma4:e4b` avec dechargement de l'ancien modele
- `codex exec ↔ ollama`
- `claude --print ↔ ollama`
- `agy --print ↔ ollama`
- `codex exec ↔ claude --print`
- `--show-prompt` avec `--files`
- `--show-prompt` avec `--context docs`
- `palabre context scan src --json`
- `palabre new` simule par entree standard avec `--show-prompt` pour verifier le wizard sans appeler d'agent
- contexte de session visible dans `--show-prompt`
- arret anticipe sur accord clair
- syntaxe courte `palabre preset "sujet" -t 4`
- alias sujet `palabre -s "sujet" -t 2`
- detection des limites d'usage CLI type Codex/Claude/Antigravity par simulation stderr
- `init` avec config globale et `init --local` dans un dossier temporaire pour verifier la detection locale
- `update --check` et `update --dry-run`, avec plan adapte au canal source/npm/pnpm/Yarn/Bun
- etat "agent en cours" en rendu pretty
- synthese finale avec `defaults.summaryAgent`, fallback agent B
- `--no-summary`
- erreurs adapter `empty-output`, `non-zero-exit`, `model-unavailable`
- erreur adapter `output-too-large`
- evenement NDJSON `error` et export partiel apres interruption
- warning Ollama sans contexte
- rendu console pretty et `--plain`

Ces tests ont confirme que le mode batch est deja exploitable avant l'adapter PTY.
