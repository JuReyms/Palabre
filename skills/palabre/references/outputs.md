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

## Appliquer le consensus

Sur demande de l'utilisateur, implémenter les corrections sur lesquelles **les agents s'accordent** (sections Consensus / Actions). Ne toucher qu'aux points consensuels ; laisser de côté les points en désaccord. Après application, résumer les changements faits et lister ce qui a été volontairement écarté (et pourquoi). Pour approfondir un point, proposer un Chat avec la synthèse comme contexte initial (`references/chat.md`).

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