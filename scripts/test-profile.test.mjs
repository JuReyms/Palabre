/** Guard regressions use fictional personal directories only. */
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { guardProfile } from './test-profile.mjs';

for (const change of ['none', 'create', 'modify', 'transient']) test(`personal profile guard: ${change}`, async t => {
  const home = await mkdtemp(path.join(os.tmpdir(), 'profile-guard-'));
  t.after(() => rm(home, { recursive: true, force: true }));
  const directory = path.join(home, '.palabre');
  if (change === 'modify') { await mkdir(directory); await writeFile(path.join(directory, 'trusted-configs.json'), '{}'); }
  const guard = await guardProfile(home);
  if (change === 'create' || change === 'transient') await mkdir(directory);
  if (change === 'modify') await writeFile(path.join(directory, 'trusted-configs.json'), '{"changed":true}');
  if (change === 'transient') { await new Promise(resolve => setTimeout(resolve, 50)); await rm(directory, { recursive: true }); }
  if (change === 'none') assert.equal(await guard.finish(), guard.before);
  else await assert.rejects(guard.finish(), /real ~\/\.palabre changed/);
});
