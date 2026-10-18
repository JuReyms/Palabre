/** @file The standard test runner isolates both imports and inherited CLI processes. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { CONFIG_TRUST_PATH } from "../src/configTrust.js";
import { GLOBAL_CONFIG_PATH, GLOBAL_LEGACY_CONFIG_PATH } from "../src/config.js";
import { writeRoot } from "../src/externalSessions/write.js";

test("all global PALABRE paths and child processes inherit the worker's temporary home", () => {
  assert.ok(process.env.PALABRE_TEST_ROOT, "Use node scripts/test.mjs after pnpm build:test, not node --test directly.");
  const home = os.homedir();
  const relative = path.relative(process.env.PALABRE_TEST_ROOT!, home);
  assert.ok(relative && !relative.startsWith("..") && !path.isAbsolute(relative));
  for (const file of [CONFIG_TRUST_PATH, GLOBAL_CONFIG_PATH, GLOBAL_LEGACY_CONFIG_PATH, writeRoot()]) assert.ok(file.startsWith(path.join(home, ".palabre") + path.sep), file);
  const child = spawnSync(process.execPath, ["-e", "process.stdout.write(require('node:os').homedir())"], { encoding: "utf8" });
  assert.equal(child.status, 0, child.stderr);
  assert.equal(child.stdout, home);
});
