---
title: Mode Débat
description: Faire dialoguer deux agents, régler le nombre de réponses et obtenir une synthèse contradictoire.
seo:
  title: "Mode Débat : faire s'opposer deux agents IA"
  description: Faire dialoguer deux agents IA en alternance, régler le nombre de réponses et obtenir une synthèse de leurs désaccords.
---

Débat est le mode principal de Palabre. Deux agents se répondent sur un même sujet avec le contexte et l'historique des réponses précédentes.

## Depuis la TUI

```bash
palabre
```

Puis :

```text
/debat
/agents codex claude
/roles architect critic
Critique ce plan et tranche les désaccords importants
```

Chaque réponse reçoit le sujet, le contexte, les fichiers injectés et l'historique. La synthèse finale organise le consensus, les désaccords, les actions proposées et une conclusion courte.

Le nombre de réponses est compris entre 1 et 20. Il s'agit du total, pas du nombre par agent. Palabre peut s'arrêter après un tour complet lorsqu'un accord explicite est détecté.

## Commandes directes

```bash
palabre codex-claude "Critique ce plan" -t 4
palabre run --subject "Critique ce plan" --agent-a codex --agent-b claude --turns 4
```

Ajoutez `--no-early-stop`, `--no-summary` ou `--summary-agent <agent>` selon le besoin. `--dry-run` prévisualise la session sans appeler d'agent. L'export utilise `.debate.md`.

## Rôles, contexte et échecs

`/roles architect critic` attribue un rôle temporaire dans l'ordre des agents : proposition structurée, puis recherche des failles. Rôles : `implementer`, `reviewer`, `architect`, `scout`, `critic`, `summarizer`. Les flags `--role-a` et `--role-b` ne modifient pas la configuration ; `palabre agent-role <agent> <rôle>` définit un rôle durable.

La limite par défaut est de 4 réponses, modifiable avec `palabre config -t <n>` ; l'arrêt anticipé peut en produire moins. Pour forcer toute la limite, utilisez `--no-early-stop`. Un sujet positionnel doit contenir plusieurs mots ; pour un seul mot, utilisez `-s "mot"`.

```powershell
palabre codex-claude "Critique ce plan" --context src docs -t 4
```

Voir [Contexte et fichiers](/fr/usage/context-and-files). En cas d'échec d'agent (quota, délai, réponse vide), PALABRE tente de conserver un export partiel avec la section « Interruption ». Avec `--checkpoint`, `palabre resume <session-id>` reprend la prochaine réponse manquante ou la synthèse, sans rejouer une réponse acceptée. Aucun retry automatique.

Après le Débat, [Chat](/fr/usage/chat) peut reprendre le sujet et la synthèse. Pour consulter une conversation qui connaît déjà le projet, utilisez [Relay](/fr/usage/relay).
