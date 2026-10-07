/**
 * @file Reconnaissance stricte du shim PowerShell généré par npm, partagée par Relay et les
 * adapters CLI/PTY (#98).
 *
 * Avec Windows PowerShell 5.1, lancer ce shim refuse l'argument `-`, retire les guillemets internes
 * des arguments et remplace les caractères non ASCII de stdin par `?`. Quand le shim reproduit
 * exactement le modèle npm, Palabre lance donc directement l'interpréteur Node et le script du
 * paquet, comme le ferait le shim, sans passer par PowerShell. Le shim est **lu comme du texte**,
 * jamais exécuté ni évalué.
 */
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { resolveExecutablePath, resolvePowerShellShim } from "./exec.js";

/** Lecture d'un shim npm : chemin relatif du script, ou raison du refus. */
export type NpmShimParse = { status: "recognized"; scriptRelativePath: string } | { status: "refused"; detail: string };

/**
 * Lancement direct d'un shim npm :
 * - `resolved` : interpréteur Node et script du paquet, à lancer sans shell ;
 * - `unsupported` : shim illisible ou d'une autre forme que le modèle npm (pnpm, shim modifié…) ;
 * - `missing` : shim reconnu, mais script du paquet ou interpréteur Node introuvable.
 */
export type NpmShimLaunch =
  | { status: "resolved"; command: string; prefixArgs: string[] }
  | { status: "unsupported"; detail: string }
  | { status: "missing"; detail: string };

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
 * Transforme un shim npm reconnu en lancement direct : interpréteur Node (celui du dossier du
 * shim s'il existe, sinon `node.exe` du PATH, comme le shim) et script du paquet, qui doit être un
 * fichier JavaScript situé dans le dossier du shim.
 */
export function npmShimLaunch(shimPath: string): NpmShimLaunch {
  let text: string;
  try {
    if (statSync(shimPath).size > MAX_SHIM_BYTES) return { status: "unsupported", detail: "shim trop volumineux pour la forme npm" };
    text = readFileSync(shimPath, "utf8");
  } catch {
    return { status: "unsupported", detail: "shim illisible" };
  }
  const parsed = parseNpmPowerShellShim(text);
  if (parsed.status === "refused") return { status: "unsupported", detail: parsed.detail };
  const basedir = path.dirname(path.resolve(shimPath));
  const script = path.resolve(basedir, parsed.scriptRelativePath);
  const relative = path.relative(basedir, script);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return { status: "unsupported", detail: "script hors du dossier du shim" };
  if (!SCRIPT_EXTENSIONS.has(path.extname(script).toLowerCase())) return { status: "unsupported", detail: "le shim ne désigne pas un script JavaScript" };
  if (!isFile(script)) return { status: "missing", detail: "script du paquet introuvable" };
  const localNode = path.join(basedir, "node.exe");
  const interpreter = isFile(localNode) ? localNode : resolveExecutablePath("node.exe", [""]);
  if (!interpreter || !isFile(interpreter)) return { status: "missing", detail: "interpréteur Node introuvable" };
  return { status: "resolved", command: interpreter, prefixArgs: [script] };
}

/** Marqueur de l'exécutable cible dans le modèle natif ; jamais présent dans un shim réel. */
const TARGET_SLOT = "\u0000TARGET\u0000";

/**
 * Variante du shim npm pour un paquet dont le binaire est un exécutable natif (par exemple
 * `opencode-ai`) : pas d'interpréteur Node, appel direct de l'exécutable du paquet. Mêmes règles
 * de reconnaissance que `NPM_SHIM_TEMPLATE` : copie conforme ligne à ligne, seule la cible varie.
 */
const NPM_NATIVE_SHIM_TEMPLATE: readonly string[] = [
  "#!/usr/bin/env pwsh",
  "$basedir=Split-Path $MyInvocation.MyCommand.Definition -Parent",
  "",
  "$exe=\"\"",
  "if ($PSVersionTable.PSVersion -lt \"6.0\" -or $IsWindows) {",
  "  # Fix case when both the Windows and Linux builds of Node",
  "  # are installed in the same directory",
  "  $exe=\".exe\"",
  "}",
  "# Support pipeline input",
  "if ($MyInvocation.ExpectingInput) {",
  `  $input | & "$basedir/${TARGET_SLOT}"   $args`,
  "} else {",
  `  & "$basedir/${TARGET_SLOT}"   $args`,
  "}",
  "exit $LASTEXITCODE"
];

const FIRST_NATIVE_INVOCATION = /^ {2}\$input \| & "\$basedir\/([^"]+)" {3}\$args$/;
const NATIVE_EXTENSIONS = new Set([".exe", ".com"]);

/**
 * Reconnaît la variante native du shim npm (voir `NPM_NATIVE_SHIM_TEMPLATE`) et en extrait la cible.
 * Fonction pure, sans exécution ni évaluation du texte.
 */
export function parseNpmNativePowerShellShim(text: string): { status: "recognized"; targetRelativePath: string } | { status: "refused"; detail: string } {
  if (Buffer.byteLength(text, "utf8") > MAX_SHIM_BYTES) return { status: "refused", detail: "shim trop volumineux pour la forme npm" };
  const lines = text.split(/\r?\n/).map((line) => line.replace(/[ \t]+$/, ""));
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  const invocationIndex = NPM_NATIVE_SHIM_TEMPLATE.findIndex((line) => line.includes(TARGET_SLOT));
  const target = FIRST_NATIVE_INVOCATION.exec(lines[invocationIndex] ?? "")?.[1];
  if (target === undefined || !SCRIPT_PATH.test(target)) return { status: "refused", detail: "forme de shim inconnue" };
  const expected = NPM_NATIVE_SHIM_TEMPLATE.map((line) => line.replace(TARGET_SLOT, target));
  if (lines.length !== expected.length || lines.some((line, index) => line !== expected[index])) {
    return { status: "refused", detail: "le shim diffère du modèle npm" };
  }
  return { status: "recognized", targetRelativePath: target };
}

/** Lancement direct de la variante native : l'exécutable du paquet, situé dans le dossier du shim. */
export function npmNativeShimLaunch(shimPath: string): NpmShimLaunch {
  let text: string;
  try {
    if (statSync(shimPath).size > MAX_SHIM_BYTES) return { status: "unsupported", detail: "shim trop volumineux pour la forme npm" };
    text = readFileSync(shimPath, "utf8");
  } catch {
    return { status: "unsupported", detail: "shim illisible" };
  }
  const parsed = parseNpmNativePowerShellShim(text);
  if (parsed.status === "refused") return { status: "unsupported", detail: parsed.detail };
  const basedir = path.dirname(path.resolve(shimPath));
  const target = path.resolve(basedir, parsed.targetRelativePath);
  const relative = path.relative(basedir, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return { status: "unsupported", detail: "exécutable hors du dossier du shim" };
  if (!NATIVE_EXTENSIONS.has(path.extname(target).toLowerCase())) return { status: "unsupported", detail: "le shim ne désigne pas un exécutable natif" };
  if (!isFile(target)) return { status: "missing", detail: "exécutable du paquet introuvable" };
  return { status: "resolved", command: target, prefixArgs: [] };
}

/**
 * Lancement direct d'une commande d'agent via son shim npm frère (`codex` → `codex.ps1`) : forme
 * Node + script, puis variante native. `undefined` si aucun shim npm reconnu et complet n'existe.
 * Utilisé par les adapters CLI/PTY sous Windows avant tout repli sur PowerShell. Relay n'accepte
 * que la forme Node + script (décision D21).
 */
export function directNpmShimLaunch(command: string): { command: string; prefixArgs: string[] } | undefined {
  const shim = resolvePowerShellShim(command);
  if (!shim) return undefined;
  for (const launch of [npmShimLaunch(shim), npmNativeShimLaunch(shim)]) {
    if (launch.status === "resolved") return { command: launch.command, prefixArgs: launch.prefixArgs };
  }
  return undefined;
}
