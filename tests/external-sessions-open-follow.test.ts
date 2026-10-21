/**
 * @file Tests du suivi `--open --follow` (#195) : lecteur pur `inspectFollowedTurn` et déroulé
 * `runFollowRelay` avec dépendances injectées (horloge simulée, verrou scripté, rollout factice).
 * Aucun Codex réel, aucun dépôt, aucun quota.
 */
import assert from "node:assert/strict";
import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, test } from "node:test";
import { inspectFollowedTurn } from "../src/externalSessions/openReader.js";
import { runFollowRelay, type FollowRelayInput, type OpenRelayDeps } from "../src/externalSessions/openRelay.js";
import { captureOpenRollout, readOpenRollout } from "../src/externalSessions/openRollout.js";
import type { TargetProbe } from "../src/externalSessions/types.js";

const root = mkdtempSync(path.join(os.tmpdir(), "palabre-open-follow-"));
after(() => rmSync(root, { recursive: true, force: true }));
const THREAD = "0199aaaa-bbbb-7ccc-8ddd-eeeeeeeeeeee";
const OTHER = "99999999-9999-4999-8999-999999999999";
const TURN = "turn-app";
let counter = 0;

type Row = Record<string, unknown>;
const line = (row: Row) => `${JSON.stringify(row)}\n`;
const meta = { type: "session_meta", payload: { id: THREAD, cwd: root } };
const started = (turn = TURN): Row => ({ type: "event_msg", payload: { type: "task_started", turn_id: turn } });
const context = (turn = TURN): Row => ({ type: "turn_context", payload: { turn_id: turn, model: "gpt-fake", approval_policy: "on-request", sandbox_policy: { type: "workspace-write", network_access: false }, cwd: "C:\\privé" } });
const user = (text: string): Row => ({ type: "response_item", payload: { type: "message", role: "user", content: [{ type: "input_text", text }] } });
const item = (type: string, text: string, phase?: string, turn = TURN, thread = THREAD): Row =>
  ({ type: "event_msg", payload: { type: "item_completed", thread_id: thread, turn_id: turn, item: { type, content: [{ type: "text", text }], ...(phase ? { phase } : {}) } } });
const complete = (reply: string | null = "Lot terminé.", error?: Row, turn = TURN): Row =>
  ({ type: "event_msg", payload: { type: "task_complete", turn_id: turn, last_agent_message: reply, ...(error ? { error } : {}) } });
/** Tour complet lancé depuis l'app : saisie libre, réponse finale, fin. */
const appTurn = (turn = TURN, reply = "Lot terminé."): Row[] =>
  [started(turn), context(turn), user("oui, vas-y"), item("UserMessage", "oui, vas-y", undefined, turn), item("AgentMessage", reply, "final_answer", turn), complete(reply, undefined, turn)];

function rollout(): string {
  const file = path.join(root, `rollout-${++counter}.jsonl`);
  writeFileSync(file, line(meta) + line({ type: "turn_context", payload: { turn_id: "old", model: "ancien-modele", approval_policy: "never" } }));
  return file;
}
const appendRows = (file: string, rows: Row[]) => appendFileSync(file, rows.map(line).join(""));

/** Référence puis ajout : rend l'observation du lecteur pur sur les lignes ajoutées. */
async function observe(rows: Row[]) {
  const file = rollout();
  const baseline = await captureOpenRollout(file);
  appendRows(file, rows);
  return inspectFollowedTurn(await readOpenRollout(file, baseline), { threadId: THREAD, baseline });
}

describe("#195 : lecteur du tour suivi", () => {
  test("aucun tour terminé : awaiting-turn", async () => {
    const observation = await observe([started(), context(), user("oui")]);
    assert.equal(observation.status, "awaiting-turn");
  });
  test("tour lancé depuis l'app : followed, réponse, permissions du seul tour suivi", async () => {
    const observation = await observe(appTurn());
    assert.equal(observation.status, "followed");
    assert.equal(observation.reason, "turn-completed");
    assert.equal(observation.reply, "Lot terminé.");
    assert.equal(observation.startObserved, true);
    assert.deepEqual(observation.context, { model: "gpt-fake", approvalPolicy: "on-request", sandbox: "workspace-write", network: "restricted" });
  });
  test("tour commencé avant le suivi : followed, début non observé, permissions inconnues", async () => {
    const observation = await observe([item("AgentMessage", "Lot terminé.", "final_answer"), complete()]);
    assert.equal(observation.status, "followed");
    assert.equal(observation.reason, "turn-started-before-follow");
    assert.equal(observation.startObserved, false);
    assert.equal(observation.context, undefined);
  });
  test("deux tours terminés : seul le premier est rendu", async () => {
    const observation = await observe([...appTurn("turn-1", "Premier."), ...appTurn("turn-2", "Second.")]);
    assert.equal(observation.reply, "Premier.");
    assert.equal(observation.turnId, "turn-1");
  });
  test("tour portant une enveloppe PALABRE : ambigu (relay-turn), jamais présenté comme une suite", async () => {
    const envelope = "### 📧 PALABRE Relay\n\nréf. PR-0123456789abcdef.";
    for (const rows of [
      [started(), user(envelope), item("UserMessage", envelope), item("AgentMessage", "R.", "final_answer"), complete("R.")],
      [started(), user(envelope), item("AgentMessage", "R.", "final_answer"), complete("R.")]
    ]) {
      const observation = await observe(rows);
      assert.equal(observation.status, "ambiguous");
      assert.equal(observation.reason, "relay-turn");
      assert.equal(observation.reply, undefined);
    }
  });
  test("limite d'usage du tour : failed / usage-limit avec reprise CLI", async () => {
    const observation = await observe([started(), context(), complete(null, { codex_error_info: "usage_limit_exceeded", message: "Try again at 5:27 PM." })]);
    assert.equal(observation.status, "failed");
    assert.equal(observation.reason, "usage-limit");
    assert.equal(observation.retryAfter, "17:27");
    assert.equal(observation.context?.approvalPolicy, "on-request");
  });
  test("autres échecs : completion-error, turn-failed-or-cancelled", async () => {
    assert.equal((await observe([started(), complete(null, { message: "refusé" })])).reason, "completion-error");
    assert.equal((await observe([started(), { type: "event_msg", payload: { type: "turn_aborted", turn_id: TURN } }])).reason, "turn-failed-or-cancelled");
  });
  test("formes incohérentes : ambiguës, sans réponse", async () => {
    const cases: Array<[Row[], string]> = [
      [[started(), item("AgentMessage", "A.", "final_answer"), complete("B.")], "completion-text-mismatch"],
      [[started(), complete("A.")], "final-not-observed"],
      [[started(), item("AgentMessage", "A.", "final_answer"), item("AgentMessage", "A.", "final_answer"), complete("A.")], "multiple-finals"],
      [[started(), item("AgentMessage", "A.", "final_answer", TURN, OTHER), complete("A.")], "foreign-thread-event"]
    ];
    for (const [rows, reason] of cases) {
      const observation = await observe(rows);
      assert.equal(observation.status, "ambiguous", reason);
      assert.equal(observation.reason, reason);
      assert.equal(observation.reply, undefined);
    }
  });
  test("historique d'une autre conversation : unreadable, jamais une suite", async () => {
    const file = rollout();
    const baseline = await captureOpenRollout(file);
    writeFileSync(file, line({ type: "session_meta", payload: { id: OTHER, cwd: root } }) + line(complete()) + line(complete()));
    const observation = inspectFollowedTurn(await readOpenRollout(file, baseline), { threadId: THREAD, baseline });
    assert.equal(observation.status, "unreadable");
    assert.equal(observation.reply, undefined);
  });
});

interface Harness { deps: Pick<OpenRelayDeps, "probe" | "capture" | "read" | "now" | "sleep">; calls: { capture: number; read: number }; clock: { now: number } }

function harness(file: string, options: { probe?: TargetProbe["attachment"]; onRead?: (index: number) => void; abortAt?: { read: number; controller: AbortController } } = {}): Harness {
  const clock = { now: 0 };
  const calls = { capture: 0, read: 0 };
  return {
    calls,
    clock,
    deps: {
      probe: () => ({ attachment: options.probe ?? "attached", activity: "unknown", processes: [], evidence: [] }),
      capture: async (name) => { calls.capture += 1; return captureOpenRollout(name); },
      read: async (name, baseline) => {
        options.onRead?.(calls.read);
        if (options.abortAt?.read === calls.read) options.abortAt.controller.abort();
        calls.read += 1;
        return readOpenRollout(name, baseline);
      },
      now: () => clock.now,
      sleep: async (ms, signal) => { if (!signal.aborted) clock.now += ms; }
    }
  };
}

const input = (file: string, fields: Partial<FollowRelayInput> = {}): FollowRelayInput =>
  ({ sessionId: THREAD, historyPath: file, timeoutMs: 10_000, signal: new AbortController().signal, ...fields });

describe("#195 : déroulé du suivi", () => {
  for (const [attachment, status] of [["detached", "target-not-open"], ["unknown", "target-state-unknown"]] as const) {
    test(`verrou ${attachment} : ${status}, aucune lecture`, async () => {
      const file = rollout();
      const h = harness(file, { probe: attachment });
      const result = await runFollowRelay(input(file), h.deps);
      assert.equal(result.outcome.status, status);
      assert.equal(result.outcome.exitCode, 3);
      assert.equal(h.calls.capture, 0);
      assert.equal(h.calls.read, 0);
      assert.equal(result.correlation, undefined);
    });
  }
  test("tour terminé après quelques lectures : followed, code 0, auteur non vérifié", async () => {
    const file = rollout();
    const h = harness(file, { onRead: (index) => { if (index === 2) appendRows(file, appTurn()); } });
    const result = await runFollowRelay(input(file), h.deps);
    assert.equal(result.outcome.status, "followed");
    assert.equal(result.outcome.exitCode, 0);
    assert.equal(result.reply, "Lot terminé.");
    assert.equal(result.identity, "same-as-target");
    assert.deepEqual(result.observedModels, ["gpt-fake"]);
    assert.deepEqual(result.targetPermissions, { approvalPolicy: "on-request", sandbox: "workspace-write", network: "restricted" });
    assert.deepEqual(result.correlation, { status: "followed", reason: "turn-completed" });
    assert.equal(result.receiver, "unverified");
    assert.equal(result.diagnostic, undefined);
    assert.equal(h.calls.read, 3);
  });
  test("aucun tour avant l'échéance : timeout, sans réponse ni permissions", async () => {
    const file = rollout();
    const h = harness(file);
    const result = await runFollowRelay(input(file, { timeoutMs: 2_000 }), h.deps);
    assert.equal(result.outcome.status, "timeout");
    assert.equal(result.reply, undefined);
    assert.equal(result.targetPermissions, "unknown");
    assert.deepEqual(result.correlation, { status: "awaiting-turn", reason: "no-completed-turn" });
  });
  test("tour terminé pendant une lecture interrompue : cancelled, la réponse n'est pas rendue", async () => {
    const file = rollout();
    const controller = new AbortController();
    const h = harness(file, { onRead: () => appendRows(file, appTurn()), abortAt: { read: 0, controller } });
    const result = await runFollowRelay(input(file, { signal: controller.signal }), h.deps);
    assert.equal(result.outcome.status, "cancelled");
    assert.equal(result.reply, undefined);
    assert.equal(result.identity, "unavailable");
  });
  test("limite d'usage du tour suivi : usage-limit avec reprise ; tour Relay : no-valid-reply", async () => {
    const file = rollout();
    const h = harness(file, { onRead: (index) => { if (index === 0) appendRows(file, [started(), context(), complete(null, { codex_error_info: "usage_limit_exceeded", message: "Try again in 30 seconds." })]); } });
    const limited = await runFollowRelay(input(file), h.deps);
    assert.equal(limited.outcome.status, "usage-limit");
    assert.equal(limited.retryAfter, 30);
    assert.equal(limited.diagnostic, "usage-limit");

    const other = rollout();
    const envelope = "### 📧 PALABRE Relay réf. PR-0123456789abcdef.";
    const h2 = harness(other, { onRead: (index) => { if (index === 0) appendRows(other, [started(), user(envelope), item("AgentMessage", "R.", "final_answer"), complete("R.")]); } });
    const relayTurn = await runFollowRelay(input(other), h2.deps);
    assert.equal(relayTurn.outcome.status, "no-valid-reply");
    assert.equal(relayTurn.diagnostic, "relay-turn");
    assert.equal(relayTurn.reply, undefined);
  });
});
