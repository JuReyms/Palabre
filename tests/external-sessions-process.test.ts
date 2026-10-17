/** @file Tests du lancement de CLI de session externe : stdin, environnement, timeouts, plafond de sortie, annulation et diagnostic de lancement. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, test } from "node:test";
import {
  cleanExternalEnv,
  diagnoseLaunchFailure,
  runExternalProcess,
  type ExternalProcessSpec
} from "../src/externalSessions/process.js";

const node = process.execPath;
const sandbox = mkdtempSync(path.join(os.tmpdir(), "palabre-external-process-"));
const missingDir = path.join(sandbox, "dossier-absent");
after(() => rmSync(sandbox, { recursive: true, force: true }));
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function spec(script: string, overrides: Partial<ExternalProcessSpec> = {}): ExternalProcessSpec {
  return { command: node, args: ["-e", script], cwd: sandbox, stdin: "", timeoutMs: 10_000, ...overrides };
}

/** Termine un processus abandonné par un test (kill simulé sans effet). */
function cleanup(pid: number | undefined): void {
  if (pid === undefined) return;
  try {
    process.kill(pid, "SIGKILL");
  } catch {
    // Déjà terminé.
  }
}

describe("runExternalProcess : échange normal", () => {
  test("transmet stdin, sépare stdout et stderr, rapporte le code de sortie", async () => {
    const result = await runExternalProcess(spec(
      "let s='';process.stdin.on('data',c=>s+=c).on('end',()=>{process.stdout.write('OUT:'+s);process.stderr.write('ERR');process.exitCode=3;})",
      { stdin: "message relayé é" }
    ));
    assert.equal(result.started, true);
    assert.equal(result.stdout, "OUT:message relayé é");
    assert.equal(result.stderr, "ERR");
    assert.equal(result.exitCode, 3);
    assert.equal(result.stopReason, undefined);
    assert.equal(result.forcedReturn, false);
  });

  test("lance la CLI dans le dossier de travail demandé", async () => {
    const result = await runExternalProcess(spec("process.stdout.write(process.cwd())"));
    assert.equal(path.resolve(result.stdout).toLowerCase(), path.resolve(sandbox).toLowerCase());
  });

  test("retire les variables de session de l'hôte, quelle que soit leur casse", () => {
    const env = cleanExternalEnv({
      PATH: "p",
      CLAUDECODE: "1",
      CLAUDE_CODE_SSE_PORT: "1",
      claude_code_entrypoint: "x",
      CLAUDE_PID: "1",
      CLAUDE_AGENT_SDK_VERSION: "1",
      CODEX_THREAD_ID: "1",
      CODEX_SESSION_ID: "1",
      CODEX_HOME: "garde",
      ANTHROPIC_API_KEY: "garde"
    });
    assert.deepEqual(Object.keys(env).sort(), ["ANTHROPIC_API_KEY", "CODEX_HOME", "PATH"]);
  });

  test("l'environnement par défaut de la CLI ne contient pas les variables de l'hôte", async () => {
    process.env.CLAUDE_CODE_RELAY_TEST = "1";
    try {
      const result = await runExternalProcess(spec("process.stdout.write(JSON.stringify(Object.keys(process.env)))"));
      const keys = JSON.parse(result.stdout) as string[];
      assert.equal(keys.some((key) => key.toUpperCase() === "CLAUDE_CODE_RELAY_TEST"), false);
      assert.ok(keys.some((key) => key.toUpperCase() === "PATH"));
    } finally {
      delete process.env.CLAUDE_CODE_RELAY_TEST;
    }
  });
});

describe("runExternalProcess : environnement explicite", () => {
  test("un environnement fourni par l'appelant est nettoyé lui aussi", async () => {
    const result = await runExternalProcess(spec("process.stdout.write(JSON.stringify(Object.keys(process.env)))", {
      env: { ...process.env, CLAUDECODE: "1", CODEX_THREAD_ID: "t", RELAY_TEST_KEEP: "1" }
    }));
    const keys = (JSON.parse(result.stdout) as string[]).map((key) => key.toUpperCase());
    assert.equal(keys.includes("CLAUDECODE"), false);
    assert.equal(keys.includes("CODEX_THREAD_ID"), false);
    assert.ok(keys.includes("RELAY_TEST_KEEP"));
  });
});

describe("runExternalProcess : arrêts et timers", () => {
  test("aucun kill après une terminaison normale, même après l'échéance du timeout", async () => {
    const kills: number[] = [];
    const result = await runExternalProcess(spec("process.exit(0)", { timeoutMs: 200, killTree: (pid) => kills.push(pid) }));
    await sleep(400);
    assert.equal(result.stopReason, undefined);
    assert.deepEqual(kills, []);
  });

  test("timeout : tue l'arbre de processus et rapporte timeout", async () => {
    const result = await runExternalProcess(spec("setInterval(() => {}, 1000)", { timeoutMs: 300 }));
    assert.equal(result.started, true);
    assert.equal(result.stopReason, "timeout");
    assert.equal(result.forcedReturn, false, "le processus a bien été tué");
  });

  test("plafond cumulé stdout + stderr : arrêt, sortie bornée, output-too-large", async () => {
    const kills: number[] = [];
    const result = await runExternalProcess(spec(
      "process.stdout.write('o'.repeat(600));process.stderr.write('e'.repeat(600));setInterval(() => {}, 1000)",
      { maxOutputBytes: 1_000, killTree: (pid) => { kills.push(pid); process.kill(pid); } }
    ));
    assert.equal(result.stopReason, "output-too-large");
    assert.equal(kills.length, 1);
    assert.ok(Buffer.byteLength(result.stdout) + Buffer.byteLength(result.stderr) <= 1_000);
    assert.ok(result.outputBytes > 1_000);
  });

  test("annulation pendant l'exécution : kill et cancelled", async () => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 200);
    const result = await runExternalProcess(spec("setInterval(() => {}, 1000)", { signal: controller.signal }));
    assert.equal(result.started, true);
    assert.equal(result.stopReason, "cancelled");
  });

  test("annulation déjà déclenchée : aucun lancement", async () => {
    const controller = new AbortController();
    controller.abort();
    const result = await runExternalProcess(spec("process.exit(0)", { signal: controller.signal }));
    assert.equal(result.started, false);
    assert.equal(result.stopReason, "cancelled");
    assert.equal(result.pid, undefined);
  });

  test("processus qui survit au kill : la main est rendue après le délai de grâce", async () => {
    const result = await runExternalProcess(spec("setInterval(() => {}, 1000)", {
      timeoutMs: 200,
      killGraceMs: 200,
      killTree: () => {
        // Kill sans effet : simule un processus récalcitrant.
      }
    }));
    cleanup(result.pid);
    assert.equal(result.stopReason, "timeout");
    assert.equal(result.forcedReturn, true);
  });
});

describe("runExternalProcess : retour forcé, l'appelant se termine naturellement", () => {
  const processModule = new URL("../src/externalSessions/process.js", import.meta.url).href;
  const CHILD_LIFETIME_MS = 8_000;

  /**
   * Lance un programme appelant qui utilise `runExternalProcess`, écrit le résultat, puis rend la
   * main sans `process.exit()` ni nettoyage. Mesure le délai jusqu'à sa sortie (`exit`, pas `close`).
   */
  function runCaller(childScript: string, timeoutMs: number): Promise<{ elapsedMs: number; code: number | null; result: Record<string, unknown> }> {
    const caller = [
      `import { runExternalProcess } from ${JSON.stringify(processModule)};`,
      "const result = await runExternalProcess({",
      `  command: process.execPath, args: ["-e", ${JSON.stringify(childScript)}], cwd: ${JSON.stringify(sandbox)}, stdin: "",`,
      `  timeoutMs: ${timeoutMs}, killGraceMs: 300, killTree: () => {}`,
      "});",
      "process.stdout.write(JSON.stringify(result));"
    ].join("\n");
    return new Promise((resolve, reject) => {
      const startedAt = Date.now();
      const child = spawn(node, ["--input-type=module", "-e", caller], { stdio: ["ignore", "pipe", "pipe"] });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk) => { stdout += chunk; });
      child.stderr.on("data", (chunk) => { stderr += chunk; });
      // `exit` et la fermeture de stdout arrivent dans un ordre quelconque : on attend les deux.
      let exit: { elapsedMs: number; code: number | null } | undefined;
      let stdoutClosed = false;
      const settle = () => {
        if (!exit || !stdoutClosed) return;
        try {
          resolve({ ...exit, result: JSON.parse(stdout) as Record<string, unknown> });
        } catch {
          reject(new Error(`sortie de l'appelant illisible : ${stdout} ${stderr}`));
        }
      };
      child.on("error", reject);
      child.stdout.on("close", () => {
        stdoutClosed = true;
        settle();
      });
      child.on("exit", (code) => {
        exit = { elapsedMs: Date.now() - startedAt, code };
        settle();
      });
    });
  }

  test("processus qui survit au kill : l'appelant sort sans attendre la fin de l'enfant", async () => {
    const { elapsedMs, code, result } = await runCaller(`setTimeout(() => {}, ${CHILD_LIFETIME_MS})`, 300);
    cleanup(result.pid as number | undefined);
    assert.equal(code, 0);
    assert.equal(result.stopReason, "timeout");
    assert.equal(result.forcedReturn, true);
    assert.ok(elapsedMs < CHILD_LIFETIME_MS / 2, `l'appelant a mis ${elapsedMs} ms à se terminer`);
  });

  // Sous Windows, un petit-enfant lancé avec `stdio: "inherit"` ne garde pas les flux ouverts
  // (constaté avec Node 22 : `close` arrive à la sortie de l'enfant) ; le scénario ne s'y reproduit pas.
  test("descendant qui garde les flux après exit : l'appelant sort sans l'attendre", { skip: process.platform === "win32" }, async () => {
    // L'enfant lance un petit-enfant qui hérite de ses flux, publie son PID, puis se termine.
    const childScript = [
      "const { spawn } = require('node:child_process');",
      `const g = spawn(process.execPath, ['-e', 'setTimeout(() => {}, ${CHILD_LIFETIME_MS})'], { stdio: 'inherit' });`,
      "process.stdout.write(String(g.pid));",
      // Sans unref, l'enfant attendrait le petit-enfant au lieu de se terminer.
      "g.unref();"
    ].join("\n");
    const { elapsedMs, code, result } = await runCaller(childScript, 5_000);
    cleanup(Number(result.stdout));
    assert.equal(code, 0);
    assert.equal(result.stopReason, undefined, "l'enfant s'est terminé seul");
    assert.equal(result.exitCode, 0);
    assert.equal(result.forcedReturn, true);
    assert.ok(elapsedMs < CHILD_LIFETIME_MS / 2, `l'appelant a mis ${elapsedMs} ms à se terminer`);
  });
});

describe("runExternalProcess : échecs de lancement", () => {
  test("Node présent mais dossier de travail absent : invalid-working-directory, aucun lancement", async () => {
    const kills: number[] = [];
    const result = await runExternalProcess(spec("process.exit(0)", { cwd: missingDir, killTree: (pid) => kills.push(pid) }));
    assert.equal(result.started, false);
    assert.equal(result.launchFailure, "invalid-working-directory");
    assert.equal(result.pid, undefined);
    assert.deepEqual(kills, []);
  });

  test("exécutable absent (chemin explicite) : command-not-found", async () => {
    const result = await runExternalProcess({ command: path.join(sandbox, "absent-cli.exe"), args: [], cwd: sandbox, stdin: "x", timeoutMs: 5_000 });
    assert.equal(result.started, false);
    assert.equal(result.launchErrorCode, "ENOENT");
    assert.equal(result.launchFailure, "command-not-found");
  });

  test("exécutable absent du PATH : command-not-found", async () => {
    const result = await runExternalProcess({ command: "palabre-relay-cli-absente", args: [], cwd: sandbox, stdin: "x", timeoutMs: 5_000 });
    assert.equal(result.launchFailure, "command-not-found");
  });
});

describe("diagnoseLaunchFailure : ENOENT ne prouve pas l'absence de l'exécutable", () => {
  test("dossier absent, exécutable présent : invalid-working-directory", () => {
    assert.equal(diagnoseLaunchFailure("ENOENT", node, missingDir), "invalid-working-directory");
  });

  test("dossier absent l'emporte sur tout autre code", () => {
    assert.equal(diagnoseLaunchFailure("EACCES", path.join(sandbox, "absent.exe"), missingDir), "invalid-working-directory");
  });

  test("dossier présent, exécutable absent : command-not-found", () => {
    assert.equal(diagnoseLaunchFailure("ENOENT", path.join(sandbox, "absent.exe"), sandbox), "command-not-found");
    assert.equal(diagnoseLaunchFailure("ENOENT", "palabre-relay-cli-absente", sandbox), "command-not-found");
  });

  test("dossier et exécutable présents, ou autre code : spawn-failed", () => {
    assert.equal(diagnoseLaunchFailure("ENOENT", node, sandbox), "spawn-failed");
    assert.equal(diagnoseLaunchFailure("EACCES", path.join(sandbox, "absent.exe"), sandbox), "spawn-failed");
    assert.equal(diagnoseLaunchFailure(undefined, node, sandbox), "spawn-failed");
  });
});
