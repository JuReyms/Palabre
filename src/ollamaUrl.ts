/** @file Résolution et normalisation de l'URL du serveur Ollama, avec erreurs typées `OllamaUrlError`. */
import type { PalabreConfig } from "./types.js";

/** Serveur Ollama utilisé quand aucune autre source (flag, env, config) n'est fournie. */
export const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434";

/** Sources d'URL à combiner par ordre de priorité dans `resolveOllamaBaseUrl`. */
export interface OllamaUrlSources {
  cliUrl?: string;
  configUrl?: string;
  envUrl?: string;
}

/** Catégorie d'échec de validation d'une URL Ollama, utilisée par les appelants pour choisir un message localisé. */
export type OllamaUrlErrorKind = "empty" | "invalid" | "protocol";

/**
 * Erreur levée par `normalizeOllamaBaseUrl` quand la valeur fournie n'est pas une URL HTTP(S) exploitable.
 * Le message du constructeur est un texte technique de repli non localisé ; les appelants CLI/TUI
 * doivent reformater `kind`/`value`/`protocol` via les messages traduits plutôt que d'afficher ce message brut.
 */
export class OllamaUrlError extends Error {
  constructor(
    readonly kind: OllamaUrlErrorKind,
    readonly value: string,
    readonly protocol?: string
  ) {
    super(kind === "empty"
      ? "Invalid Ollama URL: the value is empty."
      : kind === "protocol"
        ? `Invalid Ollama URL protocol: ${protocol ?? ""}`
        : `Invalid Ollama URL: ${value}`);
    this.name = "OllamaUrlError";
  }
}

/**
 * Résout l'adresse client Ollama selon la priorité produit :
 * flag CLI > OLLAMA_HOST > config agent > serveur local par défaut.
 */
export function resolveOllamaBaseUrl(sources: OllamaUrlSources = {}): string {
  const value = firstNonEmpty(
    sources.cliUrl,
    sources.envUrl ?? process.env.OLLAMA_HOST,
    sources.configUrl,
    DEFAULT_OLLAMA_BASE_URL
  );

  return normalizeOllamaBaseUrl(value);
}

/** Normalise les formats acceptés par Ollama en URL HTTP(S) utilisable par fetch. */
export function normalizeOllamaBaseUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new OllamaUrlError("empty", value);
  }

  const withHost = trimmed.startsWith(":") ? `127.0.0.1${trimmed}` : trimmed;
  const hasExplicitScheme = withHost.includes("://");
  const withScheme = hasExplicitScheme ? withHost : `http://${withHost}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new OllamaUrlError("invalid", value);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new OllamaUrlError("protocol", value, url.protocol);
  }
  if (!url.hostname || url.username || url.password || url.search || url.hash) {
    throw new OllamaUrlError("invalid", value);
  }

  if (!hasExplicitScheme && !url.port) {
    url.port = "11434";
  }
  if (url.hostname === "0.0.0.0") {
    url.hostname = "127.0.0.1";
  } else if (url.hostname === "[::]") {
    url.hostname = "[::1]";
  }

  return url.toString().replace(/\/+$/, "");
}

/** Retourne l'URL configurée pour l'agent Ollama principal, puis le premier agent Ollama. */
export function configuredOllamaBaseUrl(config: PalabreConfig): string | undefined {
  const primary = config.agents["ollama-local"];
  if (primary?.type === "ollama" && primary.baseUrl) {
    return primary.baseUrl;
  }

  const configured = Object.values(config.agents).find((agent) => agent.type === "ollama" && agent.baseUrl);
  return configured?.type === "ollama" ? configured.baseUrl : undefined;
}

/** Retourne les URL configurées par nom d'agent Ollama. */
export function configuredOllamaTargets(config: PalabreConfig): Record<string, string | undefined> {
  return Object.fromEntries(
    Object.entries(config.agents)
      .filter(([, agent]) => agent.type === "ollama")
      .map(([name, agent]) => [name, agent.type === "ollama" ? agent.baseUrl : undefined])
  );
}

function firstNonEmpty(...values: Array<string | undefined>): string {
  return values.find((value) => Boolean(value?.trim())) ?? DEFAULT_OLLAMA_BASE_URL;
}
