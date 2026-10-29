---
title: Installation
description: Installer Palabre depuis npm, vérifier la commande et préparer les agents IA utilisés par les débats et demandes Ask.
seo:
  title: Installer depuis npm et brancher vos agents IA
  description: Installer Palabre globalement avec npm, vérifier la commande et connecter Claude Code, Codex, OpenCode ou Ollama avant le premier débat.
---

## Prérequis

Palabre nécessite :

- Node.js 20 ou plus ;
- au moins un agent déjà installé sur votre machine parmi Claude Code, Codex CLI, Antigravity CLI, OpenCode, Mistral Vibe ou Ollama.

Deux agents ou plus sont recommandés : un débat a besoin d'une paire, et le mode Ask devient surtout utile quand plusieurs réponses indépendantes sont comparées.

## Installer Palabre

Palabre est publié comme package Node.js sur npm. Installez-le globalement avec le gestionnaire de paquets de votre choix :

```bash
# npm
npm install --global palabre

# pnpm
pnpm add --global palabre

# Yarn
yarn global add palabre

# Bun
bun add --global palabre
```

Palabre n'est pas un package Python : `pip` ne peut pas l'installer. Il n'existe pas non plus d'installateur officiel via `curl` ; n'utilisez pas de commande `curl ... | sh` non documentée.

Vérifiez ensuite que la commande est disponible :

```bash
palabre --version
palabre --help
```

## Installer depuis le dépôt source

Cette section concerne les personnes qui veulent tester Palabre depuis le dépôt Git. Elle nécessite `pnpm`.

```bash
git clone https://github.com/JuReyms/Palabre.git
cd Palabre
pnpm install
pnpm build
pnpm link --global
palabre --version
```

Dans le reste de cette documentation, les exemples utilisent toujours la commande utilisateur finale `palabre`.

## Installer les agents

Palabre pilote des outils externes. Installez et authentifiez les agents que vous souhaitez utiliser avant de lancer Palabre.

Les conditions d’accès, les modèles et les limites de Claude Code, Codex, Antigravity, OpenCode et Mistral Vibe dépendent de leur fournisseur et de votre configuration. Avec Ollama et un modèle installé localement, les requêtes sont exécutées sur votre machine ; un serveur distant reçoit les données que vous lui envoyez.

Pages utiles :

- [Claude Code](/fr/agents/claude-code)
- [Codex](/fr/agents/codex)
- [Antigravity](/fr/agents/antigravity)
- [OpenCode](/fr/agents/opencode)
- [Mistral Vibe](/fr/agents/vibe)
- [Ollama](/fr/agents/ollama)

## Étape suivante

Lancez maintenant `palabre` dans un terminal interactif. Au premier lancement, Palabre crée la configuration globale si nécessaire, détecte les agents installés et ouvre l'accueil TUI.

Pour un setup explicite, des scripts ou une configuration locale au projet, consultez [la configuration](/fr/get-started/configuration). Si vous utilisez VS Code, vous pouvez aussi installer [l'extension Palabre](/fr/get-started/vscode-extension). Pour piloter Palabre depuis un agent IA, installez [le skill Palabre](/fr/get-started/skill).

## Mettre à jour

Vous arrivez sur un autre ordinateur, même déjà utilisé ? Suivez [Changer de machine](/fr/get-started/change-machine) : inventaire sans modification, remise à niveau et nouvelle conversation Relay.

`palabre update` détecte l'installation et les copies du skill, affiche le plan et demande une confirmation unique en terminal interactif. Les copies sont rafraîchies depuis le nouveau paquet après sauvegarde hors des dossiers de skills, en conservant les jonctions. `palabre update --check` vérifie sans modifier l'installation. Pour le skill seul, sans réseau : `palabre skill --sync`. Votre assistant peut relire les consignes actuelles sans redémarrer ; détails : [Skill Palabre](/fr/get-started/skill).

Après une mise à jour directe avec votre gestionnaire de paquets (par exemple `npm install --global palabre`), les copies installées restent intactes. Palabre signale les écarts en terminal interactif, sans modifier les sorties machine. Votre assistant peut relire les consignes actuelles du paquet et poursuivre dans le cadre autorisé, sans synchronisation ni redémarrage de votre part. Si vous souhaitez aussi aligner les fichiers installés, `palabre skill --check` vérifie leur état et `palabre skill --sync` affiche un plan à confirmer, avec sauvegarde des copies remplacées. Voir [Skill Palabre](/fr/get-started/skill).

Des fichiers identiques ne prouvent pas ce que l'agent a chargé.

Relay et son option Mission utilisent des conversations Codex ou Claude Code existantes. Chaque fournisseur fixe ses conditions d'accès et ses limites ; PALABRE ne les remplace pas.
