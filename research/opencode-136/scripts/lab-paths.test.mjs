/** Aucun moteur : les erreurs de sélection arrêtent l'essai avant la création du laboratoire. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { verifyLabBinary } from './lab-paths.mjs';

test('sans binaire explicite, aucun moteur ni dossier de laboratoire n’est créé', () => {
  const local = fileURLToPath(new URL('../.local/', import.meta.url));
  const before = fs.existsSync(local) ? fs.readdirSync(local).sort() : [];
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => key !== 'PALABRE_LAB_OPENCODE'));
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `import {prepareLab} from ${JSON.stringify(new URL('./lab-paths.mjs', import.meta.url).href)}; prepareLab('not-created');`], { env, encoding: 'utf8', windowsHide: true });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /PALABRE_LAB_OPENCODE/);
  assert.deepEqual(fs.existsSync(local) ? fs.readdirSync(local).sort() : [], before);
});

test('un fichier fictif ne peut pas remplacer silencieusement le moteur qualifié', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'opencode-binary-witness-'));
  try {
    const file = path.join(directory, 'opencode.exe');
    fs.writeFileSync(file, 'This is not an executable.');
    assert.throws(() => verifyLabBinary(file), /Binaire différent|Windows seulement/);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
