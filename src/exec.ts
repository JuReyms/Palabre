/** @file Résolution partagée et mise en cache des exécutables locaux. */
import { existsSync } from "node:fs";
import path from "node:path";

const executableCache = new Map<string, string>();

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

/** Résout une commande dans PATH une seule fois par environnement PATH/PATHEXT. */
export function resolveExecutablePath(
  command: string,
  extensions: readonly string[] = executableExtensions(command)
): string | undefined {
  if (path.isAbsolute(command) || command.includes("\\") || command.includes("/")) {
    return existsSync(command) ? command : undefined;
  }

  const key = [command, extensions.join(";"), process.env.PATH ?? "", process.env.PATHEXT ?? ""].join("\u0000");
  if (executableCache.has(key)) {
    return executableCache.get(key);
  }

  for (const directory of (process.env.PATH ?? "").split(path.delimiter)) {
    const trimmed = directory.trim();
    if (!trimmed) continue;

    for (const extension of extensions) {
      const candidate = path.join(trimmed, `${command}${extension}`);
      if (existsSync(candidate)) {
        executableCache.set(key, candidate);
        return candidate;
      }
    }
  }

  return undefined;
}

/** Résout uniquement un binaire Windows lançable sans interpréteur de commandes. */
export function resolveNativeWindowsExecutable(command: string): string | undefined {
  const extension = path.extname(command).toLowerCase();
  if (extension) {
    if (![".exe", ".com"].includes(extension)) return undefined;
    return path.isAbsolute(command) || command.includes("\\") || command.includes("/")
      ? (existsSync(command) ? command : undefined)
      : resolveExecutablePath(command, [""]);
  }
  return resolveExecutablePath(command, [".exe", ".com"]);
}

/** Résout un hôte Windows PowerShell absolu, même si le PATH appelant est réduit. */
export function resolvePowerShellExecutable(): string | undefined {
  const fromPath = resolveExecutablePath("powershell.exe", [""]);
  if (fromPath) return fromPath;

  const systemRoot = process.env.SystemRoot ?? process.env.WINDIR;
  if (!systemRoot) return undefined;
  const candidate = path.join(systemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  return existsSync(candidate) ? candidate : undefined;
}

/** Trouve le shim PowerShell frère généré par npm/pnpm. */
export function resolvePowerShellShim(command: string): string | undefined {
  const extension = path.extname(command).toLowerCase();
  if (extension) {
    const resolved = path.isAbsolute(command) || command.includes("\\") || command.includes("/")
      ? command
      : resolveExecutablePath(command, [""]);
    if (!resolved) return undefined;
    const candidate = extension === ".ps1" ? resolved : resolved.slice(0, -extension.length) + ".ps1";
    return existsSync(candidate) ? candidate : undefined;
  }
  return resolveExecutablePath(command, [".ps1"]);
}
