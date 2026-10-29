/**
 * @file Décisions du smoke réel de Relay (`scripts/smoke_relay_plan.ts`), testées hors ligne : appels
 * en arrière-plan explicite, aucun envoi sans attachement établi, verdicts du scénario de refus.
 * Profil fictif, sonde simulée, exécutables inertes jamais lancés : aucun agent réel, aucun quota.
 */
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, test, type TestContext } from "node:test";
import { executeRelay } from "../src/commands/relay.js";
import { trustConfig } from "../src/configTrust.js";
import { CodexSessionAdapter } from "../src/externalSessions/codex.js";
import { CLAUDE_ATTACHED_LABEL, blockedSmokeStartup, claudeAttachedArgs, claudeRefusalPrecondition,
  historyFootprint, ownedClaudeAttachment, refusalChecks, refusalPrecondition, smokeProcessStopCheck,
  smokeRelayArgs } from "../scripts/smoke_relay_plan.js";

const CODEX = "0199aaaa-bbbb-7ccc-8ddd-eeeeeeeeeeee";
const CLAUDE = "44444444-4444-4444-8444-444444444444";
const exe = (name: string) => (process.platform === "win32" ? `${name}.exe` : name);

describe("smoke Claude attaché : processus non interactif possédé", () => {
  const owner = { pid: 42, exited: false, preexistingPids: [11] };
  const probe = { attachment: "attached", processes: [{ pid: 42, liveness: "alive" }] };
  const history = { files: 1, lines: 3 };

  test("arguments : stream-json en lecture limitée, aucun prompt ni confiance forcée", () => {
    assert.deepEqual(claudeAttachedArgs(CLAUDE), ["-p", "--input-format", "stream-json", "--output-format", "stream-json", "--verbose",
      "--resume", CLAUDE, "--permission-mode", "plan", "--tools", "Read,Glob,Grep", "--strict-mcp-config",
      "--settings", JSON.stringify({ disableAllHooks: true })]);
  });

  test("seul le PID lancé, vivant et non préexistant établit l'attachement", () => {
    assert.equal(ownedClaudeAttachment(probe, owner), true);
    for (const processes of [[], [{ pid: 11, liveness: "alive" }], [{ pid: 42, liveness: "dead" }], [{ pid: 42, liveness: "unverifiable" }]]) {
      assert.equal(ownedClaudeAttachment({ attachment: "attached", processes }, owner), false);
    }
    assert.equal(ownedClaudeAttachment(probe, { ...owner, preexistingPids: [42] }), false);
    for (const pid of [undefined, 0, -1, NaN]) assert.equal(ownedClaudeAttachment(probe, { ...owner, pid }), false);
    assert.equal(ownedClaudeAttachment({ ...probe, attachment: "unknown" }, owner), false);
    assert.equal(ownedClaudeAttachment(undefined, owner), false);
  });

  test("sonde refaite, processus terminé ou historique absent : aucun envoi", () => {
    assert.deepEqual(claudeRefusalPrecondition(probe, owner, history), { send: true });
    for (const current of [undefined, { attachment: "detached" }, { attachment: "unknown" }, { attachment: "attached", processes: [{ pid: 11, liveness: "alive" }] }]) {
      assert.deepEqual(claudeRefusalPrecondition(current, owner, history), { send: false, reason: blockedSmokeStartup() });
    }
    assert.equal(claudeRefusalPrecondition(probe, { ...owner, exited: true }, history).send, false);
    for (const missing of [undefined, { files: 0, lines: 0 }, { files: 1, lines: 0 }]) {
      assert.equal(claudeRefusalPrecondition(probe, owner, missing).send, false);
    }
    assert.equal(ownedClaudeAttachment(probe, { ...owner, exited: true }), false);
    assert.match(blockedSmokeStartup(), /démarrage bloqué, cause non établie : aucun message envoyé/);
    assert.doesNotMatch(blockedSmokeStartup(), /confiance/);
  });

  test("verdict renommé : ni PID étranger ni scénario non joué ne donnent un succès global", () => {
    const busy = { code: 3, json: { status: "target-busy", mode: "background", modeSource: "explicit", delivery: { status: "not-delivered" } } };
    const input = { probe, owner, call: busy, before: history, after: history };
    const checks = refusalChecks(CLAUDE_ATTACHED_LABEL, input);
    assert.deepEqual(checks.map((item) => item.ok), [true, true, true]);
    assert.equal(checks[0]!.name, "Claude attaché (processus non interactif) : sonde");
    assert.equal(refusalChecks(CLAUDE_ATTACHED_LABEL, { ...input, owner: { ...owner, pid: 11 } }).every((item) => item.ok), false);
    assert.equal(refusalChecks(CLAUDE_ATTACHED_LABEL, { ...input, call: undefined }).every((item) => item.ok), false);
  });

  test("arrêt confirmé seulement si sortie, flux fermés, PID mort et aucune erreur", () => {
    const stopped = { exited: true, closed: true, liveness: "dead" };
    assert.equal(smokeProcessStopCheck(CLAUDE_ATTACHED_LABEL, stopped).ok, true);
    for (const state of [{ ...stopped, exited: false }, { ...stopped, closed: false },
      { ...stopped, liveness: "alive" }, { ...stopped, liveness: "unverifiable" }, { ...stopped, failure: "output-too-large" }, { ...stopped, failure: "annulation" }]) {
      assert.equal(smokeProcessStopCheck(CLAUDE_ATTACHED_LABEL, state).ok, false);
    }
  });
});

describe("smoke Relay : arguments des appels", () => {
  test("arrière-plan explicite, une seule fois, jamais --open", () => {
    const args = smokeRelayArgs({ from: `claude:${CLAUDE}`, to: `codex:${CODEX}`, message: "Message de test", configPath: "C:\\tmp\\palabre.config.json" });
    assert.equal(args.filter((arg) => arg === "--background").length, 1);
    assert.equal(args.includes("--open"), false);
    assert.deepEqual(args.slice(0, 2), ["relay", "--background"]);
    assert.ok(args.includes("Message de test") && args.includes("--json") && args.includes("--trust-config"));
  });
});

describe("smoke Relay : précondition du scénario de refus", () => {
  test("envoi seulement si la cible est attachée", () => {
    assert.deepEqual(refusalPrecondition({ attachment: "attached" }), { send: true });
    for (const probe of [{ attachment: "detached" }, { attachment: "unknown" }, undefined]) {
      const decision = refusalPrecondition(probe);
      assert.equal(decision.send, false, JSON.stringify(probe));
      assert.match(decision.send ? "" : decision.reason, /aucun message envoyé/);
    }
  });

  test("TUI terminé ou historique introuvable juste avant l'appel : aucun envoi", () => {
    const attached = { attachment: "attached" };
    const exited = refusalPrecondition(attached, { ptyExited: true, history: { files: 1, lines: 3 } });
    assert.equal(exited.send, false);
    assert.match(exited.send ? "" : exited.reason, /TUI terminé/);
    const empty = refusalPrecondition(attached, { ptyExited: false, history: { files: 0, lines: 0 } });
    assert.equal(empty.send, false);
    assert.match(empty.send ? "" : empty.reason, /historique introuvable/);
    assert.deepEqual(refusalPrecondition(attached, { ptyExited: false, history: { files: 1, lines: 3 } }), { send: true });
  });
});

describe("smoke Relay : verdicts du scénario de refus", () => {
  const busy = { code: 3, json: { status: "target-busy", mode: "background", modeSource: "explicit", delivery: { status: "not-delivered" } } };
  const same = { files: 1, lines: 4 };

  test("refus attendu et historique inchangé : tout réussit", () => {
    const checks = refusalChecks("Codex", { probe: { attachment: "attached" }, call: busy, before: same, after: { ...same } });
    assert.deepEqual(checks.map((check) => check.ok), [true, true, true]);
  });

  test("scénario non joué faute d'attachement : refus et historique en échec, jamais un succès", () => {
    const checks = refusalChecks("Codex", { probe: { attachment: "detached" } });
    assert.deepEqual(checks.map((check) => check.ok), [false, false, false]);
    assert.match(checks[1]!.detail, /aucun message envoyé/);
  });

  test("message joint en mode ouvert, ou refus en mode automatique : échec du refus", () => {
    const open = { code: 0, json: { status: "replied", mode: "open", modeSource: "auto", delivery: { status: "replied" } } };
    assert.equal(refusalChecks("Codex", { probe: { attachment: "attached" }, call: open, before: same, after: same })[1]!.ok, false);
    const auto = { ...busy, json: { ...busy.json, modeSource: "auto" } };
    assert.equal(refusalChecks("Codex", { probe: { attachment: "attached" }, call: auto, before: same, after: same })[1]!.ok, false);
  });

  test("nouveau segment ou nouvelles lignes : historique modifié", () => {
    const attached = { attachment: "attached" };
    assert.equal(refusalChecks("Codex", { probe: attached, call: busy, before: same, after: { files: 2, lines: 4 } })[2]!.ok, false);
    assert.equal(refusalChecks("Codex", { probe: attached, call: busy, before: same, after: { files: 1, lines: 5 } })[2]!.ok, false);
    assert.equal(refusalChecks("Codex", { probe: attached, call: busy, before: same })[2]!.ok, false);
  });

  test("aucun fichier observé avant et après : jamais un historique inchangé", () => {
    const none = { files: 0, lines: 0 };
    const checks = refusalChecks("Codex", { probe: { attachment: "attached" }, call: busy, before: none, after: { ...none } });
    assert.equal(checks[2]!.ok, false);
    assert.deepEqual(historyFootprint([]), none, "une liste vide se mesure, mais ne qualifie rien");
  });

  test("scénario non joué : la raison de l'arrêt est rapportée", () => {
    const checks = refusalChecks("Codex", { probe: { attachment: "attached" }, reason: "TUI terminé avant l'appel : aucun message envoyé" });
    assert.deepEqual(checks.map((check) => check.ok), [true, false, false]);
    assert.match(checks[1]!.detail, /TUI terminé/);
  });
});

describe("smoke Relay : empreinte d'historique", () => {
  test("compte les fichiers et les lignes non vides de tous les fichiers", async (t) => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "palabre-smoke-plan-"));
    t.after(() => rm(dir, { recursive: true, force: true }));
    const a = path.join(dir, "racine.jsonl");
    const b = path.join(dir, "segment.jsonl");
    await writeFile(a, "{}\n{}\n\n");
    await writeFile(b, "{}\r\n");
    assert.deepEqual(historyFootprint([a]), { files: 1, lines: 2 });
    assert.deepEqual(historyFootprint([a, b]), { files: 2, lines: 3 });
    assert.throws(() => historyFootprint([path.join(dir, "absent.jsonl")]));
  });
});

describe("smoke Relay : l'appel du scénario de refus refuse au lieu d'envoyer", () => {
  async function world(t: TestContext, attachment: "attached" | "detached" = "attached") {
    const root = await mkdtemp(path.join(os.tmpdir(), "palabre-smoke-refusal-"));
    t.after(() => rm(root, { recursive: true, force: true }));
    t.mock.method(os, "homedir", () => root);
    // Exécutables inertes : résolus comme natifs, jamais lancés par un refus avant lancement.
    for (const name of ["codex", "claude"]) await writeFile(path.join(root, exe(name)), "", { mode: 0o755 });
    const configPath = path.join(root, "palabre.config.json");
    await writeFile(configPath, JSON.stringify({ language: "fr", agents: {
      codex: { type: "cli", command: path.join(root, exe("codex")) }, claude: { type: "cli", command: path.join(root, exe("claude")) }
    } }));
    await trustConfig(configPath);
    const day = path.join(root, ".codex", "sessions", "2026", "10", "27");
    await mkdir(day, { recursive: true });
    await writeFile(path.join(day, `rollout-2026-10-27T10-00-00-${CODEX}.jsonl`), `${JSON.stringify({ type: "session_meta", payload: { id: CODEX, cwd: root } })}\n`);
    let probes = 0;
    t.mock.method(CodexSessionAdapter.prototype, "probe", () => {
      probes++;
      return { attachment, activity: "unknown", processes: [], evidence: [] };
    });
    // Espions : toute préparation de lancement (environnement, liste MCP, reprise ou création)
    // est comptée ; un refus avant lancement n'en déclenche aucune.
    const launches: string[] = [];
    for (const method of ["environment", "prepare", "resumeArgs", "createArgs"] as const) {
      t.mock.method(CodexSessionAdapter.prototype, method, () => { launches.push(method); throw new Error(`lancement inattendu : ${method}`); });
    }
    return { configPath, probes: () => probes, launches };
  }

  test("Codex attachée : target-busy, code 3, rien envoyé, arrière-plan explicite", async (t) => {
    const w = await world(t);
    const result = await executeRelay(smokeRelayArgs({ from: `claude:${CLAUDE}`, to: `codex:${CODEX}`, message: "Ce message doit être refusé : la conversation est ouverte.", configPath: w.configPath }));
    assert.equal(result.status, "target-busy");
    assert.equal(result.exitCode, 3);
    assert.equal(result.delivery.status, "not-delivered");
    assert.equal(result.mode, "background");
    assert.equal(result.modeSource, "explicit");
    assert.ok(w.probes() >= 1);
    assert.deepEqual(w.launches, [], "aucun environnement, liste MCP, reprise ni création préparés");
    const checks = refusalChecks("Codex", { probe: { attachment: "attached" }, call: { code: result.exitCode, json: result }, before: { files: 1, lines: 1 }, after: { files: 1, lines: 1 } });
    assert.deepEqual(checks.map((check) => check.ok), [true, true, true]);
  });

  test("témoin des espions : une Codex fermée atteint la préparation du lancement", async (t) => {
    const w = await world(t, "detached");
    const result = await executeRelay(smokeRelayArgs({ from: `claude:${CLAUDE}`, to: `codex:${CODEX}`, message: "Témoin", configPath: w.configPath }));
    assert.notEqual(result.status, "target-busy");
    assert.ok(w.launches.length > 0, "les espions détectent bien un lancement en préparation");
  });
});
