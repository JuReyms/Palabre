import type { AdapterFailureKind, Language } from "../types.js";

export interface AdapterErrorMessages {
  suggestionPrefix: string;
  hint(kind: AdapterFailureKind): string | undefined;
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
  "unsupported-model": "Verifie le nom du modele, ton abonnement, ou retire --model-a/--model-b/--summary-model pour laisser la CLI utiliser son modele par defaut.",
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
  "unsupported-model": "Check the model name, your subscription, or remove --model-a/--model-b/--summary-model so the CLI can use its default model.",
  "model-pull-failed": "Check the model name, your connection, and available disk space.",
  "http-error": "Check that the local service is running and baseUrl is correct."
};

export const adapterErrorMessages: Record<Language, AdapterErrorMessages> = {
  fr: {
    suggestionPrefix: "Suggestion",
    hint: (kind) => frHints[kind]
  },
  en: {
    suggestionPrefix: "Suggestion",
    hint: (kind) => enHints[kind]
  }
};
