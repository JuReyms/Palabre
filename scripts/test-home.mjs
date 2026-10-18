/** Set a fresh personal directory before a test worker imports application modules. */
import { mkdirSync, mkdtempSync } from 'node:fs';
import path from 'node:path';

if (process.env.NODE_TEST_CONTEXT && process.env.PALABRE_TEST_ROOT) {
  const home = mkdtempSync(path.join(process.env.PALABRE_TEST_ROOT, 'worker-'));
  for (const key of ['HOME', 'USERPROFILE']) process.env[key] = home;
  for (const [key, name] of Object.entries({ APPDATA: 'appdata', LOCALAPPDATA: 'localappdata', XDG_CONFIG_HOME: 'config', XDG_DATA_HOME: 'data', XDG_CACHE_HOME: 'cache', TEMP: 'tmp', TMP: 'tmp', TMPDIR: 'tmp' })) {
    process.env[key] = path.join(home, name);
    mkdirSync(process.env[key], { recursive: true });
  }
}
