# Lancer un débat

## Mode guidé

```bash
palabre new
```

L'assistant de Palabre vous  aide à choisir les agents, préparer le sujet et les options principales. C'est le meilleur point de départ si vous découvrez Palabre.

## Avec les agents par défaut

```bash
palabre -s "Critique ce plan" -t 4
```

Cette commande utilise les agents définis dans votre configuration.

## Avec un preset

```bash
palabre codex-claude "Critique ce plan" -t 4
```

Un preset choisit rapidement une paire d'agents. L'ordre compte : `codex-claude` fait répondre Codex en premier, puis Claude.

## Avec des agents explicites

```bash
palabre run --subject "Critique ce plan" --agent-a codex --agent-b claude --turns 4
```

Cette forme est plus longue, mais elle rend la commande totalement explicite.

## Nombre de réponses

`--turns` ou `-t` indique le nombre total de réponses, entre 1 et 20.

Exemple avec `codex` en agent A et `claude` en agent B :

| Valeur | Déroulé |
|--------|---------|
| `-t 2` | codex, puis claude |
| `-t 3` | codex, claude, codex |
| `-t 4` | codex, claude, codex, claude |

Par défaut, Palabre peut s'arrêter avant la limite si les agents expriment clairement un accord complet après un tour complet.

Pour forcer toutes les réponses demandées :

```bash
palabre codex-claude "Sujet" -t 4 --no-early-stop
```

## Choisir un modèle à la volée

Palabre ne liste pas les modèles des CLIs, car ils changent souvent. Il transmet simplement la valeur à l'agent. Si le modèle n'existe pas ou n'est pas autorisé par votre compte, la CLI renverra l'erreur.

```bash
palabre codex-claude "Sujet" --model-a gpt-5.5 --model-b opus-4.7
```

Pour Ollama :

```bash
palabre codex-ollama "Sujet" --model-b gemma4:e4b
```

## Prévisualiser sans appeler d'IA

```bash
palabre codex-claude "Sujet" --show-prompt
```

Cette commande affiche le prompt du premier tour, les agents et les modèles connus, puis s'arrête. C'est utile pour vérifier le contexte envoyé sans consommer de requête IA.

## Rendu terminal

Par défaut, Palabre utilise un rendu lisible avec en-têtes, séparateurs, synthèse structurée et état de génération.

Pour obtenir un rendu brut adapté aux logs :

```bash
palabre codex-claude "Sujet" --plain
```
