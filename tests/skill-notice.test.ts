/** @file Rappel du skill après mise à jour : plans et flux fictifs, aucun profil ni copie réelle lus. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";
import { printSkillReminder, skillReminderText, withSkillReminder, type SkillReminderStreams } from "../src/skillNotice.js";
import type { SkillCopy, SkillSyncPlan } from "../src/skillSync.js";
import { BUNDLED_SKILL_ROOT } from "../src/skillSync.js";
import { getPackageVersion } from "../src/version.js";

type Flags = Record<string, string | string[] | boolean>;

function fakePlan(...states: SkillCopy["state"][]): SkillSyncPlan {
  return {
    source: "/fictif/paquet/skills/palabre",
    backupRoot: "/fictif/sauvegardes",
    copies: states.map((state, index) => ({ directory: `/fictif/profil/copie-${index}`, state }))
  };
}

function fakeTerminal(tty: { stdin?: boolean; stdout?: boolean; stderr?: boolean } = {}) {
  const stderrWrites: string[] = [];
  const stdoutWrites: string[] = [];
  const stdout = { isTTY: tty.stdout ?? true, write(chunk: string) { stdoutWrites.push(chunk); return true; } };
  const stderr = { isTTY: tty.stderr ?? true, write(chunk: string) { stderrWrites.push(chunk); return true; } };
  const streams: SkillReminderStreams = { stdin: { isTTY: tty.stdin ?? true }, stdout, stderr };
  return { streams, stderrWrites, stdoutWrites };
}

test("hors terminal humain ou sortie machine : aucune inspection, aucune langue, aucune écriture", async () => {
  const cases: Array<{ tty: { stdin?: boolean; stdout?: boolean; stderr?: boolean }; flags: Flags }> = [
    { tty: { stdout: false }, flags: {} },
    { tty: { stderr: false }, flags: {} },
    { tty: { stdin: false }, flags: {} },
    { tty: {}, flags: { json: true } },
    { tty: {}, flags: { renderer: "ndjson" } }
  ];
  for (const { tty, flags } of cases) {
    const terminal = fakeTerminal(tty);
    let scans = 0;
    let languages = 0;
    await printSkillReminder({
      flags,
      streams: terminal.streams,
      plan: () => { scans++; return fakePlan("different"); },
      language: () => { languages++; return "fr"; }
    });
    assert.equal(scans, 0);
    assert.equal(languages, 0);
    assert.deepEqual(terminal.stderrWrites, []);
    assert.deepEqual(terminal.stdoutWrites, []);
  }
});

test("terminal humain sans copie ou avec copies identiques : silence sans résoudre la langue", async () => {
  for (const plan of [fakePlan(), fakePlan("current", "current")]) {
    const terminal = fakeTerminal();
    let languages = 0;
    await printSkillReminder({ flags: {}, streams: terminal.streams, plan: () => plan, language: () => { languages++; return "fr"; } });
    assert.equal(languages, 0);
    assert.deepEqual(terminal.stderrWrites, []);
    assert.deepEqual(terminal.stdoutWrites, []);
  }
  assert.equal(skillReminderText(undefined, "en"), undefined);
});

test("copie différente (FR) : trois étapes sur stderr, stdout intact, ni chemin ni verdict d'ancienneté", async () => {
  const terminal = fakeTerminal();
  await printSkillReminder({ flags: {}, streams: terminal.streams, plan: () => fakePlan("current", "different"), language: () => "fr" });
  assert.deepEqual(terminal.stdoutWrites, []);
  assert.equal(terminal.stderrWrites.length, 1);
  const text = terminal.stderrWrites[0]!;
  for (const expected of [
    "Mettre à jour la CLI seule ne synchronise pas les copies du skill",
    "palabre skill --check",
    "palabre skill --sync",
    "personnalisation",
    "nouvelle conversation",
    "ne prouve pas ce que l'agent a chargé"
  ]) assert.ok(text.includes(expected), expected);
  assert.ok(!text.includes("/fictif"));
  assert.doesNotMatch(text, /ancienne|reprenez/i);
});

test("copie illisible (EN) : jamais présentée comme à jour", async () => {
  const terminal = fakeTerminal();
  await printSkillReminder({ flags: { language: "en" }, streams: terminal.streams, plan: () => fakePlan("unreadable"), language: () => "en" });
  const text = terminal.stderrWrites.join("");
  assert.match(text, /could not be compared/);
  assert.match(text, /not treated as up to date/);
  assert.match(text, /palabre skill --check/);
  assert.match(text, /does not prove what the agent has loaded/);
  assert.doesNotMatch(text, /matches the current CLI|customization/);
  assert.deepEqual(terminal.stdoutWrites, []);
});

test("copies différentes et illisibles (FR) : les deux cas sont nommés", () => {
  const text = skillReminderText(fakePlan("different", "unreadable"), "fr") ?? "";
  assert.match(text, /diffèrent de cette CLI/);
  assert.match(text, /n'ont pas pu être comparées/);
});

test("erreur de lecture ou de langue : rappel abandonné sans exception", async () => {
  const failingPlan = fakeTerminal();
  await printSkillReminder({ flags: {}, streams: failingPlan.streams, plan: () => { throw Error("lecture"); }, language: () => "fr" });
  assert.deepEqual(failingPlan.stderrWrites, []);
  const failingLanguage = fakeTerminal();
  await printSkillReminder({ flags: {}, streams: failingLanguage.streams, plan: () => fakePlan("different"), language: async () => { throw Error("langue"); } });
  assert.deepEqual(failingLanguage.stderrWrites, []);
  assert.deepEqual(failingLanguage.stdoutWrites, []);
});

test("accueil TUI : notice existante conservée, rappel ajouté seulement si utile", () => {
  const combined = withSkillReminder("Configuration créée.", fakePlan("different"), "fr");
  assert.ok(combined?.startsWith("Configuration créée. "));
  assert.ok(combined?.includes("palabre skill --sync"));
  assert.equal(withSkillReminder("Configuration créée.", fakePlan("current"), "fr"), "Configuration créée.");
  assert.equal(withSkillReminder(undefined, fakePlan(), "en"), undefined);
  assert.match(withSkillReminder(undefined, fakePlan("unreadable"), "en") ?? "", /^Palabre skill:/);
});

/** Vrai dispatch CLI avec profil et TTY fictifs, sans configuration ni outil IA réel. */
test("CLI aide/version : rappel localisé sur stderr, pipes silencieux et copies inchangées", async t => {
  const root = mkdtempSync(path.join(os.tmpdir(), "skill-notice-cli-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const home = path.join(root, "home");
  const project = path.join(root, "project");
  const copy = path.join(home, ".agents", "skills", "palabre");
  mkdirSync(project, { recursive: true });
  cpSync(BUNDLED_SKILL_ROOT, copy, { recursive: true });
  const file = path.join(copy, "SKILL.md");
  const customized = "Instructions personnalisées, à conserver.\n";
  writeFileSync(file, customized);
  const preload = path.join(root, "tty.mjs");
  writeFileSync(preload, "for (const stream of [process.stdin, process.stdout, process.stderr]) Object.defineProperty(stream, 'isTTY', {value:true});");
  const entry = fileURLToPath(new URL("../src/index.js", import.meta.url));
  const env = { ...process.env, HOME: home, USERPROFILE: home, NO_COLOR: "1", PALABRE_LANGUAGE: "fr" };
  const run = (args: string[], tty = true) => spawnSync(process.execPath,
    [...(tty ? ["--import", pathToFileURL(preload).href] : []), entry, ...args],
    { cwd: project, env, encoding: "utf8", timeout: 30_000 });

  const version = run(["--version", "--language", "en"]);
  assert.equal(version.status, 0, version.stderr);
  assert.equal(version.stdout, `${await getPackageVersion()}\n`);
  assert.match(version.stderr, /Palabre skill:.*customization/);
  assert.match(version.stderr, /palabre skill --check/);
  const help = run(["--help"]);
  const pipedHelp = run(["--help"], false);
  assert.equal(help.status, 0, help.stderr);
  assert.equal(pipedHelp.status, 0, pipedHelp.stderr);
  assert.equal(help.stdout, pipedHelp.stdout);
  assert.match(help.stderr, /Skill Palabre :/);
  assert.equal(pipedHelp.stderr, "");
  for (const flags of [["--json"], ["--renderer", "ndjson"]]) {
    const result = run(["--version", ...flags]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, version.stdout);
    assert.equal(result.stderr, "");
  }
  const relay = run(["relay", "--help"]);
  assert.equal(relay.status, 0, relay.stderr);
  assert.equal(relay.stderr, "");
  assert.equal(readFileSync(file, "utf8"), customized);
  assert.equal(existsSync(path.join(home, ".palabre")), false);
});
