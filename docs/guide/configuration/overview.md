# Configuration

La configuration indique à Palabre quels agents existent, quels agents utiliser par défaut et où écrire les exports. Si `outputDir` n'est pas défini, les fichiers `.debate.md` sont créés dans le dossier courant.

## Créer une configuration

```bash
palabre init
```

Cette commande crée une configuration globale :

```text
~/.palabre/palabre.config.json
```

Pour une configuration propre au projet courant :

```bash
palabre init --local
```

Cela crée :

```text
./palabre.config.json
```

## Voir la configuration utile

```bash
palabre agents
palabre doctor
```

`palabre agents` affiche les agents déclarés et leur détection locale. `palabre doctor` vérifie les erreurs courantes.

## Modifier les paramètres courants

```bash
palabre config
```

L'assistant permet de définir ou supprimer les agents par défaut.

Commandes directes utiles :

```bash
palabre config --set-defaults codex claude --summary-agent claude -t 4
palabre config -t 3
palabre config --summary-agent claude
palabre config --clear-defaults
palabre config --sync-agents
```

## Aller plus loin

- [Paramètres par défaut](/configuration/defaults)
- [Configuration locale ou globale](/configuration/local-vs-global)
- [JSON avancé](/configuration/advanced-json)
