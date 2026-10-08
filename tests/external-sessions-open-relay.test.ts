/**
 * @file Tests du parcours B1 (`runOpenRelay`) avec dépendances injectées : horloge simulée, sonde de
 * verrou scriptée, rollout factice sur disque et dépôt simulé. Aucun Codex réel, aucun quota.
 */
import assert from "node:assert/strict";
import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { open } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, describe, test } from "node:test";
import { OPEN_BASELINE_RETRY, OPEN_POLL_MS, runOpenRelay, type OpenRelayDeps, type OpenRelayInput } from "../src/externalSessions/openRelay.js";
import { captureOpenRollout, locateOpenRollout, readOpenRollout, type OpenFile } from "../src/externalSessions/openRollout.js";
import type { ExternalProcessResult, ExternalProcessSpec } from "../src/externalSessions/process.js";
import type { TargetProbe } from "../src/externalSessions/types.js";

const root = mkdtempSync(path.join(os.tmpdir(), "palabre-open-relay-"));
after(() => rmSync(root, { recursive: true, force: true }));
const THREAD = "0199aaaa-bbbb-7ccc-8ddd-eeeeeeeeeeee";
const OTHER = "99999999-9999-4999-8999-999999999999";
const NONCE = "PR-0123456789abcdef";
const ENVELOPE = `[Message relayé par palabre relay --open · réf. ${NONCE}]\nDe : claude (session x)\n\nQuestion « été » ?`;
const TURN = "turn-relayed";
let counter = 0;

type Row = Record<string, unknown>;
const line = (row: Row) => `${JSON.stringify(row)}\n`;
const meta = { type: "session_meta", payload: { id: THREAD, cwd: root } };
const started = (turn = TURN): Row => ({ type: "event_msg", payload: { type: "task_started", turn_id: turn } });
const context = (turn = TURN): Row => ({ type: "turn_context", payload: { turn_id: turn, model: "gpt-fake", approval_policy: "never", sandbox_policy: { type: "workspace-write", network_access: false }, cwd: "C:\\privé" } });
const user = (text = ENVELOPE): Row => ({ type: "response_item", payload: { type: "message", role: "user", content: [{ type: "input_text", text }] } });
const item = (type: string, text: string, phase?: string, turn = TURN): Row =>
  ({ type: "event_msg", payload: { type: "item_completed", thread_id: THREAD, turn_id: turn, item: { type, content: [{ type: "text", text }], ...(phase ? { phase } : {}) } } });
const complete = (reply: string | null = "Réponse « été ».", error?: Row, turn = TURN): Row =>
  ({ type: "event_msg", payload: { type: "task_complete", turn_id: turn, last_agent_message: reply, ...(error ? { error } : {}) } });
const fullTurn = (): Row[] => [started(), context(), user(), item("UserMessage", ENVELOPE), item("AgentMessage", "Réponse « été ».", "final_answer"), complete()];

function rollout(): string {
  const file = path.join(root, `rollout-${++counter}.jsonl`);
  writeFileSync(file, line(meta) + line({ type: "turn_context", payload: { turn_id: "old", model: "ancien-modele", approval_policy: "on-request" } }));
  return file;
}

const queued = (fields: Partial<ExternalProcessResult> = {}): ExternalProcessResult => ({
  started: true, pid: 42, exitCode: 0, signal: null, forcedReturn: false,
  stdout: `Queued message item-1 for thread ${THREAD}.\n`, stderr: "", outputBytes: 0, durationMs: 1, ...fields
});

interface Harness {
  deps: OpenRelayDeps;
  calls: { run: ExternalProcessSpec[]; capture: number; read: number; probe: number };
  clock: { now: number };
}

/**
 * Dépendances simulées. `probes` est consommé à chaque sonde (la dernière valeur se répète) ;
 * `onRun` simule le récepteur ; `onRead` peut écrire dans le rollout avant chaque lecture.
 */
function harness(file: string, options: {
  probes?: TargetProbe["attachment"][];
  onRun?: (spec: ExternalProcessSpec, clock: { now: number }) => ExternalProcessResult;
  onRead?: (index: number) => void;
  capture?: OpenRelayDeps["capture"];
  read?: OpenRelayDeps["read"];
  openFile?: OpenFile;
} = {}): Harness {
  const clock = { now: 0 };
  const calls = { run: [] as ExternalProcessSpec[], capture: 0, read: 0, probe: 0 };
  const probes = options.probes ?? ["attached"];
  const deps: OpenRelayDeps = {
    probe: () => ({ attachment: probes[Math.min(calls.probe++, probes.length - 1)]!, activity: "unknown", processes: [], evidence: [] }),
    capture: async (target) => { calls.capture += 1; return (options.capture ?? ((name) => captureOpenRollout(name, options.openFile)))(target); },
    read: async (target, baseline) => { options.onRead?.(calls.read); calls.read += 1; return (options.read ?? ((name, base) => readOpenRollout(name, base, options.openFile)))(target, baseline); },
    run: async (spec) => { calls.run.push(spec); return (options.onRun ?? (() => queued()))(spec, clock); },
    now: () => clock.now,
    sleep: async (ms, signal) => { if (!signal.aborted) clock.now += ms; }
  };
  return { deps, calls, clock };
}

function input(file: string, fields: Partial<OpenRelayInput> = {}): OpenRelayInput {
  return {
    executable: { command: "C:\\outils\\node.exe", prefixArgs: ["C:\\outils\\codex.js"] },
    sessionId: THREAD, cwd: root, historyPath: file, envelope: ENVELOPE, nonce: NONCE,
    timeoutMs: 10_000, signal: new AbortController().signal, ...fields
  };
}

const appendRows = (file: string, rows: Row[]) => appendFileSync(file, rows.map(line).join(""));

describe("B1 : parcours nominal", () => {
  test("verrou tenu, dépôt accusé, réponse corrélée : replied, permissions et modèle du seul tour corrélé", async () => {
    const file = rollout();
    const h = harness(file, { onRun: () => { appendRows(file, fullTurn()); return queued(); } });
    const result = await runOpenRelay(input(file), h.deps);
    assert.equal(result.outcome.status, "replied");
    assert.equal(result.reply, "Réponse « été ».");
    assert.deepEqual(result.delivery, { status: "replied", persisted: true, inActiveBranch: "unknown" });
    assert.equal(result.identity, "same-as-target");
    assert.deepEqual(result.observedModels, ["gpt-fake"]);
    assert.deepEqual(result.targetPermissions, { approvalPolicy: "never", sandbox: "workspace-write", network: "restricted" });
    assert.deepEqual(result.queue, { attempted: true, accepted: true, itemId: "item-1" });
    assert.deepEqual(result.correlation, { status: "replied", reason: "correlated-final" });
    assert.equal(result.receiver, "unverified");
    // Un seul dépôt, sans shell, dans le dossier de la cible, enveloppe en argument, stdin vide.
    assert.equal(h.calls.run.length, 1);
    assert.deepEqual(h.calls.run[0]!.args, ["C:\\outils\\codex.js", "queue", "--thread", THREAD, "--message", ENVELOPE]);
    assert.equal(h.calls.run[0]!.cwd, root);
    assert.equal(h.calls.run[0]!.stdin, "");
    assert.equal(h.calls.probe, 2, "verrou contrôlé avant la référence, puis juste avant le dépôt");
  });
  test("permissions d'un ancien ou d'un autre tour ignorées : inconnues, sans modèle", async () => {
    const file = rollout();
    const rows = fullTurn().filter((row) => row.type !== "turn_context");
    const h = harness(file, { onRun: () => { appendRows(file, [context("autre-tour"), ...rows]); return queued(); } });
    const result = await runOpenRelay(input(file), h.deps);
    assert.equal(result.outcome.status, "replied");
    assert.equal(result.targetPermissions, "unknown");
    assert.deepEqual(result.observedModels, []);
  });
});

describe("B1 : refus sans dépôt", () => {
  for (const [attachment, status] of [["detached", "target-not-open"], ["unknown", "target-state-unknown"]] as const) {
    test(`verrou ${attachment} : ${status}, aucun dépôt, not-delivered`, async () => {
      const file = rollout();
      const h = harness(file, { probes: [attachment] });
      const result = await runOpenRelay(input(file), h.deps);
      assert.equal(result.outcome.status, status);
      assert.equal(result.outcome.exitCode, 3);
      assert.deepEqual(result.delivery, { status: "not-delivered", persisted: false, inActiveBranch: false });
      assert.deepEqual(result.queue, { attempted: false });
      assert.equal(h.calls.run.length, 0);
      assert.equal(h.calls.capture, 0);
    });
  }
  test("fermeture entre la référence et le dépôt : target-not-open, aucun dépôt", async () => {
    const file = rollout();
    const h = harness(file, { probes: ["attached", "detached"] });
    const result = await runOpenRelay(input(file), h.deps);
    assert.equal(result.outcome.status, "target-not-open");
    assert.equal(result.diagnostic, "lock-released-before-queue");
    assert.equal(h.calls.capture, 1);
    assert.equal(h.calls.run.length, 0);
  });
  test("sonde devenue invérifiable avant le dépôt : target-state-unknown, aucun dépôt", async () => {
    const file = rollout();
    const h = harness(file, { probes: ["attached", "unknown"] });
    assert.equal((await runOpenRelay(input(file), h.deps)).outcome.status, "target-state-unknown");
    assert.equal(h.calls.run.length, 0);
  });
  for (const [label, fields, detail] of [
    ["enveloppe trop longue", { envelope: `${ENVELOPE}${"x".repeat(9000)}` }, "envelope-too-long"],
    ["NUL incorporé", { envelope: `${ENVELOPE}\u0000` }, "nul-in-argument"],
    ["ligne de commande trop longue", { executable: { command: `C:\\${"d".repeat(33_000)}\\node.exe`, prefixArgs: [] } }, "command-line-too-long"]
  ] as const) {
    test(`${label} : invalid-request / message-too-large, sans référence ni dépôt`, async () => {
      const file = rollout();
      const h = harness(file);
      const result = await runOpenRelay(input(file, fields as Partial<OpenRelayInput>), h.deps);
      assert.equal(result.outcome.status, "invalid-request");
      assert.equal(result.outcome.reason, "message-too-large");
      assert.equal(result.outcome.exitCode, 8);
      assert.equal(result.diagnostic, detail);
      assert.equal(result.delivery.status, "not-delivered");
      assert.equal(h.calls.capture, 0);
      assert.equal(h.calls.run.length, 0);
    });
  }
  test("référence toujours partielle : nouvelles tentatives bornées à 2 s, puis no-valid-reply, not-delivered", async () => {
    const file = rollout();
    appendFileSync(file, "{\"type\":\"event_msg\"");
    const h = harness(file);
    const result = await runOpenRelay(input(file), h.deps);
    assert.equal(result.outcome.status, "no-valid-reply");
    assert.equal(result.diagnostic, "reference-baseline-incomplete");
    assert.equal(result.delivery.status, "not-delivered");
    assert.equal(h.calls.capture, OPEN_BASELINE_RETRY.totalMs / OPEN_BASELINE_RETRY.stepMs + 1);
    assert.ok(h.clock.now <= OPEN_BASELINE_RETRY.totalMs);
    assert.equal(h.calls.run.length, 0);
  });
  test("référence partielle puis complétée : dépôt normal", async () => {
    const file = rollout();
    appendFileSync(file, "{\"type\":\"event_msg\"");
    let attempts = 0;
    const h = harness(file, {
      capture: async (name) => {
        if (++attempts === 3) appendFileSync(name, ",\"payload\":{}}\n");
        return captureOpenRollout(name);
      },
      onRun: () => { appendRows(file, fullTurn()); return queued(); }
    });
    assert.equal((await runOpenRelay(input(file), h.deps)).outcome.status, "replied");
  });
  test("tentatives de référence limitées au budget restant : timeout, not-delivered", async () => {
    const file = rollout();
    appendFileSync(file, "{");
    const h = harness(file);
    const result = await runOpenRelay(input(file, { timeoutMs: 500 }), h.deps);
    assert.equal(result.outcome.status, "timeout");
    assert.equal(result.delivery.status, "not-delivered");
    assert.ok(h.clock.now <= 500);
  });
  test("Ctrl+C avant le dépôt : cancelled, not-delivered, aucun dépôt", async () => {
    const file = rollout();
    const controller = new AbortController();
    const h = harness(file, { capture: async (name) => { controller.abort(); return captureOpenRollout(name); } });
    const result = await runOpenRelay(input(file, { signal: controller.signal }), h.deps);
    assert.equal(result.outcome.status, "cancelled");
    assert.equal(result.delivery.status, "not-delivered");
    assert.equal(h.calls.run.length, 0);
  });
  for (const [launchFailure, status] of [["command-not-found", "command-not-found"], ["invalid-working-directory", "invalid-request"], ["spawn-failed", "cli-failure"]] as const) {
    test(`lancement impossible (${launchFailure}) : ${status}, aucun enfant créé, not-delivered`, async () => {
      const file = rollout();
      const h = harness(file, { onRun: () => queued({ started: false, pid: undefined, exitCode: null, stdout: "", launchFailure }) });
      const result = await runOpenRelay(input(file), h.deps);
      assert.equal(result.outcome.status, status);
      assert.equal(result.delivery.status, "not-delivered");
      assert.deepEqual(result.queue, { attempted: false });
    });
  }
});

describe("B1 : budget unique et arrêts pendant le dépôt", () => {
  test("régression : seconde sonde qui épuise le budget : timeout, aucun lancement, not-delivered", async () => {
    const file = rollout();
    const h = harness(file);
    const probe = h.deps.probe;
    h.deps.probe = () => {
      const result = probe();
      if (h.calls.probe === 2) h.clock.now = 11_000;
      return result;
    };
    const result = await runOpenRelay(input(file), h.deps);
    assert.equal(result.outcome.status, "timeout");
    assert.equal(result.outcome.exitCode, 4);
    assert.equal(result.diagnostic, "budget-exhausted-before-queue");
    assert.deepEqual(result.queue, { attempted: false });
    assert.equal(result.delivery.status, "not-delivered");
    assert.equal(h.calls.run.length, 0);
  });
  test("Ctrl+C pendant la seconde sonde : cancelled, aucun lancement", async () => {
    const file = rollout();
    const controller = new AbortController();
    const h = harness(file);
    const probe = h.deps.probe;
    h.deps.probe = () => {
      const result = probe();
      if (h.calls.probe === 2) controller.abort();
      return result;
    };
    const result = await runOpenRelay(input(file, { signal: controller.signal }), h.deps);
    assert.equal(result.outcome.status, "cancelled");
    assert.equal(result.delivery.status, "not-delivered");
    assert.equal(h.calls.run.length, 0);
  });
  test("budget de 10 s avec dépôt lent : timeout du dépôt borné au budget restant, puis timeout", async () => {
    const file = rollout();
    const h = harness(file, {
      capture: async (name) => { h.clock.now += 1_500; return captureOpenRollout(name); },
      onRun: (spec, clock) => { clock.now += spec.timeoutMs; return queued({ exitCode: null, stdout: "", stopReason: "timeout" }); }
    });
    const result = await runOpenRelay(input(file), h.deps);
    assert.equal(h.calls.run[0]!.timeoutMs, 8_500, "min(60 s, budget restant)");
    assert.equal(result.outcome.status, "timeout");
    assert.deepEqual(result.queue, { attempted: true, accepted: "unknown", diagnostic: "queue-timeout" });
    assert.equal(result.delivery.status, "unknown");
    assert.equal(result.receptionObserved, false);
    assert.equal(h.calls.read, 0, "aucune lecture après l'échéance");
  });
  test("dépôt plafonné à 60 s quand le budget est plus large", async () => {
    const file = rollout();
    const h = harness(file, { onRun: () => { appendRows(file, fullTurn()); return queued(); } });
    await runOpenRelay(input(file, { timeoutMs: 600_000 }), h.deps);
    assert.equal(h.calls.run[0]!.timeoutMs, 60_000);
  });
  test("Ctrl+C pendant queue : cancelled, tentative comptée, unknown, aucune dernière lecture", async () => {
    const file = rollout();
    const controller = new AbortController();
    const h = harness(file, { onRun: () => { controller.abort(); return queued({ exitCode: null, stdout: "", stopReason: "cancelled" }); } });
    const result = await runOpenRelay(input(file, { signal: controller.signal }), h.deps);
    assert.equal(result.outcome.status, "cancelled");
    assert.equal(result.outcome.exitCode, 130);
    assert.equal(result.delivery.status, "unknown");
    assert.equal(result.queue.attempted, true);
    assert.equal(h.calls.read, 0);
  });
  test("plafond de sortie de queue : output-too-large, sortie partielle jamais prise pour un accusé", async () => {
    const file = rollout();
    const h = harness(file, { onRun: () => queued({ exitCode: null, stopReason: "output-too-large" }) });
    const result = await runOpenRelay(input(file), h.deps);
    assert.equal(result.outcome.status, "output-too-large");
    assert.equal(result.queue.accepted, "unknown");
    assert.equal(result.queue.itemId, undefined);
  });
  test("onAttempt appelé dès qu'un processus de dépôt existe", async () => {
    const file = rollout();
    let attempted = false;
    const h = harness(file, { onRun: () => queued({ exitCode: 1, stdout: "" }) });
    await runOpenRelay(input(file, { onAttempt: () => { attempted = true; } }), h.deps);
    assert.equal(attempted, true);
  });
});

describe("B1 : échecs du déposant après tentative", () => {
  test("code non nul : cli-failure, acceptation inconnue, délivrance unknown", async () => {
    const file = rollout();
    const h = harness(file, { onRun: () => queued({ exitCode: 1, stdout: "", stderr: "Error: queue database unavailable" }) });
    const result = await runOpenRelay(input(file), h.deps);
    assert.equal(result.outcome.status, "cli-failure");
    assert.deepEqual(result.queue, { attempted: true, accepted: "unknown", diagnostic: "queue-exit-1" });
    assert.equal(result.delivery.status, "unknown");
    assert.equal(h.calls.read, 1, "une seule dernière lecture bornée");
  });
  test("réception malgré l'échec du déposant : persisted-no-reply, jamais de réponse rendue", async () => {
    const file = rollout();
    const h = harness(file, { onRun: () => { appendRows(file, fullTurn()); return queued({ exitCode: 1, stdout: "" }); } });
    const result = await runOpenRelay(input(file), h.deps);
    assert.equal(result.outcome.status, "cli-failure");
    assert.equal(result.reply, undefined);
    assert.equal(result.delivery.status, "persisted-no-reply");
    assert.equal(result.identity, "unavailable");
    assert.equal(result.receptionObserved, true);
  });
  for (const [label, stdout, diagnostic] of [
    ["accusé absent", "", "queue-ack-missing"],
    ["accusé d'une autre conversation", `Queued message x for thread ${OTHER}.\n`, "queue-ack-foreign-thread"]
  ] as const) {
    test(`${label} : no-valid-reply, acceptation inconnue (pas un refus)`, async () => {
      const file = rollout();
      const h = harness(file, { onRun: () => queued({ stdout }) });
      const result = await runOpenRelay(input(file), h.deps);
      assert.equal(result.outcome.status, "no-valid-reply");
      assert.deepEqual(result.queue, { attempted: true, accepted: "unknown", diagnostic });
      assert.equal(result.delivery.status, "unknown");
    });
  }
  test("CLI sans queue (refus authentique de l'analyseur) : cli-failure, not-delivered, acceptation false", async () => {
    const file = rollout();
    const stderr = "error: unexpected argument '--thread' found\n\n  tip: to pass '--thread' as a value, use '-- --thread'\n\nUsage: codex [OPTIONS] [PROMPT]\n       codex [OPTIONS] <COMMAND> [ARGS]\n\nFor more information, try '--help'.\n";
    const h = harness(file, { onRun: () => queued({ exitCode: 2, stdout: "", stderr }) });
    const result = await runOpenRelay(input(file), h.deps);
    assert.equal(result.outcome.status, "cli-failure");
    assert.equal(result.delivery.status, "not-delivered");
    assert.deepEqual(result.queue, { attempted: true, accepted: false, diagnostic: "queue-unsupported" });
  });
  test("régression : mention « unrecognized subcommand 'queue' » dans un journal, avec accusé et réception : jamais not-delivered", async () => {
    const file = rollout();
    const h = harness(file, {
      onRun: () => {
        appendRows(file, fullTurn());
        return queued({ exitCode: 1, stderr: "warning: nested tool reported unrecognized subcommand 'queue'; deposit was already accepted" });
      }
    });
    const result = await runOpenRelay(input(file), h.deps);
    assert.equal(result.outcome.status, "cli-failure");
    assert.deepEqual(result.queue, { attempted: true, accepted: "unknown", diagnostic: "queue-exit-1" });
    assert.equal(h.calls.read, 1, "la dernière lecture bornée a lieu");
    assert.equal(result.delivery.status, "persisted-no-reply");
    assert.equal(result.receptionObserved, true);
    assert.equal(result.reply, undefined);
  });
});

describe("B1 : attente et lecteur", () => {
  test("réception non observée à l'échéance : timeout, unknown, lectures espacées", async () => {
    const file = rollout();
    const h = harness(file);
    const result = await runOpenRelay(input(file, { timeoutMs: 2_000 }), h.deps);
    assert.equal(result.outcome.status, "timeout");
    assert.equal(result.delivery.status, "unknown");
    assert.equal(result.receptionObserved, false);
    assert.deepEqual(result.correlation, { status: "awaiting-message", reason: "envelope-not-observed" });
    // Lectures à 0, 500, 1 000 et 1 500 ms ; à l'échéance, aucune lecture supplémentaire.
    assert.equal(h.calls.read, 2_000 / OPEN_POLL_MS);
  });
  test("régression : Ctrl+C pendant une lecture qui rapporte une réponse : cancelled, sans réponse, réception conservée", async () => {
    const file = rollout();
    const controller = new AbortController();
    const h = harness(file, {
      onRun: () => { appendRows(file, fullTurn()); return queued(); },
      read: async (name, base) => { const snapshot = await readOpenRollout(name, base); controller.abort(); return snapshot; }
    });
    const result = await runOpenRelay(input(file, { signal: controller.signal }), h.deps);
    assert.equal(result.outcome.status, "cancelled");
    assert.equal(result.outcome.exitCode, 130);
    assert.equal(result.reply, undefined);
    assert.equal(result.identity, "unavailable");
    assert.equal(result.delivery.status, "persisted-no-reply");
    assert.equal(result.targetPermissions, "unknown");
    assert.deepEqual(result.observedModels, []);
  });
  test("régression : lecture terminée après l'échéance avec une réponse : timeout, sans réponse, réception conservée", async () => {
    const file = rollout();
    const h = harness(file, {
      onRun: () => { appendRows(file, fullTurn()); return queued(); },
      read: async (name, base) => { const snapshot = await readOpenRollout(name, base); h.clock.now = 11_000; return snapshot; }
    });
    const result = await runOpenRelay(input(file), h.deps);
    assert.equal(result.outcome.status, "timeout");
    assert.equal(result.outcome.exitCode, 4);
    assert.equal(result.reply, undefined);
    assert.equal(result.delivery.status, "persisted-no-reply");
  });
  test("une observation terminale d'échec ne masque pas l'annulation pendant la lecture", async () => {
    const file = rollout();
    const controller = new AbortController();
    const h = harness(file, {
      onRun: () => { appendRows(file, [started(), context(), user(), item("UserMessage", ENVELOPE), complete(null, { message: "modèle refusé" })]); return queued(); },
      read: async (name, base) => { const snapshot = await readOpenRollout(name, base); controller.abort(); return snapshot; }
    });
    const result = await runOpenRelay(input(file, { signal: controller.signal }), h.deps);
    assert.equal(result.outcome.status, "cancelled");
    assert.equal(result.delivery.status, "persisted-no-reply");
  });
  test("échéance atteinte au réveil entre deux lectures : timeout, sans nouvelle lecture", async () => {
    const file = rollout();
    const h = harness(file, { onRun: () => { appendRows(file, [started(), user(), item("UserMessage", ENVELOPE)]); return queued(); } });
    h.deps.sleep = async () => { h.clock.now += 20_000; };
    const result = await runOpenRelay(input(file), h.deps);
    assert.equal(result.outcome.status, "timeout");
    assert.equal(h.calls.read, 1);
    assert.equal(result.delivery.status, "persisted-no-reply");
  });
  test("enveloppe reçue sans réponse à l'échéance : timeout, persisted-no-reply", async () => {
    const file = rollout();
    const h = harness(file, { onRun: () => { appendRows(file, [started(), user(), item("UserMessage", ENVELOPE)]); return queued(); } });
    const result = await runOpenRelay(input(file, { timeoutMs: 2_000 }), h.deps);
    assert.equal(result.outcome.status, "timeout");
    assert.equal(result.delivery.status, "persisted-no-reply");
    assert.equal(result.receptionObserved, true);
  });
  test("preuve de réception puis exception du collecteur : no-valid-reply, preuve conservée", async () => {
    const file = rollout();
    let reads = 0;
    const h = harness(file, {
      onRun: () => { appendRows(file, [started(), user(), item("UserMessage", ENVELOPE)]); return queued(); },
      read: async (name, base) => { if (++reads === 2) throw new Error("history-replaced"); return readOpenRollout(name, base); }
    });
    const result = await runOpenRelay(input(file), h.deps);
    assert.equal(result.outcome.status, "no-valid-reply");
    assert.deepEqual(result.correlation, { status: "unreadable", reason: "history-replaced" });
    assert.equal(result.delivery.status, "persisted-no-reply");
    assert.equal(result.identity, "unavailable");
  });
  test("exception sans preuve : no-valid-reply, unknown, sans chemin dans le diagnostic", async () => {
    const file = rollout();
    const h = harness(file, { read: async () => { throw new Error(`ENOENT: no such file, open '${file}'`); } });
    const result = await runOpenRelay(input(file), h.deps);
    assert.equal(result.delivery.status, "unknown");
    assert.equal(result.correlation?.reason, "read-error");
  });
  test("échec du tour corrélé (task_complete.error) : cli-failure, persisted-no-reply, sans réponse", async () => {
    const file = rollout();
    const h = harness(file, { onRun: () => { appendRows(file, [started(), context(), user(), item("UserMessage", ENVELOPE), complete(null, { message: "modèle refusé" })]); return queued(); } });
    const result = await runOpenRelay(input(file), h.deps);
    assert.equal(result.outcome.status, "cli-failure");
    assert.deepEqual(result.correlation, { status: "failed", reason: "completion-error" });
    assert.equal(result.delivery.status, "persisted-no-reply");
    assert.equal(result.reply, undefined);
    assert.equal(result.identity, "unavailable");
  });
  test("ambiguïté (deux contextes exemptables) : no-valid-reply, identité indisponible, sans permissions", async () => {
    const file = rollout();
    const environment = (): Row => ({ type: "response_item", payload: { type: "message", role: "user", internal_chat_message_metadata_passthrough: { turn_id: TURN, content_item_kinds: ["environments.environment_context"] }, content: [{ type: "input_text", text: "<environment_context>x</environment_context>" }] } });
    const rows = fullTurn();
    rows.splice(2, 0, environment(), environment());
    const h = harness(file, { onRun: () => { appendRows(file, rows); return queued(); } });
    const result = await runOpenRelay(input(file), h.deps);
    assert.equal(result.outcome.status, "no-valid-reply");
    assert.deepEqual(result.correlation, { status: "ambiguous", reason: "multiple-environment-contexts" });
    assert.equal(result.identity, "unavailable");
    assert.equal(result.targetPermissions, "unknown");
    assert.equal(result.delivery.status, "persisted-no-reply");
  });
  test("format inconnu (ancien couple user_message/agent_message) : réception non observée, timeout", async () => {
    const file = rollout();
    const h = harness(file, { onRun: () => { appendRows(file, [{ type: "event_msg", payload: { type: "user_message", message: ENVELOPE } }, { type: "event_msg", payload: { type: "agent_message", message: "Réponse" } }]); return queued(); } });
    const result = await runOpenRelay(input(file, { timeoutMs: 1_000 }), h.deps);
    assert.equal(result.outcome.status, "timeout");
    assert.equal(result.reply, undefined);
    assert.equal(result.receptionObserved, false);
  });
  test("Ctrl+C pendant l'attente : cancelled, preuve conservée", async () => {
    const file = rollout();
    const controller = new AbortController();
    const h = harness(file, {
      onRun: () => { appendRows(file, [started(), user(), item("UserMessage", ENVELOPE)]); return queued(); },
      onRead: (index) => { if (index === 1) controller.abort(); }
    });
    const result = await runOpenRelay(input(file, { signal: controller.signal }), h.deps);
    assert.equal(result.outcome.status, "cancelled");
    assert.equal(result.delivery.status, "persisted-no-reply");
  });
});

describe("B1 : parcours complet sur grand historique", () => {
  test("rollout de 151 Mio : localisation, référence et lectures bornées, réponse corrélée", async () => {
    const day = path.join(root, "home-large", "sessions", "2026", "10", "08");
    const { mkdirSync } = await import("node:fs");
    mkdirSync(day, { recursive: true });
    const file = path.join(day, `rollout-2026-10-08T00-00-00-${THREAD}.jsonl`);
    const size = 151 * 1024 * 1024;
    const handle = await open(file, "w");
    try {
      await handle.write(line(meta), 0, "utf8");
      await handle.truncate(size);
      await handle.write("\n", size - 1, "utf8");
    } finally { await handle.close(); }
    let bytesRead = 0;
    const counting: OpenFile = async (name, flags) => {
      const fileHandle = await open(name, flags);
      const read = fileHandle.read.bind(fileHandle) as (...args: unknown[]) => Promise<{ bytesRead: number }>;
      (fileHandle as unknown as { read: (...args: unknown[]) => Promise<{ bytesRead: number }> }).read = async (...args) => {
        const result = await read(...args);
        bytesRead += result.bytesRead;
        return result;
      };
      return fileHandle;
    };
    const located = await locateOpenRollout(path.join(root, "home-large"), THREAD, counting);
    assert.equal(located.status, "found");
    assert.equal(located.status === "found" && located.historyPath, file);
    const h = harness(file, { openFile: counting, onRun: () => { appendRows(file, fullTurn()); return queued(); } });
    const result = await runOpenRelay(input(file), h.deps);
    assert.equal(result.outcome.status, "replied");
    assert.ok(bytesRead < 2 * 1024 * 1024, `lectures bornées : ${bytesRead} octets lus pour un fichier de 151 Mio`);
  });
  test("localisation bornée : première ligne trop grande ou d'une autre session refusée", async () => {
    const home = path.join(root, "home-bad");
    const day = path.join(home, "sessions", "2026");
    const { mkdirSync } = await import("node:fs");
    mkdirSync(day, { recursive: true });
    writeFileSync(path.join(day, `rollout-x-${THREAD}.jsonl`), line({ type: "session_meta", payload: { id: OTHER, cwd: root } }));
    assert.equal((await locateOpenRollout(home, THREAD)).status, "session-not-found");
    writeFileSync(path.join(day, `rollout-x-${THREAD}.jsonl`), line({ type: "session_meta", payload: { id: THREAD, cwd: path.join(root, "absent") } }));
    assert.equal((await locateOpenRollout(home, THREAD)).status, "invalid-working-directory");
    writeFileSync(path.join(day, `rollout-y-${THREAD}.jsonl`), line(meta));
    assert.equal((await locateOpenRollout(home, THREAD)).status, "session-not-found", "doublon : cible ambiguë");
  });
});
