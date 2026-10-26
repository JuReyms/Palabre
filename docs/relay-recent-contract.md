# Retrouver un échange Relay — contrat #206

Commande : `palabre relay recent [--limit 10] [--json] [--config <chemin>] [--language fr|en]` (non publiée).

## Usage et frontières

Retrouver « le même équipier » par objet, date et outil, puis faire confirmer le
choix à l'humain lorsque la conversation n'est plus dans le contexte. Une liste,
jamais une sélection automatique, un envoi, une ouverture ou une preuve de droits.
Ne pas ajouter « la dernière », de commande de reprise automatique ni de TUI dans
ce lot. Le parcours `palabre history` existant reste inchangé.

Seuls les exports `.relay.md` du dossier de sortie effectif sont consultés,
sans récursion, réseau ou lecture des conversations Claude/Codex/OpenCode.
Sans configuration, utiliser `.palabre/` du dossier courant. Une configuration
existante doit être approuvée ; aucun prompt, accord de confiance ou changement
de configuration dans cette commande. `--trust-config` et toutes les options
d'envoi/ouverture sont refusées avant lecture de la configuration.

## Résultat

JSON v1 distinct : `type: relay-recent-result`, `status: listed`, `exitCode: 0`,
`entries`, `warnings`, `truncated`, `scanTruncated`, `error: null`.
Erreur d'arguments/configuration : code 8 ; dossier existant inaccessible : code 2.
Dossier absent : liste vide réussie, pas de création.

Chaque entrée : `fileName` relatif au dossier d'export, `date` de début déclarée
par l'export, `subject` ou null, `agent` (alias), `to` (alias et session ou session nulle),
`provider`, `mode` (ou null pour un ancien export sans mode), `status`, `delivery`.
OpenCode sur copie : `to: null`, bloc `copy: {source, session, verified}` distinct ; aucun raccourci de
reprise directe. Ne jamais substituer une source à une cible manquante.
Pas de chemin de fichier absolu ajouté, prompt, réponse, nonce, permission ou commande fabriquée
dans ce JSON. Les valeurs sont des métadonnées locales non authentifiées.

Le texte affiche objet, date, outil/conversation, mode et résultat, nom du fichier,
ainsi que les avertissements. Aucun identifiant affiché n'autorise un envoi.
Les informations contrôlant le terminal sont assainies.

## Lectures et compatibilité

Tri par modification décroissante des fichiers, puis nom pour départager ; les
dates du contenu sont seulement affichées. Aucun regroupement implicite : deux
échanges avec une même conversation restent deux entrées. Limite 1–100, défaut 10.

Lecture bornée : au plus 5 000 entrées du dossier, stat des fichiers ordinaires
puis tri, 200 préfixes de 16 Kio maximum lus séquentiellement. Les plafonds de scan sont
annoncés par `scanTruncated` ; `truncated` indique des fichiers non présentés.
Liens symboliques et fichiers non ordinaires refusés. Un export illisible ou
invalide est signalé sans empêcher de lire les autres, avec un motif stable
et sans message système contenant un chemin personnel. Un nom non représentable
produit `invalid-name` et le substitut `[invalid-name]`, jamais une omission
silencieuse ou un nom de chemin dangereux. Les invalides ne comptent
pas dans `--limit`. Une table incomplète au plafond est `header-too-large`, jamais
une entrée historique partielle. Le dossier configuré peut lui-même être une
jonction ; les fichiers liés à l'intérieur ne sont pas suivis. Les dates mtime
peuvent être modifiées : aucun ordre garanti après un plafond de scan.

Une configuration relative et son outputDir sont résolus depuis le dossier
courant. Aucun repli sur une configuration globale en cas de refus local.
Le contenu des objets et les identifiants restent des données privées : le JSON
n'ajoute pas le dossier absolu des exports, mais ne prétend pas expurger un objet
dans lequel le propriétaire aurait écrit lui-même un chemin.
Sur refus de confiance, la sortie texte peut donner la commande exacte réservée
au propriétaire, depuis la configuration résolue (jamais un export) ; quoting
PowerShell/POSIX strict, aucune exécution ni ajout de ce chemin dans le JSON.
Le texte affiche la date en heure locale avec fuseau ; le JSON garde l'ISO source.

Le lecteur n'interprète que la table initiale FR/EN émise par Palabre, jamais
les tables du message ou de la réponse. Les doublons et références mal formées
sont refusés ; un fichier édité ne devient pas une source d'autorité. Les anciens
exports sans objet ou mode restent consultables. Les tests s'appuient aussi sur
le vrai rendu `renderRelayMarkdown`, y compris caractères Markdown et faux
en-têtes dans le corps.

Aide CLI, guides FR/EN, contrat JSON, skill livré, AGENTS et changelog dans le
même lot. Copies installées inchangées ; synchronisation seulement après accord.

## Vérification du lot — 26 octobre 2026

Revue du contrat, du code et des finitions par Claude via Palabre Relay,
modèle observé `claude-opus-5-5`, en arrière-plan : aucun blocage restant.
17 tests nouveaux ; dernier passage complet : 1 125 tests, 1 120 réussis,
5 ignorés, aucun échec, vrai profil Palabre inchangé avec garde actif.
Le test PowerShell préexistant à délai de 2 s avait expiré lors d'un passage
précédent ; il passe ensuite en ciblé et dans la suite finale, sans changer son
délai. Typage, build, validateurs du skill et génération documentaire réussis.

La commande compilée a aussi retrouvé les trois échanges réels de cette revue
par objet, date et outil, dans l'ordre, sans avertissement, sans ouvrir une
conversation ni appeler un modèle. Identifiants, chemins personnels, contenu
des messages et exports bruts restent locaux. Cet essai valide la liste, pas
une reprise automatique ou l'état courant des équipiers.
