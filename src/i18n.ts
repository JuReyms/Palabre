import type { Language } from "./types.js";
import { createTranslator } from "./messages/index.js";

export const DEFAULT_LANGUAGE: Language = "fr";
export const SUPPORTED_LANGUAGES = ["fr", "en"] as const;

interface ResolveLanguageOptions {
  explicitLanguage?: string;
  configLanguage?: string;
  env?: NodeJS.ProcessEnv;
}

/**
 * Valide une langue Palabre.
 * Le contrat reste volontairement strict tant que l'interface ne supporte que
 * le français et l'anglais.
 */
export function parseLanguage(value: string | undefined, source = "language"): Language | undefined {
  const normalized = value?.trim().toLowerCase();

  if (!normalized) {
    return undefined;
  }

  if ((SUPPORTED_LANGUAGES as readonly string[]).includes(normalized)) {
    return normalized as Language;
  }

  throw new Error(createTranslator(DEFAULT_LANGUAGE).common.invalidLanguage(source, value ?? "", SUPPORTED_LANGUAGES));
}

/**
 * Résout la langue de l'interface selon la précédence :
 * flag CLI explicite -> `PALABRE_LANGUAGE` -> config -> français.
 */
export function resolveLanguage(options: ResolveLanguageOptions = {}): Language {
  const env = options.env ?? process.env;

  return parseLanguage(options.explicitLanguage, "--language")
    ?? parseLanguage(env.PALABRE_LANGUAGE, "PALABRE_LANGUAGE")
    ?? parseLanguage(options.configLanguage, "config.language")
    ?? DEFAULT_LANGUAGE;
}

export { createTranslator };
