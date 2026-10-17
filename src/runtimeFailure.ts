/** @file Classification commune des erreurs runtime d'un appel agent, partagée par Débat, Ask, synthèse et Chat. */
import { AdapterError } from "./errors.js";
import type { Messages } from "./messages/index.js";
import { formatOllamaUrlError, OllamaUrlError } from "./ollamaUrl.js";
import type { AdapterFailureKind } from "./types.js";

/** Champs d'erreur indépendants de la phase : chaque mode y ajoute sa propre localisation. */
export interface ClassifiedRuntimeError {
  kind: AdapterFailureKind | "unknown";
  message: string;
  /** Agent nommé par l'adapter lui-même, à utiliser si l'appelant ne le connaît pas. */
  adapterName?: string;
  retryAfter?: number | string;
  details?: Record<string, unknown>;
}

/**
 * Convertit une erreur levée pendant un appel agent en champs stables pour les renderers.
 *
 * `AdapterError` conserve son `kind`, son délai de reprise et ses détails ; une adresse Ollama
 * invalide garde son message actionnable ; toute autre erreur devient `unknown`, sans jamais lever.
 */
export function classifyRuntimeError(error: unknown, messages: Messages): ClassifiedRuntimeError {
  if (error instanceof AdapterError) {
    return {
      kind: error.kind,
      message: error.message,
      adapterName: error.adapterName,
      retryAfter: retryAfterFromDetails(error.details),
      details: error.details
    };
  }

  if (error instanceof OllamaUrlError) {
    return { kind: "unknown", message: formatOllamaUrlError(error, messages) };
  }

  return { kind: "unknown", message: error instanceof Error ? error.message : String(error) };
}

/** Lit le délai de reprise structuré d'un adapter sans faire échouer un ancien adapter. */
function retryAfterFromDetails(details: Record<string, unknown> | undefined): number | string | undefined {
  const value = details?.retryAfter;
  return typeof value === "string" || (typeof value === "number" && Number.isFinite(value)) ? value : undefined;
}
