/**
 * @file Lancement des CLIs npm par les adapters CLI/PTY sans PowerShell (#98) : accents de stdin,
 * JSON avec guillemets et argument `-` préservés. Fausse CLI Node, aucun agent réel.
 */
import assert from "node:assert/strict";
import { copyFileSync, linkSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, test } from "node:test";
import { CliAdapter } from "../src/adapters/cli.js";
import { CliPtyAdapter } from "../src/adapters/cli-pty.js";
import { directNpmShimLaunch, npmNativeShimLaunch, npmShimLaunch, parseNpmNativePowerShellShim } from "../src/npmShim.js";
import type { AgentPrompt } from "../src/types.js";
import { npmPowerShellShim } from "./fixtures/external-sessions/npm-shim.js";

const root = mkdtempSync(path.join(os.tmpdir(), "palabre-npm-shim-"));
after(() => rmSync(root, { recursive: true, force: true }));
let counter = 0;
const SCRIPT = "node_modules/fake-cli/bin/cli.cjs";

/** Arguments structurés du constat de #98 : guillemets internes et argument final `-`. */
const STRUCTURED_ARGS = ["-c", "sandbox_mode=\"read-only\"", "--settings", "{\"disableAllHooks\":true}", "-"];

/**
 * Dossier de binaires npm jetable : shim `.ps1` au modèle npm, wrapper `.cmd` voisin et fausse CLI
 * qui écrit ses arguments et son stdin en JSON dans `capture.json`, puis répond « ok ».
 */
function npmBin(options: { shim?: string; extra?: Record<string, string> } = {}) {
  const dir = path.join(root, `bin-${++counter}`);
  const capture = path.join(dir, "capture.json");
  const files: Record<string, string> = {
    "fake.ps1": options.shim ?? npmPowerShellShim(SCRIPT),
    "fake.cmd": "@echo off\r\nexit /b 99\r\n",
    // Sous PTY, stdin est un terminal : la fausse CLI n'y lit rien et répond aussitôt.
    [SCRIPT]: `const done=(input)=>{require('fs').writeFileSync(${JSON.stringify(capture)},JSON.stringify({argv:process.argv.slice(2),stdin:input}));process.stdout.write('ok');process.exit(0)};if(process.stdin.isTTY){done('')}else{let input='';process.stdin.on('data',c=>input+=c);process.stdin.on('end',()=>done(input))}`,
    ...options.extra
  };
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    writeFileSync(path.join(dir, name), content);
  }
  return { dir, command: path.join(dir, "fake.cmd"), capture: () => JSON.parse(readFileSync(capture, "utf8")) as { argv: string[]; stdin: string } };
}

function prompt(topic: string): AgentPrompt {
  return {
    topic,
    turn: 1,
    totalTurns: 1,
    selfName: "mock",
    peerName: "peer",
    selfRole: "reviewer",
    session: { startedAt: "2026-10-08T00:00:00.000Z", localDate: "2026-10-08", timeZone: "Europe/Paris", cwd: process.cwd() },
    files: [],
    transcript: []
  };
}

const TOPIC = "Une réponse française : été.\nDeuxième ligne « citée ».";

describe("adapters Windows : shim npm lancé via Node, sans PowerShell", () => {
  test("CLI, prompt sur stdin : accents, JSON avec guillemets et argument - préservés", { skip: process.platform !== "win32" }, async () => {
    const bin = npmBin();
    const adapter = new CliAdapter("mock", { type: "cli", command: bin.command, args: STRUCTURED_ARGS, promptMode: "stdin", shell: true, role: "reviewer", timeoutMs: 10_000 });

    const response = await adapter.generate(prompt(TOPIC));

    assert.equal(response.content, "ok");
    const seen = bin.capture();
    assert.deepEqual(seen.argv, STRUCTURED_ARGS);
    assert.match(seen.stdin, /Une réponse française : été\./);
    assert.match(seen.stdin, /Deuxième ligne « citée »/);
    assert.doesNotMatch(seen.stdin, /\?\?/);
  });

  test("CLI, prompt en argument : le prompt garde accents, guillemets et métacaractères", { skip: process.platform !== "win32" }, async () => {
    const bin = npmBin();
    const adapter = new CliAdapter("mock", { type: "cli", command: bin.command, args: STRUCTURED_ARGS.slice(0, 4), promptMode: "argument", shell: true, role: "reviewer", timeoutMs: 10_000 });

    await adapter.generate(prompt("Sujet \"cité\" & été"));

    const seen = bin.capture();
    assert.deepEqual(seen.argv.slice(0, 4), STRUCTURED_ARGS.slice(0, 4));
    assert.match(seen.argv.at(-1) ?? "", /Sujet "cité" & été/);
  });

  test("PTY, prompt en argument : arguments structurés et prompt préservés", { skip: process.platform !== "win32" }, async () => {
    const bin = npmBin();
    const adapter = new CliPtyAdapter("mock-pty", { type: "cli-pty", command: bin.command, args: STRUCTURED_ARGS.slice(0, 4), promptMode: "argument", role: "reviewer", timeoutMs: 15_000 });

    await adapter.generate(prompt("Sujet \"cité\" & été"));

    const seen = bin.capture();
    assert.deepEqual(seen.argv.slice(0, 4), STRUCTURED_ARGS.slice(0, 4));
    assert.match(seen.argv.at(-1) ?? "", /Sujet "cité" & été/);
  });
});

describe("résolution d'un shim npm pour les adapters", () => {
  // Interpréteur factice dans le dossier du shim : tests portables, indépendants du Node installé.
  test("shim npm reconnu : Node du dossier du shim et script du paquet", () => {
    const bin = npmBin({ extra: { "node.exe": "" } });
    assert.deepEqual(directNpmShimLaunch(bin.command), { command: path.join(bin.dir, "node.exe"), prefixArgs: [path.join(bin.dir, ...SCRIPT.split("/"))] });
    assert.deepEqual(directNpmShimLaunch(path.join(bin.dir, "fake.ps1")), directNpmShimLaunch(bin.command));
  });

  test("shim npm modifié : pas de lancement direct, le repli reste possible", () => {
    const pnpmLike = npmPowerShellShim(SCRIPT).replace("$ret=0", "$env:NODE_PATH=\"C:\\pnpm\\node_modules\"\r\n$ret=0");
    const bin = npmBin({ shim: pnpmLike, extra: { "node.exe": "" } });
    assert.equal(directNpmShimLaunch(bin.command), undefined);
    assert.equal(npmShimLaunch(path.join(bin.dir, "fake.ps1")).status, "unsupported");
  });

  test("script du paquet absent : pas de lancement direct", () => {
    const bin = npmBin({ extra: { "node.exe": "" } });
    rmSync(path.join(bin.dir, ...SCRIPT.split("/")));
    assert.equal(directNpmShimLaunch(bin.command), undefined);
    assert.equal(npmShimLaunch(path.join(bin.dir, "fake.ps1")).status, "missing");
  });

  test("aucun shim voisin : pas de lancement direct", () => {
    const dir = path.join(root, `bin-${++counter}`);
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "seul.cmd"), "@echo off\r\n");
    assert.equal(directNpmShimLaunch(path.join(dir, "seul.cmd")), undefined);
  });
});

/** Variante native du shim npm, pour un exécutable relatif au dossier du shim (séparateurs `/`). */
function npmNativePowerShellShim(target: string): string {
  return [
    "#!/usr/bin/env pwsh",
    "$basedir=Split-Path $MyInvocation.MyCommand.Definition -Parent",
    "",
    "$exe=\"\"",
    "if ($PSVersionTable.PSVersion -lt \"6.0\" -or $IsWindows) {",
    "  # Fix case when both the Windows and Linux builds of Node",
    "  # are installed in the same directory",
    "  $exe=\".exe\"",
    "}",
    "# Support pipeline input",
    "if ($MyInvocation.ExpectingInput) {",
    `  $input | & "$basedir/${target}"   $args`,
    "} else {",
    `  & "$basedir/${target}"   $args`,
    "}",
    "exit $LASTEXITCODE",
    ""
  ].join("\r\n");
}

const NATIVE = "node_modules/fake-native/bin/fake.exe";

describe("variante native du shim npm (exécutable du paquet, sans Node)", () => {
  test("reconnue : l'exécutable du paquet est lancé directement", () => {
    const bin = npmBin({ shim: npmNativePowerShellShim(NATIVE), extra: { [NATIVE]: "" } });
    assert.deepEqual(directNpmShimLaunch(bin.command), { command: path.join(bin.dir, ...NATIVE.split("/")), prefixArgs: [] });
    assert.equal(parseNpmNativePowerShellShim(npmNativePowerShellShim(NATIVE)).status, "recognized");
  });

  test("formes refusées : cible hors du dossier, non native, absente, ou instruction ajoutée", () => {
    assert.equal(npmNativeShimLaunch(path.join(npmBin({ shim: npmNativePowerShellShim("../ailleurs/fake.exe") }).dir, "fake.ps1")).status, "unsupported");
    assert.equal(npmNativeShimLaunch(path.join(npmBin({ shim: npmNativePowerShellShim("node_modules/x/run.cmd"), extra: { "node_modules/x/run.cmd": "" } }).dir, "fake.ps1")).status, "unsupported");
    assert.equal(npmNativeShimLaunch(path.join(npmBin({ shim: npmNativePowerShellShim(NATIVE) }).dir, "fake.ps1")).status, "missing");
    const modified = npmNativePowerShellShim(NATIVE).replace("# Support pipeline input", "$env:PATH=\"C:\\autre\"\r\n# Support pipeline input");
    assert.equal(parseNpmNativePowerShellShim(modified).status, "refused");
    // La forme Node + script n'est pas une forme native, et inversement.
    assert.equal(parseNpmNativePowerShellShim(npmPowerShellShim(SCRIPT)).status, "refused");
  });

  test("Windows, adapter CLI : arguments structurés et stdin préservés par la variante native", { skip: process.platform !== "win32" }, async () => {
    const bin = npmBin({ shim: npmNativePowerShellShim(NATIVE) });
    // L'« exécutable du paquet » est Node lui-même (lien), qui lance la fausse CLI du dossier.
    mkdirSync(path.dirname(path.join(bin.dir, ...NATIVE.split("/"))), { recursive: true });
    try {
      linkSync(process.execPath, path.join(bin.dir, ...NATIVE.split("/")));
    } catch {
      copyFileSync(process.execPath, path.join(bin.dir, ...NATIVE.split("/")));
    }
    const script = path.join(bin.dir, ...SCRIPT.split("/"));
    const adapter = new CliAdapter("mock", { type: "cli", command: bin.command, args: [script, ...STRUCTURED_ARGS], promptMode: "stdin", shell: true, role: "reviewer", timeoutMs: 10_000 });

    await adapter.generate(prompt(TOPIC));

    const seen = bin.capture();
    assert.deepEqual(seen.argv, STRUCTURED_ARGS);
    assert.match(seen.stdin, /Une réponse française : été\./);
  });
});
