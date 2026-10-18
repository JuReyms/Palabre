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

Après cet inventaire, actualisez les références distantes (sans changer vos fichiers de travail) :

```text
git fetch --prune
git log --oneline --branches --not --remotes
git branch --remotes --contains <sha-du-commit>
```

Une branche fusionnée par squash peut encore apparaître : ses commits ont été regroupés sous un autre identifiant. Avec la CLI GitHub déjà connectée, retrouvez la PR du commit, puis vérifiez son état et son diff sur GitHub :

```text
gh api repos/<proprietaire>/<depot>/commits/<sha-du-commit>/pulls --jq '.[].html_url'
gh pr view <numero-de-pr> --repo <proprietaire>/<depot> --json state,mergedAt,url
gh pr diff <numero-de-pr> --repo <proprietaire>/<depot>
```

Sans preuve que le travail est conservé, gardez la branche. Ne supprimez ni ne forcez rien à partir du seul résultat de `git log`.

Repérez les installations utilisées. Dans PowerShell :

```powershell
Get-Command node,npm,pnpm,palabre,codex,claude,pwsh,powershell -All -ErrorAction SilentlyContinue | Select-Object Name,Source
```

Dans Bash ou Zsh, sur macOS ou Linux :

```sh
type -a node npm pnpm palabre codex claude
```

Pour les commandes présentes, relevez les versions :

```text
node --version
npm --version
pnpm --version
palabre --version
codex --version
claude --version
```

Plusieurs chemins peuvent désigner plusieurs installations. Sous Windows, un chemin `WindowsApps` peut être un alias du Microsoft Store, pas l'installation attendue. Ne supprimez rien pour faire disparaître un doublon ; identifiez l'installation à garder avec le [dépannage Windows](/fr/troubleshooting). Le diagnostic complet des doublons reste suivi dans [#153](https://github.com/JuReyms/Palabre/issues/153).

Repérez aussi les doublons de npm et de pnpm, pas seulement ceux des agents. Plusieurs wrappers d'une même installation ne prouvent pas un doublon ; comparez leurs dossiers et leurs versions. Signalez les installations différentes, sans les désinstaller pendant ce parcours.

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

Si `node_modules` a été créé par une autre version majeure de pnpm, une installation sans terminal interactif peut s'arrêter avec :

```text
ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY Aborted removal of modules directory due to no TTY
```

Dans le clone, vérifiez la version `packageManager` de `package.json` et `pnpm --version`. Relancez `pnpm install` dans votre terminal et confirmez la reconstruction des dépendances seulement après avoir préservé le travail local. Si vous choisissez une exécution sans terminal, le remède indiqué par pnpm est `CI=true`, limité à cette commande. PowerShell :

```powershell
$ancienneValeurCI = $env:CI
try {
    $env:CI = 'true'
    pnpm install
} finally {
    $env:CI = $ancienneValeurCI
}
```

Shell POSIX :

```sh
CI=true pnpm install
```

Cette opération peut recréer `node_modules` ; ne l'appliquez qu'au clone choisi. Si pnpm annonce que le script de build de `node-pty` a été ignoré, ce message seul ne prouve pas une panne : le binaire précompilé peut suffire, comme lors de l'essai #171. Depuis le clone, vérifiez son chargement avec `node -e "require('node-pty')"`. En cas d'erreur, arrêtez-vous et conservez le diagnostic ; n'autorisez pas tous les scripts de dépendances par défaut.

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

### Windows : vérifier PowerShell 7 hors Microsoft Store

Avant le premier Relay vers Codex, vérifiez qu'un PowerShell 7 installé hors Store est présent. Le paquet Store lui-même, pas seulement son alias, a bloqué les lectures lors de l'essai #171. Un numéro de version seul ne suffit pas :

```powershell
Get-Command pwsh -All -ErrorAction SilentlyContinue | Select-Object Source
Test-Path -LiteralPath "$env:ProgramFiles/PowerShell/7/pwsh.exe"
```

Si vous ne trouvez que `WindowsApps` ou aucun PowerShell 7, installez vous-même la version hors Store :

```text
winget install --id Microsoft.PowerShell --source winget --installer-type wix
```

`--installer-type wix` demande le MSI : `--source winget` seul peut encore choisir un paquet MSIX. Si le MSI n'est pas disponible, suivez les instructions MSI ou ZIP du [dépannage Windows](/fr/troubleshooting), sans accepter le Store comme équivalent. Ouvrez un nouveau terminal, puis refaites la vérification. Pour une installation standard :

```powershell
& "$env:ProgramFiles/PowerShell/7/pwsh.exe" --version
```

Une installation personnalisée peut avoir un autre chemin : vérifiez qu'il est hors `WindowsApps`. Ne supprimez pas le paquet Store et ne modifiez pas les permissions de Codex pour contourner le blocage. Voir le [dépannage Windows](/fr/troubleshooting).

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

## 3. Recréer, relire et approuver la configuration avant Relay

Une configuration approuvée est un prérequis : sinon Relay refuse le départ avec `config-untrusted` (code 8), même si `palabre agents --json` ou `doctor` affichent des outils disponibles.

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

`--trust-config` est décrit dans `palabre help`, pas dans `palabre config --help`. Lancez cette commande vous-même dans un terminal interactif : après l'approbation, `palabre config --trust-config` ouvre aussi l'assistant de configuration. Ce n'est pas une commande d'approbation seule. Quittez l'assistant sans sélectionner de changement si vous voulez seulement approuver ; ne le lancez pas depuis un agent ou un flux sans terminal qui pourrait sélectionner une action à votre place.

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

Sans `-y`, le choix est interactif. Avec `-y`, les confirmations sont sautées et le skill peut être installé pour tous les agents détectés. Pour limiter les cibles, nommez-les explicitement avec `--agent`, par exemple :

```text
npx skills add JuReyms/Palabre --skill palabre --global --agent claude-code codex
```

Un agent qui prépare l'installation ne doit pas ajouter `-y` de lui-même. Vous choisissez les agents et confirmez l'installation.

L'outil `skills` a ses propres prérequis Node, qui peuvent être plus élevés que ceux de PALABRE. Si `npx` signale `EBADENGINE`, mettez Node à niveau selon ces prérequis ou utilisez l'installation par copie.

Une copie installée n'est pas mise à jour par `palabre update` : refaites explicitement l'installation ou la copie après une évolution du skill. Vérifiez qu'une seule version reste active pour chaque agent, puis ouvrez une nouvelle conversation pour qu'il la découvre.

## 5. Vérifier avec doctor

Depuis le projet :

```text
palabre doctor --terminal
```

Suivez les diagnostics affichés. Aujourd'hui, `doctor` vérifie notamment la configuration et la disponibilité des outils ; il peut contacter les serveurs Ollama configurés. Il ne certifie ni la connexion des agents, ni l'installation ou la fraîcheur du skill, ni l'absence de doublons. Une ancienne configuration lisible peut donc passer ce contrôle sans être adaptée à la nouvelle machine.

## 6. Retrouver le projet et créer un nouvel équipier

Reprenez le clone préservé, ou clonez votre dépôt depuis son URL GitHub dans un nouveau dossier. Relisez README, `AGENTS.md`, issues et PR : ils donnent le travail réalisé, ce qui reste à faire et les décisions attendues. Préparez un court brief avec ces liens, sans identifiant de conversation locale.

Depuis une nouvelle conversation avec votre agent, dites par exemple :

> Passe par PALABRE pour demander à Codex de relire docs/plan.md, sans modifier de fichier. Crée un nouvel équipier et garde son identifiant pour la suite.

Ou, depuis le terminal du projet :

Avant cet appel, terminez l'approbation de l'étape 3 et, sous Windows, la vérification de PowerShell 7 hors Store de l'étape 2. Vérifiez aussi la connexion de l'agent et la présence d'un fichier à lire.

```text
palabre relay --new --to codex --subject "Reprise du projet fictif Orion" "Lis README.md et docs/plan.md. Résume ce qui reste à vérifier, sans modifier de fichier." --json
```

Pour un équipier Claude, remplacez `codex` par le nom de votre agent Claude configuré. Ce premier appel utilise son compte et son modèle et peut consommer son quota. Les parcours Desktop et les limites par plateforme sont détaillés dans [Premier Relay](/fr/get-started/first-relay).

Les conversations de l'ancienne machine ne sont pas transférées par PALABRE. Un ancien identifiant n'est pas une nouvelle cible locale. `--new` rend un nouvel identifiant dans `to.session`, avec `cwd` et le résultat de délivrance ; conservez-le localement pour les échanges suivants. Vérifiez statut, réponse et preuves avant de continuer. Aucun renvoi automatique après un échec ou une délivrance inconnue.

`delivery.status: replied` prouve l'arrivée d'une réponse, pas la lecture des fichiers. Si `status` vaut `read-unavailable` ou si `readAccess.status` vaut `blocked`, arrêtez-vous : une réponse plausible n'est pas une lecture vérifiée. Suivez le dépannage, puis décidez vous-même d'un nouvel essai.

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
