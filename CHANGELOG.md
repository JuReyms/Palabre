# Changelog

Toutes les evolutions notables de Palabre CLI sont consignees ici. Format inspire de [Keep a Changelog](https://keepachangelog.com/), versionnage [SemVer](https://semver.org/).

## [Unreleased]

### Added

- Préférence du mode Relay (#190, lot B) : `relay.view` vaut `auto` par défaut (verrou Codex tenu : dans l'app desktop avec les permissions de la conversation ; libre : arrière-plan ; invérifiable : refus sans envoi). `background` impose l'arrière-plan, avec refus si la cible est ouverte. `--background` et `--open` choisissent un mode pour un seul appel, sans modifier le réglage ; ensemble, ils sont refusés. `--new`, Mission, review, `--write` et Claude Code restent en arrière-plan, sans élargissement de leurs permissions. Le propriétaire seul change la préférence avec `palabre config --relay-view <auto|background>` : fichier/changement affichés, configuration déjà approuvée, confirmation clavier en entrée/sortie TTY, aucun `--yes` ni `--trust-config`. `agents --json` ajoute `defaults.relayView` ; Relay JSON v1 et export ajoutent `modeSource` facultatif (`explicit`, `auto`, `setting`). Aucun repli après refus ni renvoi automatique. Pour un avis ou une relecture devant rester sans modification, le skill demande `--background`, réduction ponctuelle des droits sans modifier le réglage. Sur cible occupée, une commande de réglage n'est proposée que si la préférence est la cause du refus ; option explicite, parcours exclus et course en auto ont leurs consignes adaptées. Aide, guides fr/en, skill et AGENTS.md actualisés ; copies installées : `palabre skill --sync`, après accord humain, puis recharger le skill (Refs #190).

- `palabre relay --open --follow --to codex:<session>` suit la suite d'une conversation Codex ouverte. Quand l'équipier attend une action dans l'app (une confirmation, par exemple), la suite se joue dans un nouveau tour que l'appel Relay initial n'écoutait plus : il fallait la deviner, par exemple en surveillant GitHub. `--follow` ne dépose rien et ne lance aucun processus Codex ; sous macOS/Linux, seule la sonde du verrou lance `python3`, comme pour `--open`. Il attend le premier tour terminé après l'appel et rend sa réponse avec le nouveau statut `followed` (code 0). Cette réponse n'est liée à aucun message PALABRE et son auteur n'est pas vérifié : aucune autorisation n'en est déduite. Mêmes garde-fous que `--open` : conversation désignée, verrou tenu, lectures bornées, un seul délai. Une enveloppe PALABRE observée dans le tour donne `no-valid-reply` (`relay-turn`) ; un tour déjà commencé avant l'appel est rendu, avec une origine annoncée comme inconnue. JSON v1 : `mode: "follow"` et la valeur `followed`, deux ajouts propres à cette option. Aide, guides fr/en, skill et AGENTS.md à jour ; copies installées : `palabre skill --sync`, après accord humain (Fixes #195).

- Relay annonce où se passe chaque échange, sur une ligne « Mode » en mots simples : **arrière-plan** (sans fenêtre visible, lecture seule demandée) ou **dans l'app desktop** (conversation ouverte, avec ses permissions). En JSON, `mode` est désormais émis à chaque résultat : `background`, `open` ou `follow`. C'est un ajout facultatif du v1, absent des versions antérieures ; un consommateur qui listait les champs exacts d'une sortie sans `--open` voit ce nouveau champ. En arrière-plan, une conversation Codex créée, ou reprise et retrouvée, affiche son lien `codex://threads/<id>`, cliquable dans un terminal, et la commande pour l'ouvrir soi-même (`explorer.exe`, `open` ou `xdg-open`). Le lien n'est pas cliquable dans l'app Claude. Aucun champ de lien en JSON, et un agent n'ouvre jamais le lien lui-même. Premier lot de #190 (affichage seulement, sans changement de comportement) ; copies installées : `palabre skill --sync`, après accord humain (Refs #190).

### Fixed

- Aide CLI : les quatre modes Débat, Relay, Ask et Chat sont découvrables depuis l'aide principale, avec `palabre doctor`, un exemple Relay et les options de session essentielles regroupées. Les aides Run, Ask et Chat précisent contexte, modèles et synthèse selon leur portée réelle ; l'exemple Chat est retiré d'Ask, la mémoire bornée de Chat est expliquée sans jargon, les accents, titres et paramètres français sont harmonisés et `config --mode` inclut Chat. Les descriptions des listes d'options sont alignées dans les deux langues. Les options Relay et leurs garde-fous sont conservés. Tests fr/en de couverture des options publiques, de l'alignement, des exemples et de la sortie réelle d'aide sans effet de bord. Aucun changement de comportement ni de version ; guides et skill déjà cohérents, inchangés (Fixes #147).

- Relay `--open` : le contexte AGENTS.md réinjecté avant l'enveloppe n'empêche plus une réponse corrélée lorsque sa forme et sa métadonnée sont reconnues ; un bloc AGENTS et un bloc d'environnement au plus par tour, séparés ou regroupés, sans liaison utilisateur ni nonce. Une saisie concurrente de forme `user.text` reste `no-valid-reply`, avec `user-input-during-turn` et invitation à vérifier la conversation avant tout renvoi. Aucun droit ni auteur n'en est déduit. Lot partiel : la réponse liée à une question reste ambiguë, sa forme réelle n'ayant pas été observée localement ; aucun champ `humanInput` n'est émis (Refs #146). Copies installées : `palabre skill --sync`, après accord humain.

## [0.19.0] - 2026-10-21

### Added

- Skill lié à la CLI : `palabre skill --install codex|claude` installe le skill embarqué ; `palabre skill --sync` rafraîchit les copies détectées sans réseau après affichage du plan et confirmation. `doctor` compare tous les fichiers livrés, fins de ligne normalisées, et donne l'action exacte. `palabre update` inclut les copies dans sa confirmation unique et utilise le skill du paquet nouvellement installé ; sauvegardes horodatées hors des dossiers de skills, jonctions et ajouts privés conservés. Les aperçus restent sans effet de bord ; les agents attendent l'accord humain avant de changer leurs instructions. Une copie non vérifiable reste affichée et intacte sans bloquer la CLI ni les autres copies ; sans copie différente, aucun accord inutile n'est demandé. Un échec du skill après installation réussie distingue les deux résultats et propose `palabre skill --sync`. Recharger le skill ou reprendre la conversation après rafraîchissement (Refs #179, #176, #191).

- `palabre doctor` prévient sous Windows, avant tout Relay, quand aucun `pwsh.exe` natif n'est disponible et que les `pwsh.exe` prioritaires sont des alias PowerShell du Microsoft Store confirmés : Codex peut alors échouer à démarrer ses commandes, ce que PALABRE ne signalait jusqu'ici qu'après l'échange, dans `readAccess`. Le contrôle réutilise la détection d'alias d'exécution déjà en place, n'exécute pas `pwsh` et ne modifie ni configuration, ni PATH, ni permissions ; il distingue l'absence de tout PowerShell régulier du repli appliqué au seul processus enfant Codex, et nomme ce repli. Avertissement seulement, jamais une erreur : la machine reste utilisable et l'agent lit souvent malgré le refus. Muet hors Windows, sans CLI Codex détectée, quand un vrai `pwsh.exe` reste disponible ou quand l'alias n'est pas confirmé (Refs #171, #128). Guides fr/en et skill actualisés, avec la commande winget qui installe réellement le `.msi` (`--installer-type wix`, vérifié avec winget 1.29.380 ; `--installer-type msi` ne correspond à aucun installeur et `--source winget` seul pose le paquet MSIX) ; la copie installée du skill se rafraîchit avec `palabre skill --sync`, après accord humain.

### Changed

- Doctor : guide d'arrivée sur une machine, actions dans l'ordre : approbation de la configuration (vérifiée avant toute sonde d'agent ou URL configurée ; non approuvée, code 1 et commande `--trust-config` à lancer par le propriétaire), alias PowerShell du Store sous Windows (avertissement ajouté plus haut, réutilisé sans seconde détection), état de connexion Claude Code/Codex déclaré par `auth status --json` ou `login status` (sans shell ni appel modèle, 3 s et 32 Kio, « non vérifié » sinon), agent archivé encore déclaré, présence du skill dans six emplacements connus et emplacements multiples de node/npm/pnpm/claude/codex dans PATH. Actions explicites laissées au propriétaire, aucune réparation ni donnée de compte affichée ; contrat `{ ok, output }` inchangé. Aide, guides fr/en et référence du skill actualisés ; les copies installées du skill se rafraîchissent avec `palabre skill --sync`, après accord humain (Refs #151, #153).

- Skill et consignes contributeurs : un agent chef de mission propose désormais la délégation de lui-même. Quand un travail se découpe (relecture, recherche, lot indépendant, vérification), il n'attend plus que l'humain y pense : une petite délégation attendue en lecture seule, dans un travail déjà validé, est annoncée en une ligne puis faite ; une délégation qui engage (écriture, plusieurs équipiers, quota important, nouveau chantier) fait l'objet d'une question claire, une seule fois pour tout le lot. Jamais une demande d'autorisation à chaque appel, et jamais de relecture par l'auteur du travail. La mise en garde contre l'usage réflexe reste valable pour une question simple. Si l'équipier demande une autorisation (écriture, commande, accès), le chef de mission ne la relaie jamais : il s'arrête et dit à l'humain où la valider ; la relance après validation est une nouvelle demande explicite, jamais un renvoi automatique. Le refus d'une autorisation relayée par l'équipier est voulu et inchangé : ni l'enveloppe, ni le contrat JSON, ni le code ne changent (Fixes #187). Guides fr/en (nouvelle section « L'équipier demande une autorisation ») et AGENTS.md alignés ; une copie installée du skill se rafraîchit avec `palabre skill --sync`, après accord humain.

- Relay : après `relay --new --to codex`, la sortie texte et l'export `.relay.md` donnent le lien `codex://threads/<identifiant>`. Une conversation créée par la CLI reste absente de la liste de Codex Desktop, mais ce lien l'ouvre avec son historique, sans ajouter de message ni élargir ses permissions (essai Windows, Codex Desktop 26.1013.40934). Une fois ouverte, Desktop la tient : Relay la joint alors avec `--open`, avec les permissions de Desktop. Aucun champ JSON ajouté : une intégration construit le lien depuis `to.session`. Remplace le conseil de créer d'abord la conversation dans Desktop. Aide, guides fr/en et skill alignés (Refs #179, point 10) ; une copie installée du skill se rafraîchit avec `palabre skill --sync`, après accord humain.

### Fixed

- Relay sous Windows : PALABRE distingue désormais les lancements de commandes refusés (`CreateProcessAsUserW, erreur 5`) d'un blocage durable. Si une commande aboutit (code 0) après le premier refus et avant la réponse finale, la réponse reste `replied`/0 avec `readAccess.status: "partial"` et `succeededCommands` ; sans réussite ultérieure ni événement ambigu, `blocked` donne `read-unavailable`/2 tout en conservant réponse et délivrance ; une réussite explicite donne priorité à `partial`, même en présence d'un autre événement ambigu ; `unverified` ne s'applique qu'en l'absence de réussite explicite et en présence d'un événement de commande ambigu, sans dégrader l'issue. L'essai réel #171 a ainsi vu Codex se replier après deux refus et lire correctement un fichier. La tâche `--task review` reste volontairement stricte : tout diagnostic refuse la publication (`review-failed`, code 9), car une revue publiée ne se défait pas. Mission poursuit une étape `consult` répondue seulement si son Relay reste réussi (Fixes #173, Refs #171, #128).
  Contrat JSON v1 sans suppression ni renommage : `readAccess.status` accepte `partial` et `unverified`, et `succeededCommands` est ajouté seulement pour `partial`. Les consommateurs doivent tolérer les valeurs d'énumération et ignorer les champs optionnels inconnus. Aide, guides fr/en et skill actualisés ; la copie installée du skill se rafraîchit avec `palabre skill --sync`, après accord humain.

- Codex sous Windows : le contournement de l'alias PowerShell Store (#128, 0.18.0) ne s'appliquait pas quand l'alias se trouve dans le dossier du paquet (`WindowsApps\Microsoft.PowerShell_<éditeur>\pwsh.exe`), emplacement créé par une mise à jour winget ou Store et réellement lancé par Codex dans l'essai #171. Cet emplacement est désormais reconnu, toujours après confirmation AppExecLink, et un second alias confirmé qui passe ensuite en tête est écarté à son tour ; un alias suivant non confirmé laisse l'environnement inchangé. `palabre doctor` en bénéficie. Aucun changement de permission, de sandbox ni de PATH global (Refs #128, #171). Guides fr/en, skill et consignes contributeurs actualisés ; la copie installée du skill se rafraîchit avec `palabre skill --sync`, après accord humain.

## [0.18.0] - 2026-10-20

### Fixed

- Relay vers Codex sous macOS/Linux : le verrou consultatif est désormais éprouvé par `flock(LOCK_EX | LOCK_NB)` via un appel `python3` borné, sans shell ni lecture du contenu. Un verrou tenu distingue la cible ouverte (`target-busy` sans `--open`, dépôt autorisé avec `--open`) d'un verrou libre ; Python absent, timeout ou erreur ambiguë reste `target-state-unknown`, sans dépôt. Windows est inchangé, la CI couvre maintenant macOS et la matrice réelle sous macOS 26.6.1 valide les quatre combinaisons cible ouverte/fermée avec/sans `--open` (Fixes #180). Aide, guides fr/en, skill et consignes contributeurs actualisés ; la copie installée du skill doit être mise à jour manuellement.

- Adapters CLI : lorsqu'un agent termine avec un code non nul et un stderr vide, le message `non-zero-exit` affiche désormais un extrait nettoyé et borné de stdout pour rendre notamment les erreurs d'authentification actionnables. stdout reste un diagnostic, jamais une réponse ni une source de reclassification automatique (Refs #179, point 11). Aide, guides fr/en, skill et consignes contributeurs actualisés ; la copie installée du skill doit être mise à jour manuellement.

- Tests : chaque processus dispose d'un dossier personnel temporaire et le vrai `~/.palabre` est surveillé avant/après la suite, sous Windows et Linux. Les tests ne doivent plus y ajouter d'approbations. `palabre config --prune-trust` permet à l'utilisateur de retirer les approbations de fichiers disparus, avec aperçu `--dry-run`, confirmation au clavier et sauvegarde horodatée ; aucun nettoyage automatique (Fixes #156). Aide, guides fr/en, skill et consignes contributeurs actualisés ; la copie installée du skill doit être mise à jour manuellement.

- Relay, Mission et review vers Codex sous Windows : un alias PowerShell Store confirmé est écarté du seul processus enfant lorsqu'un PowerShell natif reste disponible. La lecture seule et les réglages utilisateur restent inchangés ; les autres alias du dossier écarté sont indisponibles à cet enfant (Refs #128). Aide, guides fr/en et skill actualisés ; la copie installée du skill n'est pas mise à jour automatiquement.


### Added
- Guide « Changer de machine » fr/en : préserver le travail d'un ancien clone, inventorier sans modification, remettre les outils à niveau, réapprouver localement la configuration, réinstaller le skill et démarrer un nouvel équipier Relay. Données locales et limites actuelles de doctor explicitées, liens depuis Installation et Premier Relay ; aucune nouvelle commande produit (Refs #151).
- Identité visible : le skill demande `Palabre <mode> : <objet>` pour les tâches de l'hôte ; la CLI pose le nom logique `palabre <commande>` et un titre temporaire de terminal avec le mode, hors sorties JSON/NDJSON ou redirigées. Le nom d'exécutable Windows peut rester `node.exe` et la restauration dépend de l'hôte. Aide, guide fr/en et AGENTS.md alignés (Refs #162). La copie installée du skill doit être mise à jour manuellement.
- Documentation : guide « Premier Relay » fr/en centré sur les tâches confiées par votre agent, les trois configurations et le sens des échanges, avec glossaire, parcours `--new --write`, lien vers la récupération du travail et ancres vérifiées avec le moteur Markdown du site. README et skill alignés : avis/relecture, `--open` ou accord ponctuel selon la cible et les permissions, identifiant conservé pour la suite (Refs #150). Une copie installée du skill doit être mise à jour manuellement.
- Relay : `--new --write` prépare une tâche Codex sous Windows, avec accord humain ponctuel `approve-write`, exécution unique `run-write`, worktree Git séparé conservé et préflight de confinement avant modèle. Le JSON et l'export conservent fichiers/diff Git et commandes observées avec codes/sorties ; aucun succès de test déduit de la prose. Claude Windows natif refuse ce parcours. Aide, guide fr/en et skill actualisés (Refs #150) ; une copie installée du skill n'est pas mise à jour automatiquement.
- Relay : `--new --to <agent>` crée une conversation Claude Code ou Codex persistante en lecture seule ; `--dir` choisit son dossier. L'identifiant reste dans `to.session` en JSON et dans l'export même si le premier tour échoue ; la sortie texte ajoute une commande de continuation prête à copier (Refs #149, #150). Le parcours création puis reprise a été validé sous macOS 26.6.1 avec conservation du contexte (#179).

### Changed
- Releases : un tag de préversion doit correspondre exactement à `package.json`, publie npm sous le dist-tag `next` et crée une GitHub prerelease qui ne devient pas Latest. Le site et Bluesky restent sur la dernière version stable jusqu'au tag final.
- Documentation : le guide « Changer de machine » fr/en intègre les neuf constats de l'essai réel : approbation avant Relay, assistant de configuration, PowerShell 7 hors Store, références Git après squash, dépendances pnpm, `node-pty`, choix des agents pour le skill et doublons npm/pnpm (Refs #151, #171).
- Relay : méthode de travail et gabarits demande/réponse dans le skill pour réduire coordination et quotas tout en gardant les preuves et la relecture indépendante. Enveloppes classiques et `--open` : avertissement FR/EN clarifié, titre `###`, séparateurs autour de l'objet et du corps intact et partie agent `####`. Guides fr/en et consignes contributeurs alignés ; aucun nouveau champ JSON ni analyse des réponses. La copie installée du skill doit être mise à jour manuellement (Fixes #168).
- Relay, direction B : communication entre conversations précises et choix du chef de mission Claude Code ou Codex. README, Premier Relay et guide fr/en expliquent le parcours Codex desktop vers Claude fermée sous Windows, avec une autorisation de l'hôte par commande, sans droit permanent. `--write` devient un parcours documentaire expérimental et gelé, hors défaut et uniquement sur demande humaine explicite ; Mission et `--task review` sont gelés, conservés sans extension, correctifs de sécurité seulement. Aide et skill alignés ; aucune fonctionnalité supprimée ni code Relay modifié. Pendant un tour reçu par Relay, les questions vont dans la réponse finale (#146). Les copies installées du skill sont à mettre à jour manuellement (Refs #150).
- Relay en écriture : guides fr/en et skill expliquent comment relire, intégrer et ranger le worktree, avec validation humaine distincte avant commit/push/fusion. Les tableaux documentent les trois refus `write-*` et l'aide précise la langue des commandes d'accord ; messages d'écriture centralisés (Refs #150, #161). Une copie installée du skill nécessite une mise à jour manuelle.
- Documentation : le README et le guide Relay disent clairement le sens des échanges (Claude Code et Codex dans les deux sens en arrière-plan ; vers une conversation déjà ouverte, seul Codex peut recevoir la tâche, sous Windows, macOS ou Linux). Le README ne présente plus Relay comme « lecture seule » en général, mais décrit ses deux façons de travailler.
- Relay : `--from` devient facultatif et accepte un nom d'agent seul ; sans expéditeur, l'en-tête indique le terminal, toujours sans autorisation transmise (Refs #145). Aide, guides fr/en et skill synchronisés ; une copie installée du skill n'est pas mise à jour automatiquement. Une option `--from` ou `--dir` vide donne une consigne précise, sans appel ; le test Claude compare tous les arguments de création à la reprise privée de `--resume <id>` (Refs #152).
- Documentation : le menu « Utilisation » du site suit les quatre modes (Débat, Relay, Ask, Chat), et la page Relay s'intitule « Mode Relay », comme les autres modes. Les guides de cette section passent à des préfixes à deux chiffres, et la synchronisation supprime aussi les anciens fichiers à deux chiffres.

## [0.17.0] - 2026-10-17

<!-- social: New Relay mode: your agents cooperate and hand off to each other. You are no longer the go-between, but the decision-maker. -->

### Added

- Relay ajoute un en-tête compact `📧 PALABRE Relay` avec expéditeur, destinataire et avertissement avant le contenu ; la provenance détaillée et le nonce passent en bas. `--subject` fournit un objet facultatif (une ligne, 200 caractères), repris dans le JSON v1 et l'export. Mission utilise le même format avec son id et son étape. En-tête et pied suivent la langue ; les 64 Kio couvrent l'enveloppe de coordination entière, sans réduire la borne séparée du contexte PR (#126). Aide, guides FR/EN et skill alignés ; les copies installées du skill doivent être mises à jour manuellement.

- `palabre mission` v2.0 : un chef de mission fixe avec l'humain un cadre en lecture seule, puis appelle son équipier une seule fois par étape explicite. Création, `step`, `status`, `stop`, budgets de tentatives/durée, délai configurable, état local reprenable, export `.mission.md` et `--json` ; consultation et tâche `review` Relay existante. Aucun code délégué, changement de chef de mission, renvoi automatique ou release ; une délivrance incertaine bloque la suite (#115). Les copies installées du skill doivent être mises à jour manuellement.

- `palabre relay allow-repo proprietaire/depot` (ou `'proprietaire/*'`) autorise la tâche review après confirmation au clavier, sur la configuration locale ou globale ; le refus `task-not-allowed` fournit la commande dans `remedy` et guide l'agent vers le terminal visible du propriétaire (#118).
- `allow-repo` exige une configuration déjà approuvée et refuse sans écriture en code 8 si le propriétaire répond non. `palabre config --config <fichier> --trust-config` permet désormais au propriétaire d'approuver aussi une configuration globale, après l'avoir relue ; allow-repo n'approuve que le contenu exact qu'il a écrit (#118).
- `palabre relay` transmet un message à une conversation Codex ou Claude Code fermée et renvoie sa réponse en un seul appel : reprise en lecture seule renforcée, refus si la conversation est ouverte ou son état invérifiable, statut de délivrance sans renvoi automatique, sortie `--json` v1 et export `.relay.md`.
- `palabre relay --open` (pilote, Codex sous Windows) dépose un message dans une conversation Codex ouverte, dans le TUI ou dans Codex desktop, par `codex queue`, puis rend sa réponse corrélée au bon tour. La conversation doit être ouverte (`target-not-open` sinon, sans dépôt) ; elle répond avec ses propres outils et permissions, sans garantie de lecture seule. Un seul délai couvre préparation, dépôt et attente ; un message déposé peut être traité plus tard, sans renvoi automatique. L'historique n'est jamais lu en entier. Le relay vers une conversation Claude Code ouverte reste à faire (#96).

### Changed

- Guide 0.17.0, lot C : configuration, référence CLI, contrats JSON/NDJSON, dépannage et fonctionnalités disponibles FR/EN corrigés contre le code ; la feuille de route reprend les cinq priorités validées par le propriétaire (Refs #131).

- Guide 0.17.0, lot B : Débat, Ask, Chat, TUI, contexte, exports et agents FR/EN alignés sur les formats de synthèse, les limites de fichiers, les défauts et les capacités réelles des adapters (Refs #131).

- Guide 0.17.0, lot A : prise en main et Relay FR/EN alignés sur les quatre modes, Mission en option, confiance des configurations, périmètre Windows de `--open`, revue autorisée et diagnostics réellement exposés (Refs #131).

- README (fr et en) préparé pour la 0.17.0 : Relay est présenté comme nouveau, sans la mention « après la 0.16.0 », avec la coopération entre agents et le rôle de décideur de l'humain ; la note précise que `--open` vise une conversation Codex ouverte, sous Windows pour l'instant ; Mission apparaît en une phrase comme option de Relay, et non comme un mode (#121).

- Le pied des messages Relay et Mission est renommé « 🤖 Message pour l’agent » / « 🤖 Message for the agent », dans les messages, l’aide, les guides et le skill. Les copies installées du skill restent à rafraîchir manuellement.

- Relay et Mission séparent l'avertissement ℹ️ de l'en-tête, avant le contenu, et regroupent provenance, nonce et consigne unique de réponse dans « 🤖 Message pour l'agent ». Échappement Markdown limité pour garder tirets, points et parenthèses lisibles ; cadre Mission traduit sur deux lignes sans JSON. Permissions, limites de taille et corrélation inchangées (#132). Aide, guides FR/EN et skill mis à jour ; les copies installées du skill doivent être rafraîchies manuellement.

- Les consignes d'autorisation sont disponibles dans l'aide, les erreurs et le skill. **Une copie déjà installée du skill n'est pas mise à jour automatiquement** : recopier `skills/palabre` dans son emplacement d'installation après la mise à jour.
- Le README est réorganisé pour tous les niveaux : un tableau « Quel mode pour quoi ? » par ordre d'utilité (Débat, Relay, Ask, Chat), l'installation, le fonctionnement (contexte, synthèses finales du Débat et de l'Ask, arrêt anticipé, exports, sessions) et les six rôles expliqués avec des combinaisons conseillées (#121).
- Le skill `palabre` aide désormais l'agent à choisir entre Chat, Débat, Ask et Relay. Il couvre le pilotage de Chat par le flux NDJSON, distingue checkpoints Palabre et reprise d'une conversation externe, et documente l'installation pour Claude Code et Codex ainsi que la découverte dans les sessions neuves et reprises (#99).

### Fixed

- Relay `--open` reconnaît la limite structurée Codex du tour corrélé (`usage-limit`, code 2), au lieu de `cli-failure`. Reprise CLI dans le message, le champ optionnel `retryAfter` du JSON v1 et l’export ; aucune date ni aucun fuseau déduits d’une heure seule. Mission conserve le diagnostic et se met en pause sur une limite connue, sans renvoi automatique (#41, point 3 seulement). Aide, guides FR/EN et skill mis à jour ; rafraîchir manuellement les copies installées du skill.

- Relay et Mission signalent l'erreur Windows/Codex `CreateProcessAsUserW failed: 5` au démarrage des commandes de lecture (`read-unavailable`/2), sans perdre réponse, identité ou délivrance. Mission se met en pause ; la tâche review refuse toute publication GitHub (`review-failed`/9, `not-attempted`). Les messages nomment l'alias Microsoft Store comme cause probable à vérifier et renvoient au dépannage ; l'export traduit « Accès en lecture ». Aucun réglage validé pour imposer PowerShell natif à ce parcours Codex 0.163.0, aucun changement de sandbox ni renvoi automatique (#128). Aide, guides FR/EN et skill mis à jour ; les copies déjà installées du skill doivent être rafraîchies manuellement.

- La synchronisation des agents à l'accueil TUI et avec `palabre config --sync-agents` conserve les commandes configurées avec un chemin absolu (POSIX, Windows ou UNC), même si une autre installation est détectée ou si le chemin est introuvable. Les noms simples et chemins relatifs continuent d'être synchronisés (#117). Les copies déjà installées du skill nécessitent une mise à jour manuelle.
- `doctor` et la disponibilité des agents/presets vérifient le fichier du chemin absolu configuré, sans lancer la CLI et sans présenter une autre installation du PATH comme valide (#117).
- Chat ne se ferme plus sur une ligne vide : la conversation continue et `/end` exporte tous les échanges (#101).
- En NDJSON, une erreur d'agent pendant Chat émet désormais un événement `error` (`phase: "chat"`), puis un seul `done` avec le chemin de l'export partiel, ou `null` si cet export échoue. Une annulation pendant l'attente d'un message termine aussi le flux, avec le code 130 (#101).
- Une consultation Chat annonce le rôle effectif de l'agent consulté, rôle temporaire `--role-a` compris (#101).
- `--dry-run` est refusé explicitement en Chat, avant tout appel d'agent ou export, au lieu d'être ignoré (#101).
- Avec le mode Chat, par défaut ou via `--mode chat`, le raccourci `palabre -s "Sujet"` et le sujet positionnel ouvrent Chat comme `palabre run`, au lieu d'échouer sur « mode inconnu ». Un preset en mode Chat est refusé avec un message explicite au lieu d'être ignoré (#104).
- Dans la TUI, une saisie vide ou composée d'espaces ne quitte plus la conversation Chat sans export : elle est ignorée. L'indicateur d'une consultation affiche le rôle effectif de l'agent, rôle temporaire `--role-a` compris (#103).
- Sous Windows, les CLIs installées par npm (Codex, OpenCode…) sont lancées directement, via Node et le script du paquet ou via l'exécutable du paquet, au lieu de leur shim PowerShell : les accents de stdin, les guillemets des arguments JSON et l'argument `-` sont préservés. Les shims d'une autre forme (shim modifié) restent lancés par PowerShell (#98).
- Sous Windows, les CLIs installées par pnpm, en paquet global ou par `pnpm link --global`, sont aussi lancées directement via Node et le script du paquet, avec le même `NODE_PATH` que leur shim, dans le même ordre : accents, guillemets et argument `-` sont préservés. Un shim pnpm modifié, ou dont le script n'est pas un fichier `.js`, `.cjs` ou `.mjs`, reste lancé par PowerShell. Relay reste limité à la forme npm (#109).

## [0.16.0] - 2026-08-31

<!-- social: A calmer, more consistent TUI, clearer recovery guidance, and hardened adapters and local config handling. -->

### Added

- Les erreurs d'agent peuvent désormais indiquer un délai de reprise structuré (`retryAfter`), y compris dans les événements NDJSON destinés aux intégrations.

### Changed

- Les écrans TUI, leur fil d'Ariane, leurs cartes et le composer partagent une navigation et une présentation cohérentes ; l'accueil met plus clairement en avant la session, les commandes essentielles et l'ajout de contexte.
- Les guides français et anglais décrivent les comportements actuels des agents, de la configuration, du contexte et des contrats d'intégration.

### Fixed

- Les écritures de configuration, la confiance associée et les lancements d'agents locaux sont plus robustes, notamment face aux shims Windows, aux sorties et aux erreurs d'adapters variables.
- Les diagnostics Ollama, le scan de contexte, les exports et les événements NDJSON conservent leurs limites et leurs messages utiles dans davantage de cas limites.

## [0.15.0] - 2026-08-30

<!-- social: Resumable Debate and Ask sessions with atomic checkpoints, safe continuation, and explicit checkpoint management. -->

### Added

- `--checkpoint` conserve explicitement un état machine versionné et atomique sous `.palabre/sessions/`, avant le premier appel, après chaque réponse complète et à la fin d'une session Débat ou Ask.
- `palabre resume <session-id>` reprend explicitement le prochain tour, les réponses Ask restantes ou la synthèse, après validation stricte de la configuration, du contexte et confirmation utilisateur.
- `palabre sessions` liste les checkpoints récents, y compris les entrées invalides, et `palabre sessions delete <session-id>` supprime uniquement le checkpoint explicitement confirmé.

## [0.14.0] - 2026-08-30

<!-- social: A redesigned /new flow for Chat, Debate, and Ask, a clearer TUI home, and faster, more reliable slash-command navigation. -->

### Added

- `/new` propose un parcours guidé commun à Chat, Débat et Ask, avec choix des agents, récapitulatif de session, lancement immédiat ou personnalisation des options avancées.
- Le composer affiche une liste contextuelle et documentée dès la saisie de `/`, navigable avec les flèches, `Tab` ou `→`, sans dupliquer les alias d'une même commande.
- `palabre history --json --limit <1-100>` permet aux intégrations de borner explicitement le nombre d'exports retournés.

### Changed

- L'accueil TUI résume la session active dans une carte compacte, met en avant les raccourcis essentiels et signale seulement les agents requis qui sont indisponibles.
- Les commandes proposées sont ordonnées selon le parcours utilisateur, masquent le mode déjà actif et se réduisent à la navigation essentielle dans les vues informatives.
- Les guides français et anglais documentent le nouvel accueil, le picker contextuel et la composition guidée d'une session.

### Fixed

- La navigation dans les listes TUI ne duplique plus leur rendu après l'utilisation des flèches et annule les rafraîchissements différés lors de la validation d'une commande.
- Le focus revient correctement au composer après une vue secondaire ou un retour avec `Ctrl+C`.
- Les diagnostics Codex privilégient l'erreur JSON terminale utile au lieu du bruit de prompt ou de démarrage MCP.
- Le dry-run reflète les rôles temporaires réellement appliqués à la session.

### Removed

- Gemini n'est plus généré, détecté ni proposé comme agent connu ou preset actif ; les anciennes configurations peuvent encore le conserver comme CLI personnalisée, tandis qu'Antigravity reste l'intégration Google de référence.

## [0.13.0] - 2026-07-21

### Added

- Ajoute un protocole stdin JSON v1 pour piloter Chat depuis une intégration avec `chat-send`, `chat-consult`, `chat-use`, `chat-agents` et `chat-end`.
- Émet le message utilisateur avant l'appel agent afin que les clients puissent l'afficher immédiatement pendant la réflexion.

### Changed

- Conserve les commandes texte historiques de Chat pour le terminal tout en réservant le protocole structuré aux intégrations.

## [0.12.0] - 2026-07-20

<!-- social: Stateless Chat joins Debate and Ask, with agent consultations, resilient exports, NDJSON integration events, dry-run previews, and diagnostic provenance. -->

### Added

- Le mode Chat stateless permet de converser avec un agent, d'en consulter un autre avec `/consult`, de changer d'interlocuteur avec `/use` et d'exporter la session en `.chat.md`.
- Le renderer NDJSON v1 expose les événements Chat nécessaires aux intégrations sans modifier le sens des contrats Debate et Ask.
- `--dry-run` fournit un aperçu structuré de l'exécution sans lancer les agents.
- Les exports `.debate.md`, `.ask.md` et `.chat.md` indiquent désormais la version du CLI et la provenance déclarée par une intégration. Merci à [@ccoelhofize](https://github.com/ccoelhofize) pour le diagnostic détaillé et la proposition dans [#30](https://github.com/JuReyms/Palabre/issues/30).

### Changed

- L'accueil et la configuration TUI traitent Chat comme un mode de session officiel, avec un agent actif unique et des overrides temporaires correctement isolés.

### Fixed

- Le compositeur Chat conserve un lecteur partagé, accepte les collages multilignes et ne perd plus la saisie après plusieurs navigations TUI.
- Une consultation affiche désormais l'identité réelle de l'agent consulté pendant la connexion et la réflexion.
- Les conversations terminées par `/end` ou interrompues par une erreur inscrivent leur cause de fin ; une erreur conserve automatiquement une transcription partielle.
- Les processus agents Node/Python reçoivent un environnement UTF-8 cohérent afin d'éviter les réponses corrompues sous Windows.

## [0.11.2] - 2026-07-11

### Changed

- Les posts Bluesky de release annoncent explicitement `Palabre CLI vX.Y.Z` pour les distinguer des releases de l'extension VS Code.
- Le README met en avant l'extension VS Code avec un badge Marketplace statique et une section dédiée en anglais/français.
- Le README présente plus clairement `palabre` comme l'expérience TUI principale, avec les exemples CLI relégués à l'usage scriptable.

### Fixed

- Les titres Markdown collés dans les sorties PTY d'Antigravity sont séparés avant le rendu et l''export, afin de préserver la structure des synthèses.

## [0.11.1] - 2026-07-10

### Fixed

- Les shims PowerShell npm/pnpm utilisent un hôte résolu sous `System32` quand le processus appelant possède un PATH réduit, notamment depuis VS Code.

## [0.11.0] - 2026-07-10

### Added

- Rôles de session : `--role-a`, `--role-b` et `--ask-role` appliquent des rôles temporaires sans modifier la configuration. `palabre agent-role <agent> <role>` actualise explicitement le rôle durable pour un agent.
- Le contrat v1 `palabre agents --json` expose désormais `roles`, le catalogue canonique utilisable par les intégrations.

### Changed

- Les configurations Codex historiques sont migrées en mémoire vers le mode `exec` lecture seule actuel lors du chargement.

### Fixed

- Sous Windows, les alias Codex de `WindowsApps` ne sont plus préférés au shim PowerShell npm/pnpm, ce qui évite les erreurs `spawn EPERM`.
- Les sorties CLI encodées en Windows-1252 sont décodées correctement lorsque UTF-8 est invalide, notamment pour Mistral Vibe.

## [0.10.2] - 2026-07-07

<!-- social: Safer local configs, hardened Windows agent launches, bounded Ollama responses, and protected terminal output. -->

### Changed

- Les configs projet implicites exigent désormais une approbation liée à leur chemin et à leur empreinte ; les configs générées par Palabre sont approuvées automatiquement.
- Les agents Claude, OpenCode et Vibe générés par défaut utilisent des capacités de lecture plus contraintes, et les prompts identifient explicitement le contexte et les transcripts comme données non fiables.
- La résolution des exécutables Windows est centralisée et réutilise les binaires natifs ou les shims PowerShell sûrs pour les prompts transmis en argument.

### Fixed

- Les adapters CLI et PTY refusent les lancements Windows susceptibles de réinterpréter un prompt ou un modèle via `cmd.exe`, sans casser Vibe lorsqu'un shim PowerShell est disponible.
- Les réponses Ollama et la discovery `/api/tags` sont bornées avant parsing ; les erreurs JSON, limites de taille et noms de modèles sont classés et assainis de façon cohérente.
- Les sorties agents, erreurs distantes, métadonnées d'historique et diagnostics `doctor` ne peuvent plus injecter de séquences de contrôle dans le terminal.
- Les caractères UTF-8 produits par les agents CLI restent intacts lorsqu'ils sont répartis sur plusieurs blocs `stdout` ou `stderr`.
- `palabre doctor` peut examiner une config projet non approuvée sans contacter les URLs Ollama qu'elle déclare.

## [0.10.1] - 2026-07-02

<!-- social: Smoother TUI navigation, a clearer guided setup, and useful next actions after every session. -->

### Changed

- L'assistant `/new` adopte le design du TUI avec un en-tête, des indications plus lisibles et un choix de mode encadré.
- Le logo de l'accueil utilise un violet légèrement plus sombre.
- Le panneau de fin de session présente désormais `/retry`, `/new`, `/history`, `/config`, `/help` et la commande permettant de basculer vers l'autre mode.
- Les guides d'installation documentent npm, pnpm, Yarn et Bun, ainsi que l'absence d'installation officielle via `pip` ou `curl`.

### Fixed

- Un premier `Ctrl+C` depuis `/help`, `/history`, `/update` ou le composer revient à l'accueil ; un second `Ctrl+C` rapide ferme toujours la TUI.
- L'annulation de `/new` depuis la TUI revient à l'accueil au lieu de fermer Palabre.

## [0.10.0] - 2026-07-02

<!-- social: A redesigned TUI, inline context from the composer, localized adapter errors, and safer Antigravity quota detection. -->

### Added

- Le composer de l'accueil TUI accepte `--context <chemins...>` et `--files <chemins...>` à la fin du sujet, puis confirme les fichiers injectés dans l'en-tête de session.

### Changed

- Le rendu TUI adopte un design unifié avec logo d'accueil, écrans spécialisés, cadres cohérents, couleurs sémantiques et blocs de conversation alignés à gauche.
- Le renderer TUI historique est découpé en modules dédiés au thème, aux écrans, aux prompts et aux événements de session.
- Les messages des adapters et de `palabre config --ollama-models` utilisent désormais les dictionnaires FR/EN.
- Les duplications de l'orchestrateur, des adapters et du point d'entrée CLI sont factorisées sans modifier les contrats publics.

### Fixed

- L'adapter PTY classe les diagnostics autonomes de quota Antigravity en `usage-limit`, y compris avec un exit code 0, sans confondre une réponse normale qui explique les rate limits.
- Le repli `PALABRE_ASCII=1` utilise uniquement des glyphes ASCII, y compris pour le marqueur de succès.

## [0.9.1] - 2026-07-01

<!-- social: A cleaner CLI architecture with centralized summary resolution and stronger regression coverage. -->

### Changed

- Le point d'entrée CLI délègue maintenant les commandes leaf, la résolution des options de session et le contrôleur TUI à des modules dédiés, sans modifier les contrats publics.
- L'agent de synthèse est résolu une seule fois à la frontière CLI puis transmis comme option obligatoire aux renderers et à l'orchestrateur.
- La résolution des options de débat et du mode Ask dispose désormais de tests directs couvrant les priorités entre flags, presets et defaults.

## [0.9.0] - 2026-07-01

<!-- social: Remote Ollama support, agent availability for integrations, and smoother TUI update and configuration flows. -->

### Added

- `palabre agents --json` expose un contrat v1 pour les intégrations avec les agents configurés actifs, leur disponibilité locale et la sélection Ask par défaut ; les agents retirés comme Gemini restent exclus même s'ils existent dans une ancienne config.
- Ollama distant : `--ollama-url`, `OLLAMA_HOST` et `palabre config --ollama-url` permettent de surcharger ou de persister l'adresse du serveur, avec normalisation et validation des URL.
- Configuration TUI : `/ollama-url <url|default>` modifie l'adresse de tous les agents Ollama sans éditer le JSON.
- Accueil TUI : vérification de la dernière version npm à chaque ouverture, avertissement non bloquant et commande `/update` affichant les instructions adaptées.

### Fixed

- Discovery, presets et doctor évaluent chaque agent Ollama avec son propre serveur et ses propres modèles, au lieu de réutiliser la détection de `ollama-local`.

## [0.8.1] - 2026-06-19

### Added

- Premier lancement TUI : `palabre` crée maintenant la configuration globale si aucune config n'existe, puis ouvre directement l'accueil.
- Accueil TUI : synchronisation prudente des agents connus détectés à chaque ouverture, avec ajout des agents manquants et rafraîchissement des commandes connues.
- Configuration TUI : `/ollama`, `/ollama-model <model>` et `/ollama-sync` permettent de consulter et changer le modèle `ollama-local` sans quitter Palabre.
- TUI : `/history` affiche les derniers exports Markdown, avec liens fichier/dossier quand le terminal les supporte.
- TUI : `/home` ramène à l'accueil depuis les vues secondaires et après une session.

### Changed

- `palabre config --sync-agents` persiste aussi les rafraîchissements de commandes connues même lorsqu'aucun nouvel agent n'est ajouté.
- Les guides et l'aide CLI recommandent désormais `palabre` comme entrée de première utilisation, avec `palabre init` réservé au setup explicite ou local.
- Les cartes TUI de session, de fin de session, d'historique et d'aide utilisent un rendu plus homogène et gardent le header Palabre.
- Les synthèses exposent le rôle runtime `summarizer`, même si l'agent configuré possède un autre rôle par défaut.
- Vibe n'utilise plus le mode `plan` par défaut pour éviter des réponses mal adaptées à Palabre.

### Fixed

- Adapters CLI et PTY : un exit code non nul est maintenant rejeté même si l'agent a écrit une sortie partielle.
- Adapter Ollama : la progression de `--pull-models` est écrite sur stderr afin de préserver stdout pour le NDJSON.
- `--context` : les chemins absents ou inaccessibles produisent un warning au lieu d'interrompre la session.
- Parser CLI : `--agents` et `palabre config --ask-agents` conservent toutes les valeurs afin que la validation métier signale correctement le dépassement de 4 agents.
- Débat TUI : les defaults Ask ne contaminent plus le lancement d'un débat.
- Windows : les arguments des agents CLI sont quotés plus strictement quand ils passent par le shell.
- TUI : les messages d'erreur et d'arrêt anticipé sont centrés comme les autres cartes runtime.

## [0.8.0] - 2026-06-17

### Added

- Mode `ask` : plusieurs agents peuvent répondre indépendamment au même sujet avant une synthèse comparative fidèle.
- Interface TUI-first : `palabre` ouvre un accueil interactif avec composer, mode courant, agents, rôles, synthèse, dossier courant et version.
- Configuration TUI native : `/config` permet de régler les agents, rôles, synthèse, tours, mode et interface sans sortir de Palabre.
- Commandes TUI `/agents` et `/roles` avec vue d'aide/wizard quand elles sont lancées sans arguments, et commande rapide quand les valeurs sont fournies directement.
- Affichage des agents disponibles dans la vue `/config`.
- Options CLI `--tui`, `--terminal` et `defaults.interface` pour choisir l'interface par défaut.

### Changed

- Les sessions interactives utilisent la TUI par défaut quand stdout est un terminal.
- Les rôles deviennent plus visibles dans l'accueil, la config et les exports TUI.
- `Ctrl+C` dans les wizards TUI remonte d'un niveau comme `/back`, et un double `Ctrl+C` quitte directement.
- `palabre update` affiche aussi une commande pnpm avec la version npm exacte quand elle est disponible, afin de contourner les cas ou `palabre@latest` reste temporairement sur une ancienne version avec les politiques de securite pnpm recentes.

### Fixed

- Le rendu TUI evite les doublons d'export Markdown en fin de session.
- Les réponses et synthèses TUI utilisent une largeur plus cohérente et des séparateurs colorés par agent.

## [0.7.0] - 2026-06-10

### Added

- Configuration Ollama : `palabre config --ollama-models --json` expose le modele configure, sa disponibilite et les modeles installes pour les integrations.
- Configuration Ollama : `palabre config --set-ollama-model <model>` valide un modele installe puis met a jour l'agent `ollama-local`.
- Configuration Ollama : `palabre config --sync-ollama-model` remplace le modele Ollama configure quand il a disparu et qu'un autre modele installe est disponible.
- Doctor affiche la version du CLI Palabre et signale quand une mise a jour semble disponible.

### Changed

- `palabre config --sync-agents` rafraichit aussi les commandes des agents connus deja presents dans la config quand la detection locale trouve un meilleur executable.
- `palabre presets --json` tient compte du modele Ollama configure absent, afin que les integrations masquent les presets Ollama non utilisables.

### Fixed

- Annulation : `SIGINT` / `SIGTERM` interrompent maintenant les appels adapters en cours et terminent avec le code `130`.
- Adapter CLI/PTTY/Ollama : les annulations sont propagees via `AbortSignal`, ce qui evite qu'un debat continue apres une demande d'arret.

## [0.6.4] - 2026-06-09

### Fixed

- Adapter CLI : les erreurs de modele non supporte sont maintenant classees `unsupported-model` meme quand la CLI termine avec une sortie vide et l'erreur uniquement sur stderr, au lieu d'apparaitre comme un `empty-output` deroutant.
- Suggestions d'erreur : `unsupported-model` conseille aussi de mettre a jour la CLI de l'agent, en plus de verifier le modele, l'abonnement ou les flags `--model-*`.
- Discovery : Antigravity est detecte via `agy` ou `antigravity`, afin que `doctor`, `presets --json`, la generation de config et les integrations consomment la meme source de verite CLI.

## [0.6.3] - 2026-06-09

### Fixed

- Prompts agents : `--language fr|en` ajoute maintenant une consigne explicite de langue de reponse dans le debat et la synthese, pour reduire les syntheses qui basculent ponctuellement dans l'autre langue avec de vraies CLIs IA.
- Parser CLI : un flag booleen (`--plain`, `--no-summary`, `--no-early-stop`, `--json`, `--show-prompt`, `--pull-models`, ...) n'avale plus l'argument positionnel suivant. `palabre --plain codex-claude "sujet"` conserve desormais le preset au lieu de le perdre.
- Arret anticipe du debat : les phrases d'accord suivent la langue d'interface. Ajout de motifs anglais cibles pour que `--language en` puisse declencher l'arret sur accord clair.
- Message systeme par defaut des agents Ollama localise selon la langue d'interface au lieu d'etre fige en francais.
- `palabre doctor` reconnait desormais les commandes d'agent en `.ps1` (normalisation de nom de commande alignee sur le reste du code).
- Erreur actionnable si la config chargee est structurellement invalide (racine non-objet, bloc `agents` absent ou vide), au lieu d'un echec opaque pendant le debat.

### Changed

- Refactor interne : extraction du parseur d'arguments dans `src/args.ts` avec une table centrale d'arite des flags (`boolean` / `single` / `multi`), couverte par des tests dedies (`tests/cli-args.test.ts`).
- Refactor interne : registre d'agents centralise (`src/agentRegistry.ts`) qui unifie la normalisation de nom de commande, le mapping commande -> decouverte et la liste des agents detectes, jusqu'ici duplique dans `index.ts`, `presets.ts`, `doctor.ts`, `new.ts` et `config.ts`. Ajouter un agent CLI connu se fait desormais en un seul endroit.
- Refactor interne : utilitaires d'adapter partages (`src/adapters/cli-shared.ts`, `src/exec.ts`) pour `withModelArgs`, les constantes de timeout/taille de sortie et la resolution d'extensions executables, jusqu'ici dupliques entre `cli.ts`, `cli-pty.ts` et `discovery.ts`.

## [0.6.2] - 2026-06-08

### Fixed

- Nettoyage des sorties parasites `taskkill` Windows dans l'adapter CLI, notamment le bruit localise francais/mojibake que Codex peut emettre apres l'arret de process enfants.

### Added

- Ajout de `pnpm smoke:real-presets`, un smoke test de release qui lance de vrais debats sur les presets prioritaires disponibles et verifie le flux agent -> NDJSON -> export Markdown.

## [0.6.1] - 2026-05-31

### Changed

- Mise a jour de maintenance CLI et documentation associee.

## [0.6.0] - 2026-05-21

### Added

- Contrats d'integration stabilises pour l'extension VS Code : renderer NDJSON v1, `palabre presets --json`, `palabre context scan --json`, erreurs structurees et exports partiels.
- Support des workflows de contexte et des presets exposes dynamiquement aux integrations.
