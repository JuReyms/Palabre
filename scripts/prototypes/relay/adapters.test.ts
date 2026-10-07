/**
 * @file Vérifications hors ligne du prototype relay (issue #96) : aucun vrai agent n'est appelé.
 *
 * Usage : node --experimental-strip-types --test scripts/prototypes/relay/adapters.test.ts
 *
 * Les processus « CLI » sont simulés par `node -e`. Les transcripts et registres sont des
 * fixtures écrites dans un dossier temporaire jetable.
 */
import assert from "node:assert/strict";
import { closeSync, constants, mkdtempSync, openSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, test } from "node:test";
import {
  assessTarget, classifyDelivery, diagnoseLaunchFailure, findNonceInClaudeTranscript, findNonceInCodexRollout,
  interpretClaudeOutput, interpretCodexOutput, parseMcpServerNames, pidLiveness, PreflightRefusal,
  probeClaudeRegistry, probeCodexLock, relayOutcome, run,
} from "./adapters.ts";

const sandbox = mkdtempSync(path.join(os.tmpdir(), "palabre-relay-test-"));
after(() => rmSync(sandbox, { recursive: true, force: true }));
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const startLine = 'console.log(JSON.stringify({type:"turn.started"}));';
const startSignal = (line: string) => (line.includes("turn.started") ? "turn.started" : undefined);

describe("run() : timers de kill", () => {
  test("aucun kill après une sortie réussie, même si killAfterStartMs expire ensuite", async () => {
    const kills: number[] = [];
    const result = await run({
      command: process.execPath,
      args: ["-e", `${startLine} setTimeout(() => process.exit(0), 50);`],
      cwd: sandbox, stdin: "", timeoutMs: 10_000, killAfterStartMs: 300,
      startSignal, kill: (pid) => kills.push(pid),
    });
    assert.equal(result.exitCode, 0);
    assert.equal(result.startSignal, "turn.started");
    await sleep(700);
    assert.deepEqual(kills, [], "le timer killAfterStartMs doit être annulé à la terminaison");
    assert.equal(result.killedByProbe, false);
  });

  test("aucun kill de timeout dur après une sortie réussie", async () => {
    const kills: number[] = [];
    const result = await run({
      command: process.execPath, args: ["-e", "process.exit(0)"],
      cwd: sandbox, stdin: "", timeoutMs: 200, startSignal, kill: (pid) => kills.push(pid),
    });
    await sleep(400);
    assert.equal(result.timedOut, false);
    assert.deepEqual(kills, []);
  });

  test("killAfterStartMs tue réellement un processus encore actif", async () => {
    const result = await run({
      command: process.execPath,
      args: ["-e", `${startLine} setTimeout(() => process.exit(0), 10000);`],
      cwd: sandbox, stdin: "", timeoutMs: 20_000, killAfterStartMs: 200, startSignal,
    });
    assert.equal(result.killedByProbe, true);
    assert.notEqual(result.exitCode, 0);
    assert.ok(result.durationMs < 8_000, `durée ${result.durationMs} ms`);
  });

  test("le timeout dur tue un processus silencieux", async () => {
    const result = await run({
      command: process.execPath, args: ["-e", "setTimeout(() => {}, 10000)"],
      cwd: sandbox, stdin: "", timeoutMs: 200, startSignal,
    });
    assert.equal(result.timedOut, true);
    assert.notEqual(result.exitCode, 0);
  });
});

describe("identité de la session", () => {
  const target = "11111111-1111-4111-8111-111111111111";
  const other = "22222222-2222-4222-8222-222222222222";
  const claude = (lines: object[]) => lines.map((line) => JSON.stringify(line)).join("\n");

  test("Claude : un résultat is_error ne donne jamais d'identifiant effectif", () => {
    const out = claude([{ type: "result", is_error: true, session_id: other, errors: [`No conversation found with session ID: ${target}`] }]);
    const parsed = interpretClaudeOutput(out, 1, "resume", target);
    assert.equal(parsed.isError, true);
    assert.equal(parsed.effectiveSessionId, undefined);
    assert.equal(parsed.identity, "unavailable");
    assert.deepEqual(parsed.errors, [`No conversation found with session ID: ${target}`]);
  });

  test("Claude : reprise réussie avec identifiants égaux à la cible", () => {
    const out = claude([
      { type: "system", subtype: "init", session_id: target, model: "claude-haiku-4-5-20251001" },
      { type: "assistant", session_id: target, message: { model: "claude-sonnet-4-6", content: [{ type: "text", text: "OK" }] } },
      { type: "result", is_error: false, session_id: target, result: "OK", modelUsage: { "claude-sonnet-4-6": {} } },
    ]);
    const parsed = interpretClaudeOutput(out, 0, "resume", target);
    assert.equal(parsed.identity, "same-as-target");
    assert.equal(parsed.effectiveSessionId, target);
    assert.equal(parsed.declaredModel, "claude-haiku-4-5-20251001");
    assert.deepEqual(parsed.observedModels, ["claude-sonnet-4-6"], "le modèle observé diffère du modèle annoncé");
  });

  test("Claude : reprise réussie mais identifiant différent => mismatch", () => {
    const out = claude([
      { type: "system", subtype: "init", session_id: other },
      { type: "result", is_error: false, session_id: other, result: "OK" },
    ]);
    const parsed = interpretClaudeOutput(out, 0, "resume", target);
    assert.equal(parsed.identity, "mismatch");
    assert.equal(parsed.effectiveSessionId, undefined);
  });

  test("Claude : fork réussi => new-session ; fork qui renvoie la cible => mismatch", () => {
    const fork = claude([{ type: "system", subtype: "init", session_id: other }, { type: "result", is_error: false, session_id: other, result: "OK" }]);
    assert.equal(interpretClaudeOutput(fork, 0, "fork", target).identity, "new-session");
    const same = claude([{ type: "result", is_error: false, session_id: target, result: "OK" }]);
    assert.equal(interpretClaudeOutput(same, 0, "fork", target).identity, "mismatch");
  });

  test("Codex : turn.failed après thread.started => erreur, aucun identifiant effectif", () => {
    const out = [
      { type: "thread.started", thread_id: target }, { type: "turn.started" },
      { type: "error", message: "400" }, { type: "turn.failed", error: { message: "400" } },
    ].map((line) => JSON.stringify(line)).join("\n");
    const parsed = interpretCodexOutput(out, 1, "resume", target);
    assert.equal(parsed.isError, true);
    assert.equal(parsed.effectiveSessionId, undefined);
    assert.equal(parsed.identity, "unavailable");
  });

  test("Codex : reprise réussie", () => {
    const out = [
      { type: "thread.started", thread_id: target }, { type: "turn.started" },
      { type: "item.completed", item: { type: "agent_message", text: "OK" } }, { type: "turn.completed" },
    ].map((line) => JSON.stringify(line)).join("\n");
    const parsed = interpretCodexOutput(out, 0, "resume", target);
    assert.equal(parsed.identity, "same-as-target");
    assert.equal(parsed.reply, "OK");
  });
});

describe("relayOutcome : priorités et codes de sortie", () => {
  const base = {
    agent: "codex" as const, exitCode: 0, timedOut: false, killedByProbe: false, durationMs: 1, argv: [], stdout: "", stderr: "",
    isError: false, reply: "OK", identity: "same-as-target" as const, reportedSessionIds: [], observedModels: [], errors: [],
  };
  test("seule une réponse valide de la cible sort en 0", () => {
    assert.deepEqual(relayOutcome({ result: base }), { kind: "replied", exitCode: 0 });
    assert.equal(relayOutcome({ result: { ...base, identity: "mismatch" } }).exitCode, 5);
    assert.equal(relayOutcome({ result: { ...base, identity: "unavailable" } }).exitCode, 5);
  });
  test("refus avant envoi > timeout > refus CLI certain > réponse", () => {
    assert.equal(relayOutcome({ decision: { allowed: false, error: "target-busy" }, result: base }).kind, "target-busy");
    assert.equal(relayOutcome({ result: { ...base, timedOut: true }, certainRefusal: "session-not-found" }).kind, "timeout");
    assert.equal(relayOutcome({ result: { ...base, isError: true, exitCode: 1, reply: undefined }, certainRefusal: "target-busy" }).exitCode, 3);
  });
  test("échec : exit 0 sans réponse => no-valid-reply ; exit non nul ou kill => cli-failure ; aucun résultat => cli-failure", () => {
    assert.equal(relayOutcome({ result: { ...base, isError: true, reply: undefined, identity: "unavailable" } }).kind, "no-valid-reply");
    assert.equal(relayOutcome({ result: { ...base, isError: true, reply: undefined, identity: "unavailable", exitCode: 1 } }).kind, "cli-failure");
    assert.equal(relayOutcome({ result: { ...base, isError: true, reply: undefined, identity: "unavailable", exitCode: null, killedByProbe: true } }).kind, "cli-failure");
    assert.equal(relayOutcome({}).exitCode, 2);
  });
  test("exécutable introuvable => command-not-found (7), distinct d'une erreur interne (1) et d'un échec CLI (2)", () => {
    const missing = { ...base, exitCode: -4058, isError: true, reply: undefined, identity: "unavailable" as const, spawnErrorCode: "ENOENT", launchFailure: "command-not-found" as const };
    assert.deepEqual(relayOutcome({ result: missing }), { kind: "command-not-found", exitCode: 7 });
    assert.deepEqual(relayOutcome({ preflightRefusal: new PreflightRefusal("x", "command-not-found") }), { kind: "command-not-found", exitCode: 7 });
    // Une autre erreur de lancement reste un échec CLI.
    assert.equal(relayOutcome({ result: { ...missing, spawnErrorCode: "EACCES", launchFailure: "spawn-failed" } }).kind, "cli-failure");
  });
  test("dossier de travail introuvable => invalid-request (8), raison invalid-working-directory", () => {
    const expected = { kind: "invalid-request", exitCode: 8, reason: "invalid-working-directory" };
    const result = { ...base, exitCode: -4058, isError: true, reply: undefined, identity: "unavailable" as const, spawnErrorCode: "ENOENT", launchFailure: "invalid-working-directory" as const };
    assert.deepEqual(relayOutcome({ result }), expected);
    assert.deepEqual(relayOutcome({ preflightRefusal: new PreflightRefusal("x", "invalid-working-directory") }), expected);
  });
});

describe("diagnoseLaunchFailure : ENOENT ne prouve pas l'absence de l'exécutable", () => {
  const missingDir = path.join(sandbox, "dossier-absent");
  test("dossier absent, exécutable présent => invalid-working-directory", () => {
    assert.equal(diagnoseLaunchFailure("ENOENT", process.execPath, missingDir), "invalid-working-directory");
  });
  test("dossier présent, exécutable absent => command-not-found", () => {
    assert.equal(diagnoseLaunchFailure("ENOENT", path.join(sandbox, "absent.exe"), sandbox), "command-not-found");
  });
  test("dossier et exécutable présents => spawn-failed (cause autre, ex. interpréteur manquant)", () => {
    assert.equal(diagnoseLaunchFailure("ENOENT", process.execPath, sandbox), "spawn-failed");
    assert.equal(diagnoseLaunchFailure("EACCES", path.join(sandbox, "absent.exe"), sandbox), "spawn-failed");
  });
});

describe("run : échecs de lancement", () => {
  const toResult = (result: Awaited<ReturnType<typeof run>>) =>
    ({ ...result, agent: "claude" as const, argv: [], isError: true, identity: "unavailable" as const, reportedSessionIds: [], observedModels: [], errors: [] });

  test("exécutable introuvable : ENOENT diagnostiqué command-not-found, sans blocage", async () => {
    const result = await run({
      command: path.join(sandbox, "absent-cli.exe"), args: [], cwd: sandbox, stdin: "x", timeoutMs: 5_000, startSignal: () => undefined,
    });
    assert.equal(result.spawnErrorCode, "ENOENT");
    assert.equal(result.launchFailure, "command-not-found");
    assert.equal(result.timedOut, false);
    assert.equal(relayOutcome({ result: toResult(result) }).kind, "command-not-found");
  });

  test("Node présent mais dossier de travail absent => invalid-working-directory, aucun lancement", async () => {
    const kills: number[] = [];
    const result = await run({
      command: process.execPath, args: ["-e", "process.exit(0)"], cwd: path.join(sandbox, "dossier-absent"), stdin: "x",
      timeoutMs: 5_000, startSignal: () => undefined, kill: (pid) => kills.push(pid),
    });
    assert.equal(result.launchFailure, "invalid-working-directory");
    assert.equal(result.exitCode, null);
    assert.deepEqual(kills, []);
    assert.deepEqual(relayOutcome({ result: toResult(result) }), { kind: "invalid-request", exitCode: 8, reason: "invalid-working-directory" });
  });
});

describe("parseMcpServerNames : validation stricte", () => {
  test("tableau d'objets avec noms valides => noms dédoublonnés", () => {
    assert.deepEqual(parseMcpServerNames('[{"name":"linear","enabled":true},{"name":"node_repl"},{"name":"linear"}]'), ["linear", "node_repl"]);
    assert.deepEqual(parseMcpServerNames("[]"), []);
  });
  for (const input of ["[{}]", '[{"name":42}]', '[{"name":null}]', '[{"name":""}]', '[{"name":"a b"}]', '[{"name":"a.b"}]', "[null]", '["linear"]', '{"name":"x"}', "null", "", "pas du json"]) {
    test(`refuse ${JSON.stringify(input)}`, () => {
      assert.throws(() => parseMcpServerNames(input), (error: unknown) => error instanceof PreflightRefusal && error.kind === "neutralization-failed");
    });
  }
  test("relayOutcome classe l'échec de neutralisation en refus avant envoi (3)", () => {
    assert.deepEqual(relayOutcome({ preflightRefusal: new PreflightRefusal("x") }), { kind: "neutralization-failed", exitCode: 3 });
  });
});

describe("vivacité des PID", () => {
  const thrower = (code: string) => () => { throw Object.assign(new Error(code), { code }); };
  test("ESRCH => dead, EPERM => alive, autre => unverifiable, PID invalide => unverifiable", () => {
    assert.equal(pidLiveness(42, () => true), "alive");
    assert.equal(pidLiveness(42, thrower("ESRCH")), "dead");
    assert.equal(pidLiveness(42, thrower("EPERM")), "alive");
    assert.equal(pidLiveness(42, thrower("EINVAL")), "unverifiable");
    assert.equal(pidLiveness(0, () => true), "unverifiable");
    assert.equal(pidLiveness(Number.NaN, () => true), "unverifiable");
  });
  test("le processus courant est vivant", () => {
    assert.equal(pidLiveness(process.pid), "alive");
  });
});

describe("sonde Claude : attachement distinct de l'activité", () => {
  const id = "33333333-3333-4333-8333-333333333333";
  function registry(name: string, entries: Record<string, object | string>): string {
    const dir = path.join(sandbox, name);
    mkdirSync(dir, { recursive: true });
    for (const [file, content] of Object.entries(entries)) {
      writeFileSync(path.join(dir, file), typeof content === "string" ? content : JSON.stringify(content));
    }
    return dir;
  }
  const alive = () => "alive" as const;

  test("vivant + idle => attached/idle, et envoi refusé en target-busy", () => {
    const probe = probeClaudeRegistry(id, registry("idle", { "100.json": { pid: 100, sessionId: id, status: "idle" } }), alive);
    assert.equal(probe.attachment, "attached");
    assert.equal(probe.activity, "idle");
    assert.deepEqual(assessTarget(probe), { allowed: false, error: "target-busy" });
  });

  test("vivant sans status (2.1.85) => attached/unknown", () => {
    const probe = probeClaudeRegistry(id, registry("nostatus", { "101.json": { pid: 101, sessionId: id } }), alive);
    assert.equal(probe.attachment, "attached");
    assert.equal(probe.activity, "unknown");
  });

  test("vivant + busy => attached/busy", () => {
    const probe = probeClaudeRegistry(id, registry("busy", { "102.json": { pid: 102, sessionId: id, status: "busy" } }), alive);
    assert.deepEqual([probe.attachment, probe.activity], ["attached", "busy"]);
  });

  test("PID mort => detached, envoi autorisé", () => {
    const probe = probeClaudeRegistry(id, registry("dead", { "103.json": { pid: 103, sessionId: id, status: "busy" } }), () => "dead");
    assert.equal(probe.attachment, "detached");
    assert.deepEqual(assessTarget(probe), { allowed: true });
  });

  test("PID invérifiable => unknown, refus target-state-unknown", () => {
    const probe = probeClaudeRegistry(id, registry("unverifiable", { "104.json": { pid: 104, sessionId: id } }), () => "unverifiable");
    assert.equal(probe.attachment, "unknown");
    assert.deepEqual(assessTarget(probe), { allowed: false, error: "target-state-unknown" });
  });

  test("entrée illisible => unknown ; aucune entrée => detached ; registre absent => unknown", () => {
    assert.equal(probeClaudeRegistry(id, registry("corrupt", { "105.json": "{tronqué" }), alive).attachment, "unknown");
    assert.equal(probeClaudeRegistry(id, registry("other", { "106.json": { pid: 106, sessionId: "autre" } }), alive).attachment, "detached");
    assert.equal(probeClaudeRegistry(id, path.join(sandbox, "absent"), alive).attachment, "unknown");
  });

  test("une entrée vivante l'emporte sur une entrée invérifiable", () => {
    const dir = registry("mixed", { "107.json": { pid: 107, sessionId: id }, "108.json": { pid: 108, sessionId: id } });
    const probe = probeClaudeRegistry(id, dir, (pid) => (pid === 107 ? "alive" : "unverifiable"));
    assert.equal(probe.attachment, "attached");
  });
});

describe("sonde Codex : verrou d'écriture", () => {
  test("absent => detached ; présent mais libre (orphelin) => detached", () => {
    const lock = path.join(sandbox, "orphan.lock");
    assert.equal(probeCodexLock(lock).attachment, "detached");
    writeFileSync(lock, "");
    const probe = probeCodexLock(lock);
    assert.equal(probe.lock?.exists, true);
    assert.equal(probe.attachment, process.platform === "win32" ? "detached" : "unknown");
  });

  test("tenu en exclusif par un autre handle => attached (Windows)", { skip: process.platform !== "win32" }, () => {
    const lock = path.join(sandbox, "held.lock");
    writeFileSync(lock, "");
    const fd = openSync(lock, constants.O_RDONLY | 0x10000000);
    try {
      const probe = probeCodexLock(lock);
      assert.equal(probe.attachment, "attached");
      assert.equal(probe.lock?.code, "EBUSY");
    } finally {
      closeSync(fd);
    }
  });
});

describe("délivrance : persistance distincte de la branche active", () => {
  const line = (entry: object) => JSON.stringify(entry);
  // Racine u1 -> a1 ; branche relay u2(nonce A) -> a2 ; branche TUI u3 -> a3 (écrite en dernier).
  const claudeTranscript = [
    line({ uuid: "u1", parentUuid: null, type: "user", message: { content: "début" } }),
    line({ uuid: "a1", parentUuid: "u1", type: "assistant", message: { content: [{ type: "text", text: "ok" }] } }),
    line({ uuid: "u2", parentUuid: "a1", type: "user", message: { content: "[réf. NONCE-A] relay" } }),
    line({ uuid: "a2", parentUuid: "u2", type: "assistant", message: { content: [{ type: "text", text: "réponse relay" }] } }),
    line({ uuid: "u3", parentUuid: "a1", type: "user", message: { content: [{ type: "text", text: "tour TUI NONCE-B" }] } }),
    line({ uuid: "a3", parentUuid: "u3", type: "assistant", message: { content: [{ type: "text", text: "réponse TUI" }] } }),
    line({ type: "last-prompt" }),
  ].join("\n");

  test("Claude : nonce persisté hors de la branche active (relay orphelin)", () => {
    assert.deepEqual(
      { ...findNonceInClaudeTranscript(claudeTranscript, "NONCE-A"), detail: undefined },
      { persisted: true, inActiveBranch: false, detail: undefined },
    );
  });

  test("Claude : nonce persisté sur la branche active", () => {
    const evidence = findNonceInClaudeTranscript(claudeTranscript, "NONCE-B");
    assert.equal(evidence.persisted, true);
    assert.equal(evidence.inActiveBranch, true);
  });

  test("Claude : chaîne cassée => inActiveBranch unknown", () => {
    const broken = [
      line({ uuid: "u9", parentUuid: null, type: "user", message: { content: "NONCE-C" } }),
      line({ uuid: "a9", parentUuid: "manquant", type: "assistant", message: { content: [] } }),
    ].join("\n");
    assert.equal(findNonceInClaudeTranscript(broken, "NONCE-C").inActiveBranch, "unknown");
  });

  test("Claude : compaction suivie par logicalParentUuid", () => {
    const compacted = [
      line({ uuid: "u1", parentUuid: null, type: "user", message: { content: "NONCE-D" } }),
      line({ uuid: "c1", parentUuid: null, logicalParentUuid: "u1", type: "system", subtype: "compact_boundary" }),
      line({ uuid: "a1", parentUuid: "c1", type: "assistant", message: { content: [] } }),
    ].join("\n");
    assert.equal(findNonceInClaudeTranscript(compacted, "NONCE-D").inActiveBranch, true);
  });

  test("Codex : nonce dans une entrée utilisateur du rollout", () => {
    const rollout = [
      line({ timestamp: "t1", type: "response_item", payload: { type: "message", role: "developer", content: [{ type: "input_text", text: "NONCE-E" }] } }),
      line({ timestamp: "t2", type: "response_item", payload: { type: "message", role: "user", content: [{ type: "input_text", text: "réf. NONCE-F" }] } }),
    ].join("\n");
    assert.equal(findNonceInCodexRollout(rollout, "NONCE-F").persisted, true);
    assert.equal(findNonceInCodexRollout(rollout, "NONCE-E").persisted, false, "un message développeur ne compte pas");
  });

  test("classification : not-delivered réservé aux refus certains ; absence de nonce => unknown", () => {
    const failed = { isError: true, identity: "unavailable" as const, reportedSessionIds: [], observedModels: [], errors: [] };
    assert.equal(classifyDelivery({ refusedBeforeSend: true }).status, "not-delivered");
    assert.equal(classifyDelivery({ refusedBeforeSend: false, certainCliRefusal: true, result: failed }).status, "not-delivered");
    // Refus certain contredit par l'historique : la preuve est conservée et l'emporte.
    assert.deepEqual(
      classifyDelivery({ refusedBeforeSend: false, certainCliRefusal: true, result: failed, evidence: { persisted: true, inActiveBranch: false, detail: "" } }),
      { status: "persisted-no-reply", persisted: true, inActiveBranch: false },
    );
    assert.equal(classifyDelivery({ refusedBeforeSend: false, result: failed, evidence: { persisted: false, inActiveBranch: "unknown", detail: "" } }).status, "unknown");
    assert.equal(classifyDelivery({ refusedBeforeSend: false, result: failed, evidence: { persisted: "unknown", inActiveBranch: "unknown", detail: "" } }).status, "unknown");
    const persisted = classifyDelivery({ refusedBeforeSend: false, result: failed, evidence: { persisted: true, inActiveBranch: false, detail: "" } });
    assert.deepEqual(persisted, { status: "persisted-no-reply", persisted: true, inActiveBranch: false });
    const ok = { isError: false, reply: "OK", identity: "same-as-target" as const, reportedSessionIds: [], observedModels: [], errors: [] };
    assert.equal(classifyDelivery({ refusedBeforeSend: false, result: ok, evidence: { persisted: true, inActiveBranch: true, detail: "" } }).status, "replied");
    const mismatch = { ...ok, identity: "mismatch" as const };
    assert.equal(classifyDelivery({ refusedBeforeSend: false, result: mismatch }).status, "unknown", "une réponse d'une autre session n'est pas une réponse de la cible");
  });
});
