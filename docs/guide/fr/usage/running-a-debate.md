---
title: Choisir un mode
description: Choisir entre Débat, Chat et Ask selon le nombre d'agents et le type de réponse recherché.
---

Palabre propose trois modes. **Débat reste le mode principal** : l'accueil le présente en premier et il exploite pleinement l'orchestration contradictoire.

| Mode | Agents | Échanges | Synthèse | Export |
|------|--------|----------|----------|--------|
| Débat | 2 | Les agents se répondent. | Oui, par défaut | `.debate.md` |
| Chat | 1 actif, consultation facultative | L'utilisateur échange avec l'agent actif. | Non | `.chat.md` |
| Ask | 1 à 4 | Les agents répondent indépendamment. | Oui, par défaut | `.ask.md` |

## Débat en premier

Choisissez Débat pour challenger une décision, rechercher des angles morts ou obtenir une recommandation issue d'un désaccord explicite.

```text
/debat
/agents codex claude
Critique cette architecture et propose une décision
```

Consultez le [guide du mode Débat](/fr/usage/debate).

## Chat pour poursuivre

Choisissez Chat lorsqu'un agent suffit, avec un second avis ponctuel via `/consult`. Après un Débat ou un Ask, il peut reprendre le sujet et la synthèse. Consultez le [guide Chat](/fr/usage/chat).

## Ask pour comparer sans influence

Choisissez Ask pour recueillir jusqu'à quatre réponses indépendantes avant leur comparaison. Consultez le [guide Ask](/fr/usage/ask).

Pour une utilisation humaine, commencez par `palabre` et utilisez la [TUI](/fr/usage/tui). Les extensions doivent utiliser les [contrats d'intégration](/fr/integrations/overview), pas analyser le rendu TUI.
