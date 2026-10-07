/**
 * @file Résolution de l'exécutable d'une CLI de session externe, sans shell (voir AGENTS.md,
 * section "Relay externe", décision D21).
 *
 * Le relay ne passe jamais par PowerShell ni par `cmd.exe` : avec Windows PowerShell 5.1, le shim
 * npm refuse l'argument `-`, retire les guillemets internes et remplace les caractères non ASCII
 * de stdin par `?`. Sous Windows, l'ordre est donc :
 * 1. exécutable natif (`.exe`, `.com`), y compris un alias d'exécution `WindowsApps` ;
 * 2. shim PowerShell npm de forme reconnue, **lu comme du texte** (jamais exécuté ni évalué) :
 *    l'interpréteur Node et le script du paquet sont alors lancés directement ;
 * 3. tout autre wrapper (`.cmd`, `.bat`, shim modifié ou ambigu) est refusé.
 * Ailleurs, la commande est résolue dans le PATH et lancée directement.
 */
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { resolveExecutablePath } from "../exec.js";
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

/** Lecture d'un shim npm : chemin relatif du script, ou raison du refus. */
export type NpmShimParse = { status: "recognized"; scriptRelativePath: string } | { status: "refused"; detail: string };

/** Un shim npm fait quelques centaines d'octets ; au-delà, ce n'est pas la forme reconnue. */
const MAX_SHIM_BYTES = 16 * 1024;
const SCRIPT_EXTENSIONS = new Set([".js", ".cjs", ".mjs"]);

/** Marqueur du chemin du script dans le modèle ; jamais présent dans un shim réel. */
const SCRIPT_SLOT = "\u0000SCRIPT\u0000";

/**
 * Modèle complet du shim PowerShell généré par npm (`cmd-shim`), relevé sur un shim installé par
 * npm sous Windows. Un shim n'est reconnu que s'il reproduit ces lignes **exactement**, dans cet
 * ordre. Seules variations permises : le chemin du script (identique aux quatre appels), les fins
 * de ligne (LF ou CRLF), les espaces en fin de ligne et les lignes vides finales. Toute instruction
 * ajoutée, retirée ou modifiée (affectation de `$args`, variable d'environnement, `Set-Location`,
 * `exit` anticipé, commentaire modifié…) rend le shim non reconnu.
 */
const NPM_SHIM_TEMPLATE: readonly string[] = [
  "#!/usr/bin/env pwsh",
  "$basedir=Split-Path $MyInvocation.MyCommand.Definition -Parent",
  "",
  "$exe=\"\"",
  "if ($PSVersionTable.PSVersion -lt \"6.0\" -or $IsWindows) {",
  "  # Fix case when both the Windows and Linux builds of Node",
  "  # are installed in the same directory",
  "  $exe=\".exe\"",
  "}",
  "$ret=0",
  "if (Test-Path \"$basedir/node$exe\") {",
  "  # Support pipeline input",
  "  if ($MyInvocation.ExpectingInput) {",
  `    $input | & "$basedir/node$exe"  "$basedir/${SCRIPT_SLOT}" $args`,
  "  } else {",
  `    & "$basedir/node$exe"  "$basedir/${SCRIPT_SLOT}" $args`,
  "  }",
  "  $ret=$LASTEXITCODE",
  "} else {",
  "  # Support pipeline input",
  "  if ($MyInvocation.ExpectingInput) {",
  `    $input | & "node$exe"  "$basedir/${SCRIPT_SLOT}" $args`,
  "  } else {",
  `    & "node$exe"  "$basedir/${SCRIPT_SLOT}" $args`,
  "  }",
  "  $ret=$LASTEXITCODE",
  "}",
  "exit $ret"
];

/** Ligne du modèle qui porte le premier appel, d'où le chemin du script est extrait. */
const FIRST_INVOCATION = /^ {4}\$input \| & "\$basedir\/node\$exe" {2}"\$basedir\/([^"]+)" \$args$/;

/**
 * Chemin de script admis : segments de paquet npm, séparés par `/`. Aucun caractère qui aurait
 * un sens dans une chaîne PowerShell entre guillemets doubles (`$`, accent grave, guillemet).
 */
const SCRIPT_PATH = /^[A-Za-z0-9@._+-]+(?:\/[A-Za-z0-9@._+-]+)*$/;

function isFile(file: string): boolean {
  try {
    return statSync(file).isFile();
  } catch {
    return false;
  }
}

/**
 * Reconnaît le shim PowerShell généré par npm en le comparant ligne à ligne au modèle complet
 * `NPM_SHIM_TEMPLATE`, avec le chemin de script extrait du premier appel. Fonction pure : le texte
 * n'est jamais exécuté ni évalué, et seule une copie conforme du modèle est acceptée.
 */
export function parseNpmPowerShellShim(text: string): NpmShimParse {
  if (Buffer.byteLength(text, "utf8") > MAX_SHIM_BYTES) return { status: "refused", detail: "shim trop volumineux pour la forme npm" };
  const lines = text.split(/\r?\n/).map((line) => line.replace(/[ \t]+$/, ""));
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  const invocationIndex = NPM_SHIM_TEMPLATE.findIndex((line) => line.includes(SCRIPT_SLOT));
  const script = FIRST_INVOCATION.exec(lines[invocationIndex] ?? "")?.[1];
  if (script === undefined || !SCRIPT_PATH.test(script)) return { status: "refused", detail: "forme de shim inconnue" };
  const expected = NPM_SHIM_TEMPLATE.map((line) => line.replace(SCRIPT_SLOT, script));
  if (lines.length !== expected.length || lines.some((line, index) => line !== expected[index])) {
    return { status: "refused", detail: "le shim diffère du modèle npm" };
  }
  return { status: "recognized", scriptRelativePath: script };
}

/**
 * Transforme un shim npm reconnu en exécutable direct : interpréteur Node (celui du dossier du
 * shim s'il existe, sinon `node.exe` du PATH, comme le shim) et script du paquet, qui doit être un
 * fichier JavaScript situé dans le dossier du shim.
 */
export function executableFromNpmShim(shimPath: string): ExecutableResolution {
  let text: string;
  try {
    if (statSync(shimPath).size > MAX_SHIM_BYTES) return { status: "unsupported-executable", detail: "shim trop volumineux pour la forme npm" };
    text = readFileSync(shimPath, "utf8");
  } catch {
    return { status: "unsupported-executable", detail: "shim illisible" };
  }
  const parsed = parseNpmPowerShellShim(text);
  if (parsed.status === "refused") return { status: "unsupported-executable", detail: parsed.detail };
  const basedir = path.dirname(path.resolve(shimPath));
  const script = path.resolve(basedir, parsed.scriptRelativePath);
  const relative = path.relative(basedir, script);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return { status: "unsupported-executable", detail: "script hors du dossier du shim" };
  if (!SCRIPT_EXTENSIONS.has(path.extname(script).toLowerCase())) return { status: "unsupported-executable", detail: "le shim ne désigne pas un script JavaScript" };
  if (!isFile(script)) return { status: "command-not-found", detail: "script du paquet introuvable" };
  const localNode = path.join(basedir, "node.exe");
  const interpreter = isFile(localNode) ? localNode : resolveExecutablePath("node.exe", [""]);
  if (!interpreter || !isFile(interpreter)) return { status: "command-not-found", detail: "interpréteur Node introuvable" };
  return { status: "resolved", executable: { command: interpreter, prefixArgs: [script] }, kind: "npm-shim" };
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
