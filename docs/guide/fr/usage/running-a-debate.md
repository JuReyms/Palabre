---
title: Choisir un mode
description: Choisir entre Débat, Relay, Ask et Chat selon le nombre d'agents et le type de réponse recherché.
seo:
  title: "Débat, Relay, Ask ou Chat : quel mode choisir"
  description: "Choisir le bon mode Palabre : deux agents qui s'opposent, un agent avec qui avancer, ou plusieurs réponses indépendantes."
---

Palabre propose quatre modes : Débat, Relay, Ask et Chat.

| Mode | Agents | Échanges | Synthèse | Export |
|------|--------|----------|----------|--------|
| Débat | 2 | Les agents se répondent. | Oui, par défaut | `.debate.md` |
| Relay | 1 conversation cible | Un message à une conversation existante | Non | `.relay.md` |
| Ask | 1 à 4 | Les agents répondent indépendamment. | Oui : résumé par agent puis comparaison | `.ask.md` |
| Chat | 1 actif, consultation facultative | L'utilisateur échange avec l'agent actif. | Non | `.chat.md` |

## Débat en premier

Choisissez Débat pour challenger une décision, rechercher des angles morts ou obtenir une recommandation issue d'un désaccord explicite.

```text
/debat
/agents codex claude
Critique cette architecture et propose une décision
```

Consultez le [guide du mode Débat](/fr/usage/debate).

## Relay pour passer la main

Un agent transmet un message à une conversation Codex ou Claude Code existante et reçoit sa réponse. Cette commande directe n’a pas d’écran TUI ; son option Mission garde le cadre et le budget de plusieurs étapes en lecture seule. Voir [Relay](/fr/usage/relay).

## Ask pour comparer sans influence

Choisissez Ask pour recueillir jusqu'à quatre réponses indépendantes avant leur comparaison. Consultez le [guide Ask](/fr/usage/ask).

Pour une utilisation humaine, commencez par `palabre` et utilisez la [TUI](/fr/usage/tui). Les extensions doivent utiliser les [contrats d'intégration](/fr/integrations/overview), pas analyser le rendu TUI.

## Chat pour poursuivre

Choisissez Chat lorsqu'un agent suffit, avec un second avis ponctuel via `/consult`. Après un Débat ou un Ask, il peut reprendre le sujet et la synthèse. Consultez le [guide Chat](/fr/usage/chat).

## Reprendre sans rejouer les réponses

Ajoutez `--checkpoint` à un Débat ou à une demande Ask si la session doit pouvoir reprendre après un arrêt. Palabre enregistre l'état sous `.palabre/sessions/`, puis `palabre sessions` le liste et `palabre resume <session-id>` relance uniquement la prochaine étape. La reprise vérifie la configuration et le contexte avant d'appeler un agent ; consultez la [référence CLI](/fr/reference/cli#reprendre-une-session) pour les confirmations et la suppression ciblée.

Voir [Synthèses](/fr/usage/summaries) pour les formats Débat et Ask.
