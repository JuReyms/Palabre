/** Run all automated tests with isolated personal directories and a real-profile guard. */
import { spawn } from 'node:child_process';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { guardProfile } from './test-profile.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const guard = await guardProfile(os.homedir());
let temporary;
try {
  temporary = await mkdtemp(path.join(os.tmpdir(), 'palabre-test-homes-'));
  const files = process.argv.slice(2);
  if (!files.length) {
    for (const name of (await readdir(path.join(root, '.tmp/test-dist/tests'))).sort()) if (name.endsWith('.test.js')) files.push(path.join(root, '.tmp/test-dist/tests', name));
    files.push(path.join(root, 'scripts/test-profile.test.mjs'), path.join(root, 'scripts/post_release_bluesky.test.mjs'));
  }
  const code = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', new URL('./test-home.mjs', import.meta.url).href, '--test', ...files], {
      cwd: root, stdio: 'inherit', env: { ...process.env, PALABRE_TEST_ROOT: temporary, HOME: temporary, USERPROFILE: temporary }
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve(signal ? 1 : code ?? 1));
  });
  process.exitCode = code;
} finally {
  try { console.log(`Real ~/.palabre unchanged (SHA-256 contents + metadata): ${await guard.finish()}`); }
  finally { if (temporary) await rm(temporary, { recursive: true, force: true, maxRetries: 5 }); }
}
