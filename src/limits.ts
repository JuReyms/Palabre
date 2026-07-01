/** @file Limites produit sur le nombre de tours et d'agents `ask`, et parsing/validation de `--turns`. */
import { createTranslator } from "./i18n.js";
import type { Messages } from "./messages/index.js";

/** Nombre de tours par défaut quand `--turns` n'est pas fourni. */
export const DEFAULT_TURNS = 4;
/** Nombre maximal d'agents acceptés par `--agents` en mode `ask`. */
export const MAX_ASK_AGENTS = 4;
/** Borne haute produit pour `--turns`, au-delà considérée comme une erreur d'utilisation. */
export const MAX_TURNS = 20;

/** Convertit `value` en nombre et valide la plage [1, `MAX_TURNS`]. Lève une erreur si invalide. */
export function parseTurns(value: string | number | undefined, label = "--turns", messages = createTranslator("fr")): number {
  const parsed = typeof value === "number" ? value : Number(value ?? DEFAULT_TURNS);
  validateTurns(parsed, label, messages);
  return parsed;
}

/**
 * Variante pour les flags CLI : gère les types polymorphes retournés par les parsers d'arguments
 * (`boolean` pour un flag sans valeur, `string[]` si fourni plusieurs fois).
 * Lève une erreur si `value` est un booléen ou un tableau de longueur ≠ 1.
 */
export function parseTurnsFlag(
  value: string | string[] | boolean | number | undefined,
  fallback = DEFAULT_TURNS,
  label = "--turns",
  messages: Messages = createTranslator("fr")
): number {
  if (value === undefined) {
    return parseTurns(fallback, label, messages);
  }

  if (typeof value === "boolean") {
    throw new Error(messages.limits.expectsInteger(label, MAX_TURNS));
  }

  if (Array.isArray(value)) {
    if (value.length !== 1) {
      throw new Error(messages.limits.mustBeProvidedOnce(label));
    }

    return parseTurns(value[0], label, messages);
  }

  return parseTurns(value, label, messages);
}

/** Valide que `value` est un entier dans [1, `MAX_TURNS`]. Lève une erreur descriptive sinon. */
export function validateTurns(value: number, label = "--turns", messages = createTranslator("fr")): void {
  if (!Number.isInteger(value) || value < 1 || value > MAX_TURNS) {
    throw new Error(messages.limits.mustBeInteger(label, MAX_TURNS));
  }
}

/** Retourne `value` s'il est valide, sinon `DEFAULT_TURNS`. Silencieux : ne lève pas d'erreur. */
export function turnsOrDefault(value: number | undefined): number {
  if (value !== undefined && Number.isInteger(value) && value >= 1 && value <= MAX_TURNS) {
    return value;
  }

  return DEFAULT_TURNS;
}
