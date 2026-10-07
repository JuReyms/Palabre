/** @file Tests de la résolution de l'exécutable du relay (décision D21) et du registre des fournisseurs. */
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, test } from "node:test";
import { externalSessionProviderForCommand } from "../src/agentRegistry.js";
import { executableFromNpmShim, parseNpmPowerShellShim, resolveExternalExecutable } from "../src/externalSessions/resolve.js";
import { npmPowerShellShim } from "./fixtures/external-sessions/npm-shim.js";

const root = mkdtempSync(path.join(os.tmpdir(), "palabre-external-resolve-"));
after(() => rmSync(root, { recursive: true, force: true }));
let counter = 0;
const SCRIPT = "node_modules/@openai/codex/bin/codex.js";

/** Dossier de binaires npm jetable : shim, script du paquet, éventuels fichiers voisins. */
function npmBin(files: Record<string, string>) {
  const dir = path.join(root, `bin-${++counter}`);
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    writeFileSync(path.join(dir, name), content);
  }
  return dir;
}

describe("externalSessionProviderForCommand", () => {
  test("Codex et Claude Code seulement, quels que soient le chemin et l'extension", () => {
    assert.equal(externalSessionProviderForCommand("codex"), "codex");
    assert.equal(externalSessionProviderForCommand("C:\\npm\\codex.cmd"), "codex");
    assert.equal(externalSessionProviderForCommand("claude.exe"), "claude");
    assert.equal(externalSessionProviderForCommand("/usr/local/bin/claude"), "claude");
    for (const command of ["agy", "opencode", "vibe", "ollama", "my-claude-wrapper"]) {
      assert.equal(externalSessionProviderForCommand(command), undefined, command);
    }
  });
});

describe("parseNpmPowerShellShim : seule la forme npm est reconnue", () => {
  test("shim npm : script du paquet extrait, sans exécution", () => {
    assert.deepEqual(parseNpmPowerShellShim(npmPowerShellShim(SCRIPT)), { status: "recognized", scriptRelativePath: SCRIPT });
  });

  test("formes modifiées ou ambiguës : refusées", () => {
    const base = npmPowerShellShim(SCRIPT);
    const cases: Record<string, string> = {
      "sans ligne basedir": base.replace("$basedir=Split-Path $MyInvocation.MyCommand.Definition -Parent", "$basedir=\"C:\\autre\""),
      "NODE_PATH": base.replace("$ret=0", "$env:NODE_PATH=\"x\"\r\n$ret=0"),
      "NODE_OPTIONS": base.replace("$ret=0", "$env:NODE_OPTIONS=\"--require x\"\r\n$ret=0"),
      "appel supplémentaire": base.replace("exit $ret", "& \"$basedir/autre.exe\" $args\r\nexit $ret"),
      "autre interpréteur": base.replaceAll("node$exe", "pwsh$exe"),
      "scripts différents": base.replace(`"node$exe"  "$basedir/${SCRIPT}"`, `"node$exe"  "$basedir/autre.js"`),
      "expansion dans le chemin": base.replaceAll(SCRIPT, "node_modules/$env:X/codex.js"),
      "accent grave dans le chemin": base.replaceAll(SCRIPT, "node_modules/a`b/codex.js"),
      "aucun appel": base.split("\r\n").filter((line) => !line.includes("&")).join("\r\n"),
      "trop volumineux": `${base}#${"x".repeat(20_000)}`
    };
    for (const [label, text] of Object.entries(cases)) {
      assert.equal(parseNpmPowerShellShim(text).status, "refused", label);
    }
  });

  test("instructions ajoutées ou modifiées ailleurs dans le shim : refusées (revue A4)", () => {
    const base = npmPowerShellShim(SCRIPT);
    const insertAfter = (anchor: string, line: string) => base.replace(`${anchor}\r\n`, `${anchor}\r\n${line}\r\n`);
    const cases: Record<string, string> = {
      "réaffectation de $args": insertAfter("$ret=0", "$args = @(\"autre-session\")"),
      "variable d'environnement CODEX_HOME": insertAfter("$ret=0", "$env:CODEX_HOME=\"C:\\autre\""),
      "exit anticipé": insertAfter("$basedir=Split-Path $MyInvocation.MyCommand.Definition -Parent", "exit 0"),
      "Set-Location": insertAfter("$ret=0", "Set-Location C:\\"),
      "instruction dans une branche": insertAfter("  if ($MyInvocation.ExpectingInput) {", "    $args = @()"),
      "commentaire modifié": base.replace("# Support pipeline input", "# Modifié"),
      "ligne vide ajoutée au milieu": insertAfter("$ret=0", ""),
      "indentation modifiée": base.replace("  $ret=$LASTEXITCODE", "$ret=$LASTEXITCODE"),
      "code de sortie modifié": base.replace("exit $ret", "exit 0"),
      "contenu après le modèle": `${base}Write-Output x\r\n`,
      "chemin de script avec espace": npmPowerShellShim("node_modules/a b/codex.js")
    };
    for (const [label, text] of Object.entries(cases)) {
      assert.equal(parseNpmPowerShellShim(text).status, "refused", label);
    }
  });

  test("variations permises : fins de ligne LF ou CRLF, espaces en fin de ligne, lignes vides finales", () => {
    const base = npmPowerShellShim(SCRIPT);
    const variants = [base.replaceAll("\r\n", "\n"), base.replaceAll("\r\n", "  \r\n"), `${base}\r\n\r\n`, base.trimEnd()];
    for (const text of variants) {
      assert.deepEqual(parseNpmPowerShellShim(text), { status: "recognized", scriptRelativePath: SCRIPT });
    }
  });
});

describe("executableFromNpmShim", () => {
  // Interpréteur factice dans le dossier du shim : test portable, indépendant du Node installé.
  test("shim reconnu : interpréteur Node du dossier du shim et script du paquet, lancés directement", () => {
    const dir = npmBin({ "codex.ps1": npmPowerShellShim(SCRIPT), [SCRIPT]: "", "node.exe": "" });
    const resolved = executableFromNpmShim(path.join(dir, "codex.ps1"));
    assert.ok(resolved.status === "resolved");
    assert.equal(resolved.kind, "npm-shim");
    assert.equal(resolved.executable.command, path.join(dir, "node.exe"));
    assert.deepEqual(resolved.executable.prefixArgs, [path.join(dir, ...SCRIPT.split("/"))]);
  });

  // Sans Node local, le shim npm lance `node.exe` du PATH : sémantique Windows, comme le seul appelant
  // de production (`resolveWindows`). Ailleurs, Node s'appelle `node` et ce repli ne s'applique pas.
  test("Windows : sans Node dans le dossier du shim, node.exe du PATH", { skip: process.platform !== "win32" }, () => {
    const dir = npmBin({ "codex.ps1": npmPowerShellShim(SCRIPT), [SCRIPT]: "" });
    const resolved = executableFromNpmShim(path.join(dir, "codex.ps1"));
    assert.ok(resolved.status === "resolved");
    assert.equal(resolved.kind, "npm-shim");
    assert.deepEqual(resolved.executable.prefixArgs, [path.join(dir, ...SCRIPT.split("/"))]);
    assert.equal(path.basename(resolved.executable.command).toLowerCase(), "node.exe");
  });

  test("script hors du dossier, non JavaScript ou absent : refusé", () => {
    const outside = npmBin({ "codex.ps1": npmPowerShellShim("../ailleurs/codex.js") });
    assert.equal(executableFromNpmShim(path.join(outside, "codex.ps1")).status, "unsupported-executable");
    const notJs = npmBin({ "codex.ps1": npmPowerShellShim("node_modules/codex/bin/codex.exe"), "node_modules/codex/bin/codex.exe": "" });
    assert.equal(executableFromNpmShim(path.join(notJs, "codex.ps1")).status, "unsupported-executable");
    const missing = npmBin({ "codex.ps1": npmPowerShellShim(SCRIPT) });
    assert.equal(executableFromNpmShim(path.join(missing, "codex.ps1")).status, "command-not-found");
  });
});

describe("resolveExternalExecutable", () => {
  test("commande vide ou introuvable : command-not-found", () => {
    assert.equal(resolveExternalExecutable("").status, "command-not-found");
    assert.equal(resolveExternalExecutable(path.join(root, "absent", "codex")).status, "command-not-found");
    assert.equal(resolveExternalExecutable("palabre-relay-cli-absente").status, "command-not-found");
  });

  test("Windows : exécutable natif, y compris un alias d'exécution WindowsApps", { skip: process.platform !== "win32" }, () => {
    const dir = npmBin({ "claude.exe": "", "Microsoft/WindowsApps/claude.exe": "" });
    for (const command of [path.join(dir, "claude.exe"), path.join(dir, "claude"), path.join(dir, "Microsoft", "WindowsApps", "claude.exe")]) {
      const resolved = resolveExternalExecutable(command);
      assert.ok(resolved.status === "resolved", command);
      assert.equal(resolved.kind, "native");
      assert.deepEqual(resolved.executable.prefixArgs, []);
    }
  });

  test("Windows : shim npm voisin d'un .cmd ou d'un script sans extension, résolu sans PowerShell", { skip: process.platform !== "win32" }, () => {
    const dir = npmBin({ "codex.ps1": npmPowerShellShim(SCRIPT), "codex.cmd": "@echo off", codex: "#!/bin/sh", [SCRIPT]: "" });
    for (const command of [path.join(dir, "codex"), path.join(dir, "codex.cmd"), path.join(dir, "codex.ps1")]) {
      const resolved = resolveExternalExecutable(command);
      assert.ok(resolved.status === "resolved", command);
      assert.equal(resolved.kind, "npm-shim");
      assert.equal(/powershell|pwsh/i.test(resolved.executable.command), false);
    }
  });

  test("Windows : wrapper .cmd seul, ou shim modifié : unsupported-executable, sans exécution", { skip: process.platform !== "win32" }, () => {
    const cmdOnly = npmBin({ "codex.cmd": "@echo off\r\nnode codex.js %*" });
    assert.equal(resolveExternalExecutable(path.join(cmdOnly, "codex")).status, "unsupported-executable");
    const modified = npmBin({ "codex.ps1": npmPowerShellShim(SCRIPT).replace("$ret=0", "$env:NODE_PATH=\"x\"\r\n$ret=0"), [SCRIPT]: "" });
    assert.equal(resolveExternalExecutable(path.join(modified, "codex")).status, "unsupported-executable");
  });

  test("hors Windows : exécutable résolu et lancé directement", { skip: process.platform === "win32" }, () => {
    const dir = npmBin({ codex: "#!/usr/bin/env node\n" });
    const resolved = resolveExternalExecutable(path.join(dir, "codex"));
    assert.ok(resolved.status === "resolved");
    assert.deepEqual(resolved.executable, { command: path.join(dir, "codex"), prefixArgs: [] });
  });
});
