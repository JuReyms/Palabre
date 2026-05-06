# Ollama

Ollama permet d'utiliser des modèles locaux depuis Palabre.

C'est utile pour ajouter un regard local, moins coûteux, ou pour confier à un petit modèle un rôle ciblé : critique, exploration ou synthèse légère.

## À installer avant Palabre

Installez Ollama, puis vérifiez que le serveur répond :

```bash
ollama list
```

Si nécessaire, démarrez Ollama :

```bash
ollama serve
```

## Installer un modèle

```bash
ollama pull gemma4:e4b
```

Adaptez le modèle à votre machine. Les gros modèles peuvent être trop lourds pour un usage fluide.

## Configuration typique

```json
"ollama-local": {
  "type": "ollama",
  "baseUrl": "http://localhost:11434",
  "model": "gemma4:e4b",
  "role": "critic",
  "temperature": 0.2,
  "validateModel": true,
  "unloadOtherModels": true
}
```

## Télécharger automatiquement un modèle manquant

Par défaut, Palabre n'installe pas de modèle automatiquement. Pour l'autoriser au lancement :

```bash
palabre codex-ollama "Critique ce plan" --pull-models
```

Vous pouvez aussi activer `autoPullModel` dans la configuration de l'agent.

## Donner du contexte à Ollama

Ollama ne lit pas vos fichiers directement. Utilisez :

```bash
palabre codex-ollama "Critique ce module" --files src/module.ts
```

ou :

```bash
palabre codex-ollama "Critique l'architecture" --context src docs
```
