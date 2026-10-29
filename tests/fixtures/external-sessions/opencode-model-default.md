# Provenance des cas default de modèle

Cas synthétiques, sans compte ni appel réel. Sources officielles anomalyco/opencode
v2.0.32, commit `843a6c514e606b436a7fe713422ace0a93ad3d61` :

- `packages/core/src/session/runner/model.ts`, `SessionRunnerModel.resolve` transmet
  `session.model.variant` à `resolver.resolveModel` sans normaliser `default`.
- `packages/core/src/model-resolver.ts`, `withVariant` transforme `default` en absence
  uniquement pour les options de requête ; `ModelResolver.resolveModel` conserve
  l'argument `variant` dans `ref`, y compris la chaîne `default`.
- `packages/core/src/session/runner/{llm,step,publish-llm-event}.ts` transmettent cette
  référence jusqu'à `SessionEvent.Step.Started.model` ; `session/message-updater.ts`
  la recopie dans le modèle de l'assistant.

La référence fictive `{providerID: "fake", id: "other", variant: "default"}` respecte
ce chemin. `model-variant-lost` supprime volontairement la variante de l'assistant :
ce n'est pas une forme réelle qualifiée, elle doit être refusée sans effacer la
preuve du message ni relancer. `model-duplicate` fournit volontairement deux entrées
de catalogue de même identité et doit arrêter avant la sélection et le prompt.

La source sans modèle doit arrêter avant fork/sélection, même avec `--model` :
le repli `previous ?? getModel()` n'est donc pas emprunté dans ce parcours.
L'essai réel documenté utilise `#low` : ces cas ne prouvent pas un essai réel sans `#`.
