import type { Language } from "../types.js";

export interface LimitsMessages {
  expectsInteger(label: string, maxTurns: number): string;
  mustBeProvidedOnce(label: string): string;
  mustBeInteger(label: string, maxTurns: number): string;
}

export const limitsMessages: Record<Language, LimitsMessages> = {
  fr: {
    expectsInteger: (label, maxTurns) => `${label} attend un nombre entier entre 1 et ${maxTurns}.`,
    mustBeProvidedOnce: (label) => `${label} doit être fourni une seule fois.`,
    mustBeInteger: (label, maxTurns) => `${label} doit être un nombre entier entre 1 et ${maxTurns}.`
  },
  en: {
    expectsInteger: (label, maxTurns) => `${label} expects an integer between 1 and ${maxTurns}.`,
    mustBeProvidedOnce: (label) => `${label} must be provided only once.`,
    mustBeInteger: (label, maxTurns) => `${label} must be an integer between 1 and ${maxTurns}.`
  }
};
