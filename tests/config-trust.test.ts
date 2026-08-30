import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  isConfigTrusted,
  isImplicitProjectConfig,
  refreshTrustedConfig,
  trustConfig
} from "../src/configTrust.js";

test("isImplicitProjectConfig recognizes only default configs at the project root", () => {
  const cwd = path.resolve("C:/project");
  assert.equal(isImplicitProjectConfig(path.join(cwd, "palabre.config.json"), cwd, ["palabre.config.json", "chicane.config.json"]), true);
  assert.equal(isImplicitProjectConfig(path.join(cwd, "chicane.config.json"), cwd, ["palabre.config.json", "chicane.config.json"]), true);
  assert.equal(isImplicitProjectConfig(path.join(cwd, "nested", "palabre.config.json"), cwd, ["palabre.config.json", "chicane.config.json"]), false);
});

test("trustConfig binds approval to the exact file content", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "palabre-config-trust-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const configPath = path.join(root, "palabre.config.json");
  const trustPath = path.join(root, "trusted-configs.json");
  await writeFile(configPath, "{\"agents\":{}}\n", "utf8");

  assert.equal(await isConfigTrusted(configPath, trustPath), false);
  await trustConfig(configPath, trustPath);
  assert.equal(await isConfigTrusted(configPath, trustPath), true);

  await writeFile(configPath, "{\"agents\":{\"changed\":{}}}\n", "utf8");
  assert.equal(await isConfigTrusted(configPath, trustPath), false);
});

test("refreshTrustedConfig updates only an existing approval", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "palabre-config-refresh-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const configPath = path.join(root, "palabre.config.json");
  const trustPath = path.join(root, "trusted-configs.json");
  await writeFile(configPath, "{\"agents\":{}}\n", "utf8");

  await refreshTrustedConfig(configPath, trustPath);
  assert.equal(await isConfigTrusted(configPath, trustPath), false);

  await trustConfig(configPath, trustPath);
  await writeFile(configPath, "{\"agents\":{\"updated\":{}}}\n", "utf8");
  await refreshTrustedConfig(configPath, trustPath);
  assert.equal(await isConfigTrusted(configPath, trustPath), true);
});

test("concurrent trust updates retain every approval and leave no lock or temporary file", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "palabre-config-trust-concurrent-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const first = path.join(root, "first.config.json");
  const second = path.join(root, "second.config.json");
  const trustPath = path.join(root, "trusted-configs.json");
  await Promise.all([
    writeFile(first, "{\"agents\":{\"first\":{}}}\n", "utf8"),
    writeFile(second, "{\"agents\":{\"second\":{}}}\n", "utf8")
  ]);

  await Promise.all([trustConfig(first, trustPath), trustConfig(second, trustPath)]);

  assert.equal(await isConfigTrusted(first, trustPath), true);
  assert.equal(await isConfigTrusted(second, trustPath), true);
  assert.deepEqual((await readdir(root)).filter((name) => name.includes(".tmp") || name.endsWith(".lock")), []);
  assert.equal(JSON.parse(await readFile(trustPath, "utf8")).v, 1);
});
