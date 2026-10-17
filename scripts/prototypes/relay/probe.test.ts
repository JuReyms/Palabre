/**
 * @file Tests du point d'entrée `probe.ts` avec CLI simulée (prototype relay, issue #96).
 *
 * Usage : node --experimental-strip-types --test scripts/prototypes/relay/probe.test.ts
 *
 * Chaque test lance réellement `probe.ts` dans un sous-processus, avec `fixtures/fake-cli.cjs`
 * à la place de Claude ou Codex, et des dossiers d'état, de travail et de traces jetables.
 * On vérifie le code de sortie, l'issue (`outcome`) et le statut de délivrance.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, describe, test } from "node:test";

const here = path.dirname(fileURLToPath(import.meta.url));
const probe = path.join(here, "probe.ts");
const fakeCli = path.join(here, "fixtures", "fake-cli.cjs");
const root = mkdtempSync(path.join(os.tmpdir(), "palabre-relay-probe-test-"));
after(() => rmSync(root, { recursive: true, force: true }));
const TARGET = "44444444-4444-4444-8444-444444444444";

let counter = 0;
function runProbe(agent: "claude" | "codex", mode: string, extra: { args?: string[]; env?: Record<string, string>; setup?: (dirs: Dirs) => void } = {}) {
  const base = path.join(root, `case-${++counter}`);
  const dirs: Dirs = {
    base,
    marker: path.join(base, "marker.jsonl"),
    claudeHome: path.join(base, "claude-home"),
    codexHome: path.join(base, "codex-home"),
    workspace: path.join(base, "ws"),
  };
  // Registre Claude présent mais vide : sans lui, l'attachement est invérifiable (voir le test dédié).
  mkdirSync(path.join(dirs.claudeHome, "sessions"), { recursive: true });
  mkdirSync(dirs.codexHome, { recursive: true });
  extra.setup?.(dirs);
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    FAKE_MODE: mode,
    FAKE_MARKER: dirs.marker,
    PROBE_CLAUDE_COMMAND: process.execPath,
    PROBE_CLAUDE_PREFIX_ARGS: JSON.stringify([fakeCli, "claude"]),
    PROBE_CLAUDE_MODEL: "",
    PROBE_CLAUDE_HOME: dirs.claudeHome,
    PROBE_CODEX_COMMAND: process.execPath,
    PROBE_CODEX_PREFIX_ARGS: JSON.stringify([fakeCli, "codex"]),
    PROBE_CODEX_HOME: dirs.codexHome,
    PROBE_WORKSPACE_ROOT: dirs.workspace,
    PROBE_TRACE_DIR: path.join(base, "traces"),
    ...extra.env,
  };
  const child = spawnSync(process.execPath, ["--experimental-strip-types", "--no-warnings", probe, "send", agent, TARGET, "message de test", ...(extra.args ?? [])], {
    env, encoding: "utf8", timeout: 60_000,
  });
  let output: Record<string, any> = {};
  try { output = JSON.parse(child.stdout); } catch { /* sortie non JSON : erreur interne */ }
  const calls = existsSync(dirs.marker) ? readFileSync(dirs.marker, "utf8").trim().split(/\r?\n/).map((line) => JSON.parse(line)) : [];
  return { status: child.status, stderr: child.stderr, output, calls, dirs };
}

interface Dirs { base: string; marker: string; claudeHome: string; codexHome: string; workspace: string }

describe("probe.ts send : codes de sortie (Claude simulé)", () => {
  test("réponse valide, même session => 0, replied", () => {
    const { status, output, calls } = runProbe("claude", "ok");
    assert.equal(status, 0);
    assert.equal(output.outcome.kind, "replied");
    assert.equal(output.delivery.status, "replied");
    assert.equal(output.identity, "same-as-target");
    assert.ok(calls[0].stdin.includes(output.nonce), "le nonce est transmis dans l'enveloppe sur stdin");
  });

  test("identité incohérente => 5", () => {
    const { status, output } = runProbe("claude", "mismatch");
    assert.equal(status, 5);
    assert.equal(output.outcome.kind, "identity-mismatch");
    assert.notEqual(output.delivery.status, "replied");
  });

  test("session introuvable (is_error) => 6, not-delivered, aucun identifiant effectif", () => {
    const { status, output } = runProbe("claude", "not-found");
    assert.equal(status, 6);
    assert.equal(output.outcome.kind, "session-not-found");
    assert.equal(output.delivery.status, "not-delivered");
    assert.equal(output.effectiveSessionId, undefined);
  });

  test("échec CLI sans sortie => 2, delivery unknown", () => {
    const { status, output } = runProbe("claude", "fail");
    assert.equal(status, 2);
    assert.equal(output.outcome.kind, "cli-failure");
    assert.equal(output.delivery.status, "unknown");
  });

  test("exit 0 sans résultat valide => 2, no-valid-reply", () => {
    const { status, output } = runProbe("claude", "no-result");
    assert.equal(status, 2);
    assert.equal(output.outcome.kind, "no-valid-reply");
  });

  test("échec après persistance du message => 2, persisted-no-reply", () => {
    const { status, output } = runProbe("claude", "persisted");
    assert.equal(status, 2);
    assert.equal(output.delivery.status, "persisted-no-reply");
    assert.equal(output.delivery.persisted, true);
    assert.equal(output.delivery.inActiveBranch, true);
  });

  test("timeout => 4", () => {
    const { status, output } = runProbe("claude", "hang", { args: ["--timeout", "800"] });
    assert.equal(status, 4);
    assert.equal(output.outcome.kind, "timeout");
    assert.equal(output.timedOut, true);
  });

  test("cible attachée (registre vivant, idle) => 3, CLI jamais lancée", () => {
    const { status, output, calls } = runProbe("claude", "ok", {
      setup: (dirs) => {
        mkdirSync(path.join(dirs.claudeHome, "sessions"), { recursive: true });
        writeFileSync(path.join(dirs.claudeHome, "sessions", `${process.pid}.json`), JSON.stringify({ pid: process.pid, sessionId: TARGET, status: "idle" }));
      },
    });
    assert.equal(status, 3);
    assert.equal(output.outcome.kind, "target-busy");
    assert.equal(output.delivery.status, "not-delivered");
    assert.equal(calls.length, 0);
  });

  test("registre absent => 3, target-state-unknown, CLI jamais lancée", () => {
    const { status, output, calls } = runProbe("claude", "ok", {
      setup: (dirs) => rmSync(path.join(dirs.claudeHome, "sessions"), { recursive: true, force: true }),
    });
    assert.equal(status, 3);
    assert.equal(output.outcome.kind, "target-state-unknown");
    assert.equal(calls.length, 0);
  });

  test("registre illisible => 3, target-state-unknown", () => {
    const { status, output, calls } = runProbe("claude", "ok", {
      setup: (dirs) => {
        mkdirSync(path.join(dirs.claudeHome, "sessions"), { recursive: true });
        writeFileSync(path.join(dirs.claudeHome, "sessions", "123.json"), "{tronqué");
      },
    });
    assert.equal(status, 3);
    assert.equal(output.outcome.kind, "target-state-unknown");
    assert.equal(calls.length, 0);
  });
});

describe("probe.ts send : exécutable introuvable (Claude simulé)", () => {
  test("exécutable Claude introuvable => 7, command-not-found, not-delivered, distinct de l'erreur interne", () => {
    const { status, output } = runProbe("claude", "ok", {
      env: { PROBE_CLAUDE_COMMAND: path.join(root, "absent-claude.exe"), PROBE_CLAUDE_PREFIX_ARGS: "[]" },
    });
    assert.equal(status, 7);
    assert.equal(output.outcome.kind, "command-not-found");
    assert.equal(output.delivery.status, "not-delivered");
  });

  test("Node présent, dossier de travail absent => 8, invalid-working-directory", () => {
    const { status, output, calls } = runProbe("claude", "ok", { args: ["--cwd", path.join(root, "dossier-absent")] });
    assert.equal(status, 8);
    assert.equal(output.outcome.reason, "invalid-working-directory");
    assert.equal(output.delivery.status, "not-delivered");
    assert.equal(calls.length, 0);
  });
});

describe("probe.ts send : codes de sortie (Codex simulé)", () => {
  test("réponse valide => 0", () => {
    const { status, output } = runProbe("codex", "ok");
    assert.equal(status, 0);
    assert.equal(output.outcome.kind, "replied");
  });

  test("écrivain actif (course perdue) => 3, target-busy, not-delivered", () => {
    const { status, output } = runProbe("codex", "active-writer");
    assert.equal(status, 3);
    assert.equal(output.outcome.kind, "target-busy");
    assert.equal(output.delivery.status, "not-delivered");
  });

  test("thread inconnu => 6", () => {
    const { status, output } = runProbe("codex", "not-found");
    assert.equal(status, 6);
    assert.equal(output.outcome.kind, "session-not-found");
  });

  test("turn.failed => 2, delivery unknown (pas not-delivered)", () => {
    const { status, output } = runProbe("codex", "turn-failed");
    assert.equal(status, 2);
    assert.equal(output.outcome.kind, "cli-failure");
    assert.equal(output.delivery.status, "unknown");
  });

  test("exit 0 sans agent_message => 2, no-valid-reply", () => {
    const { status, output } = runProbe("codex", "no-message");
    assert.equal(status, 2);
    assert.equal(output.outcome.kind, "no-valid-reply");
  });

  test("identité incohérente => 5", () => {
    const { status } = runProbe("codex", "mismatch");
    assert.equal(status, 5);
  });

  test("timeout => 4", () => {
    const { status } = runProbe("codex", "hang", { args: ["--timeout", "800"] });
    assert.equal(status, 4);
  });

  test("neutralisation MCP : liste calculée dans le cwd cible, flags transmis à exec resume", () => {
    const { status, calls, dirs } = runProbe("codex", "ok", {
      env: { PROBE_CODEX_USER_CONFIG: "1", PROBE_CODEX_NEUTRALIZE_MCP: "1", FAKE_MCP: JSON.stringify([{ name: "alpha" }, { name: "beta-2" }]) },
    });
    assert.equal(status, 0);
    const [list, exec] = calls;
    assert.deepEqual(list.argv.slice(0, 3), ["mcp", "list", "--json"]);
    assert.ok(list.argv.includes("plugins") && list.argv.includes("apps"));
    assert.equal(path.resolve(list.cwd), path.resolve(dirs.workspace, "codex"));
    const joined = exec.argv.join(" ");
    for (const expected of ["--disable plugins", "--disable apps", "mcp_servers.alpha.enabled=false", "mcp_servers.beta-2.enabled=false"]) {
      assert.ok(joined.includes(expected), `exec doit recevoir ${expected}`);
    }
  });

  const invalidLists: Array<[string, string]> = [
    ["objet sans nom", "[{}]"],
    ["nom numérique", '[{"name":42}]'],
    ["nom null", '[{"name":null}]'],
    ["nom vide", '[{"name":""}]'],
    ["nom non neutralisable", '[{"name":"nom avec espace"}]'],
    ["entrée null", "[null]"],
    ["entrée tableau", '[["alpha"]]'],
    ["objet au lieu d'un tableau", '{"name":"alpha"}'],
    ["sortie non JSON", "pas du json"],
    ["une entrée valide puis une invalide", '[{"name":"alpha"},{"name":42}]'],
  ];
  for (const [label, list] of invalidLists) {
    test(`neutralisation MCP refusée (${label}) => 3, neutralization-failed, aucun exec resume`, () => {
      const { status, output, calls } = runProbe("codex", "ok", {
        env: { PROBE_CODEX_USER_CONFIG: "1", PROBE_CODEX_NEUTRALIZE_MCP: "1", FAKE_MCP: list },
      });
      assert.equal(status, 3);
      assert.equal(output.outcome.kind, "neutralization-failed");
      assert.equal(output.delivery.status, "not-delivered");
      assert.equal(calls.filter((call) => call.argv[0] === "mcp").length, 1, "la liste est bien demandée");
      assert.equal(calls.filter((call) => call.argv[0] === "exec").length, 0, "aucun exec resume ne doit partir");
    });
  }

  test("neutralisation MCP refusée si `codex mcp list` échoue => 3, aucun exec resume", () => {
    const { status, output, calls } = runProbe("codex", "ok", {
      env: { PROBE_CODEX_USER_CONFIG: "1", PROBE_CODEX_NEUTRALIZE_MCP: "1", FAKE_MCP_EXIT: "1" },
    });
    assert.equal(status, 3);
    assert.equal(output.outcome.kind, "neutralization-failed");
    assert.equal(calls.filter((call) => call.argv[0] === "exec").length, 0);
  });

  test("exécutable Codex introuvable dès la liste MCP => 7, command-not-found, not-delivered", () => {
    const { status, output, calls } = runProbe("codex", "ok", {
      env: { PROBE_CODEX_USER_CONFIG: "1", PROBE_CODEX_NEUTRALIZE_MCP: "1", PROBE_CODEX_COMMAND: path.join(root, "absent-codex.exe"), PROBE_CODEX_PREFIX_ARGS: "[]" },
    });
    assert.equal(status, 7);
    assert.equal(output.outcome.kind, "command-not-found");
    assert.equal(output.delivery.status, "not-delivered");
    assert.equal(calls.length, 0);
  });

  test("exécutable Codex introuvable au lancement => 7, not-delivered", () => {
    const { status, output } = runProbe("codex", "ok", {
      env: { PROBE_CODEX_COMMAND: path.join(root, "absent-codex.exe"), PROBE_CODEX_PREFIX_ARGS: "[]" },
    });
    assert.equal(status, 7);
    assert.equal(output.outcome.kind, "command-not-found");
    assert.equal(output.delivery.status, "not-delivered");
    assert.equal(output.spawnErrorCode, "ENOENT");
    assert.equal(output.launchFailure, "command-not-found");
  });

  test("Node présent, dossier de travail absent => 8, invalid-working-directory, pas command-not-found", () => {
    const { status, output, calls } = runProbe("codex", "ok", { args: ["--cwd", path.join(root, "dossier-absent")] });
    assert.equal(status, 8);
    assert.equal(output.outcome.kind, "invalid-request");
    assert.equal(output.outcome.reason, "invalid-working-directory");
    assert.equal(output.delivery.status, "not-delivered");
    assert.equal(calls.length, 0);
  });

  test("liste MCP avec dossier de travail absent => 8, aucune liste ni exec resume", () => {
    const { status, output, calls } = runProbe("codex", "ok", {
      args: ["--cwd", path.join(root, "dossier-absent")],
      env: { PROBE_CODEX_USER_CONFIG: "1", PROBE_CODEX_NEUTRALIZE_MCP: "1" },
    });
    assert.equal(status, 8);
    assert.equal(output.outcome.reason, "invalid-working-directory");
    assert.equal(output.delivery.status, "not-delivered");
    assert.equal(calls.length, 0);
  });

  test("liste MCP vide et valide => reprise lancée avec les seuls flags globaux", () => {
    const { status, calls } = runProbe("codex", "ok", {
      env: { PROBE_CODEX_USER_CONFIG: "1", PROBE_CODEX_NEUTRALIZE_MCP: "1", FAKE_MCP: "[]" },
    });
    assert.equal(status, 0);
    const exec = calls.find((call) => call.argv[0] === "exec");
    assert.ok(exec, "exec resume lancé");
    assert.ok(exec.argv.join(" ").includes("--disable plugins --disable apps"));
    assert.ok(!exec.argv.some((arg: string) => arg.includes("enabled=false")));
  });
});
