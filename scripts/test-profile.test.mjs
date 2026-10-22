/** Guard regressions use fictional personal directories only. */
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, stat, utimes, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { guardProfile, guardVerdict, snapshot } from './test-profile.mjs';

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

// In-place write then contents and mtime restored: outside Windows, the 'change' event still fails the
// guard. utimes cannot restore mtime to the exact precision, so the lone-event rule is covered by the
// verdict test below.
test('personal profile guard: restored contents and mtime fail outside Windows', async t => {
  const { home, directory, config } = await fictionalHome(t);
  await mkdir(directory); await writeFile(config, '{}');
  const { atime, mtime } = await stat(config);
  const guard = await guardProfile(home, { platform: 'linux' });
  await writeFile(config, '{"changed":true}');
  await writeFile(config, '{}'); await utimes(config, atime, mtime);
  await new Promise(resolve => setTimeout(resolve, 50));
  await assert.rejects(guard.finish(), /real ~\/\.palabre changed/);
});

test('personal profile guard: Windows compares again after a write during the final pass', async t => {
  const { home, directory, config } = await fictionalHome(t);
  await mkdir(directory); await writeFile(config, '{}');
  let calls = 0;
  let guard;
  const takeSnapshot = async target => {
    calls += 1;
    const result = await snapshot(target);
    if (calls !== 2) return result;
    // A surviving process writes a file this final pass has already read.
    await writeFile(config, '{"late":true}');
    return guard.before;
  };
  guard = await guardProfile(home, { platform: 'win32', takeSnapshot });
  await assert.rejects(guard.finish(), /real ~\/\.palabre changed/);
  assert.equal(calls, 3);
});

test('personal profile guard verdict: a lone change is access noise on Windows only', () => {
  const change = { type: 'change', label: 'personal-content:change:a.debate.md' };
  assert.equal(guardVerdict({ before: 'h', after: 'h', events: [change, change], platform: 'win32' }), false);
  assert.equal(guardVerdict({ before: 'h', after: 'h', events: [change], platform: 'linux' }), true);
  assert.equal(guardVerdict({ before: 'h', after: 'h', events: [change], platform: 'darwin' }), true);
  assert.equal(guardVerdict({ before: 'h', after: 'h2', events: [change], platform: 'win32' }), true);
  for (const type of ['rename', 'watch-error']) assert.equal(guardVerdict({ before: 'h', after: 'h', events: [{ type, label: type }], platform: 'win32' }), true);
});
