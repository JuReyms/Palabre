import type { Language } from "../types.js";

export interface CommonMessages {
  invalidLanguage(source: string, value: string, supported: readonly string[]): string;
}

export const commonMessages: Record<Language, CommonMessages> = {
  fr: {
    invalidLanguage: (source, value, supported) => `${source} invalide: ${value}. Valeurs supportées: ${supported.join(", ")}.`
  },
  en: {
    invalidLanguage: (source, value, supported) => `Invalid ${source}: ${value}. Supported values: ${supported.join(", ")}.`
  }
};
