/**
 * @file Résolution de l'exécutable d'une CLI de session externe, sans shell (voir AGENTS.md,
 * section "Relay externe", décision D21).
 *
 * Le relay ne passe jamais par PowerShell ni par `cmd.exe` : avec Windows PowerShell 5.1, le shim
 * npm refuse l'argument `-`, retire les guillemets internes et remplace les caractères non ASCII
 * de stdin par `?`. Sous Windows, l'ordre est donc :
 * 1. exécutable natif (`.exe`, `.com`), y compris un alias d'exécution `WindowsApps` ;
 * 2. shim PowerShell npm de forme reconnue, **lu comme du texte** (jamais exécuté ni évalué) :
 *    l'interpréteur Node et le script du paquet sont alors lancés directement. La reconnaissance
 *    est partagée avec les adapters CLI/PTY (`src/npmShim.ts`) ;
 * 3. tout autre wrapper (`.cmd`, `.bat`, shim modifié ou ambigu) est refusé.
 * Ailleurs, la commande est résolue dans le PATH et lancée directement.
 */
import { statSync } from "node:fs";
import path from "node:path";
import { resolveExecutablePath } from "../exec.js";
import { npmShimLaunch } from "../npmShim.js";
import type { ExternalExecutable } from "./adapter.js";

/**
 * Résolution :
 * - `resolved` : exécutable lançable sans shell, natif ou via le script d'un shim npm ;
 * - `command-not-found` : rien de trouvé ;
 * - `unsupported-executable` : trouvé, mais seulement sous une forme que le relay refuse de lancer.
 */
export type ExecutableResolution =
  | { status: "resolved"; executable: ExternalExecutable; kind: "native" | "npm-shim" }
  | { status: "command-not-found"; detail: string }
  | { status: "unsupported-executable"; detail: string };

export { parseNpmPowerShellShim, type NpmShimParse } from "../npmShim.js";

function isFile(file: string): boolean {
  try {
    return statSync(file).isFile();
  } catch {
    return false;
  }
}

/**
 * Transforme un shim npm reconnu en exécutable direct (voir `npmShimLaunch`) : interpréteur Node
 * et script du paquet. Un shim d'une autre forme est refusé ; un script ou un interpréteur absent
 * donne `command-not-found`.
 */
export function executableFromNpmShim(shimPath: string): ExecutableResolution {
  const launch = npmShimLaunch(shimPath);
  if (launch.status === "unsupported") return { status: "unsupported-executable", detail: launch.detail };
  if (launch.status === "missing") return { status: "command-not-found", detail: launch.detail };
  return { status: "resolved", executable: { command: launch.command, prefixArgs: launch.prefixArgs }, kind: "npm-shim" };
}

/** Variantes Windows d'une commande, dans l'ordre de préférence au sein d'un même dossier. */
const WINDOWS_CANDIDATE_EXTENSIONS = [".exe", ".com", ".ps1", ".cmd", ".bat", ""];

function resolveWindows(command: string): ExecutableResolution {
  const explicit = path.isAbsolute(command) || command.includes("/") || command.includes("\\");
  const extension = path.extname(command).toLowerCase();
  let found: string | undefined;
  if (explicit) {
    const candidates = extension ? [command] : WINDOWS_CANDIDATE_EXTENSIONS.map((candidate) => `${command}${candidate}`);
    found = candidates.find(isFile);
  } else {
    found = resolveExecutablePath(command, extension ? [""] : WINDOWS_CANDIDATE_EXTENSIONS);
  }
  if (!found) return { status: "command-not-found", detail: "commande introuvable" };

  const foundExtension = path.extname(found).toLowerCase();
  if (foundExtension === ".exe" || foundExtension === ".com") {
    return { status: "resolved", executable: { command: found, prefixArgs: [] }, kind: "native" };
  }
  // `.ps1`, wrapper `.cmd`/`.bat` ou script sans extension : seul un shim npm voisin est accepté.
  const shim = foundExtension === ".ps1" ? found : `${found.slice(0, found.length - foundExtension.length)}.ps1`;
  if (isFile(shim)) return executableFromNpmShim(shim);
  return { status: "unsupported-executable", detail: "wrapper non pris en charge (ni exécutable natif, ni shim npm)" };
}

/**
 * Résout la commande d'un agent en exécutable lançable sans shell. Ne lance et n'évalue rien.
 */
export function resolveExternalExecutable(command: string): ExecutableResolution {
  if (command.trim() === "") return { status: "command-not-found", detail: "commande vide" };
  if (process.platform === "win32") return resolveWindows(command);
  const resolved = resolveExecutablePath(command, [""]);
  return resolved && isFile(resolved)
    ? { status: "resolved", executable: { command: resolved, prefixArgs: [] }, kind: "native" }
    : { status: "command-not-found", detail: "commande introuvable" };
}
