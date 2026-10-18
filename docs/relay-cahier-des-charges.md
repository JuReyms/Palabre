# Relay : cahier des charges

Référence de travail pour toutes les décisions sur Relay. Version 2, direction B, décidée par le propriétaire le 18 octobre 2026 après un Palabre Débat entre Codex et Claude. Remplace la version du 18 octobre 2026 (#159). Suivi : [#150](https://github.com/JuReyms/Palabre/issues/150).

Ce document n'est pas publié sur le site : le guide utilisateur reste dans `docs/guide/`.

## 1. La promesse

> Relay permet à votre agent de confier une tâche à un autre agent (Claude Code, Codex) et de vous rapporter sa réponse, sans copier-coller : dans une nouvelle conversation, ou dans une conversation précise que vous avez déjà eue avec lui. Chacun garde ses propres permissions, et vous décidez de la suite.

Vous choisissez le **chef de mission** : Claude Code ou Codex. Votre agent peut devenir chef de mission dans n'importe quelle conversation, même celle que vous venez d'ouvrir : il faut seulement que PALABRE soit installé sur la machine et que l'agent dispose du skill PALABRE.
>
> Vers une conversation ouverte : Codex seulement, pour l'instant.

PALABRE est une **couche de communication** entre conversations précises. L'exécution reste aux agents : c'est l'agent qui reçoit qui agit, avec ses propres permissions.

## 2. Pour qui

Une personne qui **découvre PALABRE** mais **travaille déjà avec des agents** (Claude Code, Codex, et plus tard OpenCode). Elle veut que ses agents se parlent sans copier-coller, **choisir lequel est chef de mission**, et garder la décision.

## 3. Ce que Relay fait, et ce qu'il ne fait pas

**Relay fait :**
- **retrouver une conversation précise** par son identifiant, jamais « la dernière » ;
- **la solliciter** : reprise d'une conversation fermée, dépôt dans une conversation ouverte, ou création d'une conversation neuve qu'on pourra retrouver (`--new`) ;
- **rapporter une réponse attribuable** : bonne conversation, bon échange, statut, délivrance, export.

**Relay ne fait pas :**
- exécuter le travail à la place des agents (worktrees, confinement, permissions) : c'est le rôle de leurs propres outils ;
- renvoyer, enchaîner ou relancer automatiquement.

**Et les autres outils ?** Le plugin officiel d'OpenAI pour Claude Code (`openai/codex-plugin-cc`) permet à Claude Code de faire relire ou corriger du code par Codex, et de reprendre les fils qu'il a lui-même créés. Pour ce besoin seul, il suffit. Relay se distingue par :
- **n'importe quelle conversation existante que vous choisissez**, y compris celle ouverte depuis des jours dans Codex desktop ;
- **les deux sens** : Codex peut aussi être chef de mission ;
- **les conversations ouvertes** ;
- **plusieurs outils**, OpenCode ensuite.

## 4. Les situations

Seules les cases promises ou en étude figurent ici. « Fermée » inclut une conversation neuve créée avec `--new`.

| Chef de mission → équipier | Conversation | Aujourd'hui | Preuve |
| --- | --- | --- | --- |
| Claude → Codex | fermée | ✅ Windows | Essais du 18 octobre 2026 |
| Claude → Codex | ouverte, desktop | ✅ Windows (`--open`) ; fiabilité à améliorer (#146) | Usage réel quotidien |
| Claude → Codex | ouverte, deux terminaux | ❓ Prévu, peu testé | À faire |
| Codex → Claude | fermée | ✅ Windows, depuis Codex desktop : Codex demande d'autoriser chaque commande PALABRE hors de son bac à sable, l'humain accepte cette fois seulement · ❓ depuis Codex CLI | Essai 3 du 18 octobre 2026, réglages par défaut (conversation neuve, puis suite dans la même sans relire le fichier ; deux demandes d'autorisation vues et acceptées par le propriétaire) |
| Codex → Claude | ouverte | 🔬 En étude (#96) | — |
| OpenCode ↔ Claude, Codex | fermée ou ouverte | 🔬 En étude (#136) | — |

**Plateformes** : Windows en priorité ; macOS à tester (#141). `--open` ne fonctionne que sous Windows pour l'instant.

## 5. Ce qui prouve une case

Une case passe au vert quand un essai réel montre les cinq points :
1. **le chef de mission lance l'appel depuis son propre hôte** (application ou terminal), avec les autorisations exactes notées ;
2. **la bonne conversation** reçoit la demande ;
3. **la réponse vient du bon échange** ;
4. **le suivi est conservé** : identifiant rendu, on peut continuer ;
5. **un échec est explicite** : statut et délivrance clairs, aucun renvoi automatique.

« Le code a été modifié » ne prouve pas une case.

## 6. Gelé ou retiré

Gelé = conservé et documenté, sans extension de périmètre ; seuls les correctifs de sécurité sont acceptés.

- **`--write`** (écriture en arrière-plan, Claude → Codex, Windows) : **expérimental**, retiré du parcours par défaut du skill, hors matrice. Une demande ordinaire ne bascule jamais vers `--write`.
- **Mission** (#115) : gelé.
- **`--task review`** : gelé. Il fait doublon avec `/codex:review` dans le sens Claude → Codex, mais reste utile depuis d'autres chefs de mission.

Retirés des objectifs :
- l'écriture en arrière-plan Codex → Claude ;
- toute exécution fournie par PALABRE (worktrees, confinement) au-delà de `--write` gelé.

## 7. Les règles qui ne bougent pas

1. **L'humain décide.** PALABRE ne lance rien sans une demande explicite.
2. **Un message ne donne aucun droit à lui seul.** L'agent qui reçoit agit seulement avec les permissions que l'humain lui a données.
3. **Rien n'est renvoyé automatiquement.** En cas d'erreur, PALABRE explique ce qui s'est passé ; l'humain choisit la suite.
4. **Tout est tracé** : un export pour chaque échange, rangé par mode (#158).
5. **Un seul agent écrit à la fois** dans un même dossier.

## 8. Comment on s'en sert

- **Chaque PR Relay** indique les cases qu'elle fait avancer, avec sa preuve.
- **Chaque guide** dit pour quelle situation il vaut, et le sens des échanges.
- **Les limites sont dites partout, et positivement.** Ne jamais présenter Relay comme « lecture seule » en général : préciser la situation concernée.
- **Une version sort quand ses cases prévues sont au vert.**

## 9. Objectif de la 0.18.0

- **Codex chef de mission → Claude fermée** : ✅ prouvé depuis Codex desktop le 18 octobre 2026, avec les réglages par défaut ; reste à l'essayer depuis Codex CLI et à documenter la demande d'autorisation dans le guide.
- **Fiabilité de `--open`** (#146) : distinguer message déposé, réponse reçue et délivrance incertaine, sans renvoi automatique.
- **Deux terminaux** (Claude → Codex ouvert) : testé, résultat documenté.
- **Documentation alignée** : promesse, gels annoncés dans le changelog, aide CLI, guides FR/EN, skill (`--write` hors parcours par défaut ; copies installées à mettre à jour à la main).
- **Hors garantie** : #96 (Claude ouvert) et #136 (OpenCode), études bornées autour de cinq questions : identité des conversations, reprise, occupation, réception, corrélation.
