/** Guard regressions use fictional personal directories only. */
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { guardProfile, guardVerdict } from './test-profile.mjs';

async function fictionalHome(t) {
  const home = await mkdtemp(path.join(os.tmpdir(), 'profile-guard-'));
  t.after(() => rm(home, { recursive: true, force: true }));
  return { home, directory: path.join(home, '.palabre'), config: path.join(home, '.palabre', 'trusted-configs.json') };
}

for (const change of ['none', 'read', 'create', 'modify', 'transient', 'transient-file']) test(`personal profile guard: ${change}`, async t => {
  const { home, directory, config } = await fictionalHome(t);
  if (['read', 'modify', 'transient-file'].includes(change)) { await mkdir(directory); await writeFile(config, '{}'); }
  const guard = await guardProfile(home);
  if (change === 'read') await readFile(config, 'utf8');
  if (change === 'create' || change === 'transient') await mkdir(directory);
  if (change === 'modify') await writeFile(config, '{"changed":true}');
  if (change === 'transient-file') await writeFile(path.join(directory, 'stray.json'), '{}');
  if (change === 'transient' || change === 'transient-file') {
    await new Promise(resolve => setTimeout(resolve, 50));
    await rm(change === 'transient' ? directory : path.join(directory, 'stray.json'), { recursive: true });
  }
  if (change === 'none' || change === 'read') assert.equal(await guard.finish(), guard.before);
  else await assert.rejects(guard.finish(), /real ~\/\.palabre changed/);
});

/** Let native watcher events land before the guard counts them. */
const settle = () => new Promise(resolve => setTimeout(resolve, 150));

// In-place write that leaves every snapshot identical (simulated): outside Windows, the lone 'change'
// event still fails the guard.
test('personal profile guard: a lone change fails outside Windows even with identical snapshots', async t => {
  const { home, directory, config } = await fictionalHome(t);
  await mkdir(directory); await writeFile(config, '{}');
  const guard = await guardProfile(home, { platform: 'linux', takeSnapshot: async () => 'identical' });
  await writeFile(config, '{"changed":true}');
  await settle();
  await assert.rejects(guard.finish(), /real ~\/\.palabre changed/);
});

// Simulated final snapshots on Windows; a real write produces the watcher events that trigger the second pass.
for (const scenario of ['late write', 'restored before second pass']) test(`personal profile guard: Windows final passes (${scenario})`, async t => {
  const { home, directory, config } = await fictionalHome(t);
  await mkdir(directory); await writeFile(config, '{}');
  // late write: the first final pass misses a write to a file it already read, the second sees it.
  // restored: the first final pass sees a change, the second finds the original state again.
  const finals = scenario === 'late write' ? ['h', 'h2'] : ['h2', 'h'];
  let calls = 0;
  const takeSnapshot = async () => {
    calls += 1;
    if (calls === 1) return 'h';
    if (calls === 2) { await writeFile(config, '{"late":true}'); await settle(); }
    return finals[calls - 2];
  };
  const guard = await guardProfile(home, { platform: 'win32', takeSnapshot });
  await assert.rejects(guard.finish(), /real ~\/\.palabre changed/);
  assert.equal(calls, 3);
});

test('personal profile guard verdict: a lone change is access noise on Windows only', () => {
  const change = { type: 'change', label: 'personal-content:change:a.debate.md' };
  assert.equal(guardVerdict({ before: 'h', afters: ['h'], events: [change, change], platform: 'win32' }), false);
  assert.equal(guardVerdict({ before: 'h', afters: ['h', 'h'], events: [change], platform: 'win32' }), false);
  assert.equal(guardVerdict({ before: 'h', afters: ['h'], events: [change], platform: 'linux' }), true);
  assert.equal(guardVerdict({ before: 'h', afters: ['h'], events: [change], platform: 'darwin' }), true);
  assert.equal(guardVerdict({ before: 'h', afters: ['h2'], events: [change], platform: 'win32' }), true);
  // A change seen by the first final snapshot is never erased by a later one.
  assert.equal(guardVerdict({ before: 'h', afters: ['h2', 'h'], events: [change], platform: 'win32' }), true);
  for (const type of ['rename', 'watch-error']) assert.equal(guardVerdict({ before: 'h', afters: ['h'], events: [{ type, label: type }], platform: 'win32' }), true);
});
