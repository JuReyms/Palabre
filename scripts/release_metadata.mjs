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

async function main() {
  const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  const metadata = resolveReleaseMetadata(parseTag(process.argv.slice(2)), packageJson.version);
  const output = process.env.GITHUB_OUTPUT;

  if (output) {
    await appendFile(output, [
      `version=${metadata.version}`,
      `prerelease=${String(metadata.prerelease)}`,
      `npm_tag=${metadata.npmTag}`,
      `make_latest=${String(metadata.makeLatest)}`,
      ''
    ].join('\n'), 'utf8');
  }

  console.log(JSON.stringify(metadata));
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
