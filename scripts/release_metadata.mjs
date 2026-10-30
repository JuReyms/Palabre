/** @file Résout et valide le canal d'une release GitHub/npm depuis son tag et package.json. */
import { appendFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const TAG_RE = /^v(?<version>(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?)$/;

/**
 * Valide la correspondance exacte entre le tag Git et la version du paquet.
 * Une version SemVer avec suffixe est publiée sous `next`; une version stable sous `latest`.
 */
export function resolveReleaseMetadata(tag, packageVersion) {
  const match = TAG_RE.exec(tag);
  if (!match?.groups?.version) {
    throw new Error(`Invalid release tag ${JSON.stringify(tag)}. Expected vX.Y.Z or vX.Y.Z-prerelease.`);
  }

  const version = match.groups.version;
  if (version !== packageVersion) {
    throw new Error(`Release tag ${tag} does not match package.json version ${packageVersion}.`);
  }

  const prerelease = version.includes('-');
  return {
    version,
    prerelease,
    npmTag: prerelease ? 'next' : 'latest',
    makeLatest: !prerelease
  };
}

function parseTag(args) {
  if (args.length !== 2 || args[0] !== '--tag' || !args[1]) {
    throw new Error('Usage: node scripts/release_metadata.mjs --tag vX.Y.Z[-prerelease]');
  }
  return args[1];
}

/**
 * Lit le nom facultatif dans la seule section du tag demandé, jamais dans une autre version.
 * Sans section ou marqueur, conserve le tag ; un marqueur ambigu ou non sûr est refusé
 * avant toute écriture dans GITHUB_OUTPUT. Le nom est une donnée, pas une commande shell.
 */
export function resolveReleaseTitle(changelog, tag) {
  const { version } = resolveReleaseMetadata(tag, tag.slice(1));
  const sections = changelog.replace(/\r\n/g, '\n').split(/^## \[/m);
  const matching = sections.slice(1).filter((section) => section.startsWith(`${version}]`));
  if (matching.length > 1) throw new Error(`Duplicate changelog section for ${tag}.`);
  if (matching.length === 0) return tag;
  const body = matching[0].slice(matching[0].indexOf('\n') + 1);
  const markers = [...body.matchAll(/<!--\s*release-name\b/g)];
  if (markers.length === 0) return tag;
  if (markers.length !== 1) throw new Error(`Duplicate release-name for ${tag}.`);
  const line = body.split('\n').find((value) => /<!--\s*release-name\b/.test(value));
  const match = /^[ \t]*<!-- release-name: ([^\r\n]*?) -->[ \t]*$/.exec(line ?? '');
  const name = match?.[1];
  if (!name || name !== name.trim() || [...name].length > 80 || /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(name)) {
    throw new Error(`Invalid release-name for ${tag}: expected one safe line of 1–80 characters.`);
  }
  return `Palabre ${tag} — ${name}`;
}

async function main() {
  const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  const metadata = resolveReleaseMetadata(parseTag(process.argv.slice(2)), packageJson.version);
  const changelog = await readFile(path.join(root, 'CHANGELOG.md'), 'utf8');
  const releaseTitle = resolveReleaseTitle(changelog, `v${metadata.version}`);
  const output = process.env.GITHUB_OUTPUT;

  if (output) {
    await appendFile(output, [
      `version=${metadata.version}`,
      `prerelease=${String(metadata.prerelease)}`,
      `npm_tag=${metadata.npmTag}`,
      `make_latest=${String(metadata.makeLatest)}`,
      `release_title=${releaseTitle}`,
      ''
    ].join('\n'), 'utf8');
  }

  console.log(JSON.stringify({ ...metadata, releaseTitle }));
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
