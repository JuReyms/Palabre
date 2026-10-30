# Documentation, contribution et releases

Référence de développement extraite d’`AGENTS.md`. Lire [les règles communes](../../AGENTS.md) et ce document avant de modifier les guides, le skill livré, les publications, la synchronisation web ou les workflows de contribution. Les chemins de code entre backticks sont relatifs à la racine du dépôt. Les qualifications datées décrivent un essai, pas une garantie pour toutes les versions.

## Documentation

La documentation doit rester a jour dans le meme changement que le code. Avant de finaliser une modification, verifier les fichiers concernes :

Le script `scripts/sync_docs.py` valide et copie les pages `docs/guide/fr` et `docs/guide/en` vers les formats numerotes `content/fr` et `content/en` de palabre-web. Ne pas recreer de logique qui devine les descriptions depuis le contenu : elles doivent etre explicites dans le frontmatter.

- `README.md` pour l'etat du MVP, les commandes principales, les limites connues et les liens de documentation.
- `AGENTS.md` pour les règles communes et le routage ; `docs/dev/` pour les contrats d’architecture, les workflows et les consignes de maintenance détaillés.
- `CHANGELOG.md` pour les changements notables par version. Toute release CLI doit y ajouter une entree datee avant le bump/tag, avec les sections utiles (`Added`, `Changed`, `Fixed`, `Removed`, `Security`).
- `docs/guide/fr/**.md` pour les guides utilisateur francais. Ces pages utilisent le meme format que palabre-web/Nuxt Content : frontmatter `title` + `description`, puis contenu sans H1 de page. La traduction anglaise vit dans `docs/guide/en/**.md`.
- `docs/guide/fr/roadmap.md` pour la roadmap publique francaise orientee utilisateurs : disponible aujourd'hui, prochaines ameliorations, philosophie du projet.
- `docs/roadmap.md` pour la roadmap interne locale non versionnee : travaux faits, priorites, dettes techniques et notes de pilotage.

`docs/notes.md` est reserve aux idees personnelles du mainteneur. Ne pas l'utiliser comme roadmap projet. Quand une idee de `docs/notes.md` est implementee ou deplacee dans une roadmap, nettoyer la note correspondante pour garder ce fichier lisible.

Les documents obsoletes ou historiques doivent etre deplaces dans `docs/archive/` plutot que supprimes brutalement quand ils gardent une valeur de contexte.

## Skill livré

`metadata.revision` du skill est un entier positif sûr, indépendant de la version CLI. L'incrémenter à chaque changement des consignes d'exécution (SKILL ou références) et aligner les littéraux `--skill-revision` dans ses recettes ; le validateur refuse une déclaration différente. Cette première révision amorce le protocole ; un numéro déclaré n'est pas une preuve de chargement. La lecture du paquet (`skill --read --json`) ne synchronise aucune copie installée. Les références du paquet sont résolues par la CLI, sans recherche depuis le cwd. Un agent peut les relire dans une tâche autorisée sans nouvel accord ; toute installation/remplacement disque garde son plan humain confirmé.

Lors d'un bump de révision, actualiser aussi les attentes sur le paquet réel dans `tests/skill-runtime.test.ts`, `tests/relay-check.test.ts`, `tests/relay-command.test.ts` et les scénarios de bump de `tests/skill-validation.test.ts` ; les valeurs des paquets fictifs restent indépendantes. Le validateur et le runtime acceptent un BOM UTF-8 initial et LF/CRLF, avec une clôture `---` seule ; le texte restitué conserve BOM et fins de ligne. Le test croisé couvre ces formats pour éviter une divergence de lecture.

Skill livré : `SKILL.md` garde routage, exemples sûrs, portée des rôles et invariants d'autorité/délivrance. Références conditionnelles : `relay.md` (bases), `relay-desktop.md`, `relay-opencode.md`, `relay-frozen.md`, plus Chat, CLI et exports. Le validateur contrôle présence/liens, au plus 120 lignes, 10 000 caractères et 1 200 caractères par paragraphe/élément de liste du point d'entrée ; ce budget ne prouve pas le comportement. Préserver les garde-fous lors des déplacements, faire évaluer des scénarios réalistes par un autre agent sans donner les réponses attendues. Copies installées seulement par plan confirmé, jamais depuis la branche Git.

## JSDoc

Mettre en place et maintenir des JSDoc sur les API internes qui servent de contrat entre modules :

- types et interfaces exportes dans `src/types.ts` ;
- fonctions d'orchestration ;
- adapters ;
- chargement de config ;
- discovery ;
- gestion du contexte ;
- update.

Les commentaires doivent expliquer le contrat, les invariants et les limites utiles. Eviter les commentaires qui paraphrasent simplement le code.

Regle d'entretien : chaque fichier TypeScript modifie doit faire l'objet d'une revue JSDoc dans le meme changement. Au minimum, maintenir une description de module (`@file`) et documenter les types/fonctions exportes ; documenter aussi les fonctions internes quand leur priorite, leurs effets de bord, leurs erreurs ou leurs fallbacks ne sont pas evidents. Si une API documentee change de comportement, sa JSDoc doit etre mise a jour avant le commit.

## Releases

Les releases sont gerees via des tags Git. Trois workflows GitHub Actions sont en place :

- `.github/workflows/ci.yml` : type check + tests + build sur chaque push `main` et chaque PR.
- `.github/workflows/release.yml` : validation stricte du tag et de `package.json`, type check + tests + build + pack + publication npm via Trusted Publishing + creation de release GitHub sur chaque tag stable ou de preversion.
- `.github/workflows/release-social.yml` : reprise manuelle ciblée du post Bluesky pour un tag déjà publié, sans republier npm ni recréer la release.

### Preparer et publier une release

La préparation de 0.22.1 a son [bilan de qualification](../release-0.22.1-qualification.md), avec les contrôles du paquet, les simulations du parcours débutant et les campagnes réelles restant à effectuer.

Pour la préparation de 0.21.0, consulter le [bilan de qualification](../release-0.21.0-qualification.md) : il sépare les révisions testées, les limites et les contrôles restant avant publication.

La préparation de 0.22.0 « Bunny » a son [bilan distinct](../release-0.22.0-qualification.md). Un nom d'affichage facultatif se déclare dans la section exacte de la version du changelog : `<!-- release-name: Bunny -->`. Le workflow utilise alors `Palabre v0.22.0 — Bunny` comme titre GitHub, sans changer le tag, SemVer ni le canal npm. Sans marqueur dans cette section, le titre reste le tag ; un nom mal formé, ambigu ou contenant des caractères de contrôle est refusé avant publication. Les noms d'autres versions et d'Unreleased ne sont jamais repris.

```bash
# Depuis une branche de release, sans creer de tag local
pnpm version patch --no-git-tag-version   # ou minor / major
# Mettre a jour CHANGELOG.md, ouvrir puis fusionner la PR de release
```

Avant le bump, mettre a jour `CHANGELOG.md` avec l'entree datee de la version cible. La PR de release contient au minimum `package.json` et le changelog ; `main` reste protegee et ne recoit pas de commit direct.

Pour une preversion, utiliser une version explicite comme `0.18.0-beta.1` et un tag Git identique prefixe par `v`. Le workflow refuse tout ecart entre le tag et `package.json`. Il publie la preversion sur le dist-tag npm `next`, cree une GitHub prerelease qui ne devient pas Latest, et n'actualise ni palabre-web ni Bluesky. La version stable reste installee par defaut. Commandes utilisateur : `npm install -g palabre@next`, puis retour arriere avec `npm install -g palabre@0.17.0` ou une autre version stable explicite.

Apres fusion de la PR, taguer exactement le commit courant de `main`, puis pousser seulement ce tag :

```bash
git switch main
git pull --ff-only
git tag vX.Y.Z
git push origin vX.Y.Z
```

Le push du tag declenche le workflow `release.yml` qui :

1. installe les dependances (`--frozen-lockfile`) ;
2. verifie les types (`pnpm check`) ;
3. lance les tests automatises (`pnpm test`) ;
4. compile (`pnpm build`) ;
5. pack un tarball npm (`pnpm pack`) ;
6. publie sur npm via Trusted Publishing, sous `latest` pour une stable ou `next` pour une preversion, sans token npm stocke dans GitHub ;
7. cree une release GitHub avec le tarball en artifact et les notes generees depuis les commits ; une preversion est marquee comme telle et ne devient pas Latest ;
8. pour une stable seulement, pousse `public/version.json` dans le repo `JuReyms/palabre-web` (branche `dev`) ;
9. pour une stable seulement, cree une PR `dev -> main` dans palabre-web, ou commente la PR deja ouverte, puis expose son lien dans le resume du workflow. La fusion manuelle de cette PR declenche le build Netlify de production et met a jour le badge de version.

Les workflows de release et de synchronisation documentaire recréent la branche `dev` de `palabre-web` depuis `main` lorsqu'elle a été supprimée après fusion. Si le workflow principal s'interrompt après la publication npm mais avant le post social, ne jamais republier le même tag : déclencher manuellement `release-social.yml` avec le tag existant.

### Npm Trusted Publishing

Le package npm `palabre` doit etre configure cote npm avec un Trusted Publisher GitHub Actions :

- Repository owner: `JuReyms`
- Repository name: `Palabre`
- Workflow filename: `release.yml`
- Environment: laisser vide, sauf si le workflow ajoute explicitement `environment: ...`

Ne pas stocker de `NPM_TOKEN` dans GitHub et ne pas publier depuis la machine locale pour les releases normales. Si une publication manuelle d'urgence est faite, supprimer le token local avec `npm config delete //registry.npmjs.org/:_authToken` juste apres.

## Sync documentation (palabre-web)

Le repo CLI est public. Le site de documentation (`JuReyms/palabre-web`, Nuxt SSG sur Netlify) recoit les mises a jour via deux workflows GitHub Actions qui poussent directement dans la branche `dev` de palabre-web. Netlify produit depuis `main` : le workflow de release cree ou rappelle donc une PR `dev -> main`, dont la fusion reste manuelle.

Les deux workflows utilisent le secret `DOCS_REPO_TOKEN` (PAT fine-grained sur `JuReyms/palabre-web` uniquement). Il exige `Contents = Read and write` pour la synchronisation et `Pull requests = Read and write` pour proposer le deploiement de production.

### Workflow sync-docs.yml

Declenche sur tout push dans `docs/guide/fr/**`, `scripts/sync_docs.py` ou le workflow lui-meme vers `main`.

Les pages source utilisent le meme format que palabre-web/Nuxt Content : frontmatter `title` + `description`, puis contenu sans H1 de page. Le workflow appelle `scripts/sync_docs.py`, qui valide ce format et copie les pages vers `content/fr/**` dans palabre-web.

Convention i18n :

- francais actif : `docs/guide/fr/**` -> `content/fr/**` ;
- anglais : `docs/guide/en/**` -> `content/en/**`.

Ne pas recreer de logique qui devine les descriptions depuis le contenu. Les descriptions doivent rester explicites dans le frontmatter.

**Contrainte critique** : ne jamais utiliser `rm -rf palabre-web/content/*` dans le step de copie. `content/index.md` (landing page) n'est pas dans la sync et ne doit pas etre supprime — sans lui, la collection `landing` de Nuxt Content est vide, la route `/` retourne 404 et le build Netlify echoue. Le step de copie doit se limiter a `cp -R dist/content/. palabre-web/content/`.

Pour ajouter une page de documentation, ajouter les versions `fr` et `en` dans le meme changement :

1. Creer le fichier source dans la section adaptee de `docs/guide/fr/`.
2. Ajouter la ligne correspondante dans `ROUTE_MAP` de `scripts/sync_docs.py`.
3. Verifier localement avec `python scripts/sync_docs.py`.
4. Si la page ajoute une nouvelle section, creer ou adapter la navigation correspondante dans palabre-web (`content/fr/**/.navigation.yml`).

Attention aux liens internes : ne pas utiliser de liens relatifs (`./autre-page.md`) dans les sources `docs/guide/fr/`. Utiliser des URLs absolutes correspondant aux routes finales du site (`/fr/get-started/...`, `/fr/agents/...`, `/fr/usage/...`, `/fr/configuration/...`, `/fr/reference/...`).
### Workflow release.yml (step de sync)

A chaque release, apres la creation de la release GitHub, le workflow ecrit :

```json
{ "tag_name": "vX.Y.Z" }
```

dans `public/version.json` de palabre-web. Le composable `useLatestRelease.ts` de palabre-web lit ce fichier local au lieu d'appeler l'API GitHub — ce qui evite au site de documentation d'appeler l'API GitHub a chaque affichage.

### Nommage des versions

Suivre semver :

- `patch` : correction de bug, ajustement mineur sans impact sur les commandes.
- `minor` : nouvelle fonctionnalite retro-compatible.
- `major` : changement cassant de l'interface CLI ou du format de config.

## Issues GitHub

Les titres, descriptions et commentaires des issues et pull requests doivent etre rediges en francais. Les messages de commit, y compris ceux produits par les workflows automatises, doivent egalement etre en francais. Les identifiants techniques et les noms de branches peuvent rester en anglais.

Toute issue GitHub creee ou mise a jour par un agent doit recevoir exactement un label de type existant :

- `type: bug` pour une regression ou un comportement incorrect reproductible ;
- `type: feature` pour une fonctionnalite, une amelioration produit ou une dette technique planifiee ;
- `type: documentation` pour une documentation, une ADR ou une evolution de contrat documentaire ;
- `type: question` uniquement quand l'objectif est d'obtenir une decision ou une information externe avant toute implementation.

Ajouter aussi un label de zone quand le perimetre est clair : `area: cli`, `area: vscode-extension` ou `area: website`. Ne pas creer de nouveau label sans demande explicite. Ne pas appliquer les anciens labels generiques (`bug`, `enhancement`, `documentation`, `question`) aux nouvelles issues, ni `duplicate`, `invalid`, `wontfix`, `good first issue` ou `help wanted` sans validation explicite du mainteneur.

## Style de contribution

- Preferer des changements petits et comprehensibles.
- Ne pas melanger TUI, PTY et extension VS Code dans le meme changement.
- Garder les adapters independants du moteur d'orchestration.
- Documenter les limites connues plutot que de masquer les heuristiques.
- Eviter les abstractions prematurees, sauf quand elles gardent les adapters propres.
