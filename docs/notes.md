# Notes sur Chicane

## 1. A faire

- Detecter si les IA sont déja installé (Gemini, Claude et Codex) lors de l'init.
- Voir si ollama est disponible
- Documentation pour les utilisateurs finaux (comment installer, comment utiliser, etc.)
- montrer que les ia's sont en train de reflechir (ex: pointillés qui bougent, un loader, ou une animation, etc.) dans le terminal car pour ollama ça peut etre long de charger le model. L'utilisateur attend dans le vide pendant qu'un agent répond. Avec `stream: false` sur Ollama et des CLIs batch, le silence peut durer 30 secondes. Un spinner ou un indicateur "agent X en cours..." est le strict minimum avant de parler de TUI.
- gestion de l'historique des conversations 
- afficher le model si possible (pour ollama et aussi pour les ia's proprietaires)

## 2. idées d'amélioration

- Version anglaise et francais. Lors de l'installation on choisi sa langue. 
- Ajouter LM Studio en provider 


## 3. Idées interessantes venant de discussions "Chicane"

- Une IA dit : "Je recommande fortement de créer un rôle dédié : **`summarizer`**. L'arbitraire de laisser `agentB` faire la synthèse est un risque de biais. Un `summarizer` dédié recevrait l'historique complet du débat (le *state*) et aurait un prompt spécifique : "Synthétiser les 3 points de consensus et les 2 points de désaccord majeurs." Cela garantit une sortie structurée et non dépendante du rôle de l'agent précédent.

## 4. Roadmap priorisee

### P0 - Installation et premiers retours utilisateur

- Detecter `codex`, `claude`, `gemini` et Ollama pendant `chicane init`.
- Afficher un resume clair des outils detectes et manquants.
- Generer une config dont les defaults utilisent une paire detectee quand c'est possible.
- Afficher un etat "agent en cours" pendant les appels longs, avant le vrai TUI.

Statut :

- Fait : detection locale pendant `init`, resume des outils et defaults adaptes quand une paire est detectee.
- Fait : etat vivant pendant qu'un agent repond en rendu pretty.
- Prochaine etape P0 : tester l'installation globale via `pnpm link --global`.

### P1 - Transparence pendant les debats

- Afficher le modele utilise quand Chicane peut le connaitre.
- Pour Ollama : afficher le modele configure ou override.
- Pour les CLIs : afficher `default` si aucun override n'est fourni, car le vrai modele depend de la config interne de la CLI.
- Garder la synthese finale explicite et documenter le biais possible si `agentB` est le synthétiseur par defaut.

### P2 - Documentation utilisateur

- Versionner les guides utilisateurs : demarrage rapide, configuration, lancer un debat, troubleshooting.
- Documenter clairement la difference entre `--files`, `--context` et les capacites internes des CLIs.
- Ajouter une section Ollama : modeles locaux modestes, validation, auto-pull, dechargement.

### P3 - Historique et reprise

- Stabiliser le format `.debate.md`.
- Ajouter ensuite une commande `chicane history`.
- Plus tard : relancer un debat depuis un transcript existant.

### P4 - Providers et internationalisation

- Ajouter un adapter `openai-compatible` plutot qu'un adapter LM Studio specifique, afin de couvrir LM Studio, LocalAI, vLLM et autres serveurs locaux compatibles.
- Prevoir le francais/anglais plus tard, quand les messages CLI seront plus stables.
