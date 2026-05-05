# Notes personnelles sur Palabre

Ce fichier est réservé aux idées personnelles du mainteneur.

## Idées à explorer

- Gestion de l'historique des conversations.
- Afficher le modèle utilisé quand Palabre peut le connaître.
- Version anglaise et française — choix de la langue à l'installation.
- Ajouter LM Studio via un provider compatible OpenAI local.
- Ajouter OpenCode via un provider compatible OpenAI local.
- Créer un rôle/config dédié `summarizer` pour éviter que `agentB` soit toujours le synthétiseur par défaut.

## Observations

### OpenSource 

Voir conversation > C:\Users\jurey\Documents\Dev\Chicane\palabre-2026-05-05T11-30-42-773Z.debate.md

### Prérequis providers

Pour utiliser Palabre, chaque provider doit être installé séparément :

- **Claude Code** — abonnement Anthropic requis.
- **Codex** — abonnement OpenAI requis.
- **Gemini** — gratuit avec limitations, ou abonnement Google AI.
- **Ollama** — gratuit en local (usage actuel) ou version cloud disponible.

### Rôles des agents

Les rôles définis dans `src/types.ts` méritent d'être mieux documentés :

```ts
export type AgentRole =
  | "implementer"
  | "reviewer"
  | "architect"
  | "scout"
  | "critic"
  | "summarizer";
```

À clarifier : Comment utiliser les rôles et comment chaque rôle influence concrètement les prompts et le comportement de l'orchestrateur.

### Branches de développement

Plusieurs branches locales peuvent coexister. Le terminal utilisera toujours la branche active au moment du `pnpm build` + `pnpm link --global` — c'est le `dist/` compilé à ce moment-là qui est exécuté.

### Documentation en ligne

Un site de documentation est disponible à l'adresse **https://palab.re** — nom de domaine définitif. L'URL Netlify **https://palabre.netlify.app** reste active.

### Faire débattre deux instances du même agent

Il est possible de configurer deux entrées pointant vers le même CLI, par exemple deux Claude Code. Les deux instances s'exécutent indépendamment et ne partagent pas de contexte entre elles.

### Mise en page de l'en-tête dans les exports `.debate.md`

L'en-tête de session est rendu avec des `**bold:**` séparés par des retours à la ligne. Selon le renderer Markdown utilisé, cela peut s'afficher sur une seule ligne au lieu d'un bloc structuré. Exemple du rendu non souhaité :

> Sujet: ... Agents: claude <-> gemini Modeles: default <-> default Auto-pull Ollama: no ...

À corriger dans `src/output.ts` — utiliser une table ou un bloc de code pour garantir le rendu.

### Config par dossier courant (comportement actuel)

Quand `palabre` est lancé dans un dossier sans `palabre.config.json`, il en crée un automatiquement sur place, puis quitte en demandant de l'éditer. Cela provoque une erreur `EPERM` dans les dossiers protégés (ex. `C:\Windows\System32`) et génère une copie de config dans chaque dossier utilisé.

Chaque copie est indépendante — aucune synchronisation si la config « source » est modifiée ailleurs.

**Solution envisagée :** config globale dans `~/.palabre/palabre.config.json`, consultée en fallback quand aucune config locale n'est présente.

### Installation sur macOS

Le code est cross-platform. Installation depuis le repo :

```bash
git clone <repo>
cd Chicane
pnpm install
pnpm build
pnpm link --global
```

Le problème de config par dossier courant s'applique également sur Mac. À corriger avant de documenter l'installation multi-plateforme.

### Compatibilité avec d'autres gestionnaires de paquets

- **Utilisateur final** (une fois publié sur npm) : `npm install -g palabre` et `yarn global add palabre` fonctionneront — le binaire est un script Node.js standard.
- **Développement/contribution** : pnpm requis — `package.json` déclare `"packageManager": "pnpm@10.18.3"` et `palabre update --apply` hardcode les commandes pnpm.


### Readme et documentation
- Readme actuel en français, mettre en anglais bientôt avec [English](#english) | [Français](#français) dans le menu.
- Documentation est actuellement en français et en ligne sur https://palab.re, à maintenir à jour avec les évolutions du projet.
- Ajouter une version anglaise de la documentation pour élargir l'audience
- Verfifier pour la synchronisation (fr/en) entre le repertoire actuel du projet cli https://github.com/JuReyms/Palabre et la documentation en ligne https://palab.re (repo :https://github.com/JuReyms/palabre-app )
