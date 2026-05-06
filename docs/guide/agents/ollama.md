# Ollama

C'est utile pour ajouter un regard local, moins coûteux, ou pour confier à un petit modèle un rôle ciblé : critique, exploration ou synthèse légère.

Ollama peut avoir un temps de réponse plus lent que les autres agents, surtout si le modèle n'est pas déjà chargé. Il est recommandé de vérifier que le modèle est chargé avant de lancer un débat avec Ollama. Ou de patienter.

## À installer avant Palabre

Installez Ollama depuis la documentation officielle d'OpenAI,et téléchargez un modèle.

Documentation officielle : [https://ollama.com/](https://ollama.com/)

Vérifiez ensuite que la commande fonctionne :

```bash
ollama list
```
ou 
```bash
ollama ls
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

## Vérifier si un modèle est chargé dans Ollama

Ollama doit charger un modèle pour répondre rapidement.

```bash
ollama ps
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

