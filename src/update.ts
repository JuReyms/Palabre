/** @file Détection sûre des installations Palabre et plans de mise à jour structurés. */
import { spawn } from "node:child_process";
import { access, realpath } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Messages } from "./messages/index.js";
import { resolveNativeWindowsExecutable, resolvePowerShellExecutable, resolvePowerShellShim } from "./exec.js";
import { getLatestPackageVersion, compareSemver } from "./version.js";

/** Canal d'installation reconnu sans ambiguïté. */
export type InstallationChannel = "source" | "npm-global" | "pnpm-global" | "yarn-global" | "bun-global" | "unknown";

/** Une commande structurée, affichable et exécutable sans concaténer une ligne de shell. */
export interface UpdateStep {
  command: string;
  args: string[];
}

/** Racines `node_modules` globales connues pour chaque gestionnaire de paquets. */
export type GlobalInstallRoots = Partial<Record<Exclude<InstallationChannel, "source" | "unknown">, string[]>>;

/** Informations sur l'installation courante, utilisées par le CLI et l'écran TUI `/update`. */
export interface UpdateInfo {
  version: string;
  latestVersion?: string;
  projectRoot: string;
  /** Conservé pour la compatibilité des consommateurs historiques. */
  sourceCheckout: boolean;
  channel: InstallationChannel;
  steps: UpdateStep[];
}

/** Détermine si la version npm connue est effectivement plus récente que la version exécutée. */
export function hasAvailableUpdate(info: UpdateInfo): boolean {
  return Boolean(info.latestVersion && compareSemver(info.latestVersion, info.version) > 0);
}

/** Indique si Palabre connaît une stratégie de mutation sûre pour l'installation détectée. */
export function canApplyUpdate(info: UpdateInfo): boolean {
  return info.steps.length > 0 && (info.channel === "source" || hasAvailableUpdate(info));
}

/** Rend une commande structurée lisible sans prétendre qu'elle doit être collée dans un shell. */
export function formatUpdateStep(step: UpdateStep): string {
  return [step.command, ...step.args.map(formatArgument)].join(" ");
}

/** Détecte l'installation courante et interroge npm de façon best-effort. */
export async function getUpdateInfo(version: string): Promise<UpdateInfo> {
  const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const sourceCheckout = await exists(path.join(projectRoot, ".git"));
  const [latestVersion, roots] = await Promise.all([
    sourceCheckout ? Promise.resolve(undefined) : getLatestPackageVersion(),
    sourceCheckout ? Promise.resolve({} satisfies GlobalInstallRoots) : discoverGlobalInstallRoots()
  ]);
  const channel = sourceCheckout ? "source" : await detectResolvedInstallationChannel(projectRoot, roots);

  return {
    version,
    latestVersion,
    projectRoot,
    sourceCheckout,
    channel,
    steps: createUpdatePlan(channel, latestVersion)
  };
}

/**
 * Classe un package installé à partir des racines globales interrogées localement.
 * Une racine absente ou ambiguë reste `unknown` : elle ne doit jamais déclencher de mutation.
 */
export function detectInstallationChannel(projectRoot: string, roots: GlobalInstallRoots): InstallationChannel {
  const packageRoot = normalizePath(projectRoot);
  const channels: Array<Exclude<InstallationChannel, "source" | "unknown">> = [
    "pnpm-global", "npm-global", "yarn-global", "bun-global"
  ];

  for (const channel of channels) {
    for (const root of roots[channel] ?? []) {
      if (pathsEqual(packageRoot, path.join(root, "palabre"))) {
        return channel;
      }
    }
  }

  return "unknown";
}

/**
 * Complete la comparaison textuelle avec le chemin canonique du package. Les gestionnaires
 * peuvent lier `node_modules/palabre` vers un store (notamment pnpm), ce qui change le chemin
 * vu par `import.meta.url` sans changer l'installation globale que l'utilisateur a choisie.
 */
async function detectResolvedInstallationChannel(projectRoot: string, roots: GlobalInstallRoots): Promise<InstallationChannel> {
  const directChannel = detectInstallationChannel(projectRoot, roots);
  if (directChannel !== "unknown") return directChannel;

  const canonicalProjectRoot = await canonicalPath(projectRoot);
  if (!canonicalProjectRoot) return "unknown";

  const channels: Array<Exclude<InstallationChannel, "source" | "unknown">> = [
    "pnpm-global", "npm-global", "yarn-global", "bun-global"
  ];
  for (const channel of channels) {
    for (const root of roots[channel] ?? []) {
      const canonicalCandidate = await canonicalPath(path.join(root, "palabre"));
      if (canonicalCandidate === canonicalProjectRoot) return channel;
    }
  }

  return "unknown";
}

/** Crée les étapes d'update correspondant au canal détecté. Une provenance inconnue n'a pas de plan. */
export function createUpdatePlan(channel: InstallationChannel, latestVersion?: string): UpdateStep[] {
  if (channel === "source") {
    return [
      { command: "git", args: ["pull", "--ff-only"] },
      { command: "pnpm", args: ["install"] },
      { command: "pnpm", args: ["build"] },
      { command: "pnpm", args: ["link", "--global"] }
    ];
  }

  const packageSpec = `palabre@${latestVersion ?? "latest"}`;
  switch (channel) {
    case "npm-global": return [{ command: "npm", args: ["install", "--global", packageSpec] }];
    case "pnpm-global": return [{ command: "pnpm", args: ["add", "--global", packageSpec] }];
    case "yarn-global": return [{ command: "yarn", args: ["global", "add", packageSpec] }];
    case "bun-global": return [{ command: "bun", args: ["add", "--global", packageSpec] }];
    default: return [];
  }
}

/** Génère le rapport terminal détaillé et localisé du plan de mise à jour. */
export function formatUpdateInstructions(info: UpdateInfo, messages: Messages): string {
  return messages.update.instructions({
    version: info.version,
    latestVersion: info.latestVersion,
    projectRoot: info.projectRoot,
    sourceCheckout: info.sourceCheckout,
    channel: info.channel,
    steps: info.steps.map(formatUpdateStep),
    hasAvailableUpdate: hasAvailableUpdate(info)
  });
}

/**
 * Exécute le plan déjà validé. Chaque processus reçoit des arguments structurés ; Windows
 * privilégie un binaire natif ou le shim PowerShell sans passer par `cmd.exe`.
 */
export async function applyUpdate(info: UpdateInfo, messages: Messages): Promise<void> {
  if (!canApplyUpdate(info)) {
    throw new Error(messages.update.automaticUnavailable);
  }

  for (const step of info.steps) {
    await runStep(step, info.projectRoot, messages);
  }
}

/** Alias historique conservé pour les consommateurs qui appellent le workflow checkout directement. */
export async function applySourceUpdate(info: UpdateInfo, messages: Messages): Promise<void> {
  if (info.channel !== "source") {
    throw new Error(messages.update.automaticSourceOnly);
  }
  await applyUpdate(info, messages);
}

async function discoverGlobalInstallRoots(): Promise<GlobalInstallRoots> {
  const [npmRoot, pnpmRoot, yarnDirectory] = await Promise.all([
    captureCommand("npm", ["root", "--global"]),
    captureCommand("pnpm", ["root", "--global"]),
    captureCommand("yarn", ["global", "dir"])
  ]);
  const bunInstall = process.env.BUN_INSTALL ?? path.join(os.homedir(), ".bun");

  return {
    ...(npmRoot ? { "npm-global": [npmRoot] } : {}),
    ...(pnpmRoot ? { "pnpm-global": [pnpmRoot] } : {}),
    ...(yarnDirectory ? { "yarn-global": [path.join(yarnDirectory, "node_modules")] } : {}),
    "bun-global": [path.join(bunInstall, "install", "global", "node_modules")]
  };
}

async function captureCommand(command: string, args: string[]): Promise<string | undefined> {
  return new Promise((resolve) => {
    const invocation = resolveInvocation(command, args);
    const child = spawn(invocation.command, invocation.args, {
      shell: false,
      stdio: ["ignore", "pipe", "ignore"],
      windowsHide: true
    });
    let output = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      output += chunk.toString("utf8");
    });
    child.once("error", () => resolve(undefined));
    child.once("close", (code) => resolve(code === 0 ? output.trim() || undefined : undefined));
  });
}

async function exists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

/** Renvoie le chemin physique normalise si la cible existe, sans propager les echecs de lookup. */
async function canonicalPath(targetPath: string): Promise<string | undefined> {
  try {
    return normalizePath(await realpath(targetPath));
  } catch {
    return undefined;
  }
}

function runStep(step: UpdateStep, cwd: string, messages: Messages): Promise<void> {
  return new Promise((resolve, reject) => {
    const invocation = resolveInvocation(step.command, step.args);
    const child = spawn(invocation.command, invocation.args, {
      cwd,
      shell: false,
      stdio: "inherit",
      windowsHide: true
    });

    child.on("error", reject);
    child.on("close", (exitCode) => {
      if (exitCode === 0) {
        resolve();
        return;
      }
      reject(new Error(messages.update.stepFailed(step.command, step.args.join(" "), String(exitCode ?? "unknown"))));
    });
  });
}

function resolveInvocation(command: string, args: string[]): UpdateStep {
  if (process.platform !== "win32") return { command, args };

  const nativeExecutable = resolveNativeWindowsExecutable(command);
  if (nativeExecutable) return { command: nativeExecutable, args };

  const shim = resolvePowerShellShim(command);
  const powerShell = shim ? resolvePowerShellExecutable() : undefined;
  if (shim && powerShell) {
    return {
      command: powerShell,
      args: ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", shim, ...args]
    };
  }

  return { command, args };
}

function normalizePath(value: string): string {
  return path.resolve(value).replace(/[\\/]+$/, "").toLocaleLowerCase();
}

function pathsEqual(left: string, right: string): boolean {
  return normalizePath(left) === normalizePath(right);
}

function formatArgument(value: string): string {
  return /\s/.test(value) ? `"${value.replaceAll("\"", "\\\"")}"` : value;
}
