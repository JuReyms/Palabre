# Notes personnelles sur Chicane

Ce fichier est reserve aux idees personnelles du mainteneur.

## Idees a explorer

- Gestion de l'historique des conversations.
- Afficher le modele utilise quand Chicane peut le connaitre.
- Version anglaise et francaise. Lors de l'installation, choisir la langue.
- Ajouter LM Studio via un provider compatible OpenAI local.
- Creer un role/config dedie `summarizer` pour eviter que `agentB` soit toujours le synthétiseur par defaut.



## Observation  

### Context et files
- Verifier si JSDOC est bon sur les fichiers modifié.


### Erreur de limite d'utilisation de Codex
- Quand notre session codex a atteint sa limite, le message d'erreur n'est pas  clair. Exemple :

```
chicane --topic "quel jour sommes nous ?" --turns 4

┌─ Chicane ───────────────────────────────────────────────
│ Sujet: quel jour sommes nous ?
│ Agents: codex <-> claude
│ Tours: 4 | Synthese: claude
└─────────────────────────────────────────────────────────

◆ codex · implementer · tour 1/4
────────────────────────────────────────────────────────────
Erreur: codex exited with code 1: OpenAI Codex v0.125.0 (research preview)
--------
workdir: C:\Users\jurey\Documents\Dev\Chicane
model: gpt-5.5
provider: openai
approval: never
sandbox: read-only
reasoning effort: high
reasoning summaries: none
session id: 019defda-f4e3-7a31-9cb6-6be884fe3b74
--------
user
Sujet: quel jour sommes nous ?
Tu es codex. Tu reponds au tour 1.
Ton interlocuteur est claude.
Contexte de session Chicane:
- Source: fourni par Chicane et visible par tous les agents de ce debat.
- Date locale: 2026-05-03
- Fuseau horaire: Europe/Paris
- Dossier courant: C:\Users\jurey\Documents\Dev\Chicane
- Session demarree a: 2026-05-03T21:59:56.710Z
Objectif:
- Apporte une reponse utile, concrete et courte.
- Reagis aux arguments precedents au lieu de repartir de zero.
- Signale les incertitudes ou les points a trancher.
Historique: aucun message pour le moment.
Ta reponse:
2026-05-03T21:59:57.652060Z ERROR rmcp::transport::worker: worker quit with fatal: Transport channel closed, when AuthRequired(AuthRequiredError { www_authenticate_header: "Bearer realm=\"OAuth\", resource_metadata=\"https://mcp.linear.app/.well-known/oauth-protected-resource\", error=\"invalid_token\", error_description=\"Missing or invalid access token\"" })
ERROR: You've hit your usage limit. Upgrade to Pro (https://chatgpt.com/explore/pro), visit https://chatgpt.com/codex/settings/usage to purchase more credits or try again at May 4th, 2026 3:38 AM.
ERROR: You've hit your usage limit. Upgrade to Pro (https://chatgpt.com/explore/pro), visit https://chatgpt.com/codex/settings/usage to purchase more credits or try again at May 4th, 2026 3:38 AM.
2026-05-03T21:59:59.563824Z ERROR codex_core::session: failed to record rollout items: thread 019defda-f4e3-7a31-9cb6-6be884fe3b74 not found
Suggestion: Lis stderr ci-dessus, puis ajuste args, permissions, modele ou authentification de la CLI.

```

Il faudrait aussi verifier pour gemini et claude.


### Commande de lancement
- Pour lancer un débat, c'est domage de devoir spécifier la commande ``--preset`` et ``--topic``.
Exemple : 
`` chicane --preset claude-gemini --topic "quel jour sommes nous ?" --turns 4`` 

Si on peut simplifier : 
`` chicane claude-gemini "quel jour sommes nous ?" --t 4``