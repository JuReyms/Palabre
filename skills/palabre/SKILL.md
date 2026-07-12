---
name: palabre
description: Orchestrer avec la CLI Palabre un débat entre deux agents IA ou une demande Ask à plusieurs agents pour confronter des approches techniques, obtenir une relecture contradictoire, comparer des modèles ou produire une synthèse. Utiliser lorsque l'utilisateur demande de « faire débattre », « confronter deux avis », « lancer un palabre/débat », d'arbitrer une architecture ou un refactoring, ou d'obtenir une seconde opinion critique sur du code.
---

# Palabre — débats entre agents IA

Palabre orchestre les agents installés et authentifiés sur la machine : Codex, Claude Code, Antigravity, OpenCode, Vibe et Ollama. Le mode `debate` alterne deux agents ; le mode `ask` recueille des réponses indépendantes de 1 à 4 agents. Les deux modes peuvent produire une synthèse (consensus, désaccords et actions) et un export Markdown.

Doc : https://palab.re/fr · GitHub : https://github.com/JuReyms/Palabre · npm : `palabre`

## Déclenchement (agir, ne pas hésiter)

Quand l'utilisateur dit « **lance le débat** », « fais débattre », « lance un palabre » ou équivalent : **exécuter `palabre` immédiatement**, sans redemander confirmation. Inférer le sujet et les fichiers du contexte ; ne poser une question que si une information **bloquante** manque (aucun sujet déductible, ou aucun agent détecté).

```bash
palabre -s "<sujet déduit>" -t 4 --terminal                  # débat standard
palabre -s "<sujet déduit>" --files <chemin> -t 4 --terminal # avec un fichier en contexte
```

Utiliser les agents par défaut et 4 réponses sauf demande explicite. Pour des avis indépendants, utiliser Ask :

```bash
palabre ask "<sujet déduit>" --agents codex claude opencode --terminal
```

Ne pas interroger l'utilisateur sur le choix des agents sauf demande explicite. Si aucun agent utilisable n'est disponible, lancer `palabre doctor --terminal` et restituer le diagnostic.

Ne pas lancer Palabre pour une réponse factuelle simple ou une tâche réalisable seul : un débat est plus lent et peut consommer des quotas.

## Prérequis

`npm install -g palabre`, puis les agents choisis installés et authentifiés. Un débat nécessite deux agents ; Ask accepte de un à quatre agents. Diagnostic : `palabre doctor --terminal`.

## Garde-fous

- **Confidentialité** : avant d'injecter du code/données sensibles (secrets, données client, code propriétaire) via `--files`/`--context`, prévenir que ce contenu part vers les agents choisis. Si un agent cloud est impliqué, le signaler et proposer une paire 100 % locale (Ollama).
- **Mode économique** : pour un sujet simple/exploratoire, proposer Ask avec un agent Ollama local, ou une paire CLI ↔ Ollama. Réserver deux agents premium aux décisions à fort enjeu.

## Langue

Palabre est en **français par défaut** mais fonctionne aussi en anglais. L'agent peut forcer la langue de Palabre et des prompts avec `--language fr|en` (ou la fixer une fois via `palabre config --language <fr|en>`). Choisir la langue de l'utilisateur si elle est claire.

## Restitution

Ne pas s'arrêter à la sortie terminal. Repérer le chemin d'export affiché par Palabre, puis proposer le transcript complet ou la synthèse seule. L'export est par défaut dans `.palabre/`, mais `outputDir` est configurable ; il porte l'extension `.debate.md` ou `.ask.md` selon le mode. Puis proposer une suite : transformer les actions en tâches, **appliquer le consensus** (uniquement les points d'accord), approfondir un désaccord par un nouveau débat, ou préparer un commentaire de PR / un ADR.

Si l'utilisateur a demandé l'affichage automatique du transcript, le faire sans redemander.

## Références (charger à la demande)

- `references/cli.md` — choix du mode, commandes, rôles, contexte, presets et dépannage.
- `references/outputs.md` — exports, historique et formats de commentaire PR / ADR.

## Verification

Lancer `palabre doctor --terminal` pour un diagnostic complet. Confirmer que le fichier exporté annoncé par Palabre a bien été généré, sauf avec `--dry-run` ou `--show-prompt`.