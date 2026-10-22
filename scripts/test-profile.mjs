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

/**
 * Decide whether the real profile changed. Any snapshot difference (contents, mtime, mode), any
 * 'rename' (transient creation, deletion or rename) and any watcher error fail. On Windows only, a
 * 'change' event alone is ignored when the snapshots match: fs.watch there also reports last-access
 * updates, including the guard's own reads. Residual Windows limit: an in-place write that restores
 * both contents and mtime goes unseen. Elsewhere, every 'change' still fails, as before.
 */
export function guardVerdict({ before, after, events, platform = process.platform }) {
  return before !== after || events.some(event => event.type !== 'change' || platform !== 'win32');
}

/**
 * Watch transient writes as well as comparing the final state (Windows and Linux, Node 20+).
 * `platform` and `takeSnapshot` exist for the guard's own tests on fictional directories.
 */
export async function guardProfile(home, { platform = process.platform, takeSnapshot = snapshot } = {}) {
  const directory = path.join(home, '.palabre');
  const events = [];
  const watchers = [];
  watchers.push(watch(home, (type, file) => {
    if (file === null || String(file).toLowerCase() === '.palabre') events.push({ type, label: `personal-directory:${type}` });
  }));
  try { watchers.push(watch(directory, { recursive: true }, (type, file) => events.push({ type, label: `personal-content:${type}:${file}` }))); }
  catch (error) { if (error.code !== 'ENOENT') { watchers.forEach(w => w.close()); throw error; } }
  watchers.forEach(w => w.on('error', () => events.push({ type: 'watch-error', label: 'watch-error' })));
  let before;
  try { before = await takeSnapshot(directory); }
  catch (error) { watchers.forEach(w => w.close()); throw error; }
  return {
    before,
    async finish() {
      try {
        const seen = events.length;
        let after = await takeSnapshot(directory);
        // Let queued watcher callbacks run before deciding.
        await new Promise(resolve => setTimeout(resolve, 30));
        // On Windows, events during the final pass may hide a write to a file already read: compare once more.
        if (platform === 'win32' && events.length > seen) after = await takeSnapshot(directory);
        if (guardVerdict({ before, after, events, platform })) throw new Error(`TEST PROFILE GUARD: real ~/.palabre changed during tests. No restoration attempted. Before=${before}, after=${after}, events=${JSON.stringify([...new Set(events.map(event => event.label))])}`);
        return after;
      } finally { watchers.forEach(w => w.close()); }
    }
  };
}
