/** Read-only guard for the real personal PALABRE directory. Never restores or edits it. */
import { createHash } from 'node:crypto';
import { watch } from 'node:fs';
import { lstat, readFile, readdir, readlink } from 'node:fs/promises';
import path from 'node:path';

/** Include contents and metadata, without following links outside the guarded directory. */
export async function snapshot(directory) {
  const entries = [];
  async function visit(file, relative) {
    let info;
    try { info = await lstat(file); }
    catch (error) { if (error.code === 'ENOENT') { entries.push([relative, 'absent']); return; } throw error; }
    const kind = info.isSymbolicLink() ? 'link' : info.isDirectory() ? 'directory' : 'file';
    entries.push([relative, kind, info.mtimeMs, info.mode, kind === 'file' ? createHash('sha256').update(await readFile(file)).digest('hex') : kind === 'link' ? await readlink(file) : null]);
    if (kind === 'directory') for (const child of (await readdir(file)).sort()) await visit(path.join(file, child), path.join(relative, child));
  }
  await visit(directory, '.');
  return createHash('sha256').update(JSON.stringify(entries)).digest('hex');
}

/** Watch transient writes as well as comparing the final state (Windows and Linux, Node 20+). */
export async function guardProfile(home) {
  const directory = path.join(home, '.palabre');
  const changes = [];
  const watchers = [];
  watchers.push(watch(home, (event, file) => {
    if (file === null || String(file).toLowerCase() === '.palabre') changes.push(`personal-directory:${event}`);
  }));
  try { watchers.push(watch(directory, { recursive: true }, (event, file) => changes.push(`personal-content:${event}:${file}`))); }
  catch (error) { if (error.code !== 'ENOENT') { watchers.forEach(w => w.close()); throw error; } }
  watchers.forEach(w => w.on('error', () => changes.push('watch-error')));
  let before;
  try { before = await snapshot(directory); }
  catch (error) { watchers.forEach(w => w.close()); throw error; }
  return {
    before,
    async finish() {
      try {
        const after = await snapshot(directory);
        // Let queued watcher callbacks run before closing the handles.
        await new Promise(resolve => setTimeout(resolve, 30));
        if (before !== after || changes.length) throw new Error(`TEST PROFILE GUARD: real ~/.palabre changed during tests. No restoration attempted. Before=${before}, after=${after}, events=${JSON.stringify([...new Set(changes)])}`);
        return after;
      } finally { watchers.forEach(w => w.close()); }
    }
  };
}
