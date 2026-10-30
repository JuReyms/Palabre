/** @file Tests du routage stable/préversion du workflow de release. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { resolveReleaseMetadata, resolveReleaseTitle } from './release_metadata.mjs';

test('stable releases publish to latest and may update production metadata', () => {
  assert.deepEqual(resolveReleaseMetadata('v0.18.0', '0.18.0'), {
    version: '0.18.0',
    prerelease: false,
    npmTag: 'latest',
    makeLatest: true
  });
});

test('prereleases publish to next and never become the latest GitHub release', () => {
  assert.deepEqual(resolveReleaseMetadata('v0.18.0-beta.1', '0.18.0-beta.1'), {
    version: '0.18.0-beta.1',
    prerelease: true,
    npmTag: 'next',
    makeLatest: false
  });
});

test('the release tag must exactly match package.json', () => {
  assert.throws(
    () => resolveReleaseMetadata('v0.18.0-beta.1', '0.18.0'),
    /does not match package\.json/
  );
});

test('ambiguous or non-semver release tags are rejected before publication', () => {
  for (const tag of ['0.18.0', 'v0.18', 'v01.2.3', 'v0.18.0+build', 'v0.18.0-beta..1']) {
    assert.throws(() => resolveReleaseMetadata(tag, tag.replace(/^v/, '')), /Invalid release tag/);
  }
});

test('a release name belongs only to its exact version, with LF or CRLF', () => {
  const changelog = '# Changelog\n\n## [Unreleased]\n\n<!-- release-name: Future -->\n\n## [0.22.0] - 2026-10-30\n\n<!-- release-name: Bunny -->\n\n## [0.21.0] - 2026-10-29\n\n<!-- release-name: Older -->\n';
  for (const text of [changelog, changelog.replaceAll('\n', '\r\n')]) {
    assert.equal(resolveReleaseTitle(text, 'v0.22.0'), 'Palabre v0.22.0 — Bunny');
    assert.equal(resolveReleaseTitle(text, 'v0.23.0'), 'v0.23.0');
    assert.equal(resolveReleaseTitle(text, 'v0.22.0-beta.1'), 'v0.22.0-beta.1');
  }
  assert.equal(resolveReleaseTitle('## [0.22.0] - 2026-10-30\nNo name.\n', 'v0.22.0'), 'v0.22.0');
});

test('unsafe, malformed or ambiguous release names are refused', () => {
  const header = '## [0.22.0] - 2026-10-30\n';
  for (const body of [
    '<!-- release-name:  -->', '<!-- release-name: Bunny\nrelease_title=Injected -->',
    '<!-- release-name: Bunny\rInjected -->', '<!-- release-name: Bunny\u0000 -->',
    '<!-- release-name: Bun\u202eny -->', '<!-- release-name: Bunny\u2028Injected -->',
    `<!-- release-name: ${'a'.repeat(81)} -->`, '<!-- release-name:  Bunny -->',
    '<!-- release-name: Bunny  -->', '<!-- release-name: Bunny -->\n<!-- release-name: Other -->',
    '<!-- release-name Bunny -->', '<!-- release-name:\nBunny -->',
    '<!--\nrelease-name: Bunny -->'
  ]) assert.throws(() => resolveReleaseTitle(header + body, 'v0.22.0'), /release-name/);
  assert.throws(() => resolveReleaseTitle(header + '\n' + header, 'v0.22.0'), /Duplicate changelog section/);
  assert.throws(() => resolveReleaseTitle(header, 'v0.22'), /Invalid release tag/);
});

test('Unicode names and shell-looking text remain single-line data', () => {
  for (const name of ['Lapin 🐇', 'Été', '$(echo Bunny)', '${{ secrets.TEST }}']) {
    assert.equal(resolveReleaseTitle(`## [0.22.0]\n<!-- release-name: ${name} -->\n`, 'v0.22.0'), `Palabre v0.22.0 — ${name}`);
  }
});

test('the entrypoint validates before writing GitHub outputs from its own package root', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'release-title-'));
  try {
    await mkdir(path.join(root, 'scripts'));
    const script = path.join(root, 'scripts/release_metadata.mjs');
    await copyFile(new URL('./release_metadata.mjs', import.meta.url), script);
    await writeFile(path.join(root, 'package.json'), JSON.stringify({ version: '0.22.0' }));
    const output = path.join(root, 'github-output');
    await writeFile(output, 'sentinel=preserved\n');
    const run = (tag) => spawnSync(process.execPath, [script, '--tag', tag], {
      cwd: os.tmpdir(), encoding: 'utf8', env: { ...process.env, GITHUB_OUTPUT: output }
    });
    await writeFile(path.join(root, 'CHANGELOG.md'), '## [0.22.0]\n<!-- release-name: Bunny\nother=injected -->\n');
    assert.equal(run('v0.22.0').status, 1);
    assert.equal(await readFile(output, 'utf8'), 'sentinel=preserved\n');
    await writeFile(path.join(root, 'CHANGELOG.md'), '## [0.22.0]\n<!-- release-name: Bunny -->\n');
    assert.equal(run('v0.23.0').status, 1);
    assert.equal(await readFile(output, 'utf8'), 'sentinel=preserved\n');
    const result = run('v0.22.0');
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).releaseTitle, 'Palabre v0.22.0 — Bunny');
    assert.equal(await readFile(output, 'utf8'), 'sentinel=preserved\nversion=0.22.0\nprerelease=false\nnpm_tag=latest\nmake_latest=true\nrelease_title=Palabre v0.22.0 — Bunny\n');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
