/** @file Vérification bornée de la commande Palabre réellement résolue après installation, sans réinstallation. */
import { open } from "node:fs/promises";
import path from "node:path";
import { resolveExecutablePath } from "./exec.js";
import { directNpmShimLaunch, withShimNodePath, type DirectShimLaunch } from "./npmShim.js";
import { runExternalProcess } from "./externalSessions/process.js";
import type { UpdateInfo } from "./update.js";

/** Observation de la version exécutée ; aucun résultat ne certifie les autres terminaux ou leur cache. */
export interface UpdateVerification {
  status: "verified" | "mismatch" | "unverified";
  expectedVersion?: string;
  actualVersion?: string;
  /** Entrée PATH choisie, distincte de l'interpréteur d'un shim. Jamais une commande de réparation. */
  command?: string;
}

/** Dépendances de test : aucune installation ni commande globale réelle nécessaire. */
export interface UpdateVerificationOptions {
  run?: typeof runExternalProcess;
  resolve?: () => (DirectShimLaunch & { entrypoint: string }) | undefined;
  cwd?: string;
}

const VERSION = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

/** Lit seulement le manifeste du paquet après un update source ; aucune comparaison Git/npm. */
async function sourceVersion(directory: string): Promise<string | undefined> {
  try {
    const file = await open(path.join(directory, "package.json"), "r");
    try {
      if (!(await file.stat()).isFile()) return undefined;
      const buffer = Buffer.alloc(32 * 1024 + 1);
      let length = 0;
      while (length < buffer.length) {
        const { bytesRead } = await file.read(buffer, length, buffer.length - length, null);
        if (!bytesRead) break;
        length += bytesRead;
      }
      if (length === buffer.length) return undefined;
      const pkg = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, length))) as { name?: unknown; version?: unknown };
      return pkg.name === "palabre" && typeof pkg.version === "string" && VERSION.test(pkg.version) ? pkg.version : undefined;
    } finally { await file.close(); }
  } catch { return undefined; }
}

/**
 * Résout à neuf le premier emplacement PATH ; ne saute jamais un wrapper inconnu pour trouver
 * une installation plus loin. Sous Windows, seuls un natif ou un shim npm/pnpm reconnu sont lancés.
 */
function resolveUpdatedCommand(): (DirectShimLaunch & { entrypoint: string }) | undefined {
  const extensions = process.platform === "win32" ? [".exe", ".com", ".ps1", ".cmd", ".bat", ""] : [""];
  const entrypoint = resolveExecutablePath("palabre", extensions, { fresh: true });
  if (!entrypoint) return undefined;
  if (process.platform !== "win32" || /\.(?:exe|com)$/i.test(entrypoint)) {
    return { command: entrypoint, prefixArgs: [], entrypoint };
  }
  const shim = directNpmShimLaunch(entrypoint);
  return shim ? { ...shim, entrypoint } : undefined;
}

/**
 * Après les étapes d'installation seulement, compare une version complète de `palabre --version`
 * à la version npm épinglée (ou au manifeste source relu). Un exit non nul, arrêt, retour forcé,
 * sortie inconnue ou résolution impossible reste non vérifié. Un seul lancement, 15 s / 32 Kio,
 * sans shell, configuration, modèle ni changement de PATH ; aucun repli ni réessai.
 */
export async function verifyUpdatedCommand(info: UpdateInfo, options: UpdateVerificationOptions = {}): Promise<UpdateVerification> {
  const expectedVersion = info.channel === "source" ? await sourceVersion(info.projectRoot) : info.latestVersion;
  if (!expectedVersion || !VERSION.test(expectedVersion)) return { status: "unverified" };
  try {
    const executable = (options.resolve ?? resolveUpdatedCommand)();
    if (!executable) return { status: "unverified", expectedVersion };
    const base = { expectedVersion, command: executable.entrypoint };
    const result = await (options.run ?? runExternalProcess)({
      command: executable.command, args: [...executable.prefixArgs, "--version"],
      cwd: options.cwd ?? process.cwd(), stdin: "", timeoutMs: 15_000, maxOutputBytes: 32 * 1024, killGraceMs: 1_000,
      ...(executable.nodePath ? { env: withShimNodePath(process.env, executable.nodePath) } : {})
    });
    if (!result.started || result.exitCode !== 0 || result.signal || result.stopReason || result.forcedReturn) return { status: "unverified", ...base };
    const actualVersion = result.stdout.trim();
    if (!VERSION.test(actualVersion)) return { status: "unverified", ...base };
    return { status: actualVersion === expectedVersion ? "verified" : "mismatch", ...base, actualVersion };
  } catch { return { status: "unverified", expectedVersion }; }
}
