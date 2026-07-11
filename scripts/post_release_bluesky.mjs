#!/usr/bin/env node

import { readFile } from 'node:fs/promises'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

export const MAX_GRAPHEMES = 300
export const DEFAULT_URL = 'https://palab.re/en/changelog'
const SERVICE = 'https://bsky.social'
const LABELS = { Added: ['new feature', 'new features'], Changed: ['change', 'changes'], Fixed: ['fix', 'fixes'] }
const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' })

export const graphemeCount = text => [...segmenter.segment(text)].length

export function truncate(text, limit) {
  const parts = [...segmenter.segment(text)]
  if (parts.length <= limit) return text
  return `${parts.slice(0, Math.max(0, limit - 1)).map(part => part.segment).join('').trimEnd()}…`
}

export function parseRelease(changelog, tag) {
  const version = tag.replace(/^v/, '')
  const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = changelog.match(new RegExp(`^## \\[${escaped}\\](?:\\s+-[^\\n]*)?\\n([\\s\\S]*?)(?=^## \\[|\\Z)`, 'm'))
  if (!match) throw new Error(`Version ${version} not found in CHANGELOG.md`)
  const social = match[1].match(/<!--\s*social:\s*([^>]+?)\s*-->/i)?.[1]?.replace(/\s+/g, ' ').trim()
  const sections = {}
  let current
  for (const line of match[1].split(/\r?\n/)) {
    const heading = line.match(/^###\s+(.+)$/)
    if (heading) {
      current = heading[1].trim()
      sections[current] ??= []
    } else if (current && line.startsWith('- ')) {
      sections[current].push(line.slice(2).trim())
    }
  }
  return { version, social, sections }
}

function countSummary(sections) {
  const parts = Object.entries(LABELS).flatMap(([section, labels]) => {
    const count = sections[section]?.length ?? 0
    return count ? [`${count} ${labels[count === 1 ? 0 : 1]}`] : []
  })
  return parts.join(' · ') || 'A new release'
}

export function buildPost(release, url = DEFAULT_URL) {
  const heading = `Palabre CLI v${release.version} is out 🎉`
  const counts = countSummary(release.sections)
  const summaryPrefix = release.social ? 'Highlights: ' : ''
  const fixedLength = graphemeCount(`${heading}\n${counts}\n${summaryPrefix}\n${url}`)
  const summary = truncate(release.social || 'See the full changelog.', MAX_GRAPHEMES - fixedLength)
  const text = `${heading}\n${counts}\n${summaryPrefix}${summary}\n${url}`
  if (graphemeCount(text) > MAX_GRAPHEMES) throw new Error('Generated Bluesky post exceeds 300 characters')
  return text
}

export function linkFacet(text, url) {
  const start = text.lastIndexOf(url)
  if (start < 0) throw new Error('Changelog URL is missing from the post')
  const encoder = new TextEncoder()
  return [{
    index: { byteStart: encoder.encode(text.slice(0, start)).length, byteEnd: encoder.encode(text.slice(0, start + url.length)).length },
    features: [{ $type: 'app.bsky.richtext.facet#link', uri: url }]
  }]
}

async function call(service, method, body, token) {
  const response = await fetch(`${service}/xrpc/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body)
  })
  if (!response.ok) throw new Error(`${method} failed (${response.status}): ${await response.text()}`)
  return response.json()
}

export async function publish({ identifier, password, text, url, service = SERVICE }) {
  const session = await call(service, 'com.atproto.server.createSession', { identifier, password })
  return call(service, 'com.atproto.repo.createRecord', {
    repo: session.did,
    collection: 'app.bsky.feed.post',
    record: { $type: 'app.bsky.feed.post', text, facets: linkFacet(text, url), langs: ['en'], createdAt: new Date().toISOString() }
  }, session.accessJwt)
}

function arg(name, fallback) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : fallback
}

async function main() {
  const tag = arg('--tag', process.env.GITHUB_REF_NAME)
  const url = arg('--url', DEFAULT_URL)
  if (!tag) throw new Error('Use --tag vX.Y.Z or set GITHUB_REF_NAME')
  const release = parseRelease(await readFile('CHANGELOG.md', 'utf8'), tag)
  const text = buildPost(release, url)
  console.log(`${text}\n\n${graphemeCount(text)}/${MAX_GRAPHEMES} characters`)
  if (process.argv.includes('--dry-run')) return
  if (!process.env.BLUESKY_HANDLE || !process.env.BLUESKY_APP_PASSWORD) throw new Error('BLUESKY_HANDLE and BLUESKY_APP_PASSWORD are required')
  const result = await publish({ identifier: process.env.BLUESKY_HANDLE, password: process.env.BLUESKY_APP_PASSWORD, text, url })
  console.log(`Published: ${result.uri}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1 })
}