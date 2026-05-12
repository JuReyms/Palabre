import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_OUTPUT_DIR, resolveOutputDir } from "../src/config.js";

test("resolveOutputDir groups default and legacy root exports in .palabre", () => {
  assert.equal(DEFAULT_OUTPUT_DIR, ".palabre");
  assert.equal(resolveOutputDir(undefined), ".palabre");
  assert.equal(resolveOutputDir(""), ".palabre");
  assert.equal(resolveOutputDir("."), ".palabre");
});

test("resolveOutputDir preserves explicit custom output folders", () => {
  assert.equal(resolveOutputDir("debates"), "debates");
  assert.equal(resolveOutputDir("exports/palabre"), "exports/palabre");
});
