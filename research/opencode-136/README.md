# Reprendre la recherche Relay avec OpenCode sur une autre machine

Ce dossier partage le travail de l'[issue #136](https://github.com/JuReyms/Palabre/issues/136), pas un adapter prêt à utiliser. Il ne contient ni connexion, clé, base de conversations, binaire, trace brute ou code R1/B3. Ces éléments restent sur leur machine. Les reproducteurs historiques restent limités aux profils fictifs. Le nouvel essai avec le profil habituel suit la procédure ci-dessous.

## Décision actuelle : environnement OpenCode habituel

Le 19 octobre 2026, le propriétaire a retenu cette ligne pour **OpenCode** :
« Relay doit travailler avec mon OpenCode configuré comme je l'ai choisi ».
Ses modèles, connexions, permissions, plugins, MCP et règles d'organisation font
partie de cet environnement. Leur neutralisation générale n'est plus un préalable
au premier lot. Le contre-exemple Console reste une limite documentée de l'ancien
objectif de neutralisation, sans bloquer ce nouveau parcours.

OpenCode sert de laboratoire : le propriétaire l'utilise surtout pour des tests
et comme agent supplémentaire dans les débats Palabre. Cela autorise à préparer
des essais sur des projets et conversations fictifs ; les autres conversations
et réglages personnels restent hors cible. **Claude Code reste inchangé** : son
cadrage sera discuté séparément.

La première étape est une **consultation demandée sur copie**, avec les permissions
habituelles conservées. Ne pas la présenter comme une lecture seule imposée.
Un fork copie la conversation, pas le projet. Aucun `--auto`, changement de
permissions, modèle imposé, retry ou repli payant implicite.

Voir le [laboratoire avec profil habituel](habitual-profile-lab.md). Le script
`scripts/habitual-lab.mjs prepare` prépare seulement des fichiers fictifs et leur
relevé initial, hors du dépôt ; il ne lance pas OpenCode. Le propriétaire choisit
le modèle dans son interface, crée la conversation source de laboratoire, puis
la ferme avant l'essai de copie.

Identité de l'agent sur cette machine : **Codex MSI**. Utiliser cette signature
dans les interventions GitHub ; ne pas réécrire les anciennes signatures.

### Premier essai réel réussi avec le profil habituel

Le 19 octobre, le propriétaire a créé et fermé la source dans le dossier fictif.
Un essai unique dans une copie a conservé `build` et le modèle choisi
`opencode/deepseek-v4.1-flash-free`, variante `high`. La réponse restitue le code
de contexte, relève correctement l'erreur de calcul et propose des tests utiles.
Trois outils `read` terminés sont observés. Les relevés de la source sont
identiques avant/après ; les fichiers et leur inventaire hors `.git` sont inchangés.
La copie est conservée et le serveur privé s'est arrêté normalement.

Voir le [bilan réel](habitual-profile-result-2026-10-19.md). Ce passage qualifie ce
scénario CLI simple ; l'adapter produit, Desktop, la concurrence et les autres
contenus de conversation restent à traiter séparément.

## Où nous en sommes au 19 octobre 2026

Le but est de travailler avec OpenCode comme avec Claude Code et Codex, puis de permettre les échanges dans les deux sens. Les modèles gratuits sont un cas d'usage, pas la limite du produit. L'ordre retenu reste : avis sur une copie, choix du modèle, puis écriture. Desktop se qualifie séparément.

| Point | Établi sur les essais du 18 octobre | Limite à conserver |
| --- | --- | --- |
| Version | OpenCode 2.0.32 Windows, empreinte dans `scripts/lab-paths.mjs` | Ne s'applique pas automatiquement à une nouvelle version |
| Copie d'une conversation | Fork et contexte éprouvés ; original inchangé dans les relevés | Une copie de conversation ne copie pas le projet ni ne constitue un bac à sable |
| Réglages locaux remplacés | Plugin et MCP témoins non chargés, connexion locale fictive réutilisée | Ne neutralise pas toutes les autorités système ou distantes |
| Lecture seule | Écriture, shell et web refusés avant effet dans les cas testés | Contrôle applicatif, pas confinement système |
| Connexion Console habituelle | Peut ramener des règles et démarrer un MCP malgré le refus local | Ancien objectif de neutralisation non atteint ; le nouveau parcours conserve l'environnement choisi |
| Modèles et erreurs | Modèle par défaut lisible statiquement sous conditions ; erreurs simulées | Aucun changement automatique, aucun repli payant implicite |

Le dernier test local avec Ollama prouve le transport, le fork et la réutilisation d'une fausse clé. Sa réponse finale ne respectait pas entièrement la consigne : il ne faut pas le présenter comme un succès fonctionnel complet.

### Reprise sur le deuxième PC, 19 octobre 2026

Le paquet installé est `@opencode/cli` **2.0.32** et son binaire a exactement
l'empreinte qualifiée. Le contre-exemple Console/MCP a été rejoué avec des profils
fictifs : **une requête au MCP malgré le refus local**, sans session ni modèle ;
la politique distante reste absente de l'API de configuration. La connexion réelle
annoncée par le propriétaire n'a pas été utilisée pour cet essai.

La lecture des sources précise une distinction : un `deny` effectif dans les
permissions de session est contrôlé avant les politiques, mais il n'empêche pas
l'initialisation des MCP. Aucun plafond d'intégrations indépendant des politiques
Console n'a été établi dans les interfaces examinées. Ce constat bloquait
l'ancien parcours ; la décision ci-dessus change le préalable produit, sans
invalider l'essai. Voir le [bilan de reprise](resumption-2026-10-19.md), les pistes
écartées et la question amont préparée, non publiée et désormais facultative.

## Prochaine étape pour le chef de mission

1. Relever la version et le chemin de la CLI sur la machine utilisée, sans lire les connexions. Si elle a changé, requalifier les points concernés ; ne pas contourner le contrôle d'empreinte. Le moteur 2.0.32 identique a été retrouvé sur le deuxième PC.
2. Le premier parcours avec source et dossier explicites est désormais éprouvé ; conserver sa copie et ses traces locales, sans rejouer l'appel pour refaire un bilan. `scripts/habitual-copy.mjs` est un lanceur de recherche, pas une commande produit.
3. Préparer le contrat de l'adapter CLI sur une branche produit distincte depuis `main` à jour : consultation sur copie, environnement habituel, sélection de modèle explicite, corrélation stricte, erreurs et délivrance sans retry, rétention annoncée. Utiliser des faux transports pour ses tests ordinaires et les preuves réelles encore valides. Desktop garde sa qualification séparée.

Les bilans complets sont dans `historical/` et dans #136. Ils sont datés ; leurs anciens chemins `.cache/` sont des références de provenance, pas des commandes à reprendre. Les pièces brutes restent sur la première machine et ne sont pas nécessaires pour lire ces conclusions.

## Synchroniser les deux machines

Le dépôt de référence est `https://github.com/JuReyms/Palabre.git`. Ne recopiez pas un ancien dossier `.tmp/` ni vos fichiers d'approbation ou de connexion sur l'autre PC.

Sur le deuxième PC, depuis un clone existant propre, créez une seule fois un worktree de recherche (si cette branche locale n'existe pas déjà) :

```powershell
git fetch origin
git worktree add -b codex/opencode-research-handoff .tmp/opencode-research origin/codex/opencode-research-handoff
```

Si la branche existe déjà, utilisez son worktree existant ou `git worktree add .tmp/opencode-research codex/opencode-research-handoff` si elle n'est utilisée dans aucun worktree.

Avant chaque reprise sur ce PC :

```powershell
git -C .tmp/opencode-research status --short --branch
git -C .tmp/opencode-research pull --ff-only
```

Avant de passer à l'autre PC, l'agent termine un petit lot, relit les fichiers explicitement ajoutés au commit et pousse cette branche. Il ajoute au point de reprise ce qui est établi, le blocage, les tests passés et la prochaine action. Les changements ne passent sur l'autre machine qu'après commit et push. Si le pull refuse, arrêtez-vous ; ne forcez ni ne réinitialisez le dépôt. Évitez de travailler sur les mêmes fichiers simultanément sur les deux PC. Les changements produit feront ensuite l'objet de branches et PR dédiées depuis `main` à jour.

## Vérifications hors ligne, sans OpenCode ni compte

Node.js 22.13 ou plus est nécessaire pour les tests SQLite en mémoire. Depuis la racine du worktree :

```powershell
node --test research/opencode-136/scripts/static-model.test.mjs research/opencode-136/scripts/lab-paths.test.mjs
node --test research/opencode-136/scripts/habitual-lab.test.mjs
node --test research/opencode-136/scripts/habitual-copy.test.mjs
node --test research/opencode-136/fixtures/habitual-project/test/total.test.mjs
```

Ces tests utilisent uniquement des fichiers fictifs, des dossiers temporaires et des bases en mémoire. `static-model.mjs` lit les fichiers explicitement fournis comme des données ; il n'exécute ni plugin ni substitution. Le lecteur reste conservateur, pas une reproduction complète de la découverte native. macOS/MDM n'est pas qualifié. Les deux tests `habitual-lab` vérifient la préparation sans moteur et la détection des changements/disparitions des fichiers témoins. Le test du projet fictif passe volontairement sans couvrir la remise erronée.

## Reproducteurs historiques, à ne pas lancer par défaut

Les scripts ont été adaptés pour retirer les chemins propres au premier PC : binaire choisi explicitement, Node courant et profils fictifs neufs sous `.local/`, ignoré par Git. Cette adaptation a été vérifiée hors moteur ; **elle ne constitue pas un nouveau passage des essais OpenCode**.

- `qualify-remote-policy.mjs` : Console et MCP simulés sur localhost, aucune question à un modèle ; reproduit un blocage, pas une solution.
- `qualify-config-isolation.mjs` : fork, isolation des réglages et refus des outils, avec Ollama local et réponses SSE simulées ; nécessite le modèle local historique déjà installé. N'installe et ne télécharge aucun modèle.
- `isolation-env.mjs`, `remote-env.mjs` et les helpers `*-server.mjs` : dépendances des deux essais, pas des commandes utilisateur.
- `remote-presence.mjs` : ne lit que la base fournie par son appelant ; aucun chemin personnel implicite. Il appartient à l'ancien parcours, pas au lancement du nouveau laboratoire.

Un futur passage de ces essais exige un choix explicite du chef de mission. Sous Windows seulement, le chemin du binaire qualifié se fournit avec `$env:PALABRE_LAB_OPENCODE`, puis se retire après l'essai. Le moteur est refusé si son empreinte ne correspond pas ; il ne faut ni copier un binaire de l'autre PC ni modifier son installation pour forcer le passage.

Les sorties `.local/` contiennent des profils fictifs et, pour le nouveau parcours,
des traces issues du profil habituel sur une conversation fictive. Elles peuvent
contenir des identifiants de session, des informations du profil et des mots de
passe éphémères de serveurs. Ne les ajoutez pas à Git. Publiez un bilan relu,
jamais une base ou un journal brut. Les originaux locaux ne sont ni effacés ni
remplacés par cette copie de travail.
