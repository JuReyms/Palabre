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

/** Ce que l'inspection a relevé ; aucune valeur d'environnement n'est recopiée ailleurs. */
export interface WindowsPowerShellReport {
  status: WindowsPowerShellStatus;
  /** Alias d'exécution confirmé, quand il est prioritaire. */
  alias?: string;
  /** PowerShell régulier retenu comme repli, quand il en reste un. */
  fallback?: string;
  /** PATH destiné au seul enfant Codex ; absent quand aucun repli valide n'existe. */
  childPath?: string;
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

/**
 * Emplacements où le Store pose ses alias PowerShell : directement sous `WindowsApps`, ou dans le
 * dossier d'alias propre au paquet (`WindowsApps\Microsoft.PowerShell_<éditeur>`). Ce second
 * emplacement est celui que Codex lançait dans l'essai réel #171 ; seul le nom court du dossier
 * d'alias est accepté, jamais un dossier d'installation versionné comme
 * `Program Files\WindowsApps\Microsoft.PowerShell_7.6.2.0_x64__…`. L'emplacement ne suffit
 * jamais : la sonde AppExecLink reste obligatoire.
 */
function isStoreAliasLocation(file: string): boolean {
  const dir = path.win32.dirname(file);
  if (path.win32.basename(dir).toLowerCase() === 'windowsapps') return true;
  return /^microsoft\.powershell(?:preview)?_[a-z0-9]+$/i.test(path.win32.basename(dir))
    && path.win32.basename(path.win32.dirname(dir)).toLowerCase() === 'windowsapps';
}

/** Au plus deux emplacements d'alias coexistent ; la borne évite toute boucle sur un PATH pathologique. */
const MAX_ALIAS_DIRECTORIES = 4;

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

/** Verdict partagé par le contournement Codex et par `palabre doctor`. */
export type WindowsPowerShellStatus =
  | 'not-applicable'
  | 'alias-unconfirmed'
  | 'regular-pwsh-available'
  | 'store-alias-with-fallback'
  | 'store-alias-only';

/**
 * Inspection du shell PowerShell prioritaire, sans jamais lancer `pwsh` ni modifier d'environnement.
 *
 * - `not-applicable` : hors Windows, PATH absent, aucun `pwsh.exe`, ou `pwsh.exe` hors `WindowsApps` ;
 * - `alias-unconfirmed` : `WindowsApps\pwsh.exe` prioritaire, mais la sonde `fsutil` répond non ou pas du tout ;
 * - `regular-pwsh-available` : alias confirmé, et un vrai `pwsh.exe` reste disponible plus loin dans le PATH ;
 * - `store-alias-with-fallback` : alias confirmé, aucun vrai `pwsh.exe`, mais un PowerShell régulier reste ;
 * - `store-alias-only` : alias confirmé et aucun repli régulier ; le contournement ne peut pas s'appliquer.
 *
 * `childPath` n'est rempli que quand un repli valide existe : c'est la seule valeur de PATH que le
 * contournement accepte de donner à l'enfant Codex. Sa présence vaut donc « contournement applicable ».
 */
export async function inspectWindowsPowerShell(
  source: NodeJS.ProcessEnv,
  options: CodexWindowsEnvironmentOptions = {}
): Promise<WindowsPowerShellReport> {
  if ((options.platform ?? process.platform) !== 'win32') return { status: 'not-applicable' };
  const original = envValue(source, 'PATH');
  if (!original) return { status: 'not-applicable' };
  const exists = options.exists ?? entryExists;
  const regular = options.regularFile ?? (file => { try { return lstatSync(file).isFile(); } catch { return false; } });
  const extensions = (envValue(source, 'PATHEXT') || '.COM;.EXE;.BAT;.CMD').split(';').map(ext => ext.toLowerCase());
  const entries = original.split(';');
  const isCandidate = (file: string | undefined): file is string => !!file
    && path.win32.basename(file).toLowerCase() === 'pwsh.exe' && isStoreAliasLocation(file);
  const selected = findShell(entries, 'pwsh', extensions, exists);
  if (!isCandidate(selected)) return { status: 'not-applicable' };
  const alias = options.appExecutionAlias ?? (file => isAppExecutionAlias(file, source));
  const confirmed = async (file: string): Promise<boolean> => { try { return await alias(file); } catch { return false; } };
  if (!await confirmed(selected)) return { status: 'alias-unconfirmed' };
  // Plusieurs emplacements d'alias peuvent se suivre dans le PATH (essai #171 : dossier du paquet,
  // puis `WindowsApps` lui-même). Écarter seulement ceux qui passent en tête et sont confirmés ;
  // un suivant non confirmé reste en place et sera refusé comme repli plus bas.
  let filtered = entries;
  let current: string | undefined = selected;
  for (let round = 0; round < MAX_ALIAS_DIRECTORIES && isCandidate(current); round += 1) {
    if (current !== selected && !await confirmed(current)) break;
    const removed = directory(path.win32.dirname(current));
    filtered = filtered.filter(entry => directory(entry) !== removed);
    current = findShell(filtered, 'pwsh', extensions, exists);
  }
  const fallback = findShell(filtered, 'pwsh', extensions, exists) ?? findShell(filtered, 'powershell', extensions, exists);
  // Ne pas remplacer le Store par un script, un autre alias ou un paquet PowerShell Store.
  if (!fallback || path.win32.extname(fallback).toLowerCase() !== '.exe' || !regular(fallback)
    || /[\\/]WindowsApps[\\/](?:Microsoft\.PowerShell[^\\/]*[\\/]|(?:pwsh|powershell)\.exe$)/i.test(fallback)) {
    return { status: 'store-alias-only', alias: selected };
  }
  return {
    status: path.win32.basename(fallback).toLowerCase() === 'pwsh.exe' ? 'regular-pwsh-available' : 'store-alias-with-fallback',
    alias: selected,
    fallback,
    childPath: filtered.join(';')
  };
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
  const report = await inspectWindowsPowerShell(source, options);
  if (!report.childPath) return env;
  for (const key of Object.keys(env)) if (key.toLowerCase() === 'path') env[key] = report.childPath;
  return env;
}
