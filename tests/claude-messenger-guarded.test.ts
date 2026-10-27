/** @file Profil deny-only : tests sans SDK, compte, processus ou timer réel. */
import test from "node:test";
import assert from "node:assert/strict";
import { createGuardedCalibration, guardedFixturePolicy } from "../scripts/prototypes/relay/claudeMessengerGuarded.js";
import { CALIBRATION_TOOL, CALIBRATION_TEXT } from "../scripts/prototypes/relay/claudeMessengerCalibration.js";

const plan = () => ({ messengerSessionId: "11111111-1111-4111-8111-111111111111",
  target: { kind: "fixture-only" as const, sessionId: "22222222-2222-4222-8222-222222222222", recipient: "fixture" },
  envelope: CALIBRATION_TEXT, expiresAt: 10000 });
const event = () => ({ hook_event_name: "PreToolUse", session_id: plan().messengerSessionId, tool_use_id: "fixture-call", tool_name: CALIBRATION_TOOL,
  tool_input: { recipient: "fixture", text: CALIBRATION_TEXT } });
function clock() {
  const pending = new Set<() => void>();
  let delay: number | undefined;
  return { now: () => 1, pending, delay: () => delay,
    schedule: (ms: number, expire: () => void) => { delay = ms; pending.add(expire); return () => { pending.delete(expire); }; },
    expire: () => { for (const wake of [...pending]) wake(); } };
}
function deferred() {
  let resolve!: () => void, reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const isDeny = (output: object) => assert.equal((output as { hookSpecificOutput?: { permissionDecision: string } }).hookSpecificOutput?.permissionDecision, "deny");
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

test("profil restrictif : pas de préapprobation et MCP explicitement always_ask", () => {
  const policy = guardedFixturePolicy();
  assert.deepEqual(policy, { allowedTools: [], permissionMode: "default", mcpToolPolicy: [{ name: "fixture_send", permission_policy: "always_ask" }] });
  policy.allowedTools.push("unexpected");
  assert.deepEqual(guardedFixturePolicy().allowedTools, []);
});
for (const failure of ["throw", "reject"]) {
  test(`profil restrictif : ${failure} devient deny, jamais un rejet SDK non traité`, async () => {
    const time = clock();
    const guarded = createGuardedCalibration(plan(), time, () => {
      if (failure === "throw") throw new Error("SECRET fixture");
      return Promise.reject(new Error("SECRET fixture"));
    });
    const result = await guarded.hook(event(), new AbortController().signal);
    isDeny(result);
    assert.equal(JSON.stringify(result).includes("SECRET"), false);
    assert.equal(guarded.state().reservations, 0);
    assert.equal(guarded.state().executions, 0);
    assert.equal(time.pending.size, 0);
    assert.deepEqual(await guarded.canUseTool(), { behavior: "deny", message: "Guarded fixture: no execution permitted" });
    isDeny(await guarded.hook({ ...event(), tool_use_id: "retry" }, new AbortController().signal));
  });
}
test("profil restrictif : attente bornée à 2 s, refus explicite avant le délai SDK préparé", async () => {
  const time = clock(), gate = deferred();
  const guarded = createGuardedCalibration(plan(), time, () => gate.promise);
  const pending = guarded.hook(event(), new AbortController().signal);
  await flush();
  assert.equal(time.delay(), 2000);
  time.expire();
  isDeny(await pending);
  gate.reject(new Error("late"));
  await flush();
  assert.equal(guarded.state().executions, 0);
  assert.equal(time.pending.size, 0);
});
test("profil restrictif : même le témoin intact reste refusé au second contrôle", async () => {
  const guarded = createGuardedCalibration(plan(), clock(), () => {});
  assert.deepEqual(await guarded.hook(event(), new AbortController().signal), {});
  assert.equal(guarded.state().reservations, 1);
  assert.equal((await guarded.canUseTool()).behavior, "deny");
  assert.equal(guarded.state().executions, 0);
  assert.equal(guarded.state().permissionCalls, 1);
});
test("profil restrictif : second contrôle appelé sans hook ou pendant l'attente, refus terminal", async () => {
  for (const started of [true, false]) {
    const gate = deferred(), guarded = createGuardedCalibration(plan(), clock(), () => gate.promise);
    const pending = started ? guarded.hook(event(), new AbortController().signal) : undefined;
    assert.equal((await guarded.canUseTool()).behavior, "deny");
    if (pending) isDeny(await pending);
    gate.resolve();
    await flush();
    isDeny(await guarded.hook(event(), new AbortController().signal));
    assert.equal(guarded.state().executions, 0);
  }
});
test("profil restrictif : annulation avant ou pendant le contrôle, aucun résultat tardif neutre", async () => {
  for (const before of [true, false]) {
    const abort = new AbortController(), gate = deferred();
    const guarded = createGuardedCalibration(plan(), clock(), () => gate.promise);
    if (before) abort.abort();
    const pending = guarded.hook(event(), abort.signal);
    abort.abort();
    isDeny(await pending);
    gate.resolve();
    await flush();
    assert.equal(guarded.state().executions, 0);
  }
});
test("profil restrictif : panne de signal ou de nettoyage reste un deny sans exception", async () => {
  for (const broken of ["register", "cleanup"]) {
    const signal = { aborted: false,
      addEventListener() { if (broken === "register") throw new Error("register"); },
      removeEventListener() { throw new Error("cleanup"); }
    } as unknown as AbortSignal;
    const guarded = createGuardedCalibration(plan(), clock(), () => {});
    isDeny(await guarded.hook(event(), signal));
    assert.equal(guarded.state().executions, 0);
    assert.equal(guarded.state().phase, "closed");
  }
});
test("profil restrictif : outils natifs et inconnus refusés avant toute réservation", async () => {
  for (const tool_name of ["SendMessage", "ListAgents", "Bash", "mcp__other__fixture_send"]) {
    const guarded = createGuardedCalibration(plan(), clock(), () => {});
    isDeny(await guarded.hook({ ...event(), tool_name }, new AbortController().signal));
    assert.equal(guarded.state().reservations, 0);
  }
});
