/** @file Trust maintenance regressions on fictional registries; no real personal data. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmod, mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { isConfigTrusted, planTrustPrune, pruneTrust, trustConfig } from "../src/configTrust.js";
import { runPruneTrustCommand, type PruneTrustIo } from "../src/commands/pruneTrust.js";

/** An existing config, one missing config and a dedicated registry. */
async function fixture(t: { after(fn: () => Promise<unknown>): void }) {
  const root = await mkdtemp(path.join(os.tmpdir(), "prune-trust-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const file = path.join(root, "kept.json");
  const missing = path.join(root, "missing.json");
  const registry = path.join(root, "trusted-configs.json");
  await writeFile(file, "{}"); await writeFile(missing, "{}");
  await trustConfig(file, registry); await trustConfig(missing, registry); await rm(missing);
  const original = await readFile(registry, "utf8");
  const lines: string[] = [];
  const io: PruneTrustIo = { interactive: true, print: line => lines.push(line), confirm: async () => true };
  return { root, file, missing, registry, original, lines, io };
}

test("pruning removes only missing configurations and backs up exact bytes", async t => {
  const f = await fixture(t);
  const before = JSON.parse(f.original);
  const plan = await planTrustPrune(f.registry);
  assert.deepEqual(plan.missing, [process.platform === "win32" ? f.missing.toLowerCase() : f.missing]);
  const result = await pruneTrust(plan, f.registry);
  assert.equal(result.removed, 1);
  assert.equal(await readFile(result.backup!, "utf8"), f.original);
  const after = JSON.parse(await readFile(f.registry, "utf8"));
  assert.deepEqual(Object.values(after.configs), [before.configs[Object.keys(after.configs)[0]!]]);
  assert.equal(await isConfigTrusted(f.file, f.registry), true);
});

test("file recreated during confirmation is retained", async t => {
  const f = await fixture(t);
  const plan = await planTrustPrune(f.registry);
  await writeFile(f.missing, "{}");
  assert.deepEqual(await pruneTrust(plan, f.registry), { removed: 0 });
  assert.equal(await readFile(f.registry, "utf8"), f.original);
  assert.equal((await readdir(f.root)).some(n => n.endsWith(".bak")), false);
});

test("an existing but changed config keeps its original approval without becoming trusted", async t => {
  const f = await fixture(t);
  await writeFile(f.file, '{"changed":true}');
  await pruneTrust(await planTrustPrune(f.registry), f.registry);
  const after = JSON.parse(await readFile(f.registry, "utf8"));
  const before = JSON.parse(f.original);
  assert.deepEqual(after.configs, Object.fromEntries(Object.entries(before.configs).filter(([file]) => file !== (process.platform === "win32" ? f.missing.toLowerCase() : f.missing))));
  assert.equal(await isConfigTrusted(f.file, f.registry), false);
});

test("inaccessible config path is retained", { skip: process.platform === "win32" || process.getuid?.() === 0 }, async t => {
  const f = await fixture(t);
  const directory = path.join(f.root, "private");
  await mkdir(directory);
  const file = path.join(directory, "config.json");
  await writeFile(file, "{}"); await trustConfig(file, f.registry);
  await chmod(directory, 0);
  t.after(() => chmod(directory, 0o700).catch(() => undefined));
  try {
    const plan = await planTrustPrune(f.registry);
    assert.equal(plan.inaccessible, 1);
    assert.equal(plan.missing.includes(file), false);
  } finally { await chmod(directory, 0o700); }
});

test("registry changed after preview is refused without backup or lost approval", async t => {
  const f = await fixture(t);
  const plan = await planTrustPrune(f.registry);
  await trustConfig(f.file, f.registry);
  // Make the drift deterministic even if timestamps coincide.
  await writeFile(f.registry, (await readFile(f.registry, "utf8")) + " ");
  const changed = await readFile(f.registry, "utf8");
  await assert.rejects(pruneTrust(plan, f.registry), /trust-registry-changed/);
  assert.equal(await readFile(f.registry, "utf8"), changed);
  assert.equal((await readdir(f.root)).some(n => n.endsWith(".bak")), false);
});

for (const raw of ["not json", "null", '{"v":2,"configs":{}}', '{"v":1,"configs":[]}', '{"v":1,"configs":{"relative":{}}}']) test(`corrupt registry is never rewritten: ${raw}`, async t => {
  const f = await fixture(t); await writeFile(f.registry, raw);
  await assert.rejects(planTrustPrune(f.registry));
  assert.equal(await readFile(f.registry, "utf8"), raw);
});

for (const mode of ["preview", "decline", "non-interactive", "yes", "json", "confirm"] as const) test(`maintenance command: ${mode}`, async t => {
  const f = await fixture(t);
  f.io.interactive = mode !== "non-interactive";
  let prompts = 0;
  f.io.confirm = async () => { prompts++; return mode !== "decline"; };
  const flags = { "prune-trust": true, language: "fr", ...(mode === "preview" ? { "dry-run": true } : mode === "yes" ? { yes: true } : mode === "json" ? { json: true } : {}) };
  const action = runPruneTrustCommand(flags, [], f.io, f.registry);
  if (["non-interactive", "yes", "json"].includes(mode)) await assert.rejects(action, /terminal|sans autre option/);
  else await action;
  assert.equal(prompts, mode === "decline" || mode === "confirm" ? 1 : 0);
  if (mode !== "confirm") assert.equal(await readFile(f.registry, "utf8"), f.original);
  else assert.match(f.lines.join("\n"), /retirées : 1[\s\S]*Sauvegarde/);
});

test("missing registry is a no-op and never creates the personal directory", async t => {
  const f = await fixture(t);
  const absent = path.join(f.root, "absent", "trusted-configs.json");
  const plan = await planTrustPrune(absent);
  assert.deepEqual(plan.missing, []);
  assert.deepEqual(await pruneTrust(plan, absent), { removed: 0 });
  await assert.rejects(readFile(absent), { code: "ENOENT" });
});

test("malformed approval fields are refused instead of coerced", async t => {
  const f = await fixture(t);
  const store = JSON.parse(f.original);
  store.configs[Object.keys(store.configs)[0]!].sha256 = ["a".repeat(64)];
  const raw = JSON.stringify(store);
  await writeFile(f.registry, raw);
  await assert.rejects(planTrustPrune(f.registry));
  assert.equal(await readFile(f.registry, "utf8"), raw);
});

test("a directory at a config path is kept; unreadable registry directory is refused", async t => {
  const f = await fixture(t);
  await mkdir(f.missing);
  assert.deepEqual((await planTrustPrune(f.registry)).missing, []);
  await assert.rejects(planTrustPrune(f.root));
});

test("CLI preview bypasses untrusted project config without reading or creating one", async t => {
  const f = await fixture(t);
  const home = path.join(f.root, "home");
  await mkdir(path.join(home, ".palabre"), { recursive: true });
  await writeFile(path.join(home, ".palabre", "trusted-configs.json"), f.original);
  await writeFile(path.join(f.root, "palabre.config.json"), "invalid project JSON");
  const cli = path.resolve(".tmp/test-dist/src/index.js");
  const result = spawnSync(process.execPath, [cli, "config", "--prune-trust", "--dry-run", "--language", "en"], { cwd: f.root, env: { ...process.env, HOME: home, USERPROFILE: home }, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Obsolete approvals: 1/);
  assert.equal(await readFile(path.join(home, ".palabre", "trusted-configs.json"), "utf8"), f.original);
});
