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

`doctor` ne lance aucun agent IA. Il affiche un diagnostic par sections : configuration, outils locaux, agents et points à vérifier. Il contrôle les agents déclarés, les paramètres par défaut, le nombre de réponses, `outputDir`, les CLIs disponibles, Ollama et les modèles configurés.

Pour obtenir une sortie brute adaptée aux logs ou aux scripts :

```bash
palabre doctor --terminal
```

## Codex sous Windows : erreur 5 malgré la lecture seule

**Ce qui se passe :** sans `--open`, Codex ne peut pas lancer ses commandes de lecture. PALABRE conserve sa réponse mais rend `read-unavailable` (2) ; avec review, rien n’est publié.

**Cause probable :** l’alias Microsoft Store `WindowsApps\pwsh.exe`. **Prochaine étape :** suivre [#128](https://github.com/JuReyms/Palabre/issues/128) ; aucune solution validée pour l’instant. Ne renvoyez pas le message et n’élargissez pas les permissions.

### Détails techniques


`CreateProcessAsUserW failed: 5` signifie ici que Codex n'a pas pu démarrer une commande, même pour lire. Sur la machine testée avec Codex 0.163.0, la même lecture sous `:read-only` réussit avec PowerShell natif Windows et échoue avec l'alias `WindowsApps\pwsh.exe`. Il faut donc vérifier le shell choisi, sans conclure que toute la sandbox `unelevated` est inutilisable.

**Pas de solution connue et validée à ce jour pour forcer PowerShell natif dans ce parcours Relay avec Codex 0.163.0 ; suivi dans [#128](https://github.com/JuReyms/Palabre/issues/128).** Le propriétaire peut suivre cette issue ; aucun changement de configuration n'est demandé pour l'instant.

`[windows] shell_path` figurait déjà dans la configuration de la machine testée, avec le chemin de PowerShell natif, mais Codex avait lancé l'alias Microsoft Store. Ce paramètre est absent du [schéma officiel de Codex 0.163.0](https://github.com/openai/codex/blob/rust-v0.163.0/codex-rs/core/config.schema.json) : ne le présentez pas comme un réglage pris en charge. Le [code de sélection du shell de cette version](https://github.com/openai/codex/blob/rust-v0.163.0/codex-rs/shell-command/src/shell_detect.rs) cherche `pwsh` avant `powershell`. La lecture réussie avec un exécutable explicitement choisi ne démontre pas comment imposer ce choix à toutes les commandes d'une session reprise.

PALABRE ne modifie ni le choix du shell ni la sécurité de la machine. Ne passez pas en accès écriture ou sans restriction pour contourner cet échec. Un passage à `elevated` reste une décision distincte du propriétaire, pas une solution démontrée par ces essais.

Relay conserve la réponse, mais signale `read-unavailable`/2 si cette erreur est observée dans les événements de commande Codex. Mission se met en pause ; la tâche review ne publie pas la revue (`review-failed`/9, `not-attempted`). Ne renvoyez pas automatiquement le message. Voir les preuves, limites et champs JSON dans le [guide Relay](/fr/usage/relay).

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

Refus avant envoi (`not-delivered`) : `config-untrusted` (8), `task-not-allowed` (8, propriétaire : lancer la commande `remedy` dans son terminal), `review-cli-unsupported` (8, Claude ≥ 2.1.292 et `--safe-mode` requis), `target-busy` (3, fermer la cible ou choisir `--open` pour Codex sous Windows), `target-not-open` (3, ouvrir la cible Codex). Voir [Relay](/fr/usage/relay).

Une limite reconnue donne `usage-limit`. Une indication de reprise n'est affichée que si fournie : `retryAfter` dans les erreurs NDJSON, ou Relay avec `--open`. Sans `--open`, Relay classe la limite mais n'expose pas ce champ. Aucun renvoi automatique, même après l'heure indiquée ; une heure seule n'a pas de date ni fuseau déduits. Avec Relay, vérifiez la délivrance avant toute nouvelle demande. Mission garde le résultat et se met en pause sur un échec connu ; une délivrance inconnue exige une vérification humaine. Avec `--checkpoint`, `resume` conserve les réponses déjà acceptées.
