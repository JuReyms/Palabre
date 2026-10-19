# Reprendre la recherche Relay avec OpenCode sur une autre machine

Ce dossier partage le travail de l'[issue #136](https://github.com/JuReyms/Palabre/issues/136), pas un adapter prêt à utiliser. Il ne contient ni connexion, clé, base de conversations, binaire, trace brute ou code R1/B3. Ces éléments restent sur leur machine. Aucun essai avec le compte du propriétaire ne doit être lancé à partir de cette archive.

## Où nous en sommes au 19 octobre 2026

Le but est de travailler avec OpenCode comme avec Claude Code et Codex, puis de permettre les échanges dans les deux sens. Les modèles gratuits sont un cas d'usage, pas la limite du produit. L'ordre retenu reste : avis sur une copie, choix du modèle, puis écriture. Desktop se qualifie séparément.

| Point | Établi sur les essais du 18 octobre | Limite à conserver |
| --- | --- | --- |
| Version | OpenCode 2.0.32 Windows, empreinte dans `scripts/lab-paths.mjs` | Ne s'applique pas automatiquement à une nouvelle version |
| Copie d'une conversation | Fork et contexte éprouvés ; original inchangé dans les relevés | Une copie de conversation ne copie pas le projet ni ne constitue un bac à sable |
| Réglages locaux remplacés | Plugin et MCP témoins non chargés, connexion locale fictive réutilisée | Ne neutralise pas toutes les autorités système ou distantes |
| Lecture seule | Écriture, shell et web refusés avant effet dans les cas testés | Contrôle applicatif, pas confinement système |
| Connexion Console habituelle | Peut ramener des règles et démarrer un MCP malgré le refus local | **Blocage ouvert : aucun essai sur le vrai compte ni adapter produit** |
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
Console n'a été établi dans les interfaces examinées. Le blocage du profil habituel
reste ouvert. Voir le [bilan de reprise](resumption-2026-10-19.md), les pistes
écartées et la question amont préparée, non publiée.

## Prochaine étape pour le chef de mission

1. Relever la version et le chemin de la CLI sur la machine utilisée, sans lire les connexions. Si elle a changé, requalifier les points concernés ; ne pas contourner le contrôle d'empreinte.
2. Chercher une limite supportée que les règles distantes ne peuvent pas rouvrir. Un simple contrôle de la configuration API ne suffit pas : la règle distante de notre contre-exemple n'y apparaît pas. Ne pas contourner une règle d'organisation.
3. Une fois le blocage levé, préparer une procédure pour une conversation fictive avec le profil habituel du propriétaire, qu'il exécutera lui-même. Code produit et Desktop restent des lots séparés.

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
```

Ces tests utilisent uniquement des fichiers temporaires et des bases en mémoire. `static-model.mjs` lit les fichiers explicitement fournis comme des données ; il n'exécute ni plugin ni substitution. Le lecteur reste conservateur, pas une reproduction complète de la découverte native. macOS/MDM n'est pas qualifié.

## Reproducteurs historiques, à ne pas lancer par défaut

Les scripts ont été adaptés pour retirer les chemins propres au premier PC : binaire choisi explicitement, Node courant et profils fictifs neufs sous `.local/`, ignoré par Git. Cette adaptation a été vérifiée hors moteur ; **elle ne constitue pas un nouveau passage des essais OpenCode**.

- `qualify-remote-policy.mjs` : Console et MCP simulés sur localhost, aucune question à un modèle ; reproduit un blocage, pas une solution.
- `qualify-config-isolation.mjs` : fork, isolation des réglages et refus des outils, avec Ollama local et réponses SSE simulées ; nécessite le modèle local historique déjà installé. N'installe et ne télécharge aucun modèle.
- `isolation-env.mjs`, `remote-env.mjs` et les helpers `*-server.mjs` : dépendances des deux essais, pas des commandes utilisateur.
- `remote-presence.mjs` : ne lit que la base fournie par son appelant ; aucun chemin personnel implicite. Aucun script destiné au vrai compte n'est livré.

Un futur passage de ces essais exige un choix explicite du chef de mission. Sous Windows seulement, le chemin du binaire qualifié se fournit avec `$env:PALABRE_LAB_OPENCODE`, puis se retire après l'essai. Le moteur est refusé si son empreinte ne correspond pas ; il ne faut ni copier un binaire de l'autre PC ni modifier son installation pour forcer le passage.

Les sorties `.local/` contiennent uniquement des essais fictifs, mais peuvent avoir des identifiants de session et des mots de passe éphémères de serveurs. Ne les ajoutez pas à Git. Publiez un bilan relu, jamais une base ou un journal brut. Les originaux locaux ne sont ni effacés ni remplacés par cette copie de travail.
