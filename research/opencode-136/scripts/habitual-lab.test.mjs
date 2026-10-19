/** Données jetables seulement ; aucun moteur OpenCode, compte ou réseau. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { prepareHabitualLab, checkHabitualLab } from './habitual-lab.mjs';

function withLab(run) {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'opencode-habitual-test-'));
  try { return run(prepareHabitualLab(parent)); }
  finally { fs.rmSync(parent, { recursive: true, force: true }); }
}

test('préparation neuve : quatre témoins, contexte hors projet, aucune config OpenCode', () => withLab(lab => {
  assert.equal(checkHabitualLab(lab.root).trackedFixtureFilesUnchanged, true);
  assert.deepEqual(fs.readdirSync(lab.project).sort(), ['AGENTS.md', 'README.md', 'src', 'test']);
  const context = /CONTEXTE-136-[a-f0-9-]+/.exec(lab.seedPrompt)?.[0];
  assert.ok(context);
  for (const relative of ['README.md', 'AGENTS.md', 'src/total.mjs', 'test/total.test.mjs']) {
    assert.equal(fs.readFileSync(path.join(lab.project, relative), 'utf8').includes(context), false);
  }
  assert.match(fs.readFileSync(lab.instructions, 'utf8'), /opencode --standalone/);
}));

test('le relevé détecte une modification et une disparition sans prétendre couvrir les ajouts', () => withLab(lab => {
  fs.appendFileSync(path.join(lab.project, 'src/total.mjs'), '\n// Modification fictive\n');
  fs.rmSync(path.join(lab.project, 'README.md'));
  const result = checkHabitualLab(lab.root);
  assert.equal(result.trackedFixtureFilesUnchanged, false);
  assert.deepEqual(result.changed, ['src/total.mjs']);
  assert.deepEqual(result.missing, ['README.md']);
  assert.match(result.scope, /ni-nouveaux-fichiers/);
}));
