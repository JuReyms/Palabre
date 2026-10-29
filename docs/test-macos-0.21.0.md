# Essai macOS du paquet npm palabre@0.21.0

> Statut : **préparé, non exécuté.** Aucun résultat n'a été mesuré. Cette fiche ne qualifie ni toute la 0.21.0, ni macOS en général.

## Version visée

- Paquet npm `palabre@0.21.0`, choisi explicitement, et non un clone de développement. Métadonnées : https://registry.npmjs.org/palabre/0.21.0 (`gitHead` `28049d692ed215e99175d93d14dff18c0b8628cc`, même commit que le tag `v0.21.0`).
- Ce paquet garde `relay.view: auto` par défaut ([code au tag](https://github.com/JuReyms/Palabre/blob/28049d692ed215e99175d93d14dff18c0b8628cc/src/externalSessions/relayView.ts)). Une conversation Codex fermée part en arrière-plan ; une conversation ouverte reçoit le message avec ses propres permissions. L'arrière-plan par défaut (#247) est arrivé après ce tag, sur `main` au commit `9fab671`. Cette fiche impose donc `--background` pour les envois Relay du parcours minimal.
- Le `package.json` de la révision de développement `9fab671` affiche aussi 0.21.0 : le numéro seul ne distingue pas le paquet d'un clone.
- Les qualifications Mac antérieures de certains transports ne valent pas pour ce paquet entier. Les campagnes 0.21.0 ont tourné sous Windows : voir le [bilan 0.21.0](release-0.21.0-qualification.md).

## Règles de l'essai

- Vous lancez et confirmez vous-même chaque commande. Aucune installation, connexion, approbation ou synchronisation n'est automatique.
- Les appels consomment des quotas et ajoutent des conversations aux historiques Codex et Claude. Pas de `smoke:real-*` ni de campagne automatique : ils exigent un accord distinct, voir le [protocole de vérification](dev/verification.md).
- Pas de `--write`, Mission, `--task review` ni `allow-repo`. Aucun changement de politique ni de `relay.view`.
- Une réponse seule n'est pas un succès : lisez `status`, `delivery.status`, `identity` et le repère lu.
- **Stop** si `delivery.status` vaut `unknown` ou `persisted-no-reply`. Pas de renvoi, rien à fermer, tuer, supprimer ou nettoyer : notez l'état et décidez plus tard.
- Les identifiants de conversation, chemins personnels et exports restent sur le Mac. Jamais de « dernière conversation » : chaque reprise désigne l'identifiant noté.

## 1. Inventaire (lecture seule)

```sh
sw_vers
uname -m
type -a node npm palabre codex claude python3
node --version
npm --version
palabre --version
codex --version
claude --version
python3 --version
npm ls --global --depth=0 palabre
ls -l "$(command -v palabre)"
claude auth status
codex login status
```

Si un outil manque ou n'est pas connecté, arrêtez-vous. Installez-le ou connectez-le vous-même selon [Installation](guide/fr/get-started/installation.md) et [Changer de machine](guide/fr/get-started/change-machine.md). `python3` sert à la sonde du verrou Codex sous macOS ; sans lui, une cible Codex existante donne `target-state-unknown`, sans envoi.

| Élément | Valeur relevée |
| --- | --- |
| macOS et architecture | à renseigner |
| Chemins (`type -a`) | à renseigner |
| Node et npm | à renseigner |
| Palabre : version et source (npm global, lien de clone, autre) | à renseigner |
| Codex, Claude Code, python3 | à renseigner |
| Connexions CLI Claude et Codex | à renseigner |

## 2. Installer la version épinglée (si vous le choisissez)

Si `npm ls` montre un lien vers un clone (`->`), ou si `palabre` vient d'un autre gestionnaire, arrêtez-vous. N'écrasez pas cette installation à l'aveugle : choisissez d'abord celle à garder. Sinon :

```sh
npm install --global palabre@0.21.0
palabre --version
npm ls --global --depth=0 palabre
```

Pendant l'essai, n'utilisez ni `palabre update`, ni `palabre@latest`, ni un clone `main`. Une installation npm déjà en 0.21.0 peut rester telle quelle.

## 3. Projet d'essai et configuration

Créez vous-même un dossier d'essai hors de vos projets. Placez-y un `README.md` fictif contenant la ligne `Repère de lecture : ORION-MAC-021`. N'y placez aucun document de vos projets réels.

Dans ce dossier, `palabre init --local` crée et approuve une configuration propre à l'essai. Relisez-la : agents, commandes, chemins absolus, dossier d'export. Une modification manuelle invalide l'approbation : réapprouvez vous-même, selon l'étape 3 de [Changer de machine](guide/fr/get-started/change-machine.md). Relevez les noms d'agents avec `palabre agents --json` : remplacez `codex` et `claude` ci-dessous par les vôtres. Aucun agent n'est choisi à votre place.

Le skill ne sert qu'à la partie Desktop facultative. Lancez `palabre skill --sync --dry-run`, puis installez ou synchronisez seulement après confirmation, et rechargez l'agent. Le skill vient du paquet exécuté : il peut remplacer une copie plus récente issue de `main`, avec sauvegarde. Voir [Skill](guide/fr/get-started/skill.md).

## 4. Parcours minimal

Tout se lance depuis le dossier d'essai. Pour chaque étape, cochez le résultat et ajoutez une note courte.

**E1. Aide et doctor, sans modèle**

```sh
palabre --version
palabre relay --help
palabre doctor --terminal
```

Attendu : la version 0.21.0 ; l'aide liste `--new`, `--background` et `--check` ; doctor voit la configuration approuvée et les CLIs, et sonde les connexions sans modèle (il peut interroger npm pour la version). Résultat : ☐ conforme ☐ non conforme. Note : à renseigner.

**E2. Accueil TUI.** Lancez `palabre` : l'accueil s'ouvre et liste les agents. Quittez sans lancer de session. Résultat : ☐ conforme ☐ non conforme. Note : à renseigner.

**E3. Ask court, agents explicites**

```sh
palabre ask "Recopie exactement le repère de lecture du README fourni, en une ligne." --agents codex claude --files README.md --terminal
```

Attendu : deux réponses qui citent ORION-MAC-021 et un export `.ask.md`. Consomme du quota, synthèse comprise si elle est active. Résultat : ☐ conforme ☐ non conforme. Note : à renseigner.

**E4. Relay en arrière-plan, nouvelle conversation Claude**

```sh
palabre relay --new --background --to claude --subject "Essai Mac 0.21.0" "Lis README.md et recopie exactement son repère de lecture, sans modifier de fichier." --json
```

Attendu :

- `status: replied` et `exitCode: 0` ;
- `mode: background` et `created: true` ;
- `delivery.status: replied` et `identity: same-as-target` ;
- `reply` contient ORION-MAC-021 ;
- `exportPath` renseigné.

Notez `to.session` localement. `--new --background` est accepté par cette version ; tout refus est un écart à consigner, sans retirer l'option ni relancer automatiquement. Résultat : ☐ conforme ☐ non conforme. Note : à renseigner.

**E5. Même étape vers Codex.** Reprenez E4 avec `--to codex`. Mêmes attendus ; en plus, aucun `readAccess` en `blocked`. Si `status` vaut `read-unavailable`, arrêtez-vous : une réponse plausible n'est pas une lecture vérifiée. N'ouvrez pas le lien `codex://` dans ce parcours. Résultat : ☐ conforme ☐ non conforme. Note : à renseigner.

**E6. Reprise de la même cible**

```sh
printf 'Identifiant Claude rendu en E4 : '
IFS= read -r test_claude_session
palabre relay --background --to "claude:$test_claude_session" "Sans relire le fichier, rappelle le repère lu au tour précédent." --json
```

Attendu : même `to.session`, `replied`, `identity: same-as-target` et le repère rappelé. La reprise Codex est facultative ; sa conversation doit rester fermée. Un `target-busy` n'envoie rien : ne basculez pas vers `--open`. Résultat : ☐ conforme ☐ non conforme. Note : à renseigner.

**E7. Vérification sans envoi**

```sh
printf 'Identifiant Codex rendu en E5 : '
IFS= read -r test_codex_session
palabre relay --check --background --to "codex:$test_codex_session" --json
```

Attendu : `status: checked`, `delivery.status: not-delivered` et `check.target: closed`. Aucun message n'est déposé, mais la commande lance `python3` pour sonder le verrou. Résultat : ☐ conforme ☐ non conforme. Note : à renseigner.

## 5. Paquet 0.21.0 ou futur main : ne pas confondre

| Cas | Paquet 0.21.0 | Code de développement `9fab671` |
| --- | --- | --- |
| Sans option de mode ni préférence enregistrée | `auto` : Codex ouverte → envoi dans la conversation, fermée → arrière-plan | arrière-plan, `modeSource: default` |
| Avec `--background` | arrière-plan, `modeSource: explicit` | identique |
| Préférence enregistrée | `background` donne `setting` ; `auto` reste `auto` | identique |

Cet essai ne teste que la ligne `--background`. N'en déduisez pas le comportement par défaut de `main`.

## 6. Facultatif et séparé : surface Desktop

Seulement si vous voulez vérifier l'app sur Mac, après le parcours CLI, avec des résultats notés à part. Une réussite CLI ne valide pas Desktop, et inversement.

- **Ouvrir une conversation Codex créée** : `palabre relay open --to "codex:$test_codex_session"` (identifiant saisi en E7), sur votre demande directe. Non vérifié sous macOS. Un verrou tenu ne prouve ni affichage ni droits. La conversation créée par `--new` reste en lecture seule, et l'ouverture n'envoie rien.
- **Depuis Codex Desktop vers Claude** : chaque commande demande une autorisation hors bac à sable, accordée une fois seulement, sans accès total ni règle durable. Une commande lancée ne prouve pas votre clic. Parcours vérifié sous Windows seulement.
- **`--open` vers une Codex ouverte** : utilise les permissions de la conversation, écriture comprise si elle est autorisée. Accord distinct, hors parcours minimal.
- **Envoi vers Claude ouverte** : indisponible.

Détails : [Relay ouvert](dev/relay-open.md) et [guide Relay](guide/fr/usage/relay.md).

## 7. Résumé à remplir (sans données privées)

| Étape | Conforme, non conforme ou non lancée | Remarque courte |
| --- | --- | --- |
| E1 Aide et doctor | à renseigner | à renseigner |
| E2 TUI | à renseigner | à renseigner |
| E3 Ask | à renseigner | à renseigner |
| E4 Relay Claude | à renseigner | à renseigner |
| E5 Relay Codex | à renseigner | à renseigner |
| E6 Reprise | à renseigner | à renseigner |
| E7 Check | à renseigner | à renseigner |
| Desktop (facultatif) | à renseigner | à renseigner |

Date, version et source de Palabre : à renseigner. La conclusion se limite aux étapes conformes de ce tableau, pour ce Mac et ces versions ; aucune qualification globale.
