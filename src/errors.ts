import type { AdapterFailureKind } from "./types.js";

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
      return "Teste la commande en dehors de Chicane et verifie que le prompt est bien lu via stdin ou argument.";
    case "non-zero-exit":
      return "Lis stderr ci-dessus, puis ajuste args, permissions, modele ou authentification de la CLI.";
    case "model-unavailable":
      return "Installe le modele Ollama ou relance avec --pull-models pour autoriser le telechargement.";
    case "model-pull-failed":
      return "Verifie le nom du modele, ta connexion et l'espace disque disponible.";
    case "http-error":
      return "Verifie que le service local est lance et que baseUrl est correct.";
    default:
      return undefined;
  }
}
