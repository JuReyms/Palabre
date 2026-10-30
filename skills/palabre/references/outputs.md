# Palabre — restitution, historique et exports

## Retrouver l'export

Les exports sont écrits dans `outputDir` (par défaut `.palabre/`) :

| Parcours | Extension | Où lire le chemin |
| --- | --- | --- |
| Débat | `.debate.md` | Sortie terminal, ou `done.outputPath` en NDJSON |
| Ask | `.ask.md` | Idem |
| Chat | `.chat.md` | `done.outputPath` après `chat-end`, ou export partiel après une erreur ; `null` sinon |
| Relay | `.relay.md` | `exportPath` du `relay-result` (`null` avec `--no-export`) |

Débat et Ask contiennent une synthèse (consensus, désaccords, actions, conclusion) séparée du transcript ; Chat et Relay n'en ont pas. Un export partiel avec une section `Interruption` signale un échec : le dire à l'utilisateur.

## Historique et index optionnel

`palabre history` ou `palabre history --json` liste les exports récents `.debate.md`, `.ask.md` et `.chat.md` (pas `.relay.md`).

Si le projet a besoin d'un registre de décisions versionné, créer un index Markdown à l'emplacement adapté au projet ; `.palabre/INDEX.md` est une convention possible, pas un export maintenu automatiquement par Palabre. Après une session, ajouter par exemple :

```markdown
| Date | Sujet | Décision / conclusion | Fichier |
|------|-------|-----------------------|---------|
| 2026-07-12 | Double-submit CheckoutPanel | UI guard + idempotencyKey | [export](.palabre/checkout-panel-review.debate.md) |
```

Créer le fichier avec l'en-tête de tableau s'il n'existe pas. Cet index permet de retrouver rapidement les décisions prises et d'éviter de rejouer un débat déjà tranché.

## Restituer à l'utilisateur

Résumer simplement : décision ou recommandation, désaccords restants, limites (agent en échec, contexte partiel, refus), prochaines étapes. Proposer le transcript complet ou la synthèse seule ; si l'utilisateur a demandé l'affichage automatique, le faire sans redemander.

### Expliquer les actions sans options techniques

Les mots de l'interface ne remplacent pas les permissions : conserver les choix explicites de l'humain, la vérification de la bonne conversation et l'absence de renvoi après refus. Une nouvelle version du skill ne justifie pas de faire voter l'utilisateur sur une règle interne. Pour une tâche déjà autorisée, annoncer puis poursuivre si aucun choix humain antérieur n'exige de nouvelle décision ; l'autorisation technique ponctuelle de l'hôte reste distincte.

| Détail réservé à l'agent | Explication dans la conversation |
| --- | --- |
| Envoi avec --open | Continuer avec l'équipier dans la conversation Codex déjà utilisée, avec ses autorisations habituelles. |
| --background | Faire travailler l'équipier sans ouvrir de fenêtre, avec les permissions propres à ce parcours. |
| --check | Vérifier que je peux joindre la bonne conversation, sans rien envoyer. |
| --new | Démarrer une nouvelle conversation avec l'équipier. |
| relay open | Demander l'ouverture de cette conversation dans l'application Codex, sans message. |

Éviter « Quand Codex est ouvert, je passe en --open sans te redemander ? ». Si le cadre suffit : « Je continue avec Codex dans la conversation que tu utilises déjà dans Codex, en conservant ses autorisations habituelles. » Si l'humain avait expressément demandé une confirmation à chaque fois, conserver ce choix ; une éventuelle proposition de changement porte sur le travail et sa portée, jamais sur un nom d'option. Ne pas transformer une demande d'ouverture pour consulter en autorisation d'envoyer.

Les options restent exactes dans les commandes copiables et le dépannage demandé. Les titres de boutons décrivent l'action (« Ouvrir dans Codex »), sans --open ni identifiant. Après Relay, dire ce qui a été fait, le blocage et la prochaine action si nécessaire ; garder identifiant, dossier et export hors de la réponse ordinaire. Une demande technique, un diagnostic ou l'absence de contexte conservé peuvent justifier de les donner.

## Appliquer le consensus

Sur demande de l'utilisateur, implémenter les corrections sur lesquelles **les agents s'accordent** (sections Consensus / Actions). Ne toucher qu'aux points consensuels ; laisser de côté les points en désaccord. Après application, résumer les changements faits et lister ce qui a été volontairement écarté (et pourquoi). Pour approfondir un point, proposer un Chat avec la synthèse comme contexte initial (`chat.md`).

## Export ciblé

### Commentaire de PR

Un résumé court prêt à coller dans une pull request : le consensus en 2-3 lignes, puis les actions sous forme de cases à cocher.

```markdown
**Débat Palabre — <sujet>**

Consensus : <résumé en 1-2 phrases>.

Actions :
- [ ] Action 1
- [ ] Action 2

Points ouverts : <désaccords résiduels, le cas échéant>.
```

### ADR (Architecture Decision Record)

Créer `docs/adr/<NNNN>-<slug>.md`, en numérotant à la suite des ADR existants :

```markdown
# <NNNN>. <Titre de la décision>

Date : <YYYY-MM-DD>
Statut : Accepté

## Contexte
<le sujet du débat et le problème posé>

## Décision
<le consensus retenu>

## Alternatives & désaccords
<les points non tranchés, les options écartées>

## Conséquences
<les actions à mener, les impacts>
```
