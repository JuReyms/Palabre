import type { AdapterFailureKind, Language } from "../types.js";

export interface AdapterErrorMessages {
  suggestionPrefix: string;
  hint(kind: AdapterFailureKind): string | undefined;
  /** Message `usage-limit` : quota/rate-limit détecté dans le stderr d'une CLI. */
  usageLimit(adapterName: string, detail: string): string;
  /** Message `unsupported-model` : modèle refusé par la CLI de l'agent. */
  unsupportedModel(adapterName: string, detail: string): string;
  /** Repli du résumé d'erreur CLI quand le process n'a rien écrit sur stderr. */
  noStderrCaptured: string;
  /** Repli du résumé d'erreur PTY quand le flux fusionné est vide. */
  noPtyOutputCaptured: string;
  /** Message `model-unavailable` : modèle Ollama absent et pull non autorisé. */
  ollamaModelUnavailable(model: string, installedModels: string[]): string;
  /** Message `model-pull-failed` : le modèle manque toujours après un pull réussi. */
  ollamaModelStillUnavailable(model: string): string;
  /** Ligne de progression écrite sur stderr avant un pull automatique. */
  ollamaPullProgress(model: string): string;
  /** Message `model-pull-failed` : le pull lui-même a échoué. */
  ollamaPullFailed(model: string, detail: string): string;
  /** Message `http-error` sur `GET /api/tags`. */
  ollamaTagsHttpError(status: number): string;
  /** Message `http-error` sur `GET /api/ps`. */
  ollamaPsHttpError(status: number): string;
  /** Message `http-error` quand le déchargement d'un modèle tiers échoue. */
  ollamaUnloadFailed(model: string, status: number): string;
}

const frHints: Partial<Record<AdapterFailureKind, string>> = {
  "command-not-found": "Verifie que la CLI est installee, authentifiee et disponible dans le PATH.",
  "spawn-failed": "Sur Windows, essaye le wrapper .cmd ou active \"shell\": true dans la config agent.",
  timeout: "Augmente timeoutMs ou teste la commande directement dans le terminal.",
  "idle-timeout": "Desactive idleTimeoutMs pour les CLIs IA qui restent silencieuses pendant la generation.",
  "output-too-large": "Reduis le contexte, le nombre de tours ou configure maxOutputBytes pour cet agent si ce volume est attendu.",
  "empty-output": "Teste la commande en dehors de Palabre et verifie que le prompt est bien lu via stdin ou argument.",
  "usage-limit": "Attends la fenetre indiquee par la CLI, change de modele ou relance avec un autre agent/preset disponible.",
  "non-zero-exit": "Teste la commande directement, puis ajuste args, permissions, modele ou authentification de la CLI.",
  "model-unavailable": "Installe le modele Ollama ou relance avec --pull-models pour autoriser le telechargement.",
  "unsupported-model": "Mets a jour la CLI de l'agent, verifie le nom du modele et ton abonnement, ou retire --model-a/--model-b/--summary-model pour laisser la CLI utiliser son modele par defaut.",
  "model-pull-failed": "Verifie le nom du modele, ta connexion et l'espace disque disponible.",
  "http-error": "Verifie que le service local est lance et que baseUrl est correct."
};

const enHints: Partial<Record<AdapterFailureKind, string>> = {
  "command-not-found": "Check that the CLI is installed, authenticated, and available in PATH.",
  "spawn-failed": "On Windows, try the .cmd wrapper or enable \"shell\": true in the agent config.",
  timeout: "Increase timeoutMs or test the command directly in the terminal.",
  "idle-timeout": "Disable idleTimeoutMs for AI CLIs that stay silent while generating.",
  "output-too-large": "Reduce context, turn count, or configure maxOutputBytes for this agent if this volume is expected.",
  "empty-output": "Test the command outside Palabre and check that the prompt is read through stdin or an argument.",
  "usage-limit": "Wait for the window indicated by the CLI, change model, or run again with another available agent/preset.",
  "non-zero-exit": "Test the command directly, then adjust args, permissions, model, or CLI authentication.",
  "model-unavailable": "Install the Ollama model or run again with --pull-models to allow downloading.",
  "unsupported-model": "Update the agent CLI, check the model name and your subscription, or remove --model-a/--model-b/--summary-model so the CLI can use its default model.",
  "model-pull-failed": "Check the model name, your connection, and available disk space.",
  "http-error": "Check that the local service is running and baseUrl is correct."
};

export const adapterErrorMessages: Record<Language, AdapterErrorMessages> = {
  fr: {
    suggestionPrefix: "Suggestion",
    hint: (kind) => frHints[kind],
    usageLimit: (adapterName, detail) => `${adapterName} a atteint une limite d'utilisation: ${detail}`,
    unsupportedModel: (adapterName, detail) => `${adapterName} ne peut pas utiliser ce modèle: ${detail}`,
    noStderrCaptured: "aucun stderr capturé.",
    noPtyOutputCaptured: "aucune sortie PTY capturée.",
    ollamaModelUnavailable: (model, installedModels) =>
      `Modèle Ollama indisponible: ${model}. Modèles détectés: ${installedModels.join(", ") || "aucun"}. ` +
      "Utilise --pull-models ou autoPullModel: true pour autoriser le téléchargement.",
    ollamaModelStillUnavailable: (model) => `Le modèle Ollama ${model} reste indisponible après téléchargement.`,
    ollamaPullProgress: (model) => `[ollama] Modèle absent, téléchargement: ${model}`,
    ollamaPullFailed: (model, detail) => `Échec du téléchargement Ollama ${model}: ${detail}`,
    ollamaTagsHttpError: (status) => `Ollama HTTP ${status} pendant la détection des modèles`,
    ollamaPsHttpError: (status) => `Ollama HTTP ${status} pendant la détection des modèles chargés`,
    ollamaUnloadFailed: (model, status) => `Impossible de décharger le modèle Ollama ${model}: HTTP ${status}`
  },
  en: {
    suggestionPrefix: "Suggestion",
    hint: (kind) => enHints[kind],
    usageLimit: (adapterName, detail) => `${adapterName} hit a usage limit: ${detail}`,
    unsupportedModel: (adapterName, detail) => `${adapterName} cannot use this model: ${detail}`,
    noStderrCaptured: "no stderr captured.",
    noPtyOutputCaptured: "no PTY output captured.",
    ollamaModelUnavailable: (model, installedModels) =>
      `Ollama model unavailable: ${model}. Detected models: ${installedModels.join(", ") || "none"}. ` +
      "Use --pull-models or autoPullModel: true to allow downloading.",
    ollamaModelStillUnavailable: (model) => `Ollama model ${model} is still unavailable after downloading.`,
    ollamaPullProgress: (model) => `[ollama] Model missing, downloading: ${model}`,
    ollamaPullFailed: (model, detail) => `Ollama download failed for ${model}: ${detail}`,
    ollamaTagsHttpError: (status) => `Ollama HTTP ${status} while detecting models`,
    ollamaPsHttpError: (status) => `Ollama HTTP ${status} while detecting loaded models`,
    ollamaUnloadFailed: (model, status) => `Failed to unload Ollama model ${model}: HTTP ${status}`
  }
};
