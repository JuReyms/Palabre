/** @file Lectures locales et sondes de connexion bornées pour doctor, sans appel modèle ni réparation. */
import { lstatSync, realpathSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveExternalExecutable } from "./externalSessions/resolve.js";
import { runExternalProcess } from "./externalSessions/process.js";

/** État déclaré par la CLI, sans preuve qu'un jeton restera valide pour un futur appel. */
export type DoctorAuthState = "connected" | "disconnected" | "unknown";

/** Entrées remplaçables dans les tests ; aucun compte ou profil réel n'y est nécessaire. */
export interface DoctorArrivalOptions {
  platform?: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
  home?: string;
  cwd?: string;
  fileExists?: (file: string) => boolean;
  canonicalDirectory?: (directory: string) => string;
  resolve?: typeof resolveExternalExecutable;
  run?: typeof runExternalProcess;
}

/** Chemins uniques par installation : les wrappers voisins ne comptent qu'une fois. */
export interface DoctorInstallation {
  command: string;
  paths: string[];
}

/**
 * Constats physiques : présence, pas chargement du skill ni validité d'une installation.
 * PowerShell n'y figure pas : doctor réutilise `inspectWindowsPowerShell` (#175).
 */
export interface DoctorLocalArrival {
  skills: string[];
  duplicates: DoctorInstallation[];
}

function environmentValue(env: NodeJS.ProcessEnv, name: string): string | undefined {
  return Object.entries(env).find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1];
}

/** Inclut les liens Store inspectables sans jamais les exécuter ni suivre leur cible. */
function entryExists(file: string): boolean {
  try { const entry = lstatSync(file); return entry.isFile() || entry.isSymbolicLink(); }
  catch { return false; }
}

/** Un alias et ses wrappers voisins restent une installation ; les vrais doublons restent visibles. */
export function doctorInstallations(command: string, options: DoctorArrivalOptions = {}): string[] {
  const windows = (options.platform ?? process.platform) === "win32";
  const paths = windows ? path.win32 : path.posix;
  const env = options.env ?? process.env;
  const exists = options.fileExists ?? entryExists;
  const canonical = options.canonicalDirectory ?? (dir => { try { return realpathSync(dir); } catch { return dir; } });
  const extensions = windows ? [".exe", ".com", ".cmd", ".bat", ".ps1", ""] : [""];
  const seen = new Set<string>();
  const found: string[] = [];
  for (const item of (environmentValue(env, "PATH") ?? "").split(windows ? ";" : ":")) {
    const directory = item.trim().replace(/^"(.*)"$/, "$1");
    if (!directory || !paths.isAbsolute(directory)) continue;
    const normalized = paths.normalize(canonical(directory));
    const key = windows ? normalized.toLowerCase() : normalized;
    if (seen.has(key)) continue;
    seen.add(key);
    const file = extensions.map(extension => paths.join(directory, command + extension)).find(exists);
    if (file) found.push(file);
  }
  return found;
}

/** Inventorie seulement PATH et les emplacements connus, sans exécuter les fichiers trouvés. */
export function inspectDoctorArrival(options: DoctorArrivalOptions = {}): DoctorLocalArrival {
  const windows = (options.platform ?? process.platform) === "win32";
  const paths = windows ? path.win32 : path.posix;
  const home = options.home ?? os.homedir();
  const cwd = options.cwd ?? process.cwd();
  const exists = options.fileExists ?? entryExists;
  const skills = [...new Set([home, cwd].flatMap(root => [".agents", ".claude", ".codex"].map(agent => paths.join(root, agent, "skills", "palabre", "SKILL.md"))))].filter(exists);
  return {
    skills,
    duplicates: ["node", "npm", "pnpm", "claude", "codex"].map(command => ({ command, paths: doctorInstallations(command, options) })).filter(installation => installation.paths.length > 1)
  };
}

/** Ne reconnaît que le contrat de status, jamais une prose d'agent ou un compte affiché. */
export function parseDoctorAuth(provider: "claude" | "codex", code: number | null, stdout: string, stderr: string): DoctorAuthState {
  if (provider === "claude") {
    try {
      const status: unknown = JSON.parse(stdout);
      if (!status || typeof status !== "object" || !("loggedIn" in status)) return "unknown";
      if (code === 0 && status.loggedIn === true) return "connected";
      if ((code === 0 || code === 1) && status.loggedIn === false) return "disconnected";
    } catch { /* CLI ancienne, sortie tronquée ou contrat différent : aucune conclusion. */ }
    return "unknown";
  }
  const text = `${stdout}\n${stderr}`.trim();
  if (code === 0 && /^Logged in using (?:ChatGPT|an API key)(?:\b|$)/.test(text)) return "connected";
  if (code === 1 && /^Not logged in\s*$/.test(text)) return "disconnected";
  return "unknown";
}

/**
 * Appelle uniquement le sous-programme status de la commande configurée, sans ses args utilisateur.
 * L'appelant doit vérifier l'approbation avant cette fonction. Aucun shell, prompt, login ou modèle ;
 * timeout 3 s, sortie cumulée 32 Kio, aucune sortie brute ni donnée de compte rendue à doctor.
 */
export async function probeDoctorAuth(provider: "claude" | "codex", command: string, options: DoctorArrivalOptions = {}): Promise<DoctorAuthState> {
  try {
    const resolved = (options.resolve ?? resolveExternalExecutable)(command);
    if (resolved.status !== "resolved") return "unknown";
    const run = await (options.run ?? runExternalProcess)({
      command: resolved.executable.command,
      args: [...resolved.executable.prefixArgs, ...(provider === "claude" ? ["auth", "status", "--json"] : ["login", "status"])],
      cwd: options.cwd ?? process.cwd(), stdin: "", env: options.env,
      timeoutMs: 3000, maxOutputBytes: 32 * 1024, killGraceMs: 500
    });
    if (!run.started || run.launchFailure || run.stopReason || run.forcedReturn || run.signal) return "unknown";
    return parseDoctorAuth(provider, run.exitCode, run.stdout, run.stderr);
  } catch { return "unknown"; }
}
