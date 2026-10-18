/** @file Tâches Relay en écriture : accord ponctuel, worktree conservé et preuves de commandes. */
import { createHash, randomBytes } from 'node:crypto';
import { mkdir, mkdtemp, open, readFile, realpath, lstat, unlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { CodexSessionAdapter, codexCreateArgs } from './codex.js';
import type { ExternalTarget } from './types.js';
import type { PreparationRunner, PreparationResult } from './adapter.js';
import { runExternalProcess, type ExternalProcessResult } from './process.js';
/** Données exactes présentées à l'humain ; aucune exécution avant accord. */
export interface WriteRequest {
  v: 1;
  id: string;
  language: 'fr' | 'en';
  args: string[];
  agent: string;
  message: string;
  config: string;
  configHash: string;
  repository: string;
  commit: string;
  branch: string;
  worktree: string;
}
/** Rapport d'actions observées, distinct de la réponse et de la délivrance. */
export interface WriteReport {
  language: 'fr' | 'en';
  request: string;
  repository: string;
  commit: string;
  branch: string;
  worktree: string;
  files: string[];
  diff: string;
  commands: {
    command: string;
    exitCode: number | null;
    status: string;
    output: string;
  }[];
  verification: 'observed-commands-only';
  diagnostic?: string;
}
/** Erreur fermée avant modèle, ou limite d'un rapport après l'appel. */
export class WriteError extends Error {
}
/** Transport injectable pour les tests ; aucun shell dans le transport réel. */
export type WriteRunner = (command: string, args: readonly string[], cwd: string) => Promise<ExternalProcessResult>;
/** Racine de confiance hors du worktree de l'équipier. */
export const writeRoot = () => path.join(os.homedir(), '.palabre', 'relay-write');
/** Empreinte des octets d'un accord, d'une configuration ou d'une demande. */
export const writeHash = (text: string | Buffer) => createHash('sha256').update(text).digest('hex');
/** Transport natif sans shell ; entrées fermées, durée et sorties bornées. */
export const writeRun: WriteRunner = (command, args, cwd) => runExternalProcess({ command, args, cwd, stdin: '', timeoutMs: 30000, maxOutputBytes: 1024 * 1024 });
const ID = /^WR-[a-f0-9]{24}$/;
const HASH = /^[a-f0-9]{64}$/;
const COMMIT = /^[a-f0-9]{40,64}$/;
const MAX_REQUEST_BYTES = 256 * 1024;
/** Chemin d'une pièce : identifiant fermé, pas de traversée de dossier. */
function item(root: string, id: string, name: string): string {
  if (!ID.test(id))
    throw new WriteError('invalid-request');
  return path.join(root, id, name);
}
/** Lecture bornée : refuse les fichiers non réguliers, dont les liens symboliques. */
async function read(root: string, id: string, name: string): Promise<string> {
  const file = item(root, id, name);
  if (!(await lstat(file)).isFile())
    throw new WriteError('invalid-request');
  const handle = await open(file, 'r');
  try {
    const buffer = Buffer.alloc(MAX_REQUEST_BYTES + 1);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    if (bytesRead > MAX_REQUEST_BYTES)
      throw new WriteError('invalid-request');
    return buffer.subarray(0, bytesRead).toString('utf8');
  }
  finally {
    await handle.close();
  }
}
/** Création exclusive : accord, réservation et demande ne sont jamais écrasés. */
async function exclusive(file: string, value: unknown): Promise<void> {
  const text = JSON.stringify(value) + '\n';
  if (Buffer.byteLength(text) > MAX_REQUEST_BYTES)
    throw new WriteError('request-too-large');
  const handle = await open(file, 'wx', 0o600);
  try {
    await handle.writeFile(text);
  }
  finally {
    await handle.close();
  }
}
let hooksDirectory: Promise<string> | undefined;
/** Exécute Git avec désactivation des programmes de hooks et diff externes. */
async function git(run: WriteRunner, cwd: string, args: string[]): Promise<string> {
  hooksDirectory ??= mkdtemp(path.join(os.tmpdir(), 'palabre-no-hooks-'));
  const r = await run('git', ['-c', 'core.hooksPath=' + await hooksDirectory, '-c', 'core.fsmonitor=false', ...args], cwd);
  if (!r.started || r.exitCode !== 0 || r.stopReason || r.forcedReturn)
    throw new WriteError('git-unavailable');
  return r.stdout;
}
/** Prépare les données à confirmer, sans worktree ni appel au modèle. */
export async function prepareWrite(input: Omit<WriteRequest, 'v' | 'id' | 'repository' | 'commit' | 'branch' | 'worktree'> & {
  cwd: string;
}, root = writeRoot(), run: WriteRunner = writeRun): Promise<WriteRequest> {
  const cwd = await realpath(input.cwd);
  const repository = await realpath((await git(run, cwd, ['rev-parse', '--show-toplevel'])).trim());
  if (cwd.toLowerCase() !== repository.toLowerCase())
    throw new WriteError('repository-root-required');
  const commit = (await git(run, cwd, ['rev-parse', '--verify', 'HEAD^{commit}'])).trim();
  if (!COMMIT.test(commit))
    throw new WriteError('git-unavailable');
  const id = 'WR-' + randomBytes(12).toString('hex');
  const dir = path.join(root, id);
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const request: WriteRequest = {
    v: 1, id, language: input.language, args: input.args, agent: input.agent, message: input.message,
    config: input.config, configHash: input.configHash, repository, commit, branch: 'palabre/relay-' + id.slice(3), worktree: path.join(dir, 'worktree')
  };
  await exclusive(item(root, id, 'request.json'), request);
  return request;
}
/** Contrat relu : chemins calculés, empreintes et arguments sont liés à l'accord humain. */
export async function readWriteRequest(id: string, root = writeRoot()): Promise<{
  request: WriteRequest;
  hash: string;
}> {
  try {
    const text = await read(root, id, 'request.json');
    const r = JSON.parse(text) as WriteRequest;
    if (r.v !== 1 || r.id !== id || !['fr', 'en'].includes(r.language) || !Array.isArray(r.args) || !r.args.every(x => typeof x === 'string')
      || !r.args.includes('--new') || !r.args.includes('--write') || typeof r.message !== 'string' || !r.message.trim()
      || typeof r.agent !== 'string' || !path.isAbsolute(r.repository) || !path.isAbsolute(r.config) || !HASH.test(r.configHash) || !COMMIT.test(r.commit)
      || r.branch !== 'palabre/relay-' + id.slice(3) || r.worktree !== path.join(root, id, 'worktree'))
      throw Error();
    return { request: r, hash: writeHash(text) };
  }
  catch {
    throw new WriteError('invalid-request');
  }
}
/** Confirmation testable ; le vrai appel exige stdin ET stdout TTY et une réponse humaine. */
export interface WriteConfirmation {
  interactive: boolean;
  display(request: WriteRequest): void;
  confirm(): Promise<boolean>;
}
/** Seul le terminal humain crée l'accord ; toute dérive pendant sa lecture le refuse. */
export async function approveWrite(id: string, io: WriteConfirmation, root = writeRoot()): Promise<void> {
  if (!io.interactive)
    throw new WriteError('human-terminal-required');
  const before = await readWriteRequest(id, root);
  io.display(before.request);
  if (!await io.confirm())
    throw new WriteError('declined');
  const after = await readWriteRequest(id, root);
  if (before.hash !== after.hash)
    throw new WriteError('request-changed');
  await exclusive(item(root, id, 'approval.json'), { v: 1, requestHash: before.hash });
}
/** Vérifie puis consomme l'accord avant le premier effet d'exécution ; aucun rejeu possible. */
export async function consumeWrite(r: WriteRequest, root = writeRoot()): Promise<void> {
  try {
    const current = await readWriteRequest(r.id, root);
    if (JSON.stringify(r) !== JSON.stringify(current.request))
      throw Error();
    const approval = JSON.parse(await read(root, r.id, 'approval.json')) as {
      v: unknown;
      requestHash: unknown;
    };
    if (approval.v !== 1 || approval.requestHash !== current.hash)
      throw Error();
    await exclusive(item(root, r.id, 'consumed.json'), { at: new Date().toISOString(), requestHash: current.hash });
  }
  catch {
    throw new WriteError('approval-missing-changed-or-consumed');
  }
}
/** Crée le dossier séparé depuis le commit confirmé ; rien n'est supprimé, même en échec. */
export async function createWriteWorktree(r: WriteRequest, run: WriteRunner = writeRun): Promise<void> {
  if ((await git(run, r.repository, ['rev-parse', '--verify', 'HEAD^{commit}'])).trim() !== r.commit)
    throw new WriteError('commit-changed');
  await git(run, r.repository, ['worktree', 'add', '-b', r.branch, r.worktree, r.commit]);
}
/** Profil fermé à cette invocation : protège les réglages, Git et les dossiers temporaires extérieurs. */
export function writeProfileArgs(r: WriteRequest): string[] {
  const name = 'palabre_write_' + r.id.slice(3);
  const entries = [`default_permissions="${name}"`, 'approval_policy="never"', 'web_search="disabled"', `permissions.${name}.extends=":read-only"`,
    `permissions.${name}.filesystem.:workspace_roots={ "."="write", ".git"="read", ".codex"="read", ".agents"="read", ".claude"="read", "node_modules"="read", ".venv"="read" }`,
    `permissions.${name}.network.enabled=false`];
  return entries.flatMap(value => ['-c', value]);
}
/** Adapter d'écriture distinct : le profil n'est jamais activé par un simple message relayé. */
export class WriteCodexAdapter extends CodexSessionAdapter {
  constructor(private readonly request: WriteRequest) { super(); }
  /** Préparation MCP habituelle, puis preuve du confinement sans appel au modèle. */
  override async prepare(target: ExternalTarget, run: PreparationRunner): Promise<PreparationResult> {
    const ready = await super.prepare(target, run);
    if (ready.status !== 'ready')
      return ready;
    const inside = path.join(target.cwd, '.palabre-write-probe-' + randomBytes(12).toString('hex'));
    const outside = path.join(path.dirname(target.cwd), 'outside-probe');
    const payload = "const f=require('node:fs');f.writeFileSync(process.argv[1],'inside',{flag:'wx'});let denied=false;try{f.writeFileSync(process.argv[2],'outside',{flag:'wx'})}catch(e){denied=e.code==='EPERM'||e.code==='EACCES'};console.log(JSON.stringify({inside:f.readFileSync(process.argv[1],'utf8')==='inside',outsideDenied:denied}));if(!denied)process.exitCode=9";
    const probe = await run(['sandbox', '-P', 'palabre_write_' + this.request.id.slice(3), '-C', target.cwd, ...writeProfileArgs(this.request), '--', process.execPath, '-e', payload, inside, outside], { timeoutMs: 15000, maxOutputBytes: 16384 });
    let valid = false;
    try {
      const value = JSON.parse(probe.stdout);
      valid = value.inside === true && value.outsideDenied === true
        && await readFile(inside, 'utf8') === 'inside';
      await lstat(outside);
      valid = false;
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
        valid = false;
    }
    await unlink(inside).catch(() => { });
    if (!valid || probe.exitCode !== 0 || probe.stopReason || probe.forcedReturn || !probe.started)
      return { status: 'refused', refusal: { status: 'invalid-request', reason: 'write-unavailable' }, detail: 'sandbox-unavailable' };
    return ready;
  }
  /** Création seulement : aucun chemin de reprise en écriture dans ce lot. */
  override createArgs(target: ExternalTarget, preparation: readonly string[]): string[] {
    const args = codexCreateArgs(preparation);
    const i = args.indexOf('sandbox_mode="read-only"');
    if (i < 0)
      throw new WriteError('sandbox-unavailable');
    args.splice(i - 1, 2);
    args.splice(-1, 0, ...writeProfileArgs(this.request));
    return args;
  }
}
/** Lit seulement les événements structurés de commandes terminées, jamais la prose du modèle. */
export function writeCommands(stdout: string, onTruncated: () => void = () => { }): WriteReport['commands'] {
  const result: WriteReport['commands'] = [];
  for (const line of stdout.split(/\r?\n/)) {
    try {
      const e = JSON.parse(line);
      const i = e.item;
      if (e.type === 'item.completed' && i?.type === 'command_execution' && typeof i.command === 'string' && typeof i.aggregated_output === 'string'
        && (i.exit_code === null || Number.isInteger(i.exit_code)) && ['completed', 'failed'].includes(i.status)) {
        if (result.length >= 30) {
          onTruncated();
          continue;
        }
        if (i.command.length > 8192 || i.aggregated_output.length > 65536)
          onTruncated();
        result.push({ command: i.command.slice(0, 8192), exitCode: i.exit_code as number | null, status: i.status, output: i.aggregated_output.slice(0, 65536) });
      }
    }
    catch { /* Bruit ou ligne incomplète : aucune commande inventée. */ }
  }
  return result;
}
/** Rapport Git indépendant du modèle. Les lectures de fichiers ne suivent aucun lien extérieur. */
export async function writeReport(r: WriteRequest, stdout: string, run: WriteRunner = writeRun): Promise<WriteReport> {
  let commandsTruncated = false;
  const result: WriteReport = {
    language: r.language, request: r.id, repository: r.repository, commit: r.commit, branch: r.branch, worktree: r.worktree,
    files: [], diff: '', commands: writeCommands(stdout, () => { commandsTruncated = true; }), verification: 'observed-commands-only'
  };
  if (commandsTruncated)
    result.diagnostic = 'commands-truncated';
  try {
    if ((await git(run, r.worktree, ['rev-parse', 'HEAD'])).trim() !== r.commit)
      throw new WriteError('commit-changed');
    const status = await git(run, r.worktree, ['status', '--porcelain=v1', '-z', '--untracked-files=all']);
    const entries = status.split('\0').filter(Boolean);
    const untracked: string[] = [];
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]!;
      const file = entry.slice(3);
      result.files.push(file);
      if (entry.startsWith('??'))
        untracked.push(file);
      if (entry[0] === 'R' || entry[1] === 'R' || entry[0] === 'C' || entry[1] === 'C')
        i++;
    }
    result.diff = await git(run, r.worktree, ['diff', '--no-ext-diff', '--no-textconv', r.commit, '--']);
    for (const file of untracked.slice(0, 30)) {
      const absolute = path.resolve(r.worktree, file);
      const rel = path.relative(r.worktree, await realpath(absolute));
      if (rel === '..' || rel.startsWith('..' + path.sep) || path.isAbsolute(rel) || (await lstat(absolute)).isSymbolicLink())
        throw new WriteError('file-outside-worktree');
      if ((await lstat(absolute)).size > 65536)
        throw new WriteError('report-too-large');
      const text = await readFile(absolute, 'utf8');
      if (text.includes('\0'))
        throw new WriteError('binary-file-diff-unavailable');
      result.diff += `\n+++ ${file} (new)\n${text}`;
    }
    if (untracked.length > 30)
      throw new WriteError('untracked-files-truncated');
    if (result.diff.length > 1024 * 1024) {
      result.diff = result.diff.slice(0, 1024 * 1024);
      throw new WriteError('report-too-large');
    }
  }
  catch (error) {
    result.diagnostic = [result.diagnostic, error instanceof WriteError ? error.message : 'report-unavailable'].filter(Boolean).join('; ');
  }
  return result;
}
