/** @file Lecture du paquet et amorçage du skill sur profils fictifs, sans agent réel ni réseau. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, type TestContext } from "node:test";
import { inspectSkillRuntime } from "../src/skillRuntime.js";

/** Paquet jetable distinct du cwd et des emplacements de skills installés. */
function fixture(t: TestContext) {
  const root = realpathSync(mkdtempSync(path.join(os.tmpdir(), "palabre-skill-runtime-")));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(path.join(root, "references"));
  for (const name of ["relay", "relay-desktop", "relay-opencode", "relay-frozen", "chat", "cli", "outputs"]) writeFileSync(path.join(root, "references", `${name}.md`), `# ${name}\n`);
  const file = path.join(root, "SKILL.md");
  const content = '---\nname: palabre\ndescription: Fixture\nmetadata:\n  revision: "2"\n---\n\nConsignes fictives 🧪.\n';
  writeFileSync(file, content);
  return { root, file, content };
}

test("révision absente, ancienne, actuelle et invalide : diagnostic déclaratif sans mutation", t => {
  const f = fixture(t);
  for (const [declared, expected] of [[undefined, "unverified"], ["1", "reload-required"], ["2", "current"], ["3", "reload-required"], ["2x", "unverified"], ["02", "unverified"], ["0", "unverified"], ["9007199254740992", "unverified"], [true, "unverified"]] as const) {
    const result = inspectSkillRuntime(declared, "fr", { source: f.root });
    assert.equal(result.status, expected);
    assert.equal(result.revision, 2);
    assert.equal(result.entrypoint, path.join(f.root, "SKILL.md"));
    assert.equal(result.references?.["relay.md"], path.join(f.root, "references", "relay.md"));
    assert.equal(result.instructions, undefined, "pas de gros texte dans un précontrôle");
    assert.equal(result.action, expected === "current" ? undefined : "read-bundled-skill");
    assert.equal(result.message === undefined, expected === "current", "aucun rappel si actuel");
  }
  assert.equal(readFileSync(f.file, "utf8"), f.content);
  assert.deepEqual(readdirSync(f.root).sort(), ["SKILL.md", "references"]);
});

test("lecture complète Unicode/CRLF et chemins des références du paquet", t => {
  const f = fixture(t);
  for (const prefix of ["", "\uFEFF"]) {
    writeFileSync(f.file, prefix + f.content.replace(/\n/g, "\r\n"));
    const result = inspectSkillRuntime("1", "en", { source: f.root, includeInstructions: true });
    assert.equal(result.status, "reload-required");
    assert.equal(result.instructions, readFileSync(f.file, "utf8"), "BOM et fins de ligne restitués sans perte");
    assert.equal(Object.keys(result.references!).length, 7);
    assert.match(result.message!, /^Before preparing/);
  }
});

test("source invalide ou incomplète : jamais current ni contenu de remplacement", t => {
  const f = fixture(t);
  for (const content of [f.content.replace('"2"', '"0"'), f.content.replace('"2"', '"9007199254740992"'), f.content.replace("metadata:", "other:"), f.content + "x".repeat(65_537), Buffer.from([0xff, 0xfe])]) {
    writeFileSync(f.file, content);
    const result = inspectSkillRuntime("2", "fr", { source: f.root, includeInstructions: true });
    assert.equal(result.status, "unavailable");
    assert.equal(result.instructions, undefined);
    assert.equal(result.revision, undefined);
  }
  writeFileSync(f.file, f.content);
  rmSync(path.join(f.root, "references", "relay.md"));
  assert.equal(inspectSkillRuntime("2", "fr", { source: f.root }).status, "unavailable");
  assert.equal(inspectSkillRuntime("2", "fr", { source: path.join(f.root, "absent") }).status, "unavailable");
});

test("jonction racine admise, référence externe refusée", t => {
  const f = fixture(t);
  const link = path.join(f.root, "package-link");
  symlinkSync(f.root, link, process.platform === "win32" ? "junction" : "dir");
  assert.equal(inspectSkillRuntime("2", "fr", { source: link }).status, "current");
  const outside = fixture(t);
  const reference = path.join(f.root, "references");
  rmSync(reference, { recursive: true });
  symlinkSync(path.join(outside.root, "references"), reference, process.platform === "win32" ? "junction" : "dir");
  assert.equal(inspectSkillRuntime("2", "fr", { source: f.root }).status, "unavailable");
});

test("skill --read : paquet exécuté, sans config/trust/copie installée ni confirmation", t => {
  const f = fixture(t);
  // Le cwd contient une imitation du paquet et une config invalide ; aucun ne doit être consommé.
  mkdirSync(path.join(f.root, "skills", "palabre"), { recursive: true });
  writeFileSync(path.join(f.root, "skills", "palabre", "SKILL.md"), "IMPOSTEUR CWD");
  writeFileSync(path.join(f.root, "palabre.config.json"), "invalide");
  const cli = fileURLToPath(new URL("../src/index.js", import.meta.url));
  const before = readdirSync(f.root).sort();
  for (const declared of [[], ["--skill-revision", "999"], ["--skill-revision", "8"]]) {
    const child = spawnSync(process.execPath, [cli, "skill", "--read", "--json", ...declared], { cwd: f.root, encoding: "utf8" });
    assert.equal(child.status, 0, child.stderr);
    const result = JSON.parse(child.stdout);
    assert.equal(result.kind, "skill-runtime");
    assert.equal(result.v, 1);
    assert.equal(result.revision, 8);
    assert.equal(result.status, declared.at(-1) === "8" ? "current" : declared.length ? "reload-required" : "unverified");
    assert.equal(result.instructions, readFileSync(result.entrypoint, "utf8"));
    assert.ok(!result.instructions.includes("IMPOSTEUR CWD"));
    assert.equal(child.stderr, "");
  }
  assert.deepEqual(readdirSync(f.root).sort(), before);
  for (const extra of [["--yes"], ["--sync"], ["--install", "claude"], ["--check"], ["--trust-config"], ["--config", f.file]]) {
    const child = spawnSync(process.execPath, [cli, "skill", "--read", "--json", ...extra], { cwd: f.root, encoding: "utf8" });
    assert.notEqual(child.status, 0, extra.join(" "));
    assert.equal(child.stdout, "", "aucun plan de mutation ni succès de lecture");
  }
  for (const args of [["run", "--skill-revision", "1", "--subject", "test"], ["ask", "--read", "--subject", "test"]]) {
    const child = spawnSync(process.execPath, [cli, ...args], { cwd: f.root, encoding: "utf8" });
    assert.notEqual(child.status, 0);
    assert.match(child.stderr, /--skill-revision|--read/);
  }
  assert.deepEqual(readdirSync(f.root).sort(), before);
});
