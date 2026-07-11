import assert from 'node:assert/strict'
import test from 'node:test'
import { buildPost, graphemeCount, linkFacet, MAX_GRAPHEMES, parseRelease, truncate } from './post_release_bluesky.mjs'

const changelog = `# Changelog

## [Unreleased]

## [1.2.3] - 2026-07-01

<!-- social: Better remote Ollama support and a smoother TUI experience. -->

### Added

- First feature.
- Second feature.

### Fixed

- One fix.

## [1.2.2] - 2026-06-01

### Fixed

- Older fix.
`

test('parses the requested release and social summary', () => {
  const release = parseRelease(changelog, 'v1.2.3')
  assert.equal(release.version, '1.2.3')
  assert.equal(release.social, 'Better remote Ollama support and a smoother TUI experience.')
  assert.equal(release.sections.Added.length, 2)
  assert.equal(release.sections.Fixed.length, 1)
})

test('builds an English post within the Bluesky limit', () => {
  const release = parseRelease(changelog, 'v1.2.3')
  release.social += ` ${'long summary '.repeat(40)}`
  const post = buildPost(release)
  assert.match(post, /^Palabre CLI v1\.2\.3 is out 🎉/)
  assert.match(post, /2 new features · 1 fix/)
  assert.ok(post.endsWith('https://palab.re/en/changelog'))
  assert.ok(graphemeCount(post) <= MAX_GRAPHEMES)
})

test('does not split compound emoji', () => {
  assert.equal(truncate('A 👩‍💻 B', 4), 'A 👩‍💻…')
})

test('computes UTF-8 link offsets', () => {
  const url = 'https://palab.re/en/changelog'
  const text = `Palabre CLI 🎉\n${url}`
  const [facet] = linkFacet(text, url)
  const encoder = new TextEncoder()
  assert.equal(facet.index.byteStart, encoder.encode('Palabre CLI 🎉\n').length)
  assert.equal(facet.index.byteEnd, encoder.encode(text).length)
})
