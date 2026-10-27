/** @file Pannes asynchrones de banc : aucun SDK, compte, processus Claude ou timer réel. */
import test from "node:test";
import assert from "node:assert/strict";
import { createFixtureFaultAttempt, type FixtureClock } from "../scripts/prototypes/relay/claudeMessengerFaults.js";
import { CALIBRATION_TOOL, CALIBRATION_TEXT } from "../scripts/prototypes/relay/claudeMessengerCalibration.js";

const session = "11111111-1111-4111-8111-111111111111";
const target = { kind: "fixture-only" as const, sessionId: "22222222-2222-4222-8222-222222222222", recipient: "fixture-only" };
const plan = () => ({ messengerSessionId: session, target: { ...target }, envelope: CALIBRATION_TEXT, expiresAt: 100 });
const event = () => ({ hook_event_name: "PreToolUse", session_id: session, tool_use_id: "fixture-call", tool_name: CALIBRATION_TOOL,
  tool_input: { recipient: target.recipient, text: CALIBRATION_TEXT } });
function clock() {
  let time = 1;
  const pending = new Set<() => void>();
  const api: FixtureClock = { now: () => time, schedule: (_delay, expire) => { pending.add(expire); return () => { pending.delete(expire); }; } };
  return { api, set(value: number) { time = value; }, expire() { time = 100; for (const wake of [...pending]) wake(); }, pending };
}
function deferred() {
  let resolve!: () => void, reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

test("pannes : témoin valide exécuté une fois, refus de tout rejeu et nettoyage", async () => {
  const time = clock();
  const attempt = createFixtureFaultAttempt(plan(), time.api, () => {});
  assert.equal((await attempt.inspect(event())).disposition, "continue-permissions");
  assert.equal(time.pending.size, 0);
  assert.equal(attempt.executeFake(event()), true);
  assert.equal(attempt.executeFake(event()), false);
  assert.equal((await attempt.inspect({ ...event(), tool_use_id: "other-call" })).disposition, "blocked");
  assert.equal(attempt.state().executions, 1);
  assert.equal(attempt.state().reservations, 1);
});
for (const failure of ["throw", "reject"] as const) {
  test(`pannes : ${failure} ferme avant réservation, même si le faux hôte poursuit`, async () => {
    const time = clock();
    const attempt = createFixtureFaultAttempt(plan(), time.api, () => {
      if (failure === "throw") throw new Error("SECRET fixture");
      return Promise.reject(new Error("SECRET fixture"));
    });
    const decision = await attempt.inspect(event());
    assert.equal(decision.disposition, "blocked");
    assert.equal(JSON.stringify(decision).includes("SECRET"), false);
    assert.equal(attempt.executeFake(event()), false);
    assert.deepEqual(attempt.state(), { phase: "closed", reason: "hook-failed", executions: 0, reservations: 0 });
    assert.equal(time.pending.size, 0);
  });
}
for (const late of ["resolve", "reject"] as const) {
  test(`pannes : échéance d'un contrôle suspendu, puis ${late} tardif sans réouverture`, async () => {
    const time = clock(), gate = deferred();
    const attempt = createFixtureFaultAttempt(plan(), time.api, () => gate.promise);
    const decision = attempt.inspect(event());
    await flush();
    time.expire();
    assert.equal((await decision).disposition, "blocked");
    assert.equal(attempt.executeFake(event()), false);
    if (late === "resolve") gate.resolve(); else gate.reject(new Error("late failure"));
    await flush();
    assert.equal(attempt.executeFake(event()), false);
    assert.deepEqual(attempt.state(), { phase: "closed", reason: "expired", executions: 0, reservations: 0 });
    assert.equal(time.pending.size, 0);
  });
}
test("pannes : dernier contrôle refuse un hôte qui saute le hook ou poursuit pendant son attente", async () => {
  for (const started of [false, true]) {
    const time = clock(), gate = deferred();
    const attempt = createFixtureFaultAttempt(plan(), time.api, () => gate.promise);
    const decision = started ? attempt.inspect(event()) : undefined;
    assert.equal(attempt.executeFake(event()), false);
    if (decision) assert.equal((await decision).disposition, "blocked");
    gate.resolve();
    await flush();
    assert.equal(attempt.executeFake(event()), false);
    assert.equal(attempt.state().executions, 0);
  }
});
test("pannes : annulation pendant le contrôle ou après réservation, résultat tardif inutilisable", async () => {
  for (const pending of [true, false]) {
    const time = clock(), gate = deferred();
    const attempt = createFixtureFaultAttempt(plan(), time.api, () => pending ? gate.promise : undefined);
    const decision = attempt.inspect(event());
    if (!pending) assert.equal((await decision).disposition, "continue-permissions");
    attempt.cancel();
    gate.resolve();
    await flush();
    if (pending) assert.equal((await decision).disposition, "blocked");
    assert.equal(attempt.executeFake(event()), false);
    assert.equal(attempt.state().executions, 0);
    assert.equal(attempt.state().reason, "cancelled");
  }
});
test("pannes : échéance contrôlée à la résolution même si le timer ne s'est pas réveillé", async () => {
  const time = clock(), gate = deferred();
  const attempt = createFixtureFaultAttempt(plan(), time.api, () => gate.promise);
  const decision = attempt.inspect(event());
  time.set(100);
  gate.resolve();
  assert.equal((await decision).disposition, "blocked");
  assert.equal(attempt.executeFake(event()), false);
  assert.equal(attempt.state().executions, 0);
});
test("pannes : contrôle suspendu sans réveil, attente explicite et compteur nul jusqu'à annulation", async () => {
  const time = clock(), gate = deferred();
  const attempt = createFixtureFaultAttempt(plan(), time.api, () => gate.promise);
  let settled = false;
  const decision = attempt.inspect(event()).then(value => { settled = true; return value; });
  time.set(100);
  await flush();
  assert.equal(settled, false);
  assert.equal(attempt.state().phase, "checking");
  assert.equal(attempt.state().executions, 0);
  attempt.cancel();
  assert.equal((await decision).disposition, "blocked");
  gate.resolve();
  await flush();
  assert.equal(attempt.executeFake(event()), false);
});
test("pannes : réservation obtenue à temps mais expirée avant le compteur, jamais exécutée", async () => {
  const time = clock();
  const attempt = createFixtureFaultAttempt(plan(), time.api, () => {});
  await attempt.inspect(event());
  time.set(100);
  assert.equal(attempt.executeFake(event()), false);
  assert.equal(attempt.state().reservations, 1);
  assert.equal(attempt.state().executions, 0);
});
test("pannes : seconde tentative concurrente ferme les deux sans nouvelle réservation", async () => {
  const time = clock(), gate = deferred();
  const attempt = createFixtureFaultAttempt(plan(), time.api, () => gate.promise);
  const first = attempt.inspect(event());
  const second = attempt.inspect({ ...event(), tool_use_id: "other-call" });
  for (const decision of await Promise.all([first, second])) assert.equal(decision.disposition, "blocked");
  gate.resolve();
  await flush();
  assert.equal(attempt.executeFake(event()), false);
  assert.equal(attempt.state().executions, 0);
  assert.equal(attempt.state().reservations, 0);
});
test("pannes : changement de l'appel réservé (ID, session, outil, texte, destinataire) refusé", async () => {
  for (const patch of [{ tool_use_id: "other" }, { session_id: target.sessionId }, { tool_name: "SendMessage" },
    { tool_input: { recipient: target.recipient, text: "changed" } }, { tool_input: { recipient: "other", text: CALIBRATION_TEXT } }]) {
    const attempt = createFixtureFaultAttempt(plan(), clock().api, () => {});
    await attempt.inspect(event());
    assert.equal(attempt.executeFake({ ...event(), ...patch }), false);
    assert.equal(attempt.executeFake(event()), false);
    assert.equal(attempt.state().executions, 0);
  }
});
test("pannes : copie indépendante du plan et de l'événement pendant le contrôle", async () => {
  const time = clock(), gate = deferred(), proposal = event(), originalPlan = plan();
  const attempt = createFixtureFaultAttempt(originalPlan, time.api, () => gate.promise);
  const decision = attempt.inspect(proposal);
  proposal.tool_input.text = "changed";
  originalPlan.target.recipient = "changed";
  gate.resolve();
  assert.equal((await decision).disposition, "continue-permissions");
  assert.equal(attempt.executeFake(proposal), false);
  assert.equal(attempt.state().executions, 0);
});
test("pannes : ordonnanceur ou horloge en erreur et accesseur inconnu restent des refus", async () => {
  for (const api of [
    { now: () => { throw new Error("clock"); }, schedule: clock().api.schedule },
    { now: () => NaN, schedule: clock().api.schedule },
    { now: () => 1, schedule: () => { throw new Error("timer"); } }
  ]) {
    const attempt = createFixtureFaultAttempt(plan(), api, () => {});
    assert.equal((await attempt.inspect(event())).disposition, "blocked");
    assert.equal(attempt.executeFake(event()), false);
    assert.equal(attempt.state().executions, 0);
  }
  let reads = 0;
  const attempt = createFixtureFaultAttempt(plan(), clock().api, () => {});
  assert.equal((await attempt.inspect({ ...event(), get tool_input() { reads++; throw new Error(); } })).disposition, "blocked");
  assert.equal(reads, 0);
});
test("pannes : réveil synchrone ou annulation réentrante pendant le nettoyage, aucun accord tardif", async () => {
  for (const synchronous of [true, false]) {
    let attempt!: ReturnType<typeof createFixtureFaultAttempt>;
    let cleaned = 0;
    const time: FixtureClock = { now: () => 1, schedule: (_delay, expire) => {
      if (synchronous) expire();
      return () => { cleaned++; attempt.cancel(); };
    } };
    attempt = createFixtureFaultAttempt(plan(), time, () => {});
    assert.equal((await attempt.inspect(event())).disposition, "blocked");
    assert.equal(attempt.executeFake(event()), false);
    assert.equal(attempt.state().executions, 0);
    assert.equal(cleaned, 1);
  }
});
test("pannes : exception de nettoyage ferme sans masquer le refus ni exécuter le compteur", async () => {
  const time: FixtureClock = { now: () => 1, schedule: () => () => { throw new Error("cleanup"); } };
  const attempt = createFixtureFaultAttempt(plan(), time, () => {});
  assert.equal((await attempt.inspect(event())).disposition, "blocked");
  assert.equal(attempt.executeFake(event()), false);
  assert.equal(attempt.state().reason, "hook-failed");
  assert.equal(attempt.state().executions, 0);
});
test("pannes : annulation pendant la capture finale ou le dernier relevé d'horloge", async () => {
  for (const duringCapture of [true, false]) {
    let attempt!: ReturnType<typeof createFixtureFaultAttempt>, armed = false;
    const time = clock();
    const api = { ...time.api, now: () => { if (armed && !duringCapture) { armed = false; attempt.cancel(); } return 1; } };
    attempt = createFixtureFaultAttempt(plan(), api, () => {});
    await attempt.inspect(event());
    armed = true;
    const proposal = duringCapture ? new Proxy(event(), { ownKeys(value) { attempt.cancel(); return Reflect.ownKeys(value); } }) : event();
    assert.equal(attempt.executeFake(proposal), false);
    assert.equal(attempt.state().executions, 0);
    assert.equal(attempt.state().reason, "cancelled");
  }
});
test("pannes : réentrée pendant la consommation ferme les deux passages avant incrément", async () => {
  let attempt!: ReturnType<typeof createFixtureFaultAttempt>, armed = false, inner: boolean | undefined;
  const time = clock();
  attempt = createFixtureFaultAttempt(plan(), { ...time.api, now: () => {
    if (armed) { armed = false; inner = attempt.executeFake(event()); }
    return 1;
  } }, () => {});
  await attempt.inspect(event());
  armed = true;
  assert.equal(attempt.executeFake(event()), false);
  assert.equal(inner, false);
  assert.equal(attempt.state().executions, 0);
});
