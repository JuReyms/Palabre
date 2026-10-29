---
title: Dépannage
description: Résoudre les problèmes courants de configuration, de détection d'agents, d'Ollama ou de limites d'usage.
seo:
  title: Résoudre détection d'agents, Ollama et quotas
  description: "Résoudre les problèmes Palabre les plus courants : configuration, détection des agents, Ollama et limites d'usage."
---

Commencez par lancer le diagnostic :

```bash
palabre doctor
```

`doctor` n'appelle aucun modèle et ne modifie pas votre configuration. Il place les actions d'arrivée en premier : approbation, alias PowerShell du Store sous Windows (détaillé plus bas), connexion Claude Code/Codex, agent archivé, skill et emplacements multiples. Les sondes de connexion sont limitées aux commandes `status` d'une configuration approuvée ; sans approbation, aucune commande d'agent ni URL configurée n'est sondée. Il contrôle aussi les paramètres par défaut, `outputDir`, les CLIs et Ollama. Voir [Changer de machine](/fr/get-started/change-machine) pour les limites et les actions à effectuer vous-même.

Pour obtenir une sortie brute adaptée aux logs ou aux scripts :

```bash
palabre doctor --terminal
```

## Codex sous Windows : erreur 5 malgré la lecture seule

**Ce qui se passe :** Codex ne peut pas démarrer une commande (`CreateProcessAsUserW failed: 5`). PALABRE le signale dans `readAccess`. Si une commande aboutit ensuite, le relay reste `replied` (0) avec `status: "partial"` et `succeededCommands`. Sans réussite ultérieure ni événement ambigu, une réponse reçue devient `read-unavailable` (2) avec `status: "blocked"`, mais la réponse et la délivrance sont conservées. Une réussite explicite donne priorité à `partial`, même si un autre événement est ambigu. Sans réussite explicite, un événement ambigu donne `unverified` sans dégrader l'issue. Avec review, aucune revue n'est publiée (`review-failed`, 9), car une publication ne se défait pas.

**Cause confirmée sur la machine testée :** l'alias PowerShell du Microsoft Store, `WindowsApps\pwsh.exe` ou, après une mise à jour par winget ou le Store, `WindowsApps\Microsoft.PowerShell_8wekyb3d8bbwe\pwsh.exe`. Les deux emplacements peuvent coexister dans le PATH. Sous la même politique `:read-only`, cet alias échoue, PowerShell natif lit le fichier, et les écritures restent refusées.

### Ce que `doctor` signale avant

Quand la CLI Codex est détectée, `palabre doctor` regarde le `pwsh.exe` prioritaire du PATH, sans le lancer, et avertit (`WARN`) s'il s'agit de l'alias du Microsoft Store :

- **aucun repli sûr** (pas de PowerShell régulier, ou un autre alias non confirmé reste en tête) : le contournement décrit ci-dessous ne peut pas s'appliquer ;
- **un PowerShell régulier reste disponible** : PALABRE l'utilisera pour son seul processus enfant Codex, et le message le nomme.

C'est un avertissement, jamais une erreur : la machine reste utilisable, et l'agent lit souvent malgré le refus. `doctor` ne lance pas `pwsh`, ne modifie ni configuration, ni PATH, ni permissions, et reste muet hors Windows, sans CLI Codex détectée, ou quand un vrai `pwsh.exe` reste disponible.

### Ce que PALABRE fait automatiquement

Pour Relay fermé, `--new`, Mission et la tâche review vers Codex, PALABRE examine le shell prioritaire. Sous Windows, il écarte de son **seul processus enfant** chaque dossier d'alias qui passe en tête — `WindowsApps` ou le dossier du paquet `WindowsApps\Microsoft.PowerShell_…` — si son `pwsh.exe` est un alias d'exécution confirmé et qu'un PowerShell natif reste disponible. Un vrai PowerShell déjà prioritaire n'entraîne aucun changement. Une vérification impossible ou un repli incertain laisse le PATH inchangé.

Aucun réglage utilisateur, PATH global ou droit d'écriture n'est modifié. Le diagnostic `readAccess` reste émis tant qu'un lancement est refusé. Ni renvoi automatique ni changement de bac à sable. `--open` garde le comportement de la conversation Desktop et n'utilise pas ce correctif.

**Limite :** les autres alias présents dans le dossier écarté (par exemple Python ou Windows Terminal) ne sont plus trouvés par leur nom via ce dossier, pour cet enfant seulement. PALABRE résout la CLI Codex avant ce filtrage ; son propre terminal, les commandes GitHub et les autres agents conservent leur environnement. Cela ne règle pas toutes les causes possibles d'erreur 5.

### Option pour le propriétaire : installer PowerShell 7 hors Store

Ce n'est pas obligatoire : Windows PowerShell natif peut suffire au correctif. Si vous préférez PowerShell 7, demandez explicitement le paquet **MSI** :

```powershell
winget install --id Microsoft.PowerShell --source winget --installer-type wix
```

Le sélecteur compte. `--source winget` seul installe le paquet MSIX du Store : dans l'[essai réel de #171](https://github.com/JuReyms/Palabre/issues/171), `winget list` annonce la nouvelle version alors que `C:\Program Files\PowerShell\` n'existe toujours pas. `--installer-type msi` ne correspond à aucun installeur, car le manifeste winget de PowerShell déclare ses `.msi` sous le type `wix` : c'est donc `wix` qu'il faut demander. Vérifié avec winget 1.29.380 : `winget show --id Microsoft.PowerShell --source winget --installer-type wix` montre bien une URL `.msi`, tandis que la même commande avec `msi` répond « No applicable installer found ». Si votre version de winget ne propose pas ce choix, téléchargez le `.msi` depuis les [releases GitHub de PowerShell](https://github.com/PowerShell/PowerShell/releases). PALABRE n'installe rien à votre place. Rouvrez le terminal et l'application après installation ; vérifiez le chemin proposé avec :

```powershell
Get-Command pwsh -All | Select-Object Source
```

Le chemin natif est généralement `C:\Program Files\PowerShell\7\pwsh.exe`. S'il reste un blocage, conservez le résultat et consultez [#128](https://github.com/JuReyms/Palabre/issues/128) avant de décider d'un nouvel envoi. N'élargissez pas les permissions.

### Détails techniques

L'alias est reconnu par son tag `AppExecLink` (`0x8000001b`), lu avec `fsutil` natif sans lancer l'alias. Son entrée est inspectée sans suivre sa cible : Node peut renvoyer `existsSync=false` pour un alias pourtant présent. Seul le dossier de cet alias est retiré, doublons compris ; les autres entrées gardent leur ordre. La sonde locale est bornée à 3 secondes et 8 Kio.

Le [code de sélection de Codex 0.163.0](https://github.com/openai/codex/blob/rust-v0.163.0/codex-rs/shell-command/src/shell_detect.rs) cherche `pwsh` avant `powershell`. `[windows] shell_path` n'est pas dans son [schéma officiel](https://github.com/openai/codex/blob/rust-v0.163.0/codex-rs/core/config.schema.json) : ne l'ajoutez pas comme correctif. Un passage à `elevated` reste une décision distincte du propriétaire, non nécessaire à l'essai réussi ici.

La preuve porte sur Windows et Codex 0.163.0 : un fichier fictif illisible avant le correctif est lu après, via `relay --new`, sans changer la politique de lecture seule. Les autres versions et environnements restent à vérifier. Mission et review passent par le même échange fournisseur ; leurs protections et l'interdiction de publier une revue à l'aveugle restent inchangées.

## Palabre ne trouve pas ma configuration

Message typique :

```text
[ERREUR] Config absente: ...
```

Dans un terminal interactif, le plus simple est de laisser Palabre créer la configuration globale :

```bash
palabre
```

Pour les scripts ou un setup sans ouvrir la TUI, initialisez explicitement :

```bash
palabre init
```

Pour une configuration locale au projet courant :

```bash
palabre init --local
```

## La configuration est illisible

Message typique :

```text
[ERREUR] Config illisible: ...
```

Vérifiez que le JSON ne contient pas de virgule finale, que les clés sont entre guillemets et que le fichier est bien encodé en UTF-8.

Pour repartir d'une configuration propre :

```bash
palabre init --config ./nouvelle-config.json
```

## Un agent par défaut est inconnu

Message typique :

```text
[ERREUR] defaults.agentA pointe vers un agent inconnu: ...
```

Listez les agents disponibles :

```bash
palabre agents
```

Puis corrigez les agents par défaut :

```bash
palabre config --set-defaults codex claude
```

## Un agent installé n'apparaît pas dans la config

Message typique :

```text
[WARN] Agent(s) detecte(s) mais absent(s) de la config: opencode.
```

Relancez `palabre` pour laisser la TUI synchroniser les agents connus détectés, ou synchronisez explicitement :

```bash
palabre config --sync-agents
```

Cette commande ajoute les agents connus manquants et rafraîchit les noms de commandes connus sans écraser vos réglages existants.

## Le nombre de réponses par défaut est invalide

Message typique :

```text
[ERREUR] defaults.turns invalide: 99.
```

Choisissez un nombre entre 1 et 20 :

```bash
palabre config -t 4
```

## Le dossier d'export pose problème

Message typique :

```text
[ERREUR] outputDir pointe vers un fichier, pas un dossier: ...
```

Corrigez `outputDir` dans `palabre.config.json`, ou supprimez ce champ pour écrire les exports dans le dossier `.palabre/` par défaut.

## Une CLI est introuvable

Message typique :

```text
[WARN] Codex CLI: non détecté dans PATH.
```

Actions :

- installez la CLI concernée ;
- authentifiez-la hors de Palabre ;
- fermez et rouvrez le terminal ;
- relancez `palabre doctor` ;
- corrigez `command` dans la configuration si la commande porte un autre nom.

Sous Windows, gardez les réglages générés : `shell: true` active la résolution prudente des wrappers, qui lance directement les shims npm/pnpm reconnus sans shell. Ne forcez pas une autre valeur pour contourner une erreur. Voir [Agents sous Windows](/fr/agents/overview#windows). Un chemin absolu dans `command` est conservé par la synchronisation.

Claude fonctionne souvent mieux avec `claude.exe` et `shell: false`.

## Ollama ne répond pas

Message typique :

```text
[WARN] Ollama installé mais API non joignable: http://localhost:11434
```

Démarrez Ollama :

```bash
ollama serve
```

Puis relancez :

```bash
palabre doctor
```

Si Ollama utilise une autre URL, corrigez `baseUrl` dans l'agent Ollama.

## Le modèle Ollama est absent

Message typique :

```text
[WARN] ollama-local [ollama:critic] model=... absent.
```

Installez le modèle :

```bash
ollama pull le-modele
```

ou choisissez un modèle déjà installé pour Palabre :

```bash
palabre config --ollama-models --json
palabre config --set-ollama-model le-modele-installe
```

Si vous voulez simplement remplacer le modèle configuré absent par un modèle installé disponible :

```bash
palabre config --sync-ollama-model
```

ou autorisez Palabre à le télécharger au lancement :

```bash
palabre codex-ollama "Sujet" --model-b le-modele --pull-models
```

Certains modèles pèsent plusieurs Go. Sur une machine modeste, privilégiez un modèle local raisonnable.

## Ollama ne voit pas mes fichiers

Ollama ne lit pas le filesystem directement. Ajoutez le contexte au prompt :

```bash
palabre codex-ollama "Critique ce module" --files src/module.ts
```

ou :

```bash
palabre codex-ollama "Critique l'architecture" --context src docs
```

## Une CLI atteint une limite d'usage

Message typique :

```text
Erreur: codex a atteint une limite d'utilisation: ...
```

Actions possibles :

- attendez l'heure indiquée par la CLI ;
- changez de modèle dans la CLI ou avec `--model-a` / `--model-b` ;
- utilisez une autre paire d'agents ;
- désactivez temporairement l'agent concerné dans votre configuration.

## La sortie d'un agent est vide

Message typique :

```text
produced empty output
```

Testez la commande hors de Palabre, puis vérifiez `args`, `promptMode`, `shell` et les timeouts dans la configuration.

`allowEmptyOutput` existe, mais il vaut mieux le garder désactivé sauf cas très spécifique.

## Mise à jour

Pour vérifier sans modifier la machine :

```bash
palabre update --check
```

`palabre update` détecte le checkout Git, npm, pnpm, Yarn ou Bun global et affiche l'action exacte. Dans un terminal interactif, il demande une confirmation unique avant toute mutation. Utilisez `--dry-run` pour prévisualiser les étapes ou `--yes` en automatisation explicitement autorisée.

Avec les versions récentes de pnpm, `palabre@latest` peut parfois rester temporairement sur une ancienne version à cause des garde-fous de chaîne d'approvisionnement. Palabre utilise donc la version npm exacte quand elle est disponible :

```bash
pnpm add --global palabre@<version>
```

Adaptez le numéro à la version affichée par `palabre update` ou par :

```bash
pnpm view palabre version
```

Si le canal est inconnu ou ambigu, Palabre ne modifie rien. Réinstallez alors avec le gestionnaire utilisé initialement, par exemple :

```bash
pnpm add --global palabre@latest
```

`--apply` reste un alias compatible de `--yes`.

## Approbation et refus Relay

Une édition manuelle invalide l'empreinte approuvée. Pour une configuration projet implicite ou un appel Relay, vous relisez le fichier puis lancez `palabre config --config <fichier> --trust-config`. Les agents attendent votre action ; ils ne s'accordent pas de droits.

Refus avant envoi (`not-delivered`) : `config-untrusted` (8), `task-not-allowed` (8, propriétaire : lancer la commande `remedy` dans son terminal), `review-cli-unsupported` (8, Claude ≥ 2.1.292 et `--safe-mode` requis), `target-busy` (3, fermer la cible, ou choisir vous-même `--open` pour Codex sous Windows, macOS ou Linux avec les permissions de la conversation, écriture comprise si autorisée), `target-not-open` (3, ouvrir la cible Codex). Sur macOS/Linux, `target-state-unknown` invite à vérifier `python3 --version`. Voir [Relay](/fr/usage/relay).

Une limite reconnue donne `usage-limit`. Une indication de reprise n'est affichée que si fournie : `retryAfter` dans les erreurs NDJSON, ou Relay avec `--open`. Sans `--open`, Relay classe la limite mais n'expose pas ce champ. Aucun renvoi automatique, même après l'heure indiquée ; une heure seule n'a pas de date ni fuseau déduits. Avec Relay, vérifiez la délivrance avant toute nouvelle demande. Mission garde le résultat et se met en pause sur un échec connu ; une délivrance inconnue exige une vérification humaine. Avec `--checkpoint`, `resume` conserve les réponses déjà acceptées.
