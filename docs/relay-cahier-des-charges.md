# Relay : cahier des charges

Référence de travail pour toutes les décisions sur Relay. Validé par le propriétaire le 18 octobre 2026. Suivi : [#150](https://github.com/JuReyms/Palabre/issues/150).

Ce document n'est pas publié sur le site : le guide utilisateur reste dans `docs/guide/`.

## 1. Pour qui

Une personne qui **découvre PALABRE** mais **travaille déjà avec des agents** (Claude Code, Codex, et plus tard OpenCode). Elle veut que ses agents se passent le travail sans copier-coller, et garder la décision.

## 2. Ce qu'elle veut faire

- **Confier une tâche** à un autre agent : relire, vérifier, conseiller, **ou réaliser** (coder, corriger, tester).
- **Continuer** avec le même agent, qui se souvient du travail.
- Le faire **en parlant à son agent**, grâce au skill, sans apprendre les commandes.
- **Recevoir un compte rendu clair** : ce qui a été fait, ce qui a été vérifié, ce qui attend sa décision.

## 3. Les situations

Une case = une configuration × un sens. « Agir » veut dire que l'agent qui reçoit peut modifier des fichiers et lancer des tests.

| Configuration | Sens | Doit permettre | Aujourd'hui | Preuve |
| --- | --- | --- | --- | --- |
| **A. Desktop + desktop** | Claude → Codex ouvert | Agir | ✅ Windows (`--open`) · ❓ macOS | Usage réel quotidien |
| | Codex → Claude ouvert | Agir | ❌ Pas encore (#96) | — |
| **B. CLI + CLI** (deux terminaux) | Claude → Codex ouvert | Agir | ❓ Prévu, peu testé | À faire |
| | Codex → Claude ouvert | Agir | ❌ Pas encore (#96) | — |
| **C. En arrière-plan** (sans fenêtre, conversation neuve ou existante) | Claude → Codex | Relire | ✅ Windows (`--new`, #152, #154) | Essai du 18 octobre 2026 |
| | | Agir | ⏳ Lot 2 en cours ; faisable sous Windows | Étude du 18 octobre 2026 (#150) |
| | Codex → Claude | Relire | ✅ si l'humain autorise cet appel à sortir de la bulle réseau de Codex | Étude du 18 octobre 2026 (#150) |
| | | Agir | ❌ Windows natif : Claude Code n'y propose pas de confinement des commandes · ❓ macOS, Linux, WSL | À qualifier (#141) |
| **Plus tard** | OpenCode ↔ Claude ↔ Codex | Agir | 🔬 En étude (#136) | — |

**Plateformes** : Windows en priorité ; macOS à tester (#141). `--open` ne fonctionne que sous Windows pour l'instant.

**Sens des échanges** : l'envoi vers une conversation **ouverte** marche aujourd'hui vers Codex seulement. À dire clairement partout (README, guides, site).

## 4. Les règles qui ne bougent pas

1. **L'humain décide.** Pour agir en arrière-plan, il donne son accord pour chaque tâche.
2. **Un message ne donne aucun droit à lui seul.** L'agent qui reçoit agit seulement avec les permissions que l'humain lui a données.
3. **Rien n'est renvoyé automatiquement.** En cas d'erreur, PALABRE explique ce qui s'est passé ; l'humain choisit la suite.
4. **Tout est tracé** : un export pour chaque échange, rangé par mode (#158).
5. **Un seul agent écrit à la fois** dans un même dossier.

## 5. Comment on s'en sert

- **Chaque PR Relay** indique les cases qu'elle fait avancer, avec sa preuve.
- **Chaque guide** dit pour quelle configuration il vaut, et le sens des échanges.
- **Les limites sont dites partout, et positivement.** Ne jamais présenter Relay comme « lecture seule » en général : préciser la configuration concernée.
- **Une version sort quand ses cases prévues sont au vert.**

## 6. Objectif de la 0.18.0

- **C, Claude → Codex** : relire ✅ et **agir** (lot 2, Codex sous Windows d'abord).
- **C, Codex → Claude** : relire, testé et documenté (autorisation de l'appel réseau dans Codex).
- **B** : testé, résultat documenté.
- **Guide « Premier Relay »** : présente les trois configurations et dit clairement le sens des échanges, et que Claude ne peut pas encore agir en arrière-plan sous Windows.
