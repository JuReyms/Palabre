import type { AdapterFailureKind } from "./types.js";

/**
 * Erreur typée levée par les adapters.
 * `kind` est stable et utilisé par l'orchestrateur pour classifier l'échec sans inspecter le message.
 */
export class AdapterError extends Error {
  constructor(
    readonly kind: AdapterFailureKind,
    readonly adapterName: string,
    message: string,
    readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AdapterError";
  }
}

/** Formate le message d'erreur avec une suggestion actionnable selon `error.kind`. */
export function formatAdapterError(error: AdapterError): string {
  const hint = hintForFailure(error.kind);
  return hint ? `${error.message}\nSuggestion: ${hint}` : error.message;
}

function hintForFailure(kind: AdapterFailureKind): string | undefined {
  switch (kind) {
    case "command-not-found":
      return "Verifie que la CLI est installee, authentifiee et disponible dans le PATH.";
    case "spawn-failed":
      return "Sur Windows, essaye le wrapper .cmd ou active \"shell\": true dans la config agent.";
    case "timeout":
      return "Augmente timeoutMs ou teste la commande directement dans le terminal.";
    case "idle-timeout":
      return "Desactive idleTimeoutMs pour les CLIs IA qui restent silencieuses pendant la generation.";
    case "empty-output":
      return "Teste la commande en dehors de Palabre et verifie que le prompt est bien lu via stdin ou argument.";
    case "usage-limit":
      return "Attends la fenetre indiquee par la CLI, change de modele ou relance avec un autre agent/preset disponible.";
    case "non-zero-exit":
      return "Teste la commande directement, puis ajuste args, permissions, modele ou authentification de la CLI.";
    case "model-unavailable":
      return "Installe le modele Ollama ou relance avec --pull-models pour autoriser le telechargement.";
    case "unsupported-model":
      return "Verifie le nom du modele, ton abonnement, ou retire --model-a/--model-b/--summary-model pour laisser la CLI utiliser son modele par defaut.";
    case "model-pull-failed":
      return "Verifie le nom du modele, ta connexion et l'espace disque disponible.";
    case "http-error":
      return "Verifie que le service local est lance et que baseUrl est correct.";
    default:
      return undefined;
  }
}
