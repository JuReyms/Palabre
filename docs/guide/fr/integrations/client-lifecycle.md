---
title: Cycle de vie, erreurs et identité
description: Gérer les codes de sortie, les exports partiels, l'annulation et la provenance d'une intégration.
---

| Code | Signification |
|------|---------------|
| `0` | Succès. |
| `1` | Erreur de validation, configuration ou exécution. |
| `130` | Annulation. |

Attendez toujours la fermeture du processus. `error` décrit l'échec métier ; le code confirme l'état final.

Un événement `error` peut contenir la phase, l'agent, le rôle, le tour, un `kind` stable, un message et des détails. Les kinds incluent notamment `command-not-found`, `spawn-failed`, `timeout`, `idle-timeout`, `output-too-large`, `empty-output`, `non-zero-exit`, `usage-limit`, `model-unavailable`, `model-pull-failed`, `http-error` et `cancelled`. Branchez la logique sur `kind`, pas sur le texte du message.

Palabre tente de conserver les réponses dans un export partiel après un échec. Acceptez donc `done` avec un chemin suivi d'un code non nul. Une annulation doit rester distincte d'une erreur.

## Identité du client

```text
PALABRE_CLIENT=mon-integration
PALABRE_CLIENT_VERSION=2.3.0
```

Le nom est libre. Palabre nettoie ces valeurs et les inscrit avec sa propre version dans les exports. Sans déclaration, la source est `direct-cli`. Ces champs sont diagnostiques, pas une frontière de sécurité.
