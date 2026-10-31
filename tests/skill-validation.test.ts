/** @file Le validateur vérifie les références livrées et un vrai budget de lecture sur copies fictives. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { inspectSkillRuntime } from "../src/skillRuntime.js";

/** Copie jetable : ni skill installé ni profil réel consommés par le validateur. */
function fixture(t: test.TestContext) {
  const root = mkdtempSync(path.join(os.tmpdir(), "palabre-skill-validation-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(path.join(root, "skills"));
  cpSync(path.resolve("skills/palabre"), path.join(root, "skills/palabre"), { recursive: true });
  writeFileSync(path.join(root, "package.json"), JSON.stringify({ files: ["skills/"] }));
  const file = path.join(root, "skills/palabre/SKILL.md");
  const run = () => spawnSync(process.execPath, [path.resolve("scripts/validate_skill.mjs")], { cwd: root, encoding: "utf8" });
  return { root, file, run };
}

test("skill livré : toutes les références se résolvent sans agent, réseau ni écriture", t => {
  const f = fixture(t);
  const before = readFileSync(f.file, "utf8");
  const r = f.run();
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(readFileSync(f.file, "utf8"), before);
});

test("frontmatter : validateur et runtime concordent sur BOM, LF/CRLF et clôture exacte", t => {
  const f = fixture(t);
  const original = readFileSync(f.file, "utf8").replace(/\r\n/g, "\n");
  const revision = original.match(/^  revision: "(\d+)"$/m)![1]!;
  const root = path.join(f.root, "skills/palabre");
  for (const ending of ["\n", "\r\n"]) for (const prefix of ["", "\uFEFF"]) {
    const source = prefix + original.replace(/\n/g, ending);
    writeFileSync(f.file, source);
    const checked = f.run();
    assert.equal(checked.status, 0, checked.stderr);
    const runtime = inspectSkillRuntime(revision, "fr", { source: root, includeInstructions: true });
    assert.equal(runtime.status, "current");
    assert.equal(runtime.instructions, source);
  }
  for (const closing of ["-----", "---suite", "-----\n---"]) {
    writeFileSync(f.file, original.replace(/\n---\n/, `\n${closing}\n`));
    assert.equal(f.run().status, 1, `clôture invalide : ${closing}`);
    assert.equal(inspectSkillRuntime(revision, "fr", { source: root }).status, "unavailable");
  }
});

test("la description reste un scalaire YAML valide pour les hôtes stricts", t => {
  const f = fixture(t);
  const before = readFileSync(f.file, "utf8");
  for (const broken of ["Palabre : Relay", "Palabre:\tRelay", "Palabre #Relay", "- Palabre"]) {
    writeFileSync(f.file, before.replace(/^description: /m, `description: ${broken} `));
    assert.match(f.run().stderr, /plain YAML scalar/, broken);
  }
});

test("un paragraphe énorme ne contourne pas le budget grâce à une seule ligne", t => {
  const f = fixture(t);
  writeFileSync(f.file, readFileSync(f.file, "utf8") + "\n" + "x".repeat(1_201) + "\n");
  const r = f.run();
  assert.equal(r.status, 1);
  assert.match(r.stderr, /paragraph exceeding 1200/);
});

test("le budget total reste borné même avec des paragraphes courts", t => {
  const f = fixture(t);
  writeFileSync(f.file, readFileSync(f.file, "utf8") + ("\n\n" + "x".repeat(200)).repeat(10));
  const r = f.run();
  assert.equal(r.status, 1);
  assert.match(r.stderr, /exceeds 10000 characters/);
});

test("une référence conditionnelle absente ou un lien cassé est refusé", t => {
  const f = fixture(t);
  const desktop = path.join(f.root, "skills/palabre/references/relay-desktop.md");
  const before = readFileSync(desktop, "utf8");
  writeFileSync(desktop, before + "\n`references/chat.md`\n");
  assert.match(f.run().stderr, /unresolved reference/);
  unlinkSync(desktop);
  assert.match(f.run().stderr, /missing .*relay-desktop/);
});

test("une nouvelle référence non déclarée ne passe pas silencieusement", t => {
  const f = fixture(t);
  writeFileSync(f.file, readFileSync(f.file, "utf8") + "\n`references/introuvable.md`\n");
  assert.match(f.run().stderr, /unresolved reference references\/introuvable.md/);
});

test("un bump de révision exige des recettes cohérentes et un entier sûr", t => {
  const f = fixture(t);
  const before = readFileSync(f.file, "utf8");
  writeFileSync(f.file, before.replace('revision: "11"', 'revision: "12"'));
  assert.match(f.run().stderr, /recipes must declare metadata.revision/);
  writeFileSync(f.file, before.replace('revision: "11"', 'revision: "12"').replaceAll("--skill-revision 11", "--skill-revision 12"));
  assert.equal(f.run().status, 0);
  writeFileSync(f.file, before.replace('revision: "11"', 'revision: "9007199254740992"'));
  assert.match(f.run().stderr, /positive safe metadata.revision/);
});
