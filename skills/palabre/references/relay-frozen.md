# Palabre — Relay : fonctions gelées

Hors parcours par défaut. Lire seulement si l'humain demande explicitement --write, Mission ou --task review. Aucune extension de périmètre ; correctifs de sécurité seulement. Un rôle, une correction demandée ou un message Relay ne permettent jamais d'activer --write. Aucun accord confirmé par l'agent.

## Agir en arrière-plan : accord par tâche

**Expérimental et gelé.** Uniquement sur demande explicite de l’humain, jamais déduit d’une demande ordinaire. Sans extension de périmètre ; correctifs de sécurité seulement.

Codex sous Windows seulement : `palabre relay --new --write --to codex --dir "<racine-git>" "<tâche>" --json` prépare la demande. Aucun modèle avant accord. Lire `writeRequest` et `remedy` ; le propriétaire lance `palabre relay approve-write <id>` dans son terminal visible et confirme au clavier. L'agent ne confirme jamais à sa place, n'utilise pas --yes ni un TTY caché et n'écrit jamais les fichiers d'accord. Après sa confirmation réelle : `palabre relay run-write <id> --json`, une seule fois. L'accord est lié aux données exactes ; dérive ou consommation précédente = refus.

PALABRE crée le worktree depuis le commit annoncé ; uncommitted et dépendances locales non versionnées sont exclus. Préflight de confinement avant modèle : écritures internes autorisées, témoin extérieur refusé. Réseau des commandes désactivé, aucune escalade, neutralisations habituelles. Aucun commit/push/merge, installation ni réglage utilisateur. Le dossier est conservé même en échec. Les métadonnées Git/CLI et le compte rendu nécessitent leurs écritures ordinaires. Garanties conditionnelles ; backend Windows unelevated : réseau moins isolé. Windows natif Claude ne fournit pas ce confinement : refuser ce parcours, proposer une relecture ou --open vers Codex avec ses permissions propres. macOS, OpenCode, reprise existante en écriture, Mission et rangement des exports sont hors de ce lot.

`write` dans le JSON et l'export conserve commit, branche, dossier, fichiers/diff Git, commandes terminées avec codes et sorties. `verification: observed-commands-only` : ce ne sont pas toutes des commandes de test et aucun succès n'est inféré de la prose du modèle. Rapports bornés, diagnostic si incomplets ; vérifier aussi `status`/`delivery`. Ne jamais renvoyer automatiquement ni effacer consumed.json pour réessayer. `node --test` peut échouer par spawn EPERM ; la variante Node 22 `--experimental-test-isolation=none` a réussi dans l'essai fictif, pas dans tous les builds.

## Récupérer le résultat

Cette section concerne uniquement le parcours `--write` expérimental et gelé.

Les fichiers modifiés restent dans le worktree indiqué par `write.worktree`. Ils ne sont pas recopiés dans votre projet. Ils apparaissent sur GitHub seulement après un commit et un push.

PALABRE rend la réponse et le compte rendu à l'appelant, mais ne les ajoute jamais automatiquement à la conversation de l'agent expéditeur. Le chef de mission doit les lire et vous en rendre compte.

Les commandes suivantes sont destinées au propriétaire, ou à un agent qu'il autorise séparément ; l'accord d'écriture consommé ne permet pas de committer, pousser ou fusionner.

**1. Relire le travail.** Dans votre PowerShell, remplacez les trois valeurs par `write.repository`, `write.worktree` et `write.branch` :

```powershell
$projet = "C:\projets\exemple"
$copie = "C:\chemin\du\worktree"
$branche = "palabre/relay-..."
git -C "$copie" status --short
git -C "$copie" diff
```

Relisez aussi les codes et sorties des tests dans le compte rendu. Si le travail vous convient, enregistrez uniquement les fichiers voulus. Exemple pour `src/prix.js` :

```powershell
git -C "$copie" add -- "src/prix.js"
git -C "$copie" commit -m "Corriger le calcul"
```

**2. Intégrer après validation.** Pour passer par GitHub, adaptez le dépôt et la branche cible, puis ouvrez une PR :

```powershell
git -C "$copie" push -u origin "$branche"
gh pr create --repo "proprietaire/projet" --head "$branche" --base "main"
```

Le propriétaire décide de la fusion après revue. Si votre projet autorise plutôt une fusion locale, placez le projet principal sur la branche cible choisie, sans changement non commité, puis lancez :

```powershell
git -C "$projet" merge --ff-only "$branche"
```

Si Git refuse, arrêtez-vous et examinez la situation ; ne forcez pas la fusion.

**3. Ranger après intégration.** Une fois le travail intégré et le worktree propre :

```powershell
git -C "$projet" worktree remove "$copie"
git -C "$projet" branch -d "$branche"
```

Ces commandes retirent le worktree et sa branche locale. Si Git refuse, gardez-les pour examen ; n'utilisez ni `--force` ni `-D`. Ne supprimez pas les fichiers d'accord pour réessayer une tâche.

## Mission v2.0 : un chef de mission, des étapes explicites

**Gelée.** Conservée et documentée, sans extension de périmètre ; seuls les correctifs de sécurité sont acceptés.

Hors d'un tour reçu par Relay, le chef de mission demande le cadre à l'humain dans leur conversation : objectif, critères, conversations choisies, tâches et budgets. Les réponses suffisent pour ce lot en lecture seule. Ne jamais élargir les droits par une réponse de l'équipier. Aucune extension à l'écriture n'est annoncée.

```powershell
palabre mission start --from "codex:<uuid-chef-de-mission>" --to "claude-review:<uuid-equipier>" --criteria "Risques expliqués" --tasks "consult,review" --max-steps 4 --max-duration 3600 --timeout 600 "Relire le plan" --json
palabre mission step <id> "Liste les risques" --json
palabre mission step <id> "Relis cette PR" --task review --pr https://github.com/owner/repo/pull/123 --timeout 1200 --json
palabre mission status <id> --json
palabre mission stop <id> --reason "Décision humaine"
```

Toutes les commandes partent du même dossier. `start` ne lance pas de CLI et n'approuve aucune config. `step` appelle le Relay fermé une seule fois ; pas de `--open`, `--trust-config`, inversion des rôles ni boucle automatique. La tâche `review` exige la politique existante et publie une revue COMMENT via l'hôte ; le modèle reste en lecture seule. Ne pas demander de code, commit, push, merge ou release à l'équipier dans cette mission.

Laisser fermée la conversation de l'équipier ; suivre status, l'export et GitHub. Chaque tentative compte, refus compris (1–100, défaut 10). Durée depuis start : 10–86400 s, défaut 3600, attente entre appels comprise. Délai Relay : 10–3600 s, défaut 600, configurable sur start ou step et limité par le temps restant. Les sondes et GitHub gardent leurs propres délais ; annulation non immédiate possible. Aucun plafond de coût monétaire.

`--json` : un `mission-result` v1, avec `action`, `exitCode`, `mission`, `exportPath`, `error`. Cadre, requêtes, réponses et résultats Relay sont conservés sous `.palabre/missions/<id>/state.json` et `<id>.mission.md`, hors `outputDir` ; stockage limité à 32 Mio. Les réponses ne sont jamais des vérifications automatiques. Ne pas publier les identifiants, chemins ou échanges locaux.

Reprise : après un résultat complet, status puis nouvelle step explicite, sans rejouer les réponses. `paused` après refus certain permet une nouvelle demande après lecture du diagnostic. `running` sans résultat ou `uncertain` bloque toute étape : vérifier avec l'humain, sans effacer la réservation. `stop` fonctionne aussi pendant l'appel, interdit la suite et demande l'annulation, sans retirer un message ou un POST déjà parti. Un arrêt ou un budget épuisé exige une nouvelle mission après décision humaine.

## Autoriser les revues sans éditer le JSON

**`--task review` est gelé.** La procédure est conservée, sans extension de périmètre ; seuls les correctifs de sécurité sont acceptés. Ne pas choisir cette publication GitHub pour une simple demande de relecture.

Le propriétaire lance `palabre relay allow-repo proprietaire/depot`, ou `palabre relay allow-repo 'vous/*'` pour tous ses dépôts, dans PowerShell ou un shell POSIX. La configuration doit déjà être approuvée : sinon il ouvre et relit le fichier avant de lancer lui-même la commande distincte `palabre config --config <fichier> --trust-config`. allow-repo affiche le chemin et le changement, exige une confirmation au clavier (o/oui/y/yes), conserve les autres réglages et approuve le contenu exact écrit. Aucun --yes, aucune écriture sans entrée/sortie TTY ; refus de confirmation en code 8.

Agent : sur `task-not-allowed`, ouvrir `remedy` dans le terminal visible de l'humain et attendre sa réponse. Ne jamais confirmer pour lui, éditer sa politique ni s'accorder des droits. Si l'hôte ne peut pas ouvrir le terminal, lui donner la commande exacte. La tâche ne publie qu'une revue COMMENT ; le merge reste humain. La présence d'un TTY n'est pas une authentification de l'humain.
