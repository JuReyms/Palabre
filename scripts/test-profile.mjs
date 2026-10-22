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
 * Decide whether the real profile changed. The snapshot covers contents, mtime and mode, so it
 * catches any lasting modification. Watcher events add what a final comparison cannot see:
 * transient creations, deletions and renames ('rename'), and watcher errors. A 'change' event alone
 * is not a change: on Windows, fs.watch also reports last-access updates, including the guard's own
 * reads, so it only counts when the snapshot differs.
 */
export function guardVerdict({ before, after, events }) {
  return before !== after || events.some(event => event.type === 'rename' || event.type === 'watch-error');
}

/** Watch transient writes as well as comparing the final state (Windows and Linux, Node 20+). */
export async function guardProfile(home) {
  const directory = path.join(home, '.palabre');
  const events = [];
  // Snapshot first: its reads must not show up as watcher events.
  const before = await snapshot(directory);
  const watchers = [];
  watchers.push(watch(home, (type, file) => {
    if (file === null || String(file).toLowerCase() === '.palabre') events.push({ type, label: `personal-directory:${type}` });
  }));
  try { watchers.push(watch(directory, { recursive: true }, (type, file) => events.push({ type, label: `personal-content:${type}:${file}` }))); }
  catch (error) { if (error.code !== 'ENOENT') { watchers.forEach(w => w.close()); throw error; } }
  watchers.forEach(w => w.on('error', () => events.push({ type: 'watch-error', label: 'watch-error' })));
  return {
    before,
    async finish() {
      try {
        // Let queued watcher callbacks run, then stop watching before the final reads.
        await new Promise(resolve => setTimeout(resolve, 30));
      } finally { watchers.forEach(w => w.close()); }
      const after = await snapshot(directory);
      if (guardVerdict({ before, after, events })) throw new Error(`TEST PROFILE GUARD: real ~/.palabre changed during tests. No restoration attempted. Before=${before}, after=${after}, events=${JSON.stringify([...new Set(events.map(event => event.label))])}`);
      return after;
    }
  };
}
