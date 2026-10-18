/**
 * @file Contournement ciblé de l'alias PowerShell Store pour Codex sous Windows.
 * Ne modifie que l'environnement enfant, jamais le PATH global ni les permissions Codex.
 */
import { lstatSync } from 'node:fs';
import path from 'node:path';
import { runExternalProcess } from './process.js';

/** Sondes injectables : aucun exécutable de test n'est lancé pour qualifier un alias. */
export interface CodexWindowsEnvironmentOptions {
  platform?: NodeJS.Platform;
  exists?: (file: string) => boolean;
  regularFile?: (file: string) => boolean;
  appExecutionAlias?: (file: string) => Promise<boolean>;
}

/** AppExecLink peut donner existsSync=false : inspecter l'entrée sans suivre sa cible. */
function entryExists(file: string): boolean {
  try { return !lstatSync(file).isDirectory(); } catch { return false; }
}

/** Lecture insensible à la casse, comme Windows ; aucune variable n'est affichée. */
function envValue(env: NodeJS.ProcessEnv, name: string): string | undefined {
  const key = Object.keys(env).sort().find(key => key.toLowerCase() === name.toLowerCase());
  return key ? env[key] : undefined;
}

/** Répertoire PATH normalisé pour comparer les doublons, sans réécrire les autres entrées. */
function directory(entry: string): string {
  return path.win32.normalize(entry.trim().replace(/^"(.*)"$/, '$1')).replace(/[\\/]+$/, '').toLowerCase();
}

/** Première commande PowerShell du PATH, en respectant les extensions Windows déclarées. */
function findShell(entries: string[], binary: string, extensions: string[], exists: (file: string) => boolean): string | undefined {
  for (const entry of entries) {
    const dir = entry.trim().replace(/^"(.*)"$/, '$1');
    if (!dir) continue;
    for (const extension of extensions) {
      const file = path.win32.join(dir, binary + extension);
      if (exists(file)) return file;
    }
  }
  return undefined;
}

/** Le tag AppExecLink est lu par fsutil natif, sans shell ni exécution de l'alias. Inconnu = faux. */
async function isAppExecutionAlias(file: string, env: NodeJS.ProcessEnv): Promise<boolean> {
  const systemRoot = envValue(env, 'SystemRoot');
  if (!systemRoot || !path.win32.isAbsolute(systemRoot)) return false;
  const run = await runExternalProcess({
    command: path.win32.join(systemRoot, 'System32', 'fsutil.exe'),
    args: ['reparsepoint', 'query', file], cwd: systemRoot, stdin: '', env,
    timeoutMs: 3000, maxOutputBytes: 8192
  });
  const tag = run.stdout.replaceAll('\0', '').match(/0x[0-9a-f]+/i)?.[0];
  return run.exitCode === 0 && !run.stopReason && !run.forcedReturn && tag?.toLowerCase() === '0x8000001b';
}

/**
 * Écarte un dossier WindowsApps seulement si son pwsh.exe est le shell choisi et un AppExecLink
 * prouvé, et si un vrai PowerShell reste disponible. Les autres alias de ce dossier deviennent
 * indisponibles à ce seul enfant. Shell natif déjà prioritaire, doute ou absence de repli : inchangé.
 */
export async function codexWindowsEnvironment(
  source: NodeJS.ProcessEnv,
  options: CodexWindowsEnvironmentOptions = {}
): Promise<NodeJS.ProcessEnv> {
  const env = { ...source };
  if ((options.platform ?? process.platform) !== 'win32') return env;
  const original = envValue(env, 'PATH');
  if (!original) return env;
  const exists = options.exists ?? entryExists;
  const regular = options.regularFile ?? (file => { try { return lstatSync(file).isFile(); } catch { return false; } });
  const extensions = (envValue(env, 'PATHEXT') || '.COM;.EXE;.BAT;.CMD').split(';').map(ext => ext.toLowerCase());
  const entries = original.split(';');
  const selected = findShell(entries, 'pwsh', extensions, exists);
  if (!selected || path.win32.basename(selected).toLowerCase() !== 'pwsh.exe'
    || path.win32.basename(path.win32.dirname(selected)).toLowerCase() !== 'windowsapps') return env;
  const alias = options.appExecutionAlias ?? (file => isAppExecutionAlias(file, env));
  try { if (!await alias(selected)) return env; } catch { return env; }
  const removed = directory(path.win32.dirname(selected));
  const filtered = entries.filter(entry => directory(entry) !== removed);
  const fallback = findShell(filtered, 'pwsh', extensions, exists) ?? findShell(filtered, 'powershell', extensions, exists);
  // Ne pas remplacer le Store par un script, un autre alias ou un paquet PowerShell Store.
  if (!fallback || path.win32.extname(fallback).toLowerCase() !== '.exe' || !regular(fallback)
    || /[\\/]WindowsApps[\\/](?:Microsoft\.PowerShell[^\\/]*[\\/]|(?:pwsh|powershell)\.exe$)/i.test(fallback)) return env;
  for (const key of Object.keys(env)) if (key.toLowerCase() === 'path') env[key] = filtered.join(';');
  return env;
}
