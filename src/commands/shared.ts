export type CommandFlags = Record<string, string | string[] | boolean>;

/** Extrait une chaîne non vide depuis une valeur de flag. */
export function optionalString(value: string | string[] | boolean | undefined): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}
