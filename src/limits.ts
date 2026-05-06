export const DEFAULT_TURNS = 4;
export const MAX_TURNS = 20;

/** Convertit `value` en nombre et valide la plage [1, `MAX_TURNS`]. Lève une erreur si invalide. */
export function parseTurns(value: string | number | undefined, label = "--turns"): number {
  const parsed = typeof value === "number" ? value : Number(value ?? DEFAULT_TURNS);
  validateTurns(parsed, label);
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
  label = "--turns"
): number {
  if (value === undefined) {
    return parseTurns(fallback, label);
  }

  if (typeof value === "boolean") {
    throw new Error(`${label} attend un nombre entier entre 1 et ${MAX_TURNS}.`);
  }

  if (Array.isArray(value)) {
    if (value.length !== 1) {
      throw new Error(`${label} doit être fourni une seule fois.`);
    }

    return parseTurns(value[0], label);
  }

  return parseTurns(value, label);
}

/** Valide que `value` est un entier dans [1, `MAX_TURNS`]. Lève une erreur descriptive sinon. */
export function validateTurns(value: number, label = "--turns"): void {
  if (!Number.isInteger(value) || value < 1 || value > MAX_TURNS) {
    throw new Error(`${label} doit être un nombre entier entre 1 et ${MAX_TURNS}.`);
  }
}

/** Retourne `value` s'il est valide, sinon `DEFAULT_TURNS`. Silencieux : ne lève pas d'erreur. */
export function turnsOrDefault(value: number | undefined): number {
  if (value !== undefined && Number.isInteger(value) && value >= 1 && value <= MAX_TURNS) {
    return value;
  }

  return DEFAULT_TURNS;
}
