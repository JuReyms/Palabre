/** @file Résolution d'extensions exécutables partagée entre discovery et l'adapter PTY. */
import path from "node:path";

/**
 * Extensions exécutables candidates pour résoudre une commande dans le PATH.
 *
 * Retourne `[""]` quand la commande porte déjà une extension ou hors Windows.
 * Sur Windows sans extension, dérive la liste de `PATHEXT` et ajoute `.ps1`
 * ainsi que la candidate vide (binaire sans extension).
 */
export function executableExtensions(command: string): string[] {
  if (path.extname(command) || process.platform !== "win32") {
    return [""];
  }

  return (process.env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD")
    .split(";")
    .map((extension) => extension.toLowerCase())
    .concat(".ps1", "");
}
