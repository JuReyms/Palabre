/** @file Types et utilitaires partages par les commandes CLI extraites. */
/** Valeurs de flags normalisées par le parseur avant dispatch vers une commande. */
export type CommandFlags = Record<string, string | string[] | boolean>;

/**
 * Extrait une chaîne non vide depuis une valeur de flag.
 * @param value - Valeur brute produite par le parseur CLI.
 * @returns La chaîne non vide, sinon `undefined`.
 */
export function optionalString(value: string | string[] | boolean | undefined): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}
