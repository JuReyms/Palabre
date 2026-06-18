import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildContextScan } from "../src/contextScan.js";
import { createTranslator } from "../src/i18n.js";

test("buildContextScan returns the files Palabre would inject through --context", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "palabre-context-scan-"));
  await mkdir(path.join(root, "src"));
  await mkdir(path.join(root, "docs"));
  await mkdir(path.join(root, "node_modules"));
  await writeFile(path.join(root, "src", "app.ts"), "export const app = true;\n");
  await writeFile(path.join(root, "docs", "readme.md"), "# Docs\n");
  await writeFile(path.join(root, "node_modules", "ignored.ts"), "ignored\n");
  await writeFile(path.join(root, "image.png"), "not a supported text extension\n");

  const result = await buildContextScan(["."], root, createTranslator("en"));
  const files = result.items.filter((item) => item.kind === "file");
  const folders = result.items.filter((item) => item.kind === "folder");

  assert.equal(result.v, 1);
  assert.equal(result.root, root);
  assert.deepEqual(result.scanned, ["."]);
  assert.deepEqual(files.map((item) => item.path), ["docs/readme.md", "src/app.ts"]);
  assert.equal(folders.find((item) => item.path === ".")?.filesCount, 2);
  assert.equal(folders.find((item) => item.path === "docs")?.filesCount, 1);
  assert.equal(folders.find((item) => item.path === "src")?.filesCount, 1);
  assert.equal(files.find((item) => item.path === "src/app.ts")?.absolutePath, path.join(root, "src", "app.ts"));
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0] ?? "", /image\.png/);
});

test("buildContextScan defaults to the current folder when no path is provided", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "palabre-context-scan-default-"));
  await writeFile(path.join(root, "README.md"), "# Project\n");

  const result = await buildContextScan([], root, createTranslator("en"));

  assert.deepEqual(result.scanned, ["."]);
  assert.equal(result.items.find((item) => item.kind === "file")?.path, "README.md");
});

test("buildContextScan reports missing context paths as warnings", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "palabre-context-scan-missing-"));

  const result = await buildContextScan(["missing.md"], root, createTranslator("en"));

  assert.deepEqual(result.scanned, ["missing.md"]);
  assert.deepEqual(result.items, []);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0] ?? "", /missing\.md/);
});
