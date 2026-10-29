# Fiche d'observation : premier Relay sur CoolMaster

> Statut : **prévu, non exécuté**, pour la semaine du 2 au 8 novembre 2026. Aucun résultat n'a été mesuré.

## Objet

Observer si une personne suit seule la page Premier Relay de #248 : demande fictive, avis, mode et trace, puis continuation avec le même équipier. Ce n'est ni un smoke ni une qualification de plateforme.

Page à lire, figée au commit vérifié `decac18` :

- FR : https://github.com/JuReyms/Palabre/blob/decac18b87bd6c641d849b72abff4c6cfb7874ce/docs/guide/fr/get-started/first-relay.md
- EN : https://github.com/JuReyms/Palabre/blob/decac18b87bd6c641d849b72abff4c6cfb7874ce/docs/guide/en/get-started/first-relay.md

## Participant et biais

| Élément | Valeur |
| --- | --- |
| Profil (débutant, connaît déjà Palabre, mainteneur) | à renseigner |
| Agent hôte choisi (Codex ou Claude Code, app ou CLI) | à renseigner |
| Système de CoolMaster | à renseigner |
| A préparé la machine lui-même | à renseigner |

Si le participant connaît déjà Palabre, ou a préparé la machine, notez ce biais : l'essai ne prouve pas l'usage d'un novice.

## A. Préparation technique, avant l'essai

Cette préparation revient au propriétaire. Elle reste séparée de la lecture du guide : ne montrez pas les sections B à D au participant.

- **Inventaire et mise à niveau** : suivez [Changer de machine](guide/fr/get-started/change-machine.md). Aucune conversation, approbation ou registre n'est repris d'une autre machine.
- **Clone de développement exact** : après avoir préservé le travail local, compilez et reliez le clone comme l'indique ce guide. Vérifiez ensuite :

Dans PowerShell, depuis le clone choisi :

```powershell
git rev-parse HEAD
git merge-base --is-ancestor 9fab671e906590e0bea552ea9bdfbb1c81255bae HEAD
$LASTEXITCODE
Get-Command palabre -All | Select-Object Name,Source
palabre --version
palabre agents --json
```

Pour `merge-base`, 0 signifie « contient #247 », 1 « ne le contient pas » ; toute autre valeur est une erreur, pas une conclusion sur le code. Si la référence manque, actualisez les références avec `git fetch` selon le guide, sans réinitialiser les fichiers. Sous macOS/Linux, remplacez le relevé `$LASTEXITCODE` par `echo $?` et le relevé `Get-Command` par `type -a palabre`.

- **Le numéro de version ne suffit pas.** La révision de développement `9fab671` affiche 0.21.0 ; une révision ultérieure peut porter un autre numéro. Si 0.19.0 reste affiché après une mise à jour censée apporter ce code, une ancienne installation est probablement active (chemin ou lien) : ne concluez pas au nouveau comportement. Pour le code de #247, `defaults.relayView` doit valoir `background`, sauf préférence `auto` enregistrée par le propriétaire.
- **Skill** : installé ou synchronisé depuis la CLI exécutée, après confirmation du plan, puis rechargé dans l'agent hôte. Voir [Skill](guide/fr/get-started/skill.md).
- **Configuration et connexions** : configuration relue et approuvée localement par le propriétaire. Contrôlez `claude auth status`, `codex login status`, puis `palabre doctor --terminal`.
- **Dossier de travail** : un dossier sans données sensibles. La demande de la page est autonome : aucun fichier à créer.

| Préparation | Valeur |
| --- | --- |
| Commit du clone | à renseigner |
| Contient `9fab671` (#247) | à renseigner |
| Chemin `palabre` actif et version affichée | à renseigner |
| `defaults.relayView` | à renseigner |
| Skill synchronisé et rechargé | à renseigner |
| Configuration approuvée, résultat de doctor | à renseigner |

## B. Pendant l'essai

- Le participant lit seulement la page Premier Relay et l'applique. Aucune consigne n'est ajoutée par Codex, par l'observateur ou par un autre agent. Toute aide donnée est notée.
- L'observateur note sans corriger. Il mesure séparément le temps d'action humaine (lecture, copie, autorisations) et l'attente des modèles. Aucune durée cible n'est fixée.

| Étape de la page | Action humaine (durée) | Attente modèle (durée) | Incompréhension ou question | Autorisation demandée par l'hôte | Aide ou commande nécessaire |
| --- | --- | --- | --- | --- | --- |
| Avant de commencer | à renseigner | à renseigner | à renseigner | à renseigner | à renseigner |
| 1. Demander un avis | à renseigner | à renseigner | à renseigner | à renseigner | à renseigner |
| 2. Reconnaître la réussite | à renseigner | à renseigner | à renseigner | à renseigner | à renseigner |
| 3. Continuer avec le même équipier | à renseigner | à renseigner | à renseigner | à renseigner | à renseigner |
| Blocage éventuel | à renseigner | à renseigner | à renseigner | à renseigner | à renseigner |

- Pour chaque autorisation de l'hôte, notez la commande et la manière dont elle a été accordée (une fois, durable). Une demande d'accès total ou de règle durable est à refuser et à noter.
- **Stop** si la délivrance est `unknown` ou `persisted-no-reply`. Pas de renvoi ; rien à fermer, supprimer ou nettoyer. L'observateur note l'état et la suite est décidée après l'essai.
- Si un agent propose d'approuver une configuration, d'installer ou de se connecter à la place du participant, notez-le. Le participant décide.

## C. Après l'essai seulement

Ces critères ne sont pas montrés avant l'essai, pour ne pas souffler les réponses.

| Critère | Observé (oui, non, partiel) | Note |
| --- | --- | --- |
| Avis de l'équipier rapporté dans la conversation de départ | à renseigner | à renseigner |
| Mode arrière-plan annoncé | à renseigner | à renseigner |
| Réception distinguée du résultat de la tâche | à renseigner | à renseigner |
| Trace `.relay.md` retrouvée sur demande | à renseigner | à renseigner |
| Continuation avec le même équipier, sans nouvelle conversation | à renseigner | à renseigner |
| Aucune approbation ni configuration faite par un agent à la place du participant | à renseigner | à renseigner |
| Participant capable d'expliquer où retrouver le résultat | à renseigner | à renseigner |

Limites à consigner : biais du participant, préparation faite par un tiers, une seule machine, versions des outils, quotas, et aide éventuelle. Une réussite ne qualifie pas les autres plateformes ni le parcours Desktop.

## D. Données et retour

- Exports, historiques et identifiants restent sur CoolMaster.
- Un retour public (issue ou PR) se limite à un résumé nettoyé : aucun identifiant de conversation, nonce, extrait d'historique, chemin personnel ni nom de compte. Il se partage seulement avec l'accord du participant.
- L'[essai macOS du paquet 0.21.0](test-macos-0.21.0.md) porte sur une autre version et une autre plateforme : ne comparez les deux qu'avec cette réserve.
