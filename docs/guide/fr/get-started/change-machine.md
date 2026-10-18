---
title: Changer de machine
description: Reprendre un projet avec Relay sur une autre machine, même déjà utilisée, sans transporter les approbations ni les conversations locales.
seo:
  title: Changer de machine et reprendre avec Relay
  description: Préserver le travail local, remettre PALABRE et les agents à niveau, réinstaller le skill et repartir avec une nouvelle conversation Relay.
---

Votre projet et son suivi voyagent avec GitHub. Les connexions des agents, les approbations et les conversations restent locales. Sur la machine d'arrivée, préparez PALABRE puis créez un nouvel équipier avec `--new`.

Ce parcours vaut pour Windows, macOS et Linux. Sur une machine déjà utilisée, commencez par l'inventaire ci-dessous. Ne supprimez aucun ancien clone ni dossier `.palabre/` avant d'avoir retrouvé le travail à conserver.

## 1. Faire l'état des lieux sans modifier les installations

Dans chaque ancien clone, sur les deux machines si elles sont accessibles :

```text
git --no-optional-locks status --short --branch
git --no-optional-locks diff --stat
git --no-optional-locks diff --cached --stat
git log --oneline --branches --not --remotes
git worktree list
```

Ces commandes montrent les fichiers modifiés ou non suivis, les commits absents des références distantes locales et les copies de travail séparées. Les références peuvent dater : vérifiez aussi GitHub avant de conclure qu'un commit a été poussé. `--no-optional-locks` évite les rafraîchissements facultatifs de l'index pendant cet inventaire. Ne lancez pas encore de mise à jour dans un clone contenant du travail non sauvegardé.

Repérez les installations utilisées. Dans PowerShell :

```powershell
Get-Command node,palabre,codex,claude,pwsh,powershell -All -ErrorAction SilentlyContinue | Select-Object Name,Source
```

Dans Bash ou Zsh, sur macOS ou Linux :

```sh
type -a node palabre codex claude
```

Pour les commandes présentes, relevez les versions :

```text
node --version
palabre --version
codex --version
claude --version
```

Plusieurs chemins peuvent désigner plusieurs installations. Sous Windows, un chemin `WindowsApps` peut être un alias du Microsoft Store, pas l'installation attendue. Ne supprimez rien pour faire disparaître un doublon ; identifiez l'installation à garder avec le [dépannage Windows](/fr/troubleshooting). Le diagnostic complet des doublons reste suivi dans [#153](https://github.com/JuReyms/Palabre/issues/153).

Regardez aussi si le dossier personnel PALABRE existe. PowerShell :

```powershell
if (Test-Path -LiteralPath "$HOME/.palabre") {
    Get-ChildItem -LiteralPath "$HOME/.palabre" -Force
}
```

Shell POSIX :

```sh
if [ -d "$HOME/.palabre" ]; then
    ls -la "$HOME/.palabre"
fi
```

Repérez les configurations du projet (`palabre.config.json`, ou l'ancien `chicane.config.json`) et les copies du skill : `~/.agents/skills/palabre/`, `~/.claude/skills/palabre/`, l'ancien `~/.codex/skills/palabre/` et les dossiers de skills du projet. Vérifiez aussi les skills ajoutés dans votre application. Gardez les sauvegardes hors des dossiers où les agents chargent leurs skills.

### PALABRE installé depuis un clone du dépôt (version de développement)

Si `palabre --version` indique une ancienne version installée depuis un clone, mettez le clone à jour vous-même, après avoir préservé le travail repéré à l'étape 1 :

```text
git -C <dossier-du-clone> switch main
git -C <dossier-du-clone> pull --ff-only
pnpm -C <dossier-du-clone> install
pnpm -C <dossier-du-clone> build
cd <dossier-du-clone>
pnpm link --global
palabre --version
```

Avant la 0.17.0, `palabre update` affiche seulement des instructions, et `--check` n'existe pas. Si Git refuse la mise à jour (changements locaux, branche différente), arrêtez-vous et examinez la situation : ne forcez rien.

## 2. Remettre les outils à niveau

Pour une installation depuis un clone, suivez la [mise à jour du clone](#palabre-installé-depuis-un-clone-du-dépôt-version-de-développement) ci-dessus.

Préservez d'abord le travail trouvé : relisez les modifications, puis publiez les commits ou la PR que vous souhaitez reprendre. Pour un travail conservé dans un worktree Relay, suivez [Récupérer le résultat](/fr/usage/relay#récupérer-le-résultat). Sans cette étape, GitHub ne connaît pas vos modifications locales.

Faites les mises à jour du système, puis vérifiez les [prérequis d'installation](/fr/get-started/installation), dont Node.js 20 ou plus. Si PALABRE est déjà installé :

```text
palabre update --check
palabre update
```

La première commande vérifie sans mettre à jour ; la seconde affiche le plan et demande votre confirmation dans le terminal. Selon l'installation, elle peut mettre à jour le clone Git et ses dépendances ou le paquet global. Si PALABRE est absent, suivez [Installation](/fr/get-started/installation). Gardez une seule source d'installation choisie par outil.

Mettez également les CLI d'agents à jour selon leur installation. Pour Claude Code installé nativement :

```text
claude update
```

Pour Codex installé avec npm :

```text
npm install --global @openai/codex
```

Pour les autres installations, utilisez les instructions des guides [Claude Code](/fr/agents/claude-code) et [Codex](/fr/agents/codex). Fermez puis rouvrez le terminal et relevez à nouveau chemins et versions.

Vérifiez les connexions, puis connectez-vous seulement si nécessaire :

```text
claude auth status
codex login status
```

```text
claude auth login
codex login
```

Choisissez vous-même le compte et les conditions d'accès. Une connexion dans Desktop ne prouve pas que la CLI est connectée. Ne transportez pas les fichiers de connexion de `~/.claude/` ou `~/.codex/` ; gardez les résultats de ces contrôles sur votre machine.

## 3. Recréer ou relire la configuration

Dans le projet, lancez :

```text
palabre init
```

Cette commande crée la configuration globale et approuve le contenu qu'elle vient de créer. Si ce fichier existe déjà, elle le conserve : elle ne remplace ni ne répare une ancienne configuration. Pour choisir une configuration propre au projet, utilisez `palabre init --local` seulement si vous souhaitez cette portée.

Relisez la configuration effectivement utilisée, locale ou globale : commandes des agents, chemins absolus, modèles, dossier d'export et politique Relay. Un chemin absolu de l'ancienne machine peut être absent ici ; `palabre config --sync-agents` le conserve volontairement. Adaptez-le selon [la configuration avancée](/fr/configuration/advanced-json), sans changer vos réglages de sécurité pour faire passer un essai.

Après relecture d'un fichier existant, approuvez vous-même son contenu exact. Pour la configuration globale, dans PowerShell comme dans un shell POSIX :

```text
palabre config --config "$HOME/.palabre/palabre.config.json" --trust-config
```

Pour un fichier de projet déjà présent :

```text
palabre config --config ./palabre.config.json --trust-config
```

N'approuvez que le fichier réellement choisi ; [l'ordre local/global](/fr/configuration/local-vs-global) compte aussi sur une machine déjà utilisée. Un agent ne doit pas approuver à votre place une configuration qui lui accorde des droits.

Pour les approbations de fichiers disparus :

```text
palabre config --prune-trust --dry-run
palabre config --prune-trust
```

L'aperçu n'écrit rien. Le nettoyage exige votre confirmation au clavier et crée une sauvegarde horodatée. Il conserve les chemins existants ou inaccessibles ; il ne réapprouve aucun fichier. Ne recopiez jamais un registre d'approbations depuis l'ancienne machine.

Si votre aide ne propose pas `--new` dans `palabre relay --help` ou `--prune-trust` dans `palabre config --help`, la version utilisée ne contient pas encore ce parcours. Après `palabre update`, si ces options manquent toujours dans la version publiée, utilisez [l'installation depuis le dépôt source](/fr/get-started/installation#installer-depuis-le-dépôt-source) pour tester les changements disponibles sur `main`.

## 4. Réinstaller le skill

Pour l'installer pour vos agents sur cette machine, dans tous vos projets :

```text
npx skills add JuReyms/Palabre --skill palabre --global
```

Cette commande utilise [l'outil skills](https://github.com/vercel-labs/skills), télécharge le skill du dépôt et vous laisse choisir les agents. Relisez les choix avant de confirmer. Pour une installation par copie, suivez [le guide du skill](/fr/get-started/skill) et copiez le dossier complet, références comprises.

L'outil `skills` a ses propres prérequis Node, qui peuvent être plus élevés que ceux de PALABRE. Si `npx` signale `EBADENGINE`, mettez Node à niveau selon ces prérequis ou utilisez l'installation par copie.

Une copie installée n'est pas mise à jour par `palabre update` : refaites explicitement l'installation ou la copie après une évolution du skill. Vérifiez qu'une seule version reste active pour chaque agent, puis ouvrez une nouvelle conversation pour qu'il la découvre.

## 5. Vérifier avec doctor

Depuis le projet :

```text
palabre doctor --terminal
```

Suivez les actions dans l'ordre : configuration non approuvée, PowerShell 7 hors Store sous Windows, connexion Claude Code ou Codex, agent archivé, skill et emplacements multiples. `doctor` n'approuve, n'installe et ne reconnecte rien. Une configuration non approuvée reste inspectable, mais donne le code 1 et n'autorise aucune commande d'agent ni URL configurée.

Pour une configuration approuvée, les sondes `claude auth status --json` et `codex login status` utilisent la commande configurée, sans ses arguments de modèle, sans shell et sans appel modèle. Chaque sonde est limitée à 3 secondes et 32 Kio ; CLI ancienne, wrapper non pris en charge, délai ou sortie inconnue donnent « non vérifié ». L'état déclaré ne garantit pas qu'un jeton expiré pourra être renouvelé ni qu'un appel futur réussira. Aucune donnée de compte n'est affichée.

Le skill est cherché dans `.agents/skills/palabre/`, `.claude/skills/palabre/` et `.codex/skills/palabre/`, dans le projet et le dossier personnel. Présence ne veut pas dire chargé ou à jour ; un skill installé dans l'application peut échapper à cette recherche. Les doublons sont des emplacements distincts du PATH pour Node, npm, pnpm, Claude Code et Codex, sans lecture de version ni désinstallation. Les wrappers voisins ne comptent qu'une fois ; le diagnostic complet reste suivi dans [#153](https://github.com/JuReyms/Palabre/issues/153).

`doctor` peut encore vérifier la version de PALABRE auprès de npm et contacter les serveurs Ollama d'une configuration approuvée. Il ne prouve pas que Codex peut lire le projet : le premier Relay doit toujours apporter cette preuve.

## 6. Retrouver le projet et créer un nouvel équipier

Reprenez le clone préservé, ou clonez votre dépôt depuis son URL GitHub dans un nouveau dossier. Relisez README, `AGENTS.md`, issues et PR : ils donnent le travail réalisé, ce qui reste à faire et les décisions attendues. Préparez un court brief avec ces liens, sans identifiant de conversation locale.

Depuis une nouvelle conversation avec votre agent, dites par exemple :

> Passe par PALABRE pour demander à Codex de relire docs/plan.md, sans modifier de fichier. Crée un nouvel équipier et garde son identifiant pour la suite.

Ou, depuis le terminal du projet :

```text
palabre relay --new --to codex --subject "Reprise du projet fictif Orion" "Lis README.md et docs/plan.md. Résume ce qui reste à vérifier, sans modifier de fichier." --json
```

Pour un équipier Claude, remplacez `codex` par le nom de votre agent Claude configuré. Ce premier appel utilise son compte et son modèle et peut consommer son quota. Les parcours Desktop et les limites par plateforme sont détaillés dans [Premier Relay](/fr/get-started/first-relay).

Les conversations de l'ancienne machine ne sont pas transférées par PALABRE. Un ancien identifiant n'est pas une nouvelle cible locale. `--new` rend un nouvel identifiant dans `to.session`, avec `cwd` et le résultat de délivrance ; conservez-le localement pour les échanges suivants. Vérifiez statut, réponse et preuves avant de continuer. Aucun renvoi automatique après un échec ou une délivrance inconnue.

## Ce qui se conserve, se recrée ou reste local

`~` désigne votre dossier personnel. `.palabre/` est relatif au dossier depuis lequel vous lancez PALABRE, généralement le projet. Si vous le lancez depuis votre dossier personnel, ce chemin peut donc être `~/.palabre/`. `outputDir` peut choisir un autre emplacement pour les exports.

| Élément | Que faire |
| --- | --- |
| Code non poussé, fichiers non suivis, branches et worktrees | À préserver avant tout nettoyage. Faites relire et publier le travail à reprendre ; ne les traitez pas comme un cache. |
| README, `AGENTS.md`, décisions, issues et PR | Base de reprise partageable, après vérification qu'elle ne contient aucun secret ni identifiant de conversation. |
| `~/.palabre/palabre.config.json`, ancienne config ou config de projet | À recréer ou adapter puis approuver localement. Préférences réutilisables après relecture ; pas de copie aveugle des chemins. Une config de projet ne se versionne qu'avec des valeurs partageables, sans secret ni chemin personnel. |
| `~/.palabre/trusted-configs.json` et ses sauvegardes | Jamais copiés vers une autre machine ni versionnés. L'approbation est locale et volontaire. |
| `~/.palabre/relay-write/` | Accords et états d'écriture locaux, à ne pas transporter ni versionner. Un worktree situé dedans peut contenir du travail unique : récupérez son code avant tout nettoyage. |
| Exports dans `.palabre/` ou `outputDir` | À garder localement si utiles. Ils peuvent contenir messages privés, chemins et identifiants : ne les transférez ni ne les versionnez bruts. Partagez plutôt un résumé relu. |
| `.palabre/sessions/`, `.palabre/missions/` | États locaux liés aux fichiers et à la configuration. Ne promettent pas une reprise sur une autre machine ; gardez-les sur l'ancienne tant qu'ils sont utiles. Mission reste gelé. |
| Conversations et fichiers de connexion des agents, identifiants de conversation | Restent sur la machine d'origine. Ne les copiez ni ne les versionnez ; reconnectez les agents et créez de nouvelles conversations. |
| Skill installé, dépendances et compilation | Se réinstallent ou se reconstruisent. Préservez toute personnalisation avant de remplacer une copie du skill. |

Le nettoyage est une étape distincte, après vérification du nouveau parcours. Ce guide ne demande jamais de supprimer tout `.palabre/`.
