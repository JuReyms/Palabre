/** @file Garde le budget de contexte même quand un fichier grandit pendant sa lecture. */
import assert from "node:assert/strict";
import { appendFile, mkdtemp, open, rm, writeFile, type FileHandle } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { loadProjectFiles } from "../src/context.js";

test("un fichier explicite qui grandit après stat est refusé", async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), "palabre-context-cap-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const target = path.join(root, "notes.txt");
  await writeFile(target, "a");
  const fixture = await open(target);
  const stat = fixture.stat;
  const prototype = Object.getPrototypeOf(fixture);
  await fixture.close();
  const observed = t.mock.method(prototype, "stat", async function(this: FileHandle) {
    const result = await stat.call(this);
    await appendFile(target, "b".repeat(64 * 1024));
    return result;
  });
  await assert.rejects(loadProjectFiles([target], root), /65537/);
  assert.equal(observed.mock.callCount(), 1);
});
