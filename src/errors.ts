import type { AdapterFailureKind } from "./types.js";
import { createTranslator } from "./i18n.js";
import type { Messages } from "./messages/index.js";

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
export function formatAdapterError(error: AdapterError, messages: Messages = createTranslator("fr")): string {
  const hint = messages.adapterErrors.hint(error.kind);
  return hint ? `${error.message}\n${messages.adapterErrors.suggestionPrefix}: ${hint}` : error.message;
}
