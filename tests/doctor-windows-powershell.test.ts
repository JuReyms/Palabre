/**
 * @file #171 : doctor prévient quand pwsh.exe n'est que l'alias Store (#128), avant tout Relay.
 * Sondes et environnement injectés : aucun appel réel à fsutil, aucun pwsh lancé.
 */
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { runDoctor, type DoctorWindowsPowerShellProbes } from "../src/doctor.js";
import { trustConfig } from "../src/configTrust.js";
import type { ToolDiscovery } from "../src/discovery.js";

const apps = "C:\\Users\\fixture\\AppData\\Local\\Microsoft\\WindowsApps";
const windows = "C:\\Windows\\System32\\WindowsPowerShell\\v1.0";
const seven = "C:\\Program Files\\PowerShell\\7";
const alias = `${apps}\\pwsh.exe`;
const key = (value: string) => value.replaceAll("/", "\\").toLowerCase();

function discoveryWith(codex: boolean): ToolDiscovery {
  const absent = { available: false, command: "absent" };
  return {
    codex: codex ? { available: true, command: "codex", path: "C:\\tools\\codex.exe" } : absent,
    claude: absent, antigravity: absent, opencode: absent, vibe: absent,
    ollama: { available: false, commandAvailable: false, baseUrl: "http://localhost:11434", models: [] }
  };
}

/** `files` est le PATH simulé ; `aliases` sont les entrées que fsutil confirmerait comme AppExecLink. */
function probes(pathValue: string, files: string[], aliases: string[] = [alias]): DoctorWindowsPowerShellProbes {
  return {
    platform: "win32",
    env: { PATH: pathValue, PATHEXT: ".COM;.EXE;.BAT;.CMD" },
    exists: file => files.map(key).includes(key(file)),
    regularFile: file => files.map(key).includes(key(file)) && !aliases.map(key).includes(key(file)),
    appExecutionAlias: async file => aliases.map(key).includes(key(file))
  };
}

async function doctorOutput(language: "fr" | "en", windowsPowerShell: DoctorWindowsPowerShellProbes, codex = true) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "palabre-doctor-pwsh-"));
  const config = path.join(dir, "palabre.config.json");
  await writeFile(config, JSON.stringify({
    language,
    agents: { codex: { type: "cli", command: "codex", role: "implementer" }, claude: { type: "cli", command: "claude", role: "reviewer" } },
    defaults: { agentA: "codex", agentB: "claude", summaryAgent: "claude" }
  }), "utf8");
  // Approuvée dans le profil isolé des tests, sinon doctor échoue sur l'approbation (#176) ; aucune sonde de connexion lancée.
  await trustConfig(config);
  try {
    return await runDoctor(config, true, language, { checkVersion: false, discovery: discoveryWith(codex), windowsPowerShell,
      arrival: { env: { PATH: "" }, fileExists: () => false, resolve: () => ({ status: "unsupported-executable", detail: "test" }) } });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("alias Store seul : WARN qui nomme l'alias et la commande MSI, sans faire échouer doctor", async () => {
  for (const language of ["fr", "en"] as const) {
    const result = await doctorOutput(language, probes(apps, [alias]));
    const line = result.output.split("\n").find(line => line.includes("PowerShell :") || line.includes("PowerShell:"));
    assert.ok(line, "ligne PowerShell attendue");
    assert.match(line, /^\[WARN\]/);
    assert.ok(line.includes(alias));
    assert.ok(line.includes("--installer-type wix"));
    assert.doesNotMatch(line, /--installer-type msi/);
    assert.ok(line.includes("Microsoft Store"));
    assert.equal(result.ok, true);
  }
});

test("repli sur Windows PowerShell : WARN distinct qui nomme le repli du seul enfant Codex", async () => {
  const result = await doctorOutput("fr", probes(`${apps};${windows}`, [alias, `${windows}\\powershell.exe`]));
  const line = result.output.split("\n").find(line => line.includes("PowerShell :"));
  assert.ok(line);
  assert.match(line, /^\[WARN\]/);
  assert.ok(line.includes(`${windows}\\powershell.exe`));
  assert.ok(line.includes("Codex"));
  assert.equal(result.ok, true);
});

test("vrai pwsh.exe disponible, alias non confirmé ou hors Windows : aucune ligne PowerShell", async () => {
  const cases: DoctorWindowsPowerShellProbes[] = [
    probes(`${apps};${seven}`, [alias, `${seven}\\pwsh.exe`]),
    probes(`${seven};${apps}`, [`${seven}\\pwsh.exe`, alias]),
    { ...probes(`${apps};${windows}`, [alias, `${windows}\\powershell.exe`]), appExecutionAlias: async () => false },
    { ...probes(`${apps};${windows}`, [alias, `${windows}\\powershell.exe`]), appExecutionAlias: async () => { throw new Error("fsutil indisponible"); } },
    { ...probes(`${apps};${windows}`, [alias, `${windows}\\powershell.exe`]), platform: "linux" }
  ];
  for (const windowsPowerShell of cases) {
    const result = await doctorOutput("fr", windowsPowerShell);
    assert.doesNotMatch(result.output, /PowerShell :/);
  }
});

test("CLI Codex non détectée : contrôle muet et aucune sonde appelée", async () => {
  let calls = 0;
  const windowsPowerShell = probes(apps, [alias]);
  windowsPowerShell.appExecutionAlias = async () => { calls += 1; return true; };
  const result = await doctorOutput("fr", windowsPowerShell, false);
  assert.doesNotMatch(result.output, /PowerShell :/);
  assert.equal(calls, 0);
});
