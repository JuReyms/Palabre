/** @file Version post-update : faux exécutables et profils jetables, aucun gestionnaire ni agent réel. */
import assert from "node:assert/strict";
import { chmodSync, copyFileSync, linkSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { verifyUpdatedCommand } from "../src/updateVerification.js";
import { resolveExecutablePath } from "../src/exec.js";
import { createUpdatePlan, type UpdateInfo } from "../src/update.js";
import type { ExternalProcessResult } from "../src/externalSessions/process.js";
import { npmPowerShellShim } from "./fixtures/external-sessions/npm-shim.js";
import { pnpmPowerShellShim } from "./fixtures/pnpm-shim.js";

function info(): UpdateInfo {
  return { version: "0.22.0", latestVersion: "0.22.1", projectRoot: os.tmpdir(), sourceCheckout: false, channel: "npm-global", steps: createUpdatePlan("npm-global", "0.22.1") };
}
function result(overrides: Partial<ExternalProcessResult> = {}): ExternalProcessResult {
  return { started: true, exitCode: 0, signal: null, forcedReturn: false, stdout: "0.22.1\n", stderr: "", outputBytes: 7, durationMs: 1, ...overrides };
}
const resolved = () => ({ command: process.execPath, prefixArgs: ["/fixture/palabre.cjs"], entrypoint: "/fixture/palabre" });
function fixture(t: test.TestContext): string {
  const root = mkdtempSync(path.join(os.tmpdir(), "update-verification-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}
function usePath(t: test.TestContext, directories: string[]): void {
  const original = process.env.PATH;
  process.env.PATH = directories.join(path.delimiter);
  t.after(() => { if (original === undefined) delete process.env.PATH; else process.env.PATH = original; });
}

test("sonde unique bornée : arguments structurés et aucune comparaison npm pour chaque gestionnaire", async () => {
  for (const channel of ["npm-global", "pnpm-global", "yarn-global", "bun-global"] as const) {
    let calls = 0;
    const observed = await verifyUpdatedCommand({ ...info(), channel }, { resolve: resolved, run: async spec => {
      calls++;
      assert.equal(spec.command, process.execPath);
      assert.deepEqual(spec.args, ["/fixture/palabre.cjs", "--version"]);
      assert.equal(spec.stdin, ""); assert.equal(spec.timeoutMs, 15_000); assert.equal(spec.maxOutputBytes, 32 * 1024);
      assert.equal(spec.killGraceMs, 1_000);
      return result();
    } });
    assert.equal(calls, 1);
    assert.deepEqual(observed, { status: "verified", expectedVersion: "0.22.1", actualVersion: "0.22.1", command: "/fixture/palabre" });
  }
});

test("ancienne version prioritaire : écart explicite, sans réessai", async () => {
  let calls = 0;
  const observed = await verifyUpdatedCommand(info(), { resolve: resolved, run: async () => { calls++; return result({ stdout: "0.22.0\r\n" }); } });
  assert.equal(calls, 1); assert.equal(observed.status, "mismatch"); assert.equal(observed.actualVersion, "0.22.0");
});

test("exit non nul, signal, délai, dépassement et sortie partielle ne prouvent aucune version", async () => {
  for (const overrides of [
    { exitCode: 1 }, { started: false }, { signal: "SIGTERM" as const }, { stopReason: "timeout" as const },
    { stopReason: "output-too-large" as const }, { stopReason: "cancelled" as const }, { forcedReturn: true },
    { stdout: "" }, { stdout: "0.22.1\nautre texte" }, { stdout: "\u001b[31m0.22.1" }, { stdout: "version 0.22.1" }
  ]) {
    const observed = await verifyUpdatedCommand(info(), { resolve: resolved, run: async () => result(overrides) });
    assert.equal(observed.status, "unverified"); assert.equal(observed.actualVersion, undefined);
  }
  assert.equal((await verifyUpdatedCommand(info(), { resolve: resolved, run: async () => { throw Error("private output"); } })).status, "unverified");
});

test("version attendue inconnue ou invalide et commande introuvable : aucun lancement", async () => {
  const run = async () => { throw Error("must not run"); };
  for (const latestVersion of [undefined, "latest", "0.22.1\ncommande"]) {
    assert.equal((await verifyUpdatedCommand({ ...info(), latestVersion }, { resolve: () => { throw Error("must not resolve"); }, run })).status, "unverified");
  }
  assert.equal((await verifyUpdatedCommand(info(), { resolve: () => undefined, run })).status, "unverified");
});

test("checkout source : manifeste relu après installation, sans reprendre la version de l'ancien processus", async t => {
  const root = fixture(t);
  writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "palabre", version: "0.23.0-beta.2" }));
  const observed = await verifyUpdatedCommand({ ...info(), channel: "source", sourceCheckout: true, projectRoot: root }, {
    resolve: resolved, run: async () => result({ stdout: "0.23.0-beta.2" })
  });
  assert.equal(observed.status, "verified"); assert.equal(observed.expectedVersion, "0.23.0-beta.2");
  for (const text of ["invalide", JSON.stringify({ name: "other", version: "0.22.1" }), " ".repeat(33 * 1024)]) {
    writeFileSync(path.join(root, "package.json"), text);
    assert.equal((await verifyUpdatedCommand({ ...info(), channel: "source", projectRoot: root }, { resolve: () => { throw Error("must not resolve"); } })).status, "unverified");
  }
});

test("résolution fraîche après installation : le cache ne conserve pas un ancien emplacement", async t => {
  const root = fixture(t), first = path.join(root, "first"), second = path.join(root, "second");
  mkdirSync(first); mkdirSync(second); usePath(t, [first, second]);
  const extension = process.platform === "win32" ? ".exe" : "";
  const before = path.join(first, "palabre" + extension), after = path.join(second, "palabre" + extension);
  writeFileSync(before, "fixture"); writeFileSync(after, "fixture");
  const extensions = process.platform === "win32" ? [".exe", ".com", ".ps1", ".cmd", ".bat", ""] : [""];
  assert.equal(resolveExecutablePath("palabre", extensions), before);
  rmSync(before);
  let command: string | undefined;
  const observed = await verifyUpdatedCommand(info(), { run: async spec => { command = spec.command; return result(); } });
  assert.equal(command, after); assert.equal(observed.command, after); assert.equal(observed.status, "verified");
  rmSync(after);
  assert.equal((await verifyUpdatedCommand(info(), { run: async () => { throw Error("must not run"); } })).status, "unverified");
  assert.equal(resolveExecutablePath("palabre", extensions), undefined);
});

test("POSIX : la première commande PATH est exécutée, même si une version plus récente existe ailleurs", { skip: process.platform === "win32" }, async t => {
  const root = fixture(t), first = path.join(root, "ancienne installation ; $texte"), second = path.join(root, "nouvelle installation");
  for (const [dir, version] of [[first, "0.22.0"], [second, "0.22.1"]]) {
    mkdirSync(dir); const file = path.join(dir, "palabre");
    writeFileSync(file, `#!${process.execPath}\nprocess.stdout.write(${JSON.stringify(version)});`); chmodSync(file, 0o755);
  }
  usePath(t, [first, second]);
  const observed = await verifyUpdatedCommand(info(), { cwd: root });
  assert.equal(observed.status, "mismatch"); assert.equal(observed.command, path.join(first, "palabre"));
});

test("Windows : shims npm et pnpm reconnus, Node lancé directement avec --version", { skip: process.platform !== "win32" }, async t => {
  const root = fixture(t); usePath(t, [root]);
  const node = path.join(root, "node.exe");
  try { linkSync(process.execPath, node); } catch { copyFileSync(process.execPath, node); }
  const relative = "node_modules/palabre/dist/index.cjs", script = path.join(root, relative);
  mkdirSync(path.dirname(script), { recursive: true });
  writeFileSync(script, "if(JSON.stringify(process.argv.slice(2))!==JSON.stringify(['--version']))process.exit(2);process.stdout.write('0.22.1');");
  for (const shim of [npmPowerShellShim(relative), pnpmPowerShellShim(relative, "C:\\fixture\\node_modules")]) {
    writeFileSync(path.join(root, "palabre.ps1"), shim);
    const observed = await verifyUpdatedCommand(info(), { cwd: root });
    assert.equal(observed.status, "verified"); assert.equal(observed.command, path.join(root, "palabre.ps1"));
  }
});

test("Windows : wrapper inconnu prioritaire, aucun repli vers une installation suivante", { skip: process.platform !== "win32" }, async t => {
  const root = fixture(t), second = path.join(root, "second"); mkdirSync(second); usePath(t, [root, second]);
  writeFileSync(path.join(root, "palabre.cmd"), "@echo off\r\necho 0.22.0\r\n");
  writeFileSync(path.join(second, "palabre.exe"), "fixture");
  let calls = 0;
  assert.equal((await verifyUpdatedCommand(info(), { run: async () => { calls++; return result(); } })).status, "unverified");
  assert.equal(calls, 0);
});
