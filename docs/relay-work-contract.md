# Relay : méthode, suivi GitHub et attribution

Premier lot validé par le propriétaire le 31 octobre 2026. Il complète les échanges Relay ordinaires ; il ne modifie ni transport, permissions, délivrance, identité corrélée, ni les fonctions Mission/review/write gelées.

## Cadre produit

L’utilisateur pilote son chef de mission, qui délègue analyse, codage ou relecture selon les capacités et permissions du parcours. Les résultats reviennent directement au chef de mission. Celui-ci coordonne les corrections et restitue résultat ou résumé, preuves, limites et liens utiles. Un accord entre agents et une réponse reçue ne prouvent jamais la réussite du travail.

GitHub est un support facultatif du travail : issue pour problème/suivi, PR pour changements/revue, commentaire pour bilan significatif ou décision. Les échanges intermédiaires restent directs. Sans GitHub, conversation et exports suffisent. Aucun rattachement automatique depuis Git, la config ou une autre tâche de la conversation.

## Options et validation avant IO

- `--github <url>` : HTTPS github.com uniquement, dépôt `owner/repo`, issue `/issues/N` ou PR `/pull/N`. Slash final accepté et retiré ; query, fragment, credentials, encodage, contrôles et autres chemins refusés. Numéro décimal canonique de 1 à 9999999999. Validation syntaxique locale, sans réseau ou GitHub CLI : existence et accès non vérifiés.
- `--participant <nom>` : nom du destinataire pour ce travail, 1 à 64 points de code Unicode, une ligne sans espaces aux extrémités, sans Cc/Cf/Zl/Zp. L’alias configuré reste disponible ; pas de nom inventé ni de profil persistant créé. Le nom est échappé dans l’enveloppe Markdown et les tables d’export.
- `--no-reply-format` : retire la seule consigne courte de restitution. Sans cette option, l’enveloppe ordinaire demande résultat, vérifications/preuves, limites/blocages et suite/décision pertinente, sans imposer des rubriques vides. Le CLI ne lit pas ces rubriques et ne réécrit jamais la réponse.

Options ordinaires seulement : reprise, création, Codex ouvert et copie OpenCode. Refus `invalid-request` / `invalid-arguments` avant config, confiance ou lancement avec `--check`, `--follow`, Mission, `--task` et `--write`. Les doublons et valeurs manquantes suivent le parseur strict existant. Les fonctions gelées conservent leur enveloppe et leur consigne propre.

Les ajouts entrent dans la borne totale UTF-8 de 64 Kio, et dans les bornes propres à `--open` de 8192 unités UTF-16 et de ligne de commande Windows. Aucun découpage ou repli automatique. L’enveloppe complète effectivement envoyée reste conservée telle quelle.

## Contrats et traces

Champ facultatif JSON v1 `work` :

```json
{
  "github": {
    "url": "https://github.com/owner/repo/pull/42",
    "repository": "owner/repo",
    "kind": "pull-request",
    "number": 42
  },
  "participant": "Atlas"
}
```

`github` et `participant` sont indépendants. `kind` vaut `repository`, `issue` ou `pull-request` ; `number` est absent pour un dépôt. `work` est absent sans métadonnée explicite. Les métadonnées validées survivent aux refus et erreurs ultérieurs, sans changer statut ni délivrance.

Même contexte dans l’enveloppe, le résultat, l’export `.relay.md`, la passation `.handoff.md` éventuelle et `relay recent` v1. L’inventaire relit uniquement la table initiale FR/EN bornée ; un rattachement mal formé est refusé sans aller chercher une valeur dans le corps. Les anciens exports restent lisibles sans `work`. Le consommateur tolère l’absence et les champs inconnus. La passation ne contient toujours ni enveloppe ni nonce et ne devient pas une délivrance.

## Attribution et autorité

Le compte GitHub reconnu par GitHub, le participant déclaré et la conversation privée sont distincts. Le participant désigne le destinataire ; `from.agent` et `to.agent` gardent leurs significations. Un nom stable n’authentifie personne et ne change ni outil, rôle, modèle ou permissions. Deux alias du même outil ne deviennent pas deux relecteurs indépendants.

Aucune publication, notification, écoute GitHub ou nouvelle commande d’action dans ce lot. Le lien et le nom sont des données non fiables ; ils ne donnent aucun droit, et un commentaire sous le compte humain ne prouve jamais une décision humaine. Les identifiants privés, historiques, nonces et chemins locaux ne sont pas destinés à une attribution publique. Le futur bilan choisi aura son propre aperçu, cadre d’autorisation et résultat de publication ; il ne réutilisera pas implicitement la politique des fonctions gelées.

## Vérification

Tests hors ligne : validation négative des liens et noms, aiguillage avant `relay`, enveloppes FR/EN, réponse libre, création/reprise et dépôt ouvert simulés, export exact et aller-retour `relay recent`, métadonnées facultatives, refus avant IO et non-régression des fonctions gelées. Faux profils/CLIs exclusivement via `scripts/test.mjs`. Les essais réels consomment des historiques/quotas et restent séparés avant publication, avec accord humain.
