#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const VERSION_RE = /^## \[(?<version>\d+\.\d+\.\d+)\](?:\s+-\s+(?<date>[^\n]+))?\n(?<body>.*?)(?=^## \[|$(?![\s\S]))/gms
const SOCIAL_RE = /<!--\s*social:\s*(?<summary>[^>]+?)\s*-->/i
const LABELS = { Added: ['new feature', 'new features'], Changed: ['change', 'changes'], Fixed: ['fix', 'fixes'] }

export function sectionCounts(body) {
  return Object.entries(LABELS).flatMap(([section, labels]) => {
    const match = body.match(new RegExp(`^### ${section}\\s*$\\n(?<body>.*?)(?=^### |$(?![\\s\\S]))`, 'ms'))
    const count = match?.groups?.body.match(/^- /gm)?.length ?? 0
    return count ? [`${count} ${labels[count === 1 ? 0 : 1]}`] : []
  })
}

export function renderFrench(changelog) {
  const start = changelog.search(/^## \[\d/m)
  if (start < 0) throw new Error('CHANGELOG.md contains no released version')
  return `---\ntitle: Changelog\ndescription: Consulter les nouveautés, changements et corrections de chaque version de Palabre.\n---\n\nCette page est générée depuis le changelog canonique du dépôt Palabre à chaque publication.\n\n${changelog.slice(start)}`
}

export function renderEnglish(changelog) {
  const parts = [`---\ntitle: Changelog\ndescription: Review concise English highlights for every Palabre release.\n---\n\nThis page is generated from Palabre's canonical French changelog on every release.\n`]
  for (const match of changelog.matchAll(VERSION_RE)) {
    const { version, date, body } = match.groups
    const summary = body.match(SOCIAL_RE)?.groups?.summary.trim() ?? 'See the complete release notes.'
    const counts = sectionCounts(body).join(' · ')
    parts.push(`## ${version}${date ? ` — ${date}` : ''}\n`, `${summary}\n`, counts ? `**${counts}**\n` : '', `[GitHub release](https://github.com/JuReyms/Palabre/releases/tag/v${version})\n`)
  }
  return parts.filter(Boolean).join('\n')
}

async function main() {
  const changelog = await readFile('CHANGELOG.md', 'utf8')
  const pages = { fr: renderFrench(changelog), en: renderEnglish(changelog) }
  for (const [locale, content] of Object.entries(pages)) {
    const directory = `dist/content/${locale}`
    await mkdir(directory, { recursive: true })
    await writeFile(`${directory}/9.changelog.md`, content)
    console.log(`OK: CHANGELOG.md -> content/${locale}/9.changelog.md`)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(error => { console.error(error.message); process.exitCode = 1 })