/** @file Doctor sur profils fictifs : priorité, absence d'écriture, sondes sans modèle et échecs prudents. */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { runDoctor } from "../src/doctor.js";
import { CONFIG_TRUST_PATH, trustConfig } from "../src/configTrust.js";
import { doctorInstallations, inspectDoctorArrival, parseDoctorAuth, probeDoctorAuth, type DoctorArrivalOptions } from "../src/doctorArrival.js";
import type { ExternalProcessResult, ExternalProcessSpec } from "../src/externalSessions/process.js";
import type { ToolDiscovery } from "../src/discovery.js";

const absent = { available: false, command: "missing" };
const discovery: ToolDiscovery = {
  codex: absent, claude: absent, antigravity: absent, opencode: absent, vibe: absent,
  ollama: { available: false, commandAvailable: false, baseUrl: "http://localhost:11434", models: [] }
};
const finished: ExternalProcessResult = { started: true, exitCode: 0, signal: null, stdout: "", stderr: "", forcedReturn: false, outputBytes: 0, durationMs: 1 };
const isolated: DoctorArrivalOptions = { platform: "linux", env: { PATH: "" }, home: "/fixture-home", cwd: "/fixture-project", fileExists: () => false };

test("doctor distingue contrats de connexion, sorties partielles et formats inconnus sans croire le code 0 seul", () => {
  const cases: Array<["claude" | "codex", number | null, string, string, string]> = [
    ["claude", 0, '{"loggedIn":true,"email":"secret@example.invalid"}', "", "connected"],
    ["claude", 1, '{"loggedIn":false}', "", "disconnected"],
    ["claude", 0, '{"loggedIn":false}', "", "disconnected"],
    ["claude", 1, '{"loggedIn":true}', "", "unknown"],
    ["claude", 0, '{"loggedIn":"true"}', "", "unknown"],
    ["claude", 0, "not JSON", "", "unknown"],
    ["claude", 0, "null", "", "unknown"],
    ["claude", null, '{"loggedIn":true}', "", "unknown"],
    ["codex", 0, "", "Logged in using ChatGPT", "connected"],
    ["codex", 0, "Logged in using an API key - secret", "", "connected"],
    ["codex", 1, "", "Not logged in\n", "disconnected"],
    ["codex", 0, "Not logged in", "", "unknown"],
    ["codex", 1, "Logged in using ChatGPT", "", "unknown"],
    ["codex", 0, "CLI missing", "", "unknown"]
  ];
  for (const [provider, code, stdout, stderr, expected] of cases) assert.equal(parseDoctorAuth(provider, code, stdout, stderr), expected);
});

test("PowerShell Store seul, hors Store, absent et wrapper non vérifiable sont distingués sans exécuter", () => {
  const store = "C:\\Users\\fixture\\WindowsApps\\pwsh.exe";
  const native = "C:\\Program Files\\PowerShell\\7\\pwsh.exe";
  const options = { platform: "win32" as const, env: { PATH: "C:\\Users\\fixture\\WindowsApps", ProgramFiles: "C:\\Program Files" }, home: "C:\\fixture-home", cwd: "C:\\fixture-project" };
  assert.equal(inspectDoctorArrival({ ...options, fileExists: file => file === store }).shell, "store-only");
  assert.equal(inspectDoctorArrival({ ...options, fileExists: file => file === store || file === native }).shell, "native");
  assert.equal(inspectDoctorArrival({ ...options, fileExists: () => false }).shell, "missing");
  assert.equal(inspectDoctorArrival({ ...options, env: { PATH: "C:\\custom" }, fileExists: file => file === "C:\\custom\\pwsh.cmd" }).shell, "unverified");
  assert.equal(inspectDoctorArrival(isolated).shell, "not-windows");
});

test("les wrappers npm voisins et les alias de dossier ne sont pas comptés comme installations distinctes", () => {
  const present = new Set(["C:\\npm\\pnpm.cmd", "C:\\npm\\pnpm.ps1", "C:\\standalone\\pnpm.exe"]);
  const found = doctorInstallations("pnpm", { platform: "win32", env: { PATH: "C:\\npm;C:\\NPM;C:\\standalone" }, canonicalDirectory: dir => dir, fileExists: file => present.has(file) });
  assert.deepEqual(found, ["C:\\npm\\pnpm.cmd", "C:\\standalone\\pnpm.exe"]);
  assert.deepEqual(doctorInstallations("node", { ...isolated, env: { PATH: "/bin:/usr/bin" }, canonicalDirectory: () => "/usr/bin", fileExists: () => true }), ["/bin/node"]);
});

test("le skill est cherché dans les trois emplacements de chaque portée, sans certificat de fraîcheur", () => {
  const found = inspectDoctorArrival({ ...isolated, fileExists: file => file === "/fixture-project/.claude/skills/palabre/SKILL.md" || file === "/fixture-home/.agents/skills/palabre/SKILL.md" });
  assert.equal(found.skills.length, 2);
  assert.ok(found.skills.includes("/fixture-project/.claude/skills/palabre/SKILL.md"));
});

test("auth status utilise le chemin configuré, un lancement sans shell et des bornes, jamais les args modèle", async () => {
  const calls: ExternalProcessSpec[] = [];
  const options: DoctorArrivalOptions = {
    ...isolated,
    resolve: command => { assert.equal(command, "/pinned/claude"); return { status: "resolved", kind: "npm-shim", executable: { command: "/fixture/node", prefixArgs: ["/pinned/claude.js"] } }; },
    run: async spec => { calls.push(spec); return { ...finished, stdout: '{"loggedIn":true,"email":"secret@example.invalid"}' }; }
  };
  assert.equal(await probeDoctorAuth("claude", "/pinned/claude", options), "connected");
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].args, ["/pinned/claude.js", "auth", "status", "--json"]);
  assert.equal(calls[0].stdin, "");
  assert.equal(calls[0].timeoutMs, 3000);
  assert.equal(calls[0].maxOutputBytes, 32768);
  assert.equal(calls[0].killGraceMs, 500);
});

test("timeout, sortie bornée, signal et arrêt incomplet ne donnent jamais connecté", async () => {
  const failures: Partial<ExternalProcessResult>[] = [
    { stopReason: "timeout" }, { stopReason: "output-too-large" }, { forcedReturn: true },
    { signal: "SIGTERM" }, { started: false, launchFailure: "spawn-failed" }
  ];
  for (const failure of failures) {
    assert.equal(await probeDoctorAuth("codex", "codex", { ...isolated,
      resolve: () => ({ status: "resolved", kind: "native", executable: { command: "/fake/codex", prefixArgs: [] } }),
      run: async () => ({ ...finished, stderr: "Logged in using ChatGPT", ...failure })
    }), "unknown");
  }
  assert.equal(await probeDoctorAuth("codex", "codex", { ...isolated, resolve: () => ({ status: "unsupported-executable", detail: "wrapper" }), run: async () => { throw Error("must not run"); } }), "unknown");
  assert.equal(await probeDoctorAuth("codex", "codex", { ...isolated, resolve: () => { throw Error("missing"); } }), "unknown");
});

test("une fausse CLI locale reçoit seulement auth status, sans shell ni modèle", async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "doctor-status-process-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const script = path.join(dir, "status.cjs");
  await writeFile(script, `if (JSON.stringify(process.argv.slice(2)) !== JSON.stringify(['auth','status','--json'])) process.exit(9); console.log(JSON.stringify({loggedIn:false})); process.exitCode=1;`);
  const result = await probeDoctorAuth("claude", "claude", {
    cwd: dir,
    resolve: () => ({ status: "resolved", kind: "native", executable: { command: process.execPath, prefixArgs: [script] } })
  });
  assert.equal(result, "disconnected");
});

test("configuration explicite non approuvée : refus visible avant tout exécutable et sans écriture", async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "doctor-untrusted-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, "configuration.json");
  const source = JSON.stringify({ agents: { custom: { type: "cli", command: "claude", role: "reviewer" } } });
  await writeFile(file, source);
  let runs = 0;
  const before = await readFile(CONFIG_TRUST_PATH, "utf8").catch(() => "absent");
  const result = await runDoctor(file, true, "fr", { checkVersion: false, discovery,
    arrival: { ...isolated, run: async () => { runs++; return finished; } }
  });
  assert.equal(result.ok, false);
  assert.match(result.output, /config-untrusted/);
  assert.match(result.output, /palabre config --config .* --trust-config/);
  assert.match(result.output, /choisir 4/);
  assert.equal(runs, 0);
  assert.equal(await readFile(file, "utf8"), source);
  assert.equal(await readFile(CONFIG_TRUST_PATH, "utf8").catch(() => "absent"), before);
  console.log(result.output.split("\n").find(line => line.includes("config-untrusted")));
});

test("profil fictif complet : ordre d'arrivée, CLI déconnectée, gemini, skill et doublons, sans données de compte", async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "doctor-arrival-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, "configuration.json");
  await writeFile(file, JSON.stringify({ agents: {
    chosen: { type: "cli", command: "claude", role: "reviewer", args: ["--print", "NEVER_CALL_MODEL"], shell: true },
    same: { type: "cli", command: "claude", role: "critic" },
    gemini: { type: "cli", command: "gemini", role: "reviewer" }
  } }));
  await trustConfig(file);
  const before = await readFile(CONFIG_TRUST_PATH, "utf8");
  const commands: ExternalProcessSpec[] = [];
  for (const language of ["fr", "en"] as const) {
    const result = await runDoctor(file, true, language, { checkVersion: false, discovery, arrival: {
      platform: "win32", env: { PATH: "C:\\WindowsApps;C:\\npm;C:\\standalone" }, home: "C:\\fixture-home", cwd: "C:\\fixture-project", canonicalDirectory: dir => dir,
      fileExists: candidate => ["C:\\WindowsApps\\pwsh.exe", "C:\\npm\\pnpm.cmd", "C:\\standalone\\pnpm.exe"].includes(candidate),
      resolve: command => { assert.equal(command, "claude"); return { status: "resolved", kind: "native", executable: { command: "C:\\pinned\\claude.exe", prefixArgs: [] } }; },
      run: async spec => { commands.push(spec); return { ...finished, exitCode: 1, stdout: '{"loggedIn":false,"email":"secret@example.invalid"}', stderr: "secret" }; }
    } });
    assert.equal(result.ok, true);
    assert.ok(result.output.indexOf("WindowsApps") < result.output.indexOf("chosen : CLI non connectée") || language === "en");
    assert.match(result.output, /winget install --id Microsoft.PowerShell --source winget/);
    assert.match(result.output, /auth login/);
    assert.match(result.output, /gemini.*archiv/);
    assert.doesNotMatch(result.output, /gemini.*custom/);
    assert.match(result.output, /npx skills add/);
    assert.match(result.output, /Get-Command pnpm -All/);
    assert.doesNotMatch(result.output, /secret|NEVER_CALL_MODEL/);
    assert.equal(await readFile(CONFIG_TRUST_PATH, "utf8"), before);
    assert.deepEqual(Object.keys(result).sort(), ["ok", "output"]);
    if (language === "fr") console.log(result.output.split("\n").filter(line => /Configuration approuvée|PowerShell 7 trouvé|chosen : CLI|gemini : agent|Skill PALABRE non trouvé|pnpm : plusieurs/.test(line)).join("\n"));
  }
  assert.equal(commands.length, 2, "une seule sonde par commande et par diagnostic");
  assert.deepEqual(commands[0].args, ["auth", "status", "--json"]);
});

test("configuration globale non approuvée : aucune URL Ollama déclarée contactée", async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "doctor-global-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, "global.json");
  await writeFile(file, JSON.stringify({ agents: { local: { type: "ollama", role: "critic", baseUrl: "http://do-not-contact.invalid", model: "fake" } } }));
  const previous = globalThis.fetch;
  const urls: string[] = [];
  globalThis.fetch = (async input => { urls.push(String(input)); return new Response('{"models":[]}'); }) as typeof fetch;
  try {
    const result = await runDoctor(file, true, "en", { checkVersion: false, arrival: isolated });
    assert.equal(result.ok, false);
    assert.equal(urls.some(url => url.includes("do-not-contact.invalid")), false);
  } finally { globalThis.fetch = previous; }
});
