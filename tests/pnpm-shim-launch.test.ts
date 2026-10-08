/**
 * @file Lancement des CLIs installées par pnpm, par les adapters CLI/PTY, sans PowerShell (#109) :
 * reconnaissance stricte du shim, `NODE_PATH` reproduit dans le même ordre que le shim, accents de
 * stdin, JSON avec guillemets et argument `-` préservés. Fausse CLI Node, aucun agent réel.
 */
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, test } from "node:test";
import { CliAdapter } from "../src/adapters/cli.js";
import { CliPtyAdapter } from "../src/adapters/cli-pty.js";
import { resolveExternalExecutable } from "../src/externalSessions/resolve.js";
import { directNpmShimLaunch, parseNpmPowerShellShim, parsePnpmPowerShellShim, pnpmShimLaunch, withShimNodePath } from "../src/npmShim.js";
import type { AgentPrompt } from "../src/types.js";
import { npmPowerShellShim } from "./fixtures/external-sessions/npm-shim.js";
import { pnpmPowerShellShim } from "./fixtures/pnpm-shim.js";

const root = mkdtempSync(path.join(os.tmpdir(), "palabre-pnpm-shim-"));
after(() => rmSync(root, { recursive: true, force: true }));
let counter = 0;

/** Chemin d'un paquet global pnpm, sous le dossier du shim. */
const GLOBAL_SCRIPT = "global/5/.pnpm/fake-cli@1.0.0/node_modules/fake-cli/bin/cli.cjs";
const SHIM_NODE_PATH = "C:\\pnpm\\global\\5\\.pnpm\\fake-cli@1.0.0\\node_modules;C:\\pnpm\\global\\5\\.pnpm\\node_modules";

/** Arguments structurés du constat de #98 : guillemets internes et argument final `-`. */
const STRUCTURED_ARGS = ["-c", "sandbox_mode=\"read-only\"", "--settings", "{\"disableAllHooks\":true}", "-"];
const TOPIC = "Une réponse française : été.\nDeuxième ligne « citée ».";

/** Fausse CLI : écrit argv, stdin et NODE_PATH en JSON dans `capture.json`, puis répond « ok ». */
function fakeCli(capture: string): string {
  return `const done=(input)=>{require('fs').writeFileSync(${JSON.stringify(capture)},JSON.stringify({argv:process.argv.slice(2),stdin:input,nodePath:process.env.NODE_PATH??null}));process.stdout.write('ok');process.exit(0)};if(process.stdin.isTTY){done('')}else{let input='';process.stdin.on('data',c=>input+=c);process.stdin.on('end',()=>done(input))}`;
}

/**
 * Fausse CLI pour un prompt écrit dans le pseudo-terminal : lecture en mode brut, puis capture
 * après 800 ms sans nouvelle donnée (le terminal n'a pas de fin d'entrée).
 */
function fakePtyStdinCli(capture: string): string {
  return `let input='',idle;const done=()=>{require('fs').writeFileSync(${JSON.stringify(capture)},JSON.stringify({argv:process.argv.slice(2),stdin:input,nodePath:process.env.NODE_PATH??null}));process.stdout.write('ok');process.exit(0)};if(process.stdin.isTTY)process.stdin.setRawMode(true);process.stdin.setEncoding('utf8');process.stdin.on('data',c=>{input+=c;clearTimeout(idle);idle=setTimeout(done,800)});`;
}

/**
 * Dossier de binaires pnpm jetable : shim `.ps1`, wrapper `.cmd` voisin (qui échoue s'il est lancé)
 * et fausse CLI. `link` place le script hors du dossier du shim, comme `pnpm link --global` ;
 * `ptyStdin` installe la fausse CLI qui lit le prompt écrit dans le pseudo-terminal.
 */
function pnpmBin(options: { link?: boolean; ptyStdin?: boolean; shim?: (script: string) => string; extra?: Record<string, string>; withScript?: boolean } = {}) {
  const base = path.join(root, `case-${++counter}`);
  const dir = path.join(base, "pnpm");
  const capture = path.join(base, "capture.json");
  const script = options.link ? "../projet/dist/cli.cjs" : GLOBAL_SCRIPT;
  const files: Record<string, string> = {
    "fake.ps1": (options.shim ?? ((s) => pnpmPowerShellShim(s, SHIM_NODE_PATH)))(script),
    "fake.cmd": "@echo off\r\nexit /b 99\r\n",
    ...options.extra
  };
  if (options.withScript !== false) files[script] = options.ptyStdin ? fakePtyStdinCli(capture) : fakeCli(capture);
  for (const [name, content] of Object.entries(files)) {
    const file = path.resolve(dir, name);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, content);
  }
  return {
    dir, script: path.resolve(dir, script), command: path.join(dir, "fake.cmd"), shim: path.join(dir, "fake.ps1"),
    capture: () => JSON.parse(readFileSync(capture, "utf8")) as { argv: string[]; stdin: string; nodePath: string | null }
  };
}

function prompt(topic: string): AgentPrompt {
  return {
    topic, turn: 1, totalTurns: 1, selfName: "mock", peerName: "peer", selfRole: "reviewer",
    session: { startedAt: "2026-10-08T00:00:00.000Z", localDate: "2026-10-08", timeZone: "Europe/Paris", cwd: process.cwd() },
    files: [], transcript: []
  };
}

/** Exécute `run` avec `NODE_PATH` hérité fixé (ou absent), puis restaure l'environnement de Palabre. */
async function withInheritedNodePath<T>(value: string | undefined, run: () => Promise<T>): Promise<T> {
  const saved = process.env.NODE_PATH;
  if (value === undefined) delete process.env.NODE_PATH;
  else process.env.NODE_PATH = value;
  try {
    return await run();
  } finally {
    if (saved === undefined) delete process.env.NODE_PATH;
    else process.env.NODE_PATH = saved;
  }
}

describe("parsePnpmPowerShellShim : reconnaissance stricte du modèle pnpm", () => {
  test("paquet global et lien global reconnus, en CRLF comme en LF, espaces de fin tolérés", () => {
    const global = parsePnpmPowerShellShim(pnpmPowerShellShim(GLOBAL_SCRIPT, SHIM_NODE_PATH));
    assert.deepEqual(global, { status: "recognized", scriptRelativePath: GLOBAL_SCRIPT, nodePath: SHIM_NODE_PATH, outside: false });
    const link = parsePnpmPowerShellShim(pnpmPowerShellShim("../../../Documents/Dev/Mon projet/dist/index.js", "C:\\Users\\Jérôme\\node_modules"));
    assert.deepEqual(link, { status: "recognized", scriptRelativePath: "../../../Documents/Dev/Mon projet/dist/index.js", nodePath: "C:\\Users\\Jérôme\\node_modules", outside: true });
    const lf = pnpmPowerShellShim(GLOBAL_SCRIPT, SHIM_NODE_PATH).replace(/\r\n/g, "\n").replace("$ret=0", "$ret=0  ");
    assert.equal(parsePnpmPowerShellShim(lf).status, "recognized");
  });

  test("toute instruction ajoutée, retirée ou modifiée est refusée", () => {
    const shim = pnpmPowerShellShim(GLOBAL_SCRIPT, SHIM_NODE_PATH);
    const variants: Record<string, string> = {
      "instruction ajoutée": shim.replace("$ret=0", "$env:PATH=\"C:\\autre\"\r\n$ret=0"),
      "restauration retirée": shim.replace("$env:NODE_PATH=$env_node_path\r\n", ""),
      "ordre inversé": shim.replace("\"$new_node_path$pathsep$env_node_path\"", "\"$env_node_path$pathsep$new_node_path\""),
      "séparateur modifié": shim.replace("  $pathsep=\";\"", "  $pathsep=\":\""),
      "affectation seule toujours": shim.replace("if ([string]::IsNullOrEmpty($env_node_path)) {", "if ($true) {"),
      "un appel différent": shim.replace(`    & "node$exe"  "$basedir/${GLOBAL_SCRIPT}" $args`, `    & "node$exe"  "$basedir/global/autre.cjs" $args`),
      "exit anticipé": shim.replace("$ret=0", "exit 0\r\n$ret=0"),
      "forme pnpx": "pnpm dlx @args\r\n"
    };
    for (const [label, text] of Object.entries(variants)) assert.equal(parsePnpmPowerShellShim(text).status, "refused", label);
  });

  test("NODE_PATH : valeurs non littérales, relatives ou vides refusées", () => {
    for (const value of ["C:\\a;$env:USERPROFILE", "C:\\a`;C:\\b", "C:\\a;C:\\b\u201C", "node_modules", "C:\\a;;C:\\b", "", "C:/a/node_modules", "\\\\serveur\\partage"]) {
      assert.equal(parsePnpmPowerShellShim(pnpmPowerShellShim(GLOBAL_SCRIPT, value)).status, "refused", value);
    }
    assert.equal(parsePnpmPowerShellShim(pnpmPowerShellShim(GLOBAL_SCRIPT, SHIM_NODE_PATH, "/proc/$x")).status, "refused");
  });

  test("chemin de script : .. seulement en tête, littéral, JavaScript", () => {
    for (const script of ["global/../x.cjs", "global/./x.cjs", "global/$x/cli.cjs", "global/x/cli.cmd", "global\\x\\cli.cjs", "C:/x/cli.cjs", "..", "global//cli.cjs"]) {
      assert.equal(parsePnpmPowerShellShim(pnpmPowerShellShim(script, SHIM_NODE_PATH)).status, "refused", script);
    }
  });

  test("les formes npm et pnpm ne se confondent pas", () => {
    assert.equal(parsePnpmPowerShellShim(npmPowerShellShim("node_modules/x/cli.js")).status, "refused");
    assert.equal(parseNpmPowerShellShim(pnpmPowerShellShim(GLOBAL_SCRIPT, SHIM_NODE_PATH)).status, "refused");
  });
});

describe("pnpmShimLaunch : lancement direct et confinement des liens", () => {
  // Interpréteur factice dans le dossier du shim : tests portables, indépendants du Node installé.
  test("paquet global : Node du dossier du shim, script du paquet et NODE_PATH du shim", () => {
    const bin = pnpmBin({ extra: { "node.exe": "" } });
    assert.deepEqual(pnpmShimLaunch(bin.shim), { status: "resolved", command: path.join(bin.dir, "node.exe"), prefixArgs: [bin.script], nodePath: SHIM_NODE_PATH, form: "pnpm-global" });
    assert.deepEqual(directNpmShimLaunch(bin.command), { command: path.join(bin.dir, "node.exe"), prefixArgs: [bin.script], nodePath: SHIM_NODE_PATH });
  });

  test("lien global : cible hors du dossier acceptée si elle existe et est un fichier JavaScript", () => {
    const bin = pnpmBin({ link: true, extra: { "node.exe": "" } });
    const launch = pnpmShimLaunch(bin.shim);
    assert.equal(launch.status, "resolved");
    assert.equal(launch.status === "resolved" && launch.form, "pnpm-link");
    assert.deepEqual(launch.status === "resolved" && launch.prefixArgs, [bin.script]);
  });

  test("cible absente ou dossier à la place du script : pas de lancement direct", () => {
    const missingLink = pnpmBin({ link: true, withScript: false, extra: { "node.exe": "" } });
    assert.equal(pnpmShimLaunch(missingLink.shim).status, "missing");
    assert.equal(directNpmShimLaunch(missingLink.command), undefined);
    const directory = pnpmBin({ link: true, withScript: false, extra: { "node.exe": "", "../projet/dist/cli.cjs/vide.txt": "" } });
    assert.equal(pnpmShimLaunch(directory.shim).status, "missing");
  });

  test("shim pnpm modifié : pas de lancement direct, le repli reste possible", () => {
    const bin = pnpmBin({ shim: (s) => pnpmPowerShellShim(s, SHIM_NODE_PATH).replace("$ret=0", "$env:FOO=\"1\"\r\n$ret=0"), extra: { "node.exe": "" } });
    assert.equal(pnpmShimLaunch(bin.shim).status, "unsupported");
    assert.equal(directNpmShimLaunch(bin.command), undefined);
  });

  test("Relay (D21) : un shim pnpm reste refusé, sans lancement", { skip: process.platform !== "win32" }, () => {
    const bin = pnpmBin({ extra: { "node.exe": "" } });
    assert.equal(resolveExternalExecutable(bin.command).status, "unsupported-executable");
  });
});

describe("withShimNodePath : même valeur et même ordre que le shim", () => {
  test("hérité absent ou vide : valeur du shim seule ; sinon préfixe, séparateur Windows", () => {
    assert.equal(withShimNodePath({}, "C:\\shim").NODE_PATH, "C:\\shim");
    assert.equal(withShimNodePath({ NODE_PATH: "" }, "C:\\shim").NODE_PATH, "C:\\shim");
    assert.equal(withShimNodePath({ NODE_PATH: "C:\\herite;C:\\autre" }, "C:\\shim;C:\\shim2").NODE_PATH, "C:\\shim;C:\\shim2;C:\\herite;C:\\autre");
  });

  test("nom insensible à la casse, copie sans modifier l'environnement fourni", () => {
    const env = { Node_Path: "C:\\herite", PATH: "C:\\bin" };
    const result = withShimNodePath(env, "C:\\shim");
    assert.deepEqual(result, { PATH: "C:\\bin", NODE_PATH: "C:\\shim;C:\\herite" });
    assert.deepEqual(env, { Node_Path: "C:\\herite", PATH: "C:\\bin" });
  });
});

describe("adapters Windows : shim pnpm lancé via Node, sans PowerShell", () => {
  const skip = process.platform !== "win32";

  test("CLI, stdin : accents sur plusieurs lignes, JSON avec guillemets, argument - et NODE_PATH préfixé", { skip }, async () => {
    const bin = pnpmBin();
    const adapter = new CliAdapter("mock", { type: "cli", command: bin.command, args: STRUCTURED_ARGS, promptMode: "stdin", shell: true, role: "reviewer", timeoutMs: 10_000 });

    const response = await withInheritedNodePath("C:\\herite\\node_modules", () => adapter.generate(prompt(TOPIC)));

    assert.equal(response.content, "ok");
    const seen = bin.capture();
    assert.deepEqual(seen.argv, STRUCTURED_ARGS);
    assert.match(seen.stdin, /Une réponse française : été\./);
    assert.match(seen.stdin, /Deuxième ligne « citée »/);
    assert.doesNotMatch(seen.stdin, /\?\?/);
    assert.equal(seen.nodePath, `${SHIM_NODE_PATH};C:\\herite\\node_modules`);
  });

  test("CLI, prompt en argument : guillemets et & préservés ; NODE_PATH hérité absent", { skip }, async () => {
    const bin = pnpmBin();
    const adapter = new CliAdapter("mock", { type: "cli", command: bin.command, args: STRUCTURED_ARGS.slice(0, 4), promptMode: "argument", shell: true, role: "reviewer", timeoutMs: 10_000 });

    await withInheritedNodePath(undefined, () => adapter.generate(prompt("Sujet \"cité\" & été")));

    const seen = bin.capture();
    assert.deepEqual(seen.argv.slice(0, 4), STRUCTURED_ARGS.slice(0, 4));
    assert.match(seen.argv.at(-1) ?? "", /Sujet "cité" & été/);
    assert.equal(seen.nodePath, SHIM_NODE_PATH);
  });

  test("CLI, lien global hors du dossier du shim : lancé directement", { skip }, async () => {
    const bin = pnpmBin({ link: true });
    const adapter = new CliAdapter("mock", { type: "cli", command: bin.command, args: STRUCTURED_ARGS, promptMode: "stdin", shell: true, role: "reviewer", timeoutMs: 10_000 });

    await withInheritedNodePath(undefined, () => adapter.generate(prompt(TOPIC)));

    const seen = bin.capture();
    assert.deepEqual(seen.argv, STRUCTURED_ARGS);
    assert.match(seen.stdin, /Deuxième ligne « citée »/);
    assert.equal(seen.nodePath, SHIM_NODE_PATH);
  });

  test("PTY, prompt en argument : arguments structurés, prompt et NODE_PATH préservés", { skip }, async () => {
    const bin = pnpmBin();
    const adapter = new CliPtyAdapter("mock-pty", { type: "cli-pty", command: bin.command, args: STRUCTURED_ARGS.slice(0, 4), promptMode: "argument", role: "reviewer", timeoutMs: 15_000 });

    await withInheritedNodePath("C:\\herite", () => adapter.generate(prompt("Sujet \"cité\" & été")));

    const seen = bin.capture();
    assert.deepEqual(seen.argv.slice(0, 4), STRUCTURED_ARGS.slice(0, 4));
    assert.match(seen.argv.at(-1) ?? "", /Sujet "cité" & été/);
    assert.equal(seen.nodePath, `${SHIM_NODE_PATH};C:\\herite`);
  });

  test("PTY, prompt sur stdin : accents sur plusieurs lignes, JSON avec guillemets, argument - et NODE_PATH", { skip }, async () => {
    const bin = pnpmBin({ ptyStdin: true });
    const adapter = new CliPtyAdapter("mock-pty", { type: "cli-pty", command: bin.command, args: STRUCTURED_ARGS, promptMode: "stdin", role: "reviewer", timeoutMs: 20_000 });

    await withInheritedNodePath("C:\\herite", () => adapter.generate(prompt(TOPIC)));

    const seen = bin.capture();
    assert.deepEqual(seen.argv, STRUCTURED_ARGS);
    assert.match(seen.stdin, /Une réponse française : été\./);
    assert.match(seen.stdin, /Deuxième ligne « citée »/);
    assert.doesNotMatch(seen.stdin, /\?\?/);
    assert.equal(seen.nodePath, `${SHIM_NODE_PATH};C:\\herite`);
  });

  test("l'environnement de Palabre n'est pas modifié par le lancement", { skip }, async () => {
    const bin = pnpmBin();
    const adapter = new CliAdapter("mock", { type: "cli", command: bin.command, args: [], promptMode: "stdin", shell: true, role: "reviewer", timeoutMs: 10_000 });
    await withInheritedNodePath("C:\\herite", async () => {
      await adapter.generate(prompt(TOPIC));
      assert.equal(process.env.NODE_PATH, "C:\\herite");
    });
  });
});
