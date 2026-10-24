# Relay OpenCode : contrat du premier lot CLI sur copie

19 octobre 2026 — Codex MSI — recherche #136.

**Contrat du pilote non publié.** Cette branche raccorde OpenCode à `palabre relay`
avec des tests simulés et un essai CLI réel réussi le 19 octobre 2026 ; voir
`docs/relay-opencode-copy-qualification.md` pour la portée exacte de cette preuve.
Les exemples ci-dessous décrivent ce pilote. Le cahier des charges reste inchangé pour Claude
Code et Codex ; Desktop garde sa qualification séparée.

## 1. Décision et preuve de départ

Le propriétaire a choisi : « Relay doit travailler avec mon OpenCode configuré
comme je l'ai choisi ». Connexions, agent, modèle, permissions, plugins, MCP et
politiques d'organisation font partie de cet environnement. La neutralisation
générale des intégrations n'est plus un préalable **pour OpenCode seulement**.

Le premier parcours demande un avis dans une **copie de conversation**. L'enveloppe
demande de ne pas modifier de fichiers ; elle n'accorde aucun droit. Cette consigne
n'est ni une lecture seule imposée, ni un confinement. Le fork ne copie pas le
projet : source et copie utilisent le même dossier et les mêmes fichiers.

Preuve réutilisable : branche `codex/opencode-research-handoff`, commit `c1d89b2`,
`research/opencode-136/habitual-profile-result-2026-10-19.md`. Un essai unique
Windows/OpenCode 2.0.32 a retrouvé le contexte, lu trois fichiers fictifs et rendu
un avis correct dans la copie. Les relevés source et fichiers sont restés
identiques ; le serveur privé s'est arrêté normalement. Ce passage ne qualifie
pas encore la commande produit, la concurrence ou les autres plateformes.

Les traces brutes restent locales ; elles ne doivent pas entrer dans une PR.
Ne pas rejouer l'appel uniquement pour recréer ce bilan.

## 2. Entrée explicite et périmètre

Choix d'interface pour l'implémentation : opt-in `--copy`, source exacte et dossier
explicite. La distinction reste visible avant tout démarrage d'OpenCode :

```text
palabre relay --copy --to <agent-opencode>:<ses_...> --dir <dossier>
              ("<message>" | --message-file <chemin>)
              [--from <agent>] [--subject <objet>] [--timeout <secondes>]
              [--json] [--no-export] [--config <chemin>] [--trust-config]
              [--language <fr|en>]
```

- `<agent-opencode>` est une entrée CLI de la configuration approuvée ; le
  fournisseur vient de sa commande, pas du nom de l'entrée. Aucune CLI de repli.
- `--copy` est réservé à OpenCode dans ce lot. Sans ce drapeau, une cible OpenCode
  est refusée avec la commande corrigée ; elle n'est jamais reprise directement.
- L'identifiant OpenCode est opaque, sensible à la casse, de forme
  `ses_[A-Za-z0-9]+`, borné à 128 caractères. Il sert à l'API, jamais à construire
  un chemin. Ne pas élargir la grammaire UUID de `parseSessionRef` ni celle de
  Mission. Une validation dédiée ne s'utilise qu'avec ce parcours.
- `--dir` est obligatoire ici, résolu et canonisé avant lancement. Il doit être
  accessible et égal au dossier canonique enregistré dans la source. Ne pas
  retomber sur le dossier courant, importer un export, parcourir toutes les
  conversations ou choisir « la dernière ».
- Le premier lot conserve l'agent et le modèle **explicites de la source**, variante
  comprise. Aucun override de modèle, sélection gratuite automatique ou repli
  payant ; un modèle absent ou indisponible arrête le parcours. Les arguments de
  l'adapter de débat ne sont pas repris.
- Refuser `--new`, `--open`, `--background`, `--check`, `--follow`, `--then-follow`,
  `--write`, `--task`, `--pr` et l'en-tête interne Mission
  avant serveur ou modèle. Pas de retour automatique vers l'expéditeur.
- Pilote initial : Windows et CLI 2.0.32. Toute autre version ou plateforme est
  refusée avant le serveur avec un diagnostic de version non qualifiée ; ne pas
  mettre à jour OpenCode automatiquement. Étendre ce domaine demande une preuve.

Exception de préfixe source relevée le 23 octobre : le rappel `synthetic` standard
du mode Plan 2.0.32 après `agent-switched` vers `plan`, avec sélection source `plan`.
Texte complet, clés et date de création numériques stricts ; seul le chemin natif
Windows vers `.opencode\plan` varie, sans être lu ni utilisé comme autorisation.
Le fork conserve intégralement ce préfixe. Les autres synthétiques, tout changement
du rappel dans la copie et tout nouveau synthétique pendant le tour restent refusés.
Ce correctif ne change ni l'agent, ni le modèle, ni les permissions de la source.

L'approbation de la config Palabre autorise sa consommation, pas une modification
des permissions OpenCode. La commande ne demande aucune confirmation interactive.
L'agent destinataire expose ses questions ou blocages dans sa réponse finale.

## 3. Déroulé et frontières de confiance

1. Valider arguments, configuration approuvée, exécutable sans shell, version,
   dossier et budget. Une seule échéance couvre démarrage, relevés, fork et tour.
   Le shim npm natif habituel d'OpenCode est accepté seulement s'il correspond
   exactement au modèle du lecteur partagé et désigne un exécutable interne
   existant ; lancement direct sans PowerShell. D21 reste inchangé ailleurs.
2. Démarrer un **serveur privé possédé par cet appel**, dans le dossier explicite :
   `serve --stdio --hostname 127.0.0.1 --port 0`. Profil habituel conservé, sans
   copie de connexion, lecture directe de base ou modification de configuration.
   Les intégrations habituelles peuvent donc démarrer dès cette étape.
3. Accepter uniquement l'URL locale structurée annoncée par ce processus. Mot de
   passe aléatoire propre à l'appel ; authentification sur chaque requête, aucun
   redirect ni connexion à un serveur existant fourni par l'environnement.
   Ne jamais publier URL de contrôle, mot de passe, environnement ou journaux bruts.
4. Lire deux relevés source identiques : informations, export API, contexte, inbox
   et instructions API. Vérifier ID, dossier, agent/modèle explicites, inbox vide,
   dernier tour terminé avec succès et contexte admissible. Une source vide,
   partielle, compacte hors schéma reconnu, ambiguë ou changeante est refusée.
5. Créer **un seul fork** de cette source, sans prompt. Conserver immédiatement
   son identifiant s'il est valide, même si la vérification suivante échoue.
   Un fork retourné avec le même ID que la source n'est jamais une copie valide.
6. Vérifier la provenance `fork.sessionID`, le dossier, l'agent, le modèle, les
   permissions et les instructions. Comparer le contexte complet en retirant
   uniquement les ID de premier niveau réattribués par le fork. Revérifier la
   source inchangée. Aucun message tant que ces contrôles ne sont pas satisfaits.
7. Construire l'enveloppe avec un nonce neuf, l'ID **de copie** et le cadre de
   consultation avec permissions habituelles. Taille totale de coordination :
   64 Kio UTF-8, comme Relay. Envoyer une seule fois par stdin :
   `run --server <url-privée> --session <id-copie> --format json`.
   Aucun `--auto`, `--model`, `--agent`, `--pure` ou changement de permissions.
8. Lire le résultat et le contexte de la copie ; accepter une réponse uniquement
   après les contrôles de la section 4. Revérifier la source ; ne pas masquer une
   dérive ou un relevé devenu illisible par un succès du client CLI.
9. Fermer l'entrée du serveur possédé par cet appel et attendre son arrêt borné.
   Si nécessaire, arrêter uniquement son arbre de processus. Conserver le
   diagnostic si l'arrêt n'est pas établi ; ne pas arrêter d'autres OpenCode.
   Examiner la cause connue après drainage des dernières sorties : une fermeture
   confirmée ne suffit pas au succès si un plafond est détecté pendant l'attente.
   Une réponse déjà validée reste conservée.

Les lectures API, sorties serveur et client sont bornées **avant** leur parsing :
4 Mio cumulés par processus ; 4 Mio par réponse API et 32 Mio cumulés par appel.
Une limite atteinte refuse l'interprétation partielle, sans troncature silencieuse.
Chaque opération utilise le budget restant ; arrêt de nettoyage borné à 10 s
supplémentaires, annoncé séparément du délai d'attente. Les contrôles refusent
les schémas inconnus, au lieu de déduire un succès de prose ou d'un exit 0.

L'API `/api/session/active` ne décrit que son processus : elle ne prouve pas la
fermeture globale de la source. Demander à l'utilisateur de la fermer et de ne pas
la réutiliser pendant l'appel. Les relevés réduisent une course sans fournir de
verrou atomique entre clients. Ne jamais fabriquer `attachment: detached` pour
passer le garde-fou des adapters Codex/Claude.

## 4. Réponse, délivrance et rétention

La réponse doit provenir du nouveau tour de la **copie vérifiée** :

- préfixe de contexte inchangé et un seul nouvel utilisateur au corps exactement
  égal à l'enveloppe ; le nonce seul ne suffit pas ;
- assistants postérieurs à ce message, agent, fournisseur, modèle et variante
  attendus ; aucun changement de sélection contradictoire ;
- aucun apport utilisateur concurrent, message synthétique, shell, skill,
  changement de dossier, compaction ou type d'événement non qualifié ;
- seule exception système du nouveau tour : une unique notice de rafraîchissement
  `core/date` avant l'utilisateur exact. Clés de message/time/metadata strictes,
  description et texte complets, calendrier et jour de semaine cohérents ;
  aucun ajout, doublon, autre source d'instruction ou position tardive accepté.
  La notice reste soumise aux contrôles d'ID et ne change pas les comparaisons de
  préfixe, instructions, modèle ou permissions. Ces métadonnées n'ont pas d'autorité ;
- outils terminés sans erreur structurée ; dernier assistant terminé,
  `finish: stop`, texte non blanc, puis une seule fin `idle: succeeded` ;
- client terminé à zéro, sans annulation, timeout, dépassement ou identité
  contradictoire.

Ces contrôles établissent la réponse et sa délivrance. Le relevé final de la
source et l'arrêt du serveur conditionnent séparément le succès global : leur
échec ne retire pas une réponse déjà validée dans la copie.

Une réponse attribuable n'est pas une preuve de justesse de l'avis ou d'absence
d'effets externes. Ne pas scanner ni restaurer arbitrairement le projet utilisateur
pour promettre « aucun fichier modifié ».

Le JSON v1 ajoute la valeur `copy` au mode émis sur chaque résultat, avec
`modeSource: "explicit"` dès la résolution de `--copy`, et un bloc optionnel `copy`.
La préférence `relay.view` n'est pas consultée ; aucun champ de quota, de lien
Codex ou de suivi n'est ajouté dans ce parcours. **`to.session`
désigne la copie exécutée**, ou `null` tant qu'elle n'est pas vérifiée. La référence
demandée reste dans `copy.source`. `identity: same-as-target` compare donc réellement
la réponse à `to.session`, pas la copie à son original. Les sorties Claude/Codex ne
changent pas. Exemple de champs additionnels après réussite :

```json
{
  "mode": "copy",
  "to": { "agent": "opencode", "session": "ses_ExampleCopy", "provider": "opencode" },
  "copy": {
    "source": "ses_ExampleSource",
    "session": "ses_ExampleCopy",
    "verified": true,
    "retention": "retained",
    "sourceCheck": "unchanged",
    "serverStop": "confirmed"
  }
}
```

`copy.session` conserve tout ID distinct valide reçu du fork, même non vérifié ;
`verified` dit si la provenance et les contrôles avant envoi ont été satisfaits.
`sourceCheck` vaut `unchanged`, `changed` ou `unknown` au dernier relevé ; ce n'est
pas une garantie absolue sur l'original. `serverStop` vaut `confirmed` ou `unknown`.
Pas de détournement de `created`, réservé à `--new`. En cas de création du fork
incertaine sans ID, annoncer qu'une copie peut exister sans la chercher ni refaire
le POST ; omettre `copy.session` et rendre `retention: "unknown"`.

| Situation | Issue / code | Délivrance du message dans la copie |
| --- | --- | --- |
| Refus de validation | `invalid-request` / 8 ; raison dédiée `opencode-cli-unsupported` pour version/plateforme | `not-delivered` |
| Source absente / dossier invalide / état non vérifiable | `session-not-found` / 6, `invalid-request` / 8, `target-state-unknown` / 3 | `not-delivered` |
| Fork créé mais non vérifié, ou source modifiée avant envoi | `no-valid-reply` / 2, diagnostic précis | `not-delivered`, copie éventuelle conservée |
| Serveur/API indisponible avant tentative d'envoi | `cli-failure` / 2 | `not-delivered`, effets de profil/fork possibles |
| Annulation ou délai | `cancelled` / 130 ou `timeout` / 4 | `not-delivered` avant tentative, sinon selon preuve |
| Sortie ou réponse API trop grande | `output-too-large` / 2 | selon phase et preuve |
| Client non nul, erreur structurée, schéma inconnu ou réponse incomplète | `cli-failure` ou `no-valid-reply` / 2 | selon preuve |
| Mauvaise identité après tentative | `identity-mismatch` / 5 | selon preuve ; aucun texte étranger rendu |
| Source changée ou invérifiable au relevé final | `cli-failure` / 2, diagnostic source | selon preuve ; réponse validée et `replied` conservés, sans succès global |
| Arrêt serveur non établi | `cli-failure` / 2, diagnostic d'arrêt | preuve conservée ; réponse valide déjà acquise conservée séparément |
| Toutes les preuves satisfaites | `replied` / 0 | `replied` |

La tentative d'envoi commence dès le lancement effectif du client `run`, pas au
démarrage du serveur ni au fork. Une réponse validée dans la copie donne
`delivery.status: replied` et reste dans `reply`, même si un contrôle ultérieur
source, arrêt ou export rend le statut global non nul. Après tentative, sans
réponse validée, la preuve positive du corps exact dans la copie impose
`persisted-no-reply`. Absence du message ou relevé illisible donne `unknown`,
jamais `not-delivered`. Ces preuves mémorisées résistent aux erreurs de nettoyage
et aux exceptions ; un relevé ultérieur manqué ne les efface pas.

Après timeout/annulation, demander au mieux l'interruption **de la seule copie**
avec un budget de nettoyage borné. Arrêter le client ne prouve pas l'arrêt du tour
serveur. Aucun retry, nouveau fork, renvoi ou changement automatique de modèle.
Les reprises internes au fournisseur restent celles d'OpenCode sur ce même modèle.
Quota : diagnostic structuré qualifié seulement ; pas de classification de la prose.

Source et copie restent dans OpenCode, même après échec. Aucune suppression ou
restauration automatique. `--no-export` ne supprime pas la copie. L'export et le
terminal nomment source, copie, modèle observé, délivrance et limites des
permissions ; ils ne reprennent pas l'avertissement de lecture seule Codex/Claude.
Un refus avant démarrage n'écrit pas d'export. Après démarrage, le bilan local doit
aussi rendre les effets connus même si aucun message n'a été envoyé. Un échec
d'export ne doit pas faire perdre les ID ni la preuve de délivrance dans le JSON.

## 5. Architecture et vérification avant raccordement

Le contrat actuel `ExternalSessionAdapter` suppose une localisation/lecture
synchrones sur fichier et un unique processus de reprise. Ne pas y dissimuler un
serveur persistant, un faux chemin d'historique ou un faux état détaché.

Construire un parcours de copie au niveau `src/externalSessions/`, avec transport
injecté : lancement/arrêt possédés par le socle, API et schémas propres à OpenCode,
contrôles de copie/corrélation purs. Le contrôleur conserve la phase, les ID et la
preuve positive même si une dépendance lève. Réutiliser la taxonomie, les codes,
l'enveloppe de coordination et les renderers ; adapter la classification aux
phases, sans modifier les garanties des reprises Codex/Claude. Aucun cas spécial
dans le moteur de débat ni dépendance à `node:sqlite` (Node 20+ reste supporté).

Les tests ordinaires passent par `scripts/test.mjs`, avec faux processus et API,
sans compte, réseau externe ni modèle :

- arguments incompatibles, version inconnue, mauvais dossier, casse des ID ;
- source changeante, inbox non vide, fork absent/étranger ou contenu différent ;
- agent/modèle/variante/permissions/instructions modifiés, aucun envoi dans ces cas ;
- un seul fork et un seul `run`, cible toujours distincte de la source ;
- corps exact, nonce cité dans une réponse, ancien tour, concurrent, type inconnu,
  outil en échec, longueur limitée, final absent, modèles contradictoires ;
- annulation/timeout avant et après admission, POST fork sans accusé, requête
  bloquée, arrêt ou export en échec, dépassements individuels et cumulés ;
- ID et preuve toujours conservés ; jamais de retry, pas de mot de passe exposé ;
- régression : sorties et politiques Claude/Codex, Mission et review inchangées.

Avant publication : revue indépendante, `pnpm check`, `pnpm test`, `pnpm build`,
aide CLI et guides FR/EN, skill et notes de rétention cohérents dans la même PR.
Copies installées : proposer `palabre skill --sync` après accord humain, puis
recharger le skill ; aucune modification des instructions installées dans ce lot.
Qualifier une fois la **commande produit** depuis l'hôte avec des données
fictives ; le succès du lanceur de recherche ne remplace pas cette preuve.
Ne pas annoncer #136 résolue ni mettre Desktop au vert avec ce seul lot CLI.
