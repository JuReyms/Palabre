# Gemini

Palabre peut l'utiliser comme agent de relecture, de comparaison ou de synthèse.

## À installer avant Palabre

Installez Gemini CLI depuis la documentation officielle de Google, puis authentifiez la CLI dans votre terminal.

Documentation officielle : [https://geminicli.com/](https://geminicli.com/)

Vérifiez ensuite que la commande fonctionne :

```bash
gemini --version
```

Si Gemini a été installé après `palabre init`, synchronisez la configuration :

```bash
palabre config --sync-agents
```

## Modèles et limites

Les modèles disponibles et les limites d'usage dépendent de votre configuration Gemini CLI et de votre compte Google.

Palabre ne liste pas les modèles Gemini, car ils peuvent évoluer, et utilise le modèle par défaut de Gemini que vous avez configuré. Si vous fournissez un modèle avec `--model-a`, `--model-b` ou `--summary-model`, Palabre transmet la valeur telle quelle à la CLI.

## Configuration typique

```json
"gemini": {
  "type": "cli",
  "command": "gemini",
  "args": [],
  "promptMode": "stdin",
  "shell": true,
  "role": "reviewer"
}
```

## Utilisation

```bash
palabre claude-gemini "Critique cette décision produit" -t 4
palabre gemini-opencode "Compare ces arguments" -t 3
```
