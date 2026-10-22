/** Guard regressions use fictional personal directories only. */
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { guardProfile, guardVerdict } from './test-profile.mjs';

for (const change of ['none', 'read', 'create', 'modify', 'transient', 'transient-file']) test(`personal profile guard: ${change}`, async t => {
  const home = await mkdtemp(path.join(os.tmpdir(), 'profile-guard-'));
  t.after(() => rm(home, { recursive: true, force: true }));
  const directory = path.join(home, '.palabre');
  const config = path.join(directory, 'trusted-configs.json');
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

test('personal profile guard verdict: a change event alone is access noise, not a change', () => {
  const change = { type: 'change', label: 'personal-content:change:a.debate.md' };
  assert.equal(guardVerdict({ before: 'h', after: 'h', events: [change, change] }), false);
  assert.equal(guardVerdict({ before: 'h', after: 'h2', events: [change] }), true);
  assert.equal(guardVerdict({ before: 'h', after: 'h', events: [{ type: 'rename', label: 'personal-content:rename:stray.json' }] }), true);
  assert.equal(guardVerdict({ before: 'h', after: 'h', events: [{ type: 'watch-error', label: 'watch-error' }] }), true);
});
