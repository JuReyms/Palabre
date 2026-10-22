/** @file Tests du routage stable/préversion du workflow de release. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveReleaseMetadata } from './release_metadata.mjs';

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
