/** @file Skills et update dans des profils fictifs : aucune instruction réelle d'un agent modifiée. */
import assert from "node:assert/strict";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { applySkillSync, assertSkillPlanUnchanged, inspectSkillCopies, installedSkillDirectories, planSkillInstall, planSkillSync, SkillSyncError } from "../src/skillSync.js";
import { inspectDoctorArrival } from "../src/doctorArrival.js";
import { applyUpdate, canApplyUpdate, createUpdatePlan, formatUpdateInstructions, type UpdateInfo } from "../src/update.js";
import { createTranslator } from "../src/i18n.js";
import { formatSkillPlan } from "../src/messages/skillSync.js";
import { runUpdateCommand } from "../src/commands/update.js";
import type { CommandFlags } from "../src/commands/shared.js";

const names = ["SKILL.md", "agents/openai.yaml", "references/chat.md", "references/cli.md", "references/outputs.md", "references/relay.md"];
function skill(directory: string, text = "new\nline\n"): void {
  for (const name of names) { const file = path.join(directory, name); mkdirSync(path.dirname(file), { recursive: true }); writeFileSync(file, text); }
}
function fixture(t: test.TestContext) {
  const root = mkdtempSync(path.join(os.tmpdir(), "skill-sync-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const options = { source: path.join(root, "package", "skills", "palabre"), home: path.join(root, "home"), cwd: path.join(root, "project") };
  skill(options.source);
  const target = path.join(options.home, ".agents", "skills", "palabre");
  return { root, options, target };
}

test("copies identiques CRLF/LF : doctor en lecture seule, pas de sauvegarde ni d'écriture", t => {
  const { options, target } = fixture(t);
  skill(target, "new\r\nline\r\n");
  const plan = planSkillSync(options);
  assert.equal(plan.copies[0].state, "current");
  assert.deepEqual(applySkillSync(plan), []);
  assert.equal(readFileSync(path.join(target, "SKILL.md"), "utf8"), "new\r\nline\r\n");
  assert.equal(existsSync(plan.backupRoot), false);
  const arrival = inspectDoctorArrival({ home: options.home, cwd: options.cwd, env: { PATH: "" }, skillSource: options.source });
  assert.equal(arrival.skillCopies[0].state, "current");
});

test("copie personnalisée : sauvegarde exacte hors skills, ajouts privés conservés, toutes les références mises à jour", t => {
  const { options, target } = fixture(t);
  skill(target, "custom\r\n");
  writeFileSync(path.join(target, "personal.txt"), "keep");
  const plan = planSkillSync(options);
  assert.equal(plan.copies[0].state, "different");
  const backups = applySkillSync(plan);
  assert.equal(backups.length, 1);
  assert.ok(backups[0].startsWith(path.join(options.home, ".palabre", "skill-backups")));
  assert.equal(readFileSync(path.join(backups[0], "SKILL.md"), "utf8"), "custom\r\n");
  assert.equal(readFileSync(path.join(backups[0], "personal.txt"), "utf8"), "keep");
  for (const name of names) assert.equal(readFileSync(path.join(target, name), "utf8"), "new\nline\n");
  assert.equal(readFileSync(path.join(target, "personal.txt"), "utf8"), "keep");
  assert.equal(planSkillSync(options).copies[0].state, "current");
});

test("copies absentes : sync n'installe rien, installation explicitement ciblée et refus si la cible apparaît après le plan", t => {
  const { options, target } = fixture(t);
  const empty = planSkillSync(options);
  assert.deepEqual(empty.copies, []);
  assert.deepEqual(applySkillSync(empty), []);
  assert.equal(existsSync(target), false);
  const install = planSkillInstall("codex", options);
  assert.deepEqual(applySkillSync(install), []);
  assert.equal(readFileSync(path.join(target, "SKILL.md"), "utf8"), "new\nline\n");
  assert.throws(() => applySkillSync(install), error => error instanceof SkillSyncError && error.kind === "changed");
});

test("jonction Claude/Codex : préservée et une seule sauvegarde physique", t => {
  const { options, target } = fixture(t);
  skill(target, "old");
  const alias = path.join(options.home, ".claude", "skills", "palabre");
  mkdirSync(path.dirname(alias), { recursive: true });
  symlinkSync(target, alias, process.platform === "win32" ? "junction" : "dir");
  const plan = planSkillSync(options);
  assert.equal(plan.copies.length, 2);
  assert.equal(applySkillSync(plan).length, 1);
  assert.ok(lstatSync(alias).isSymbolicLink());
  assert.equal(realpathSync(alias), realpathSync(target));
});

test("source absente, lien interne, sauvegarde dans skills ou édition après confirmation : refus avant remplacement", t => {
  const { root, options, target } = fixture(t);
  skill(target, "custom");
  assert.equal(inspectSkillCopies([target], { source: path.join(root, "absent") })[0].state, "unreadable");
  const changed = planSkillSync(options);
  writeFileSync(path.join(target, "SKILL.md"), "edited");
  assert.throws(() => assertSkillPlanUnchanged(changed), error => error instanceof SkillSyncError && error.kind === "changed");
  const inside = planSkillSync({ ...options, backupRoot: path.join(target, "backups") });
  assert.throws(() => applySkillSync(inside), error => error instanceof SkillSyncError && error.kind === "backup");
  assert.equal(readFileSync(path.join(target, "SKILL.md"), "utf8"), "edited");
  const external = path.join(root, "external");
  mkdirSync(external);
  symlinkSync(external, path.join(target, "linked"), process.platform === "win32" ? "junction" : "dir");
  assert.equal(planSkillSync(options).copies[0].state, "unreadable");
  assert.deepEqual(applySkillSync(planSkillSync(options)), []);
  assert.equal(readFileSync(path.join(target, "SKILL.md"), "utf8"), "edited");
});

test("update disponible : copie illisible ignorée et intacte, avertissement affiché, CLI et autre copie mises à jour", async t => {
  const { root, options, target } = fixture(t);
  skill(target, "custom unreadable");
  const external = path.join(root, "external");
  mkdirSync(external);
  symlinkSync(external, path.join(target, "linked"), process.platform === "win32" ? "junction" : "dir");
  const other = path.join(options.home, ".claude", "skills", "palabre");
  skill(other, "custom readable");
  const projectRoot = path.dirname(path.dirname(options.source));
  const info: UpdateInfo = { version: "0.18.0", latestVersion: "0.19.0", channel: "npm-global", sourceCheckout: false, projectRoot, steps: createUpdatePlan("npm-global", "0.19.0"), skills: planSkillSync(options) };
  assert.deepEqual(info.skills!.copies.map(copy => copy.state), ["unreadable", "different"]);
  const reports: string[] = [];
  let installs = 0;
  await runUpdateCommand({ yes: true, language: "fr" }, {
    getInfo: async () => info, write: report => { reports.push(report); },
    apply: (plan, messages) => applyUpdate(plan, messages, { run: async () => {
      installs++;
      writeFileSync(path.join(projectRoot, "package.json"), JSON.stringify({ name: "palabre", version: "0.19.0" }));
      skill(options.source, "updated package");
    } })
  });
  assert.equal(installs, 1);
  assert.equal(JSON.parse(readFileSync(path.join(projectRoot, "package.json"), "utf8")).version, "0.19.0");
  assert.ok(reports.some(report => report.includes(target) && report.includes("AVERTISSEMENT") && report.includes("copie ignorée")));
  assert.equal(readFileSync(path.join(target, "SKILL.md"), "utf8"), "custom unreadable");
  assert.ok(lstatSync(path.join(target, "linked")).isSymbolicLink());
  assert.equal(readFileSync(path.join(other, "SKILL.md"), "utf8"), "updated package");
});

test("source illisible : copies non vérifiées intactes sans bloquer le processus CLI", async t => {
  const { options, target } = fixture(t);
  skill(target, "custom");
  const info: UpdateInfo = { version: "0.18.0", latestVersion: "0.19.0", channel: "npm-global", sourceCheckout: false, projectRoot: path.dirname(path.dirname(options.source)), steps: createUpdatePlan("npm-global", "0.19.0"), skills: planSkillSync({ ...options, source: path.join(options.source, "absent") }) };
  let installs = 0;
  await applyUpdate(info, createTranslator("fr"), { run: async () => { installs++; } });
  assert.equal(installs, 1);
  assert.equal(readFileSync(path.join(target, "SKILL.md"), "utf8"), "custom");
  assert.equal(existsSync(info.skills!.backupRoot), false);
});

test("CLI mise à jour puis skill incomplet : erreur limitée au skill avec la commande de reprise fr/en", async t => {
  for (const language of ["fr", "en"] as const) {
    const { options, target } = fixture(t);
    skill(target, "custom");
    const projectRoot = path.dirname(path.dirname(options.source));
    const info: UpdateInfo = { version: "0.18.0", latestVersion: "0.19.0", channel: "npm-global", sourceCheckout: false, projectRoot, steps: createUpdatePlan("npm-global", "0.19.0"), skills: planSkillSync(options) };
    await assert.rejects(applyUpdate(info, createTranslator(language), { run: async () => {
      writeFileSync(path.join(projectRoot, "package.json"), JSON.stringify({ name: "palabre", version: "0.19.0" }));
      rmSync(path.join(options.source, "references", "relay.md"));
    } }), error => {
      assert.ok(error instanceof Error);
      assert.match(error.message, language === "fr" ? /CLI a été mise à jour avec succès/ : /CLI was updated successfully/);
      assert.match(error.message, /palabre skill --sync/);
      assert.doesNotMatch(error.message, /Réinstallez|Reinstall/);
      return true;
    });
    assert.equal(JSON.parse(readFileSync(path.join(projectRoot, "package.json"), "utf8")).version, "0.19.0");
    assert.equal(readFileSync(path.join(target, "SKILL.md"), "utf8"), "custom");
  }
});

test("copies projet/personnelles inventoriées, référence absente détectée", t => {
  const { options, target } = fixture(t);
  skill(target);
  const local = path.join(options.cwd, ".codex", "skills", "palabre");
  skill(local);
  rmSync(path.join(local, "references", "relay.md"));
  assert.equal(installedSkillDirectories(options).length, 2);
  assert.deepEqual(planSkillSync(options).copies.map(copy => copy.state), ["current", "different"]);
});

test("update recharge le skill du nouveau paquet après le processus d'installation, pas l'ancien store pnpm", async t => {
  const { root, options, target } = fixture(t);
  skill(target, "custom");
  const stableRoot = path.join(root, "global", "palabre");
  const info: UpdateInfo = { version: "0.18.0", latestVersion: "0.19.0", channel: "pnpm-global", sourceCheckout: false, projectRoot: path.dirname(path.dirname(options.source)), steps: createUpdatePlan("pnpm-global", "0.19.0"), skills: planSkillSync(options), skillPackageRoot: stableRoot };
  const calls: string[] = [];
  await applyUpdate(info, createTranslator("fr"), { run: async step => {
    calls.push(step.command);
    skill(path.join(stableRoot, "skills", "palabre"), "next version");
    writeFileSync(path.join(stableRoot, "package.json"), JSON.stringify({ name: "palabre", version: "0.19.0" }));
  } });
  assert.deepEqual(calls, ["pnpm"]);
  assert.equal(readFileSync(path.join(target, "SKILL.md"), "utf8"), "next version");
  assert.equal(readFileSync(path.join(options.source, "SKILL.md"), "utf8"), "new\nline\n");
});

test("CLI à jour ou npm indisponible : skill différent proposé sans lancer le gestionnaire ; plan sans effet de bord", async t => {
  const { options, target } = fixture(t);
  skill(target, "custom");
  const info: UpdateInfo = { version: "0.18.0", latestVersion: "0.18.0", channel: "npm-global", sourceCheckout: false, projectRoot: path.dirname(path.dirname(options.source)), steps: createUpdatePlan("npm-global", "0.18.0"), skills: planSkillSync(options) };
  assert.equal(canApplyUpdate(info), true);
  assert.match(formatUpdateInstructions(info, createTranslator("fr")), /custom|personnalis|différent/);
  assert.equal(readFileSync(path.join(target, "SKILL.md"), "utf8"), "custom");
  await applyUpdate(info, createTranslator("en"), { run: async () => { throw Error("must not run"); } });
  assert.equal(readFileSync(path.join(target, "SKILL.md"), "utf8"), "new\nline\n");
});

test("plan modifié ou installation échouée : aucun skill remplacé", async t => {
  const { options, target } = fixture(t);
  skill(target, "custom");
  const info: UpdateInfo = { version: "0.18.0", latestVersion: "0.19.0", channel: "npm-global", sourceCheckout: false, projectRoot: path.dirname(path.dirname(options.source)), steps: createUpdatePlan("npm-global", "0.19.0"), skills: planSkillSync(options) };
  await assert.rejects(applyUpdate(info, createTranslator("fr"), { run: async () => { throw Error("package failed"); } }), /package failed/);
  writeFileSync(path.join(target, "SKILL.md"), "edited");
  await assert.rejects(applyUpdate(info, createTranslator("fr"), { run: async () => { throw Error("must not run"); } }), /modifiée depuis le plan/);
  assert.equal(readFileSync(path.join(target, "SKILL.md"), "utf8"), "edited");
});

test("update : même plan CLI/skill, une seule confirmation ; refus, check et dry-run n'appliquent rien", async t => {
  const { options, target } = fixture(t);
  skill(target, "custom");
  const info: UpdateInfo = { version: "0.18.0", latestVersion: "0.19.0", channel: "npm-global", sourceCheckout: false, projectRoot: path.dirname(path.dirname(options.source)), steps: createUpdatePlan("npm-global", "0.19.0"), skills: planSkillSync(options) };
  let confirmations = 0;
  let applications = 0;
  const reports: string[] = [];
  const host = {
    getInfo: async () => info, interactive: true, write: (report: string) => { reports.push(report); },
    confirm: async () => { confirmations++; return true; },
    apply: async (confirmed: UpdateInfo) => { assert.equal(confirmed, info); applications++; }
  };
  const previews: CommandFlags[] = [{ check: true, yes: true }, { "dry-run": true, apply: true }];
  for (const flags of previews) await runUpdateCommand(flags, host);
  assert.equal(confirmations, 0);
  assert.equal(applications, 0);
  await runUpdateCommand({}, { ...host, confirm: async () => false });
  assert.equal(applications, 0);
  await runUpdateCommand({}, host);
  assert.equal(confirmations, 1);
  assert.equal(applications, 1);
  assert.ok(reports.some(report => report.includes("palabre@0.19.0") && report.includes(target) && report.includes(info.skills!.backupRoot)));
  assert.equal(readFileSync(path.join(target, "SKILL.md"), "utf8"), "custom");
});

test("plan affiché fr/en : remplacement et sauvegarde annoncés seulement si une copie peut être remplacée", () => {
  const copy = (state: "current" | "different" | "unreadable") => ({ directory: `/fictif/${state}`, state });
  const plan = (...states: ("current" | "different" | "unreadable")[]) => ({ source: "/fictif/source", backupRoot: "/fictif/backups", copies: states.map(copy) });
  for (const language of ["fr", "en"] as const) {
    const replacement = language === "fr" ? /seront remplacés/ : /will be replaced/;
    const nothing = language === "fr" ? /Rien à remplacer/ : /Nothing to replace/;
    const none = language === "fr" ? /Aucune copie détectée/ : /No copy detected/;
    const announces = (text: string) => { assert.match(text, replacement); assert.ok(text.includes("/fictif/backups")); assert.doesNotMatch(text, nothing); };
    const quiet = (text: string) => { assert.match(text, nothing); assert.doesNotMatch(text, replacement); assert.ok(!text.includes("/fictif/backups")); };
    for (const states of [["different"], ["current", "different"], ["different", "unreadable"]] as const) {
      announces(formatSkillPlan(plan(...states), language));
      announces(formatSkillPlan(plan(...states), language, true));
    }
    for (const states of [["current"], ["current", "current"], ["unreadable"], ["current", "unreadable"]] as const) quiet(formatSkillPlan(plan(...states), language));
    // Après mise à jour de la CLI, une copie aujourd'hui identique sera comparée au nouveau paquet (applyUpdate).
    for (const states of [["current"], ["current", "unreadable"]] as const) announces(formatSkillPlan(plan(...states), language, true));
    quiet(formatSkillPlan(plan("unreadable"), language, true));
    for (const afterUpdate of [false, true]) {
      const empty = formatSkillPlan(plan(), language, afterUpdate);
      assert.match(empty, none); assert.doesNotMatch(empty, replacement); assert.doesNotMatch(empty, nothing);
    }
  }
});

test("commande skill : absence de confirmation, check, dry-run et options invalides ne changent rien au profil", t => {
  const { root } = fixture(t);
  const cli = fileURLToPath(new URL("../src/index.js", import.meta.url));
  const home = os.homedir(); // HOME est déjà isolé par scripts/test.mjs.
  const target = path.join(home, ".agents", "skills", "palabre");
  skill(target, "custom");
  for (const flags of [["--sync"], ["--sync", "--check", "--yes"], ["--install", "claude", "--dry-run", "--yes"], ["--install", "bogus", "--yes"], ["--sync", "--trust-config", "--yes"]]) {
    const result = spawnSync(process.execPath, [cli, "skill", ...flags], { cwd: root, encoding: "utf8", env: { ...process.env, PALABRE_LANGUAGE: "fr" } });
    assert.equal(readFileSync(path.join(target, "SKILL.md"), "utf8"), "custom", result.stderr);
    assert.equal(existsSync(path.join(home, ".palabre", "skill-backups")), false);
    if (flags.includes("--check") || flags.includes("--dry-run")) assert.equal(result.status, 0, result.stderr);
    else assert.notEqual(result.status, 0);
  }
  const approved = spawnSync(process.execPath, [cli, "skill", "--sync", "--yes"], { cwd: root, encoding: "utf8", env: process.env });
  assert.equal(approved.status, 0, approved.stderr);
  assert.match(approved.stdout, /custom|personnalis|différent/);
  assert.equal(readFileSync(path.join(target, "SKILL.md"), "utf8"), readFileSync(fileURLToPath(new URL("../skills/palabre/SKILL.md", import.meta.url)), "utf8"));
  assert.equal(existsSync(path.join(home, ".palabre", "trusted-configs.json")), false);
  for (const flags of [["--sync"], ["--install", "codex"]]) {
    const unchanged = spawnSync(process.execPath, [cli, "skill", ...flags], { cwd: root, encoding: "utf8", env: process.env });
    assert.equal(unchanged.status, 0, unchanged.stderr); // Pas de TTY ni --yes : aucun accord demandé si identique.
  }
  const external = path.join(root, "external");
  mkdirSync(external);
  symlinkSync(external, path.join(target, "linked"), process.platform === "win32" ? "junction" : "dir");
  const skipped = spawnSync(process.execPath, [cli, "skill", "--sync"], { cwd: root, encoding: "utf8", env: process.env });
  assert.equal(skipped.status, 0, skipped.stderr); // Une copie uniquement illisible ne demande pas non plus d'accord.
  assert.match(skipped.stdout, /AVERTISSEMENT|WARNING/);
  const other = path.join(home, ".codex", "skills", "palabre");
  skill(other, "custom readable");
  const mixed = spawnSync(process.execPath, [cli, "skill", "--sync", "--yes"], { cwd: root, encoding: "utf8", env: process.env });
  assert.equal(mixed.status, 0, mixed.stderr);
  assert.match(mixed.stdout, /AVERTISSEMENT|WARNING/);
  assert.ok(lstatSync(path.join(target, "linked")).isSymbolicLink());
  assert.equal(readFileSync(path.join(other, "SKILL.md"), "utf8"), readFileSync(path.join(target, "SKILL.md"), "utf8"));
});
