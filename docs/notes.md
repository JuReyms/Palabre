# Notes personnelles sur Chicane

Ce fichier est reserve aux idees personnelles du mainteneur.

## Idees a explorer

- Gestion de l'historique des conversations.
- Afficher le modele utilise quand Chicane peut le connaitre.
- Version anglaise et francaise. Lors de l'installation, choisir la langue.
- Ajouter LM Studio via un provider compatible OpenAI local.
- Creer un role/config dedie `summarizer` pour eviter que `agentB` soit toujours le synthétiseur par defaut.



## Observation  

### Providers

Pour que ça fonctionne, il faut avoir installé Claude Code (abonnement anthorpic), Codex (abonnement OpenAI), 
Gemini (Gratuit mais avec des limitations, ou abonnement Google AI) et Ollama (Gratuit en local ou abonnement cloud).

### Ollama

Ollama est dispinoble en version version local comme on utilise actuellement ou en version cloud !

### Roles des agents

Je veux avoir plus d'information à ce sujet : 
```
export type AgentRole =
  | "implementer"
  | "reviewer"
  | "architect"
  | "scout"
  | "critic"
  | "summarizer";
  ```

### Branches

Pour le developppement de ce projet, on peut creer plusieurs branches pour tester en locales ? le terminal utilisera la bonne branche ?

