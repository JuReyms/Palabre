# Palabre — restitution, index et exports

## Index des débats

Maintenir un récapitulatif des débats passés dans `.palabre/INDEX.md`. Après chaque débat, ajouter une ligne :

```markdown
| Date | Sujet | Décision / conclusion | Fichier |
|------|-------|-----------------------|---------|
| 2026-06-11 | Double-submit CheckoutPanel | UI guard + idempotencyKey | [checkout-panel-review](.palabre/checkout-panel-review.debate.md) |
```

Créer le fichier avec l'en-tête de tableau s'il n'existe pas. Cet index permet de retrouver rapidement les décisions prises et d'éviter de rejouer un débat déjà tranché.

## Appliquer le consensus

Proposer d'implémenter directement les corrections sur lesquelles **les deux agents s'accordent** (sections Consensus / Actions). Ne toucher qu'aux points consensuels ; laisser de côté les points en désaccord. Après application, résumer les changements faits et lister ce qui a été volontairement écarté (et pourquoi).

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
